import { BadRequestException, Injectable, PayloadTooLargeException } from '@nestjs/common';

/**
 * T-115 — Validador reutilizable de adjuntos.
 *
 * Cuatro validaciones independientes, todas con códigos de error de dominio
 * (RFC 7807):
 *   1. Extensión no permitida (ejecutables: `400 EJECUTABLE_NO_PERMITIDO`).
 *   2. MIME declarado no está en la allowlist (`400 ADJUNTO_MIME_INVALIDO`).
 *   3. Tamaño excede el máximo de la plaza (`413 ADJUNTO_TAMANO_EXCEDIDO`).
 *   4. Magic bytes del archivo no coinciden con la firma esperada del MIME
 *      declarado (`400 ADJUNTO_MIME_INVALIDO`, mismo código).
 *
 * El orden es deliberado: primero la extensión (más barato, evita siquiera
 * leer el buffer para un `.exe`), luego MIME, luego tamaño, finalmente magic
 * bytes (es la única que requiere leer bytes del archivo).
 *
 * La validación por magic bytes NO detecta binarios renombrados a extensiones
 * legítimas (e.g. `virus.pdf` con header MZ); sin embargo, el rechazo de
 * ejecutables por extensión (paso 1) cubre el caso de los renombrados que
 * conservan la extensión peligrosa. Un `.exe` con nombre `informe.pdf.exe`
 * cae en el paso 1. Un `.exe` renombrado a `.pdf` cae en el paso 4 (los
 * magic bytes del PDF son `%PDF-` y los del `.exe` son `MZ`).
 */
@Injectable()
export class AdjuntoValidator {
  /** Extensiones siempre rechazadas (S-TamañoMax / criterio de seguridad T-115). */
  private static readonly EXEC_EXTENSIONS = /\.(exe|bat|sh|msi|com|cmd|vbs|js|jar|app|dmg|scr|ps1|psm1)$/i;

  /**
   * Magic bytes por MIME declarado. Cada entrada es la firma mínima en
   * hexadecimal, leída del inicio del buffer. Para MIME que admiten varias
   * firmas (e.g. JPEG con JFIF/Exif) usamos la primera; el caller puede
   * extender con `extraSignatures` si lo necesita.
   *
   * Formato: clave = MIME declarado → array de firmas hex aceptadas.
   */
  private static readonly MAGIC_BYTES: Record<string, string[]> = {
    'application/pdf': ['25504446'], // %PDF
    'image/jpeg': ['ffd8ff'], // JPEG SOI marker
    'image/png': ['89504e470d0a1a0a'], // PNG signature
    'image/webp': ['52494646'], // RIFF (los 4 bytes siguientes son size, luego "WEBP" en offset 8)
    'application/vnd.ms-excel': ['d0cf11e0a1b11ae1'], // OLE2 compound document (legacy XLS)
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['504b0304'], // ZIP/OOXML
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['504b0304'], // ZIP/OOXML
    'application/dwg': ['41433130'], // AC10 (AutoCAD R18+)
    'application/acad': ['41433130'], // Alias histórico de DWG
  };

  /**
   * Valida un archivo completo en el orden definido.
   * Lanza la primera excepción que detecte; si pasa, retorna `void`.
   */
  validateAll(
    file: { buffer: Buffer; mimetype: string; size: number; originalname: string },
    allowedMimes: string[],
    maxBytes: number,
  ): void {
    this.validateExtension(file.originalname);
    this.validateMime(file.mimetype, allowedMimes);
    this.validateSize(file.size, maxBytes);
    this.validateMagicBytes(file.buffer, file.mimetype);
  }

  /** Paso 1: rechaza ejecutables por extensión del nombre. */
  validateExtension(filename: string): void {
    if (AdjuntoValidator.EXEC_EXTENSIONS.test(filename)) {
      throw new BadRequestException({
        code: 'EJECUTABLE_NO_PERMITIDO',
        title: 'Tipo de archivo no permitido',
        message: `La extensión del archivo no está permitida (${filename}).`,
      });
    }
  }

  /** Paso 2: verifica que el MIME declarado esté en la allowlist. */
  validateMime(mimetype: string, allowed: string[]): void {
    if (!Array.isArray(allowed) || allowed.length === 0) {
      throw new BadRequestException({
        code: 'ADJUNTO_MIME_INVALIDO',
        title: 'Tipo de archivo no permitido',
        message: 'La plaza no tiene MIME types configurados.',
      });
    }
    if (!allowed.includes(mimetype)) {
      throw new BadRequestException({
        code: 'ADJUNTO_MIME_INVALIDO',
        title: 'Tipo de archivo no permitido',
        message: `Tipo de archivo no permitido (${mimetype}).`,
      });
    }
  }

  /** Paso 3: verifica tamaño. */
  validateSize(size: number, maxBytes: number): void {
    if (size > maxBytes) {
      throw new PayloadTooLargeException({
        code: 'ADJUNTO_TAMANO_EXCEDIDO',
        title: 'Carga demasiado grande',
        message: `El archivo supera el máximo de ${Math.floor(maxBytes / 1024 / 1024)} MB de la plaza.`,
      });
    }
  }

  /**
   * Paso 4: valida que los magic bytes del buffer coincidan con la firma
   * esperada del MIME declarado. Si el MIME no tiene firma registrada, se
   * permite (defense-in-depth contra los formatos más comunes; un formato
   * exótico sin firma simplemente pasa esta validación).
   *
   * Caso especial: `image/webp` requiere validar también la firma "WEBP" en
   * el offset 8 (porque RIFF es un contenedor genérico).
   */
  validateMagicBytes(buffer: Buffer, declaredMime: string): void {
    const signatures = AdjuntoValidator.MAGIC_BYTES[declaredMime];
    if (!signatures) return; // MIME sin firma conocida → aceptar

    const head = buffer.subarray(0, 16).toString('hex');
    const matches = signatures.some((sig) => head.startsWith(sig));
    if (!matches) {
      throw new BadRequestException({
        code: 'ADJUNTO_MIME_INVALIDO',
        title: 'Tipo de archivo no permitido',
        message: 'El contenido del archivo no coincide con el tipo declarado.',
      });
    }

    // Validación adicional para WEBP: requiere "WEBP" en offset 8.
    if (declaredMime === 'image/webp') {
      const webpMagic = buffer.subarray(8, 12).toString('ascii');
      if (webpMagic !== 'WEBP') {
        throw new BadRequestException({
          code: 'ADJUNTO_MIME_INVALIDO',
          title: 'Tipo de archivo no permitido',
          message: 'El contenido del archivo no coincide con el tipo declarado.',
        });
      }
    }
  }
}

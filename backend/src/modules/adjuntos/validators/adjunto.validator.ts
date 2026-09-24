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
/** Firma binaria: bytes en hex esperados a partir de `offset` (default 0). */
interface MagicSignature {
  hex: string;
  offset?: number;
}

@Injectable()
export class AdjuntoValidator {
  /** Extensiones siempre rechazadas (S-TamañoMax / criterio de seguridad T-115). */
  private static readonly EXEC_EXTENSIONS = /\.(exe|bat|sh|msi|com|cmd|vbs|js|jar|app|dmg|scr|ps1|psm1)$/i;

  /**
   * Magic bytes por MIME declarado. Cada firma es la secuencia mínima en
   * hexadecimal leída desde `offset` (por defecto 0). Para MIME que admiten
   * varias firmas (e.g. QuickTime con distintos átomos iniciales) se listan
   * todas; basta con que una coincida.
   *
   * Contenedores ISO BMFF (MP4/MOV): los 4 primeros bytes son el tamaño del
   * primer átomo, por eso la firma `ftyp` va en offset 4.
   */
  private static readonly MAGIC_BYTES: Record<string, MagicSignature[]> = {
    'application/pdf': [{ hex: '25504446' }], // %PDF
    'image/jpeg': [{ hex: 'ffd8ff' }], // JPEG SOI marker
    'image/png': [{ hex: '89504e470d0a1a0a' }], // PNG signature
    'image/webp': [{ hex: '52494646' }], // RIFF (los 4 bytes siguientes son size, luego "WEBP" en offset 8)
    'application/vnd.ms-excel': [{ hex: 'd0cf11e0a1b11ae1' }], // OLE2 compound document (legacy XLS)
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [{ hex: '504b0304' }], // ZIP/OOXML
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [{ hex: '504b0304' }], // ZIP/OOXML
    'application/dwg': [{ hex: '41433130' }], // AC10 (AutoCAD R18+)
    'application/acad': [{ hex: '41433130' }], // Alias histórico de DWG
    'video/mp4': [{ hex: '66747970', offset: 4 }], // ....ftyp
    'video/quicktime': [
      { hex: '66747970', offset: 4 }, // ftyp (QuickTime moderno, brand "qt  ")
      { hex: '6d6f6f76', offset: 4 }, // moov
      { hex: '6d646174', offset: 4 }, // mdat
      { hex: '77696465', offset: 4 }, // wide
      { hex: '66726565', offset: 4 }, // free
      { hex: '736b6970', offset: 4 }, // skip
    ],
    'video/webm': [{ hex: '1a45dfa3' }], // EBML header (DocType "webm" validado aparte)
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
   * Casos especiales: `image/webp` requiere validar también la firma "WEBP" en
   * el offset 8 (porque RIFF es un contenedor genérico) y `video/webm` el
   * DocType "webm" (porque la cabecera EBML es compartida con Matroska).
   */
  validateMagicBytes(buffer: Buffer, declaredMime: string): void {
    const signatures = AdjuntoValidator.MAGIC_BYTES[declaredMime];
    if (!signatures) return; // MIME sin firma conocida → aceptar

    const matches = signatures.some(({ hex, offset = 0 }) => {
      const len = hex.length / 2;
      return buffer.length >= offset + len && buffer.toString('hex', offset, offset + len) === hex;
    });
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

    // Validación adicional para WebM: la cabecera EBML es compartida con
    // Matroska (.mkv); se exige el DocType "webm" en los primeros 64 bytes.
    if (declaredMime === 'video/webm') {
      const ebmlHead = buffer.subarray(0, 64).toString('latin1');
      if (!ebmlHead.includes('webm')) {
        throw new BadRequestException({
          code: 'ADJUNTO_MIME_INVALIDO',
          title: 'Tipo de archivo no permitido',
          message: 'El contenido del archivo no coincide con el tipo declarado.',
        });
      }
    }
  }
}

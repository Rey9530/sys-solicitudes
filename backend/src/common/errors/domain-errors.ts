import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * T-152: catálogo CENTRAL de errores de dominio (RFC 7807, docs/07 §4.5).
 *
 * Inventario completo de los códigos que hoy lanzan los services de los
 * módulos 02-11 (relevados en el survey del módulo 12). Los throws actuales
 * (`new XxxException({ code, title, message })`) ya cumplen el formato vía
 * `AllExceptionsFilter`; este catálogo + `DomainException` son la forma
 * CANÓNICA para código nuevo (decisión owner 2026-06-07: sin refactor masivo).
 */
export interface DomainErrorDef {
  status: HttpStatus;
  title: string;
  /** Detalle por defecto cuando el throw no aporta uno específico. */
  detailTemplate: string;
}

export const DOMAIN_ERRORS = {
  // ── Auth (módulo 02) ────────────────────────────────────────────────────────
  INVALID_CREDENTIALS: d(401, 'Credenciales inválidas', 'Email o contraseña incorrectos.'),
  ACCOUNT_LOCKED: d(423, 'Cuenta bloqueada', 'La cuenta está bloqueada temporalmente por intentos fallidos.'),
  TOKEN_EXPIRED: d(401, 'Token expirado', 'El token de acceso expiró; refresca la sesión.'),
  TOKEN_INVALID: d(401, 'Token inválido', 'El token de acceso no es válido.'),
  TOKEN_MISSING_SIGNATURE: d(401, 'Token inválido', 'El token no tiene una firma válida.'),
  REFRESH_EXPIRED: d(401, 'Sesión expirada', 'El refresh token expiró; inicia sesión de nuevo.'),
  REFRESH_INVALID: d(401, 'Sesión inválida', 'El refresh token no es válido o fue revocado.'),
  RESET_TOKEN_INVALID: d(400, 'Token de reset inválido', 'El enlace de restablecimiento no es válido o expiró.'),
  INVALID_CURRENT_PASSWORD: d(400, 'Contraseña actual incorrecta', 'La contraseña actual no coincide.'),
  USER_NOT_FOUND: d(404, 'Recurso no encontrado', 'El usuario no existe.'),

  // ── Guards transversales ───────────────────────────────────────────────────
  ROLE_FORBIDDEN: d(403, 'Acceso denegado', 'Tu rol no tiene permiso para esta operación.'),
  FORBIDDEN_ROLE: d(403, 'Acceso denegado', 'Tu rol no tiene permiso para esta operación.'),
  PLAZA_SCOPE_VIOLATION: d(403, 'Acceso denegado', 'Esta operación requiere un usuario con plaza asignada.'),
  INQUILINO_SCOPE_VIOLATION: d(403, 'Acceso denegado', 'El usuario inquilino no tiene inquilino asociado.'),
  PLAZA_REQUERIDA: d(400, 'Solicitud inválida', 'La operación requiere una plaza.'),
  VALIDATION_ERROR: d(400, 'Solicitud inválida', 'El cuerpo de la petición no pasa la validación.'),
  NOT_FOUND: d(404, 'Recurso no encontrado', 'El recurso no existe.'),

  // ── Plazas / usuarios / configuración (módulos 02-03) ─────────────────────
  PLAZA_NOT_FOUND: d(404, 'Recurso no encontrado', 'La plaza no existe.'),
  PLAZA_SLUG_TAKEN: d(409, 'Conflicto con el estado actual', 'Ya existe una plaza con ese slug.'),
  LOGO_REQUERIDO: d(400, 'Solicitud inválida', 'Falta el archivo de logo (campo "file").'),
  CONFIGURACION_NOT_FOUND: d(404, 'Recurso no encontrado', 'La configuración de la plaza no existe.'),
  USUARIO_EMAIL_DUPLICADO: d(409, 'Conflicto con el estado actual', 'Ya existe un usuario con ese email en la plaza.'),
  USUARIO_NO_ENCONTRADO: d(404, 'Recurso no encontrado', 'El usuario no existe en esta plaza.'),
  ROL_NO_PERMITIDO: d(400, 'Solicitud inválida', 'El rol indicado no se puede asignar por API.'),
  ROL_STAFF_NO_EXISTE: d(400, 'Solicitud inválida', 'El rol de staff no existe o está inactivo.'),
  ROL_STAFF_REQUERIDO: d(400, 'Solicitud inválida', 'Un usuario admin_plaza requiere rolStaffId.'),
  INQUILINO_REQUERIDO: d(400, 'Solicitud inválida', 'Un usuario inquilino requiere inquilinoId.'),

  // ── Locales / inquilinos / contratos (módulo 04) ───────────────────────────
  LOCAL_NOT_FOUND: d(404, 'Recurso no encontrado', 'El local no existe.'),
  LOCAL_NO_ENCONTRADO: d(404, 'Recurso no encontrado', 'El local no existe en esta plaza.'),
  LOCAL_CODIGO_DUPLICADO: d(409, 'Conflicto con el estado actual', 'Ya existe un local con ese código en la plaza.'),
  LOCAL_HAS_ACTIVE_CONTRACT: d(409, 'Conflicto con el estado actual', 'El local tiene un contrato vigente.'),
  LOCAL_NO_DISPONIBLE: d(409, 'Conflicto con el estado actual', 'El local no está disponible.'),
  LOCAL_NO_DEL_INQUILINO: d(403, 'Acceso denegado', 'El local no pertenece al inquilino.'),
  INQUILINO_NOT_FOUND: d(404, 'Recurso no encontrado', 'El inquilino no existe.'),
  INQUILINO_NO_ENCONTRADO: d(404, 'Recurso no encontrado', 'El inquilino no existe en esta plaza.'),
  INQUILINO_IDENTIFICACION_DUPLICADA: d(409, 'Conflicto con el estado actual', 'Ya existe un inquilino con esa identificación.'),
  INQUILINO_HAS_ACTIVE_CONTRACT: d(409, 'Conflicto con el estado actual', 'El inquilino tiene contratos vigentes.'),
  CONTRATO_OVERLAP: d(409, 'Conflicto con el estado actual', 'El rango del contrato se solapa con otro vigente del mismo local.'),
  INVALID_DATE: d(400, 'Solicitud inválida', 'La fecha indicada no es válida.'),

  // ── Categorías (módulo 05) ─────────────────────────────────────────────────
  CATEGORIA_HAS_ACTIVE_SUBCATEGORIAS: d(409, 'Conflicto con el estado actual', 'La categoría tiene subcategorías activas.'),
  SUBCATEGORIA_NOT_FOUND: d(404, 'Recurso no encontrado', 'La subcategoría no existe.'),
  SUBCATEGORIA_INACTIVA: d(409, 'Conflicto con el estado actual', 'La subcategoría está inactiva.'),
  SUBCATEGORIA_REQUERIDA: d(400, 'Solicitud inválida', 'El tipo de solicitud requiere subcategoría.'),
  SUBCATEGORIA_MAX_5_SUPERVISORES: d(409, 'Conflicto con el estado actual', 'La subcategoría ya tiene 5 supervisores.'),

  // ── Solicitudes y aprobaciones (módulos 06-07) ─────────────────────────────
  SOLICITUD_NOT_FOUND: d(404, 'Recurso no encontrado', 'La solicitud no existe.'),
  INVALID_STATE_TRANSITION: d(400, 'Solicitud inválida', 'La transición de estado no es válida.'),
  INVALID_STATE_FOR_EDIT: d(409, 'Conflicto con el estado actual', 'La solicitud no se puede editar en su estado actual.'),
  NOT_ASSIGNED_ADMIN: d(403, 'Acceso denegado', 'Solo el administrador asignado puede operar esta solicitud.'),
  SAME_ASSIGNEE: d(400, 'Solicitud inválida', 'La solicitud ya está asignada a ese administrador.'),
  COMENTARIO_REQUERIDO: d(400, 'Solicitud inválida', 'La operación requiere un comentario no vacío.'),
  COMENTARIO_TIPO_FORBIDDEN: d(403, 'Acceso denegado', 'Tu rol no puede crear comentarios de ese tipo.'),
  CAMPOS_EXTRA_INVALIDOS: d(400, 'Solicitud inválida', 'Los campos extra no corresponden al tipo de solicitud.'),
  CANNOT_APPROVE_OWN_REQUEST: d(403, 'Acceso denegado', 'Un administrador no puede aprobar su propia solicitud (SC-4).'),
  CANNOT_REJECT_OWN_REQUEST: d(403, 'Acceso denegado', 'Un administrador no puede rechazar su propia solicitud (SC-4).'),

  // ── Adjuntos (módulo 08) ───────────────────────────────────────────────────
  ADJUNTO_MIME_INVALIDO: d(400, 'Solicitud inválida', 'El tipo de archivo no está permitido.'),
  ADJUNTO_DEMASIADO_GRANDE: d(413, 'Carga demasiado grande', 'El archivo supera el tamaño máximo configurado.'),
  ADJUNTO_TAMANO_EXCEDIDO: d(413, 'Carga demasiado grande', 'El archivo supera el tamaño máximo configurado.'),
  ADJUNTO_REQUERIDO: d(400, 'Solicitud inválida', 'Falta el archivo (campo "file").'),
  ADJUNTO_DELETE_FORBIDDEN: d(403, 'Acceso denegado', 'No puedes eliminar este adjunto.'),
  MAX_ADJUNTOS_EXCEDIDO: d(409, 'Conflicto con el estado actual', 'La solicitud ya tiene el máximo de adjuntos.'),
  MIME_NO_PERMITIDO: d(400, 'Solicitud inválida', 'El tipo de archivo no está permitido.'),
  EJECUTABLE_NO_PERMITIDO: d(400, 'Solicitud inválida', 'Los archivos ejecutables no están permitidos.'),
  UPLOAD_FORBIDDEN: d(403, 'Acceso denegado', 'No puedes subir adjuntos a este recurso.'),

  // ── Notificaciones (módulo 09) ─────────────────────────────────────────────
  EMAIL_LOG_NO_ENCONTRADO: d(404, 'Recurso no encontrado', 'El registro de email no existe en esta plaza.'),
  EMAIL_NO_REINTENTABLE: d(400, 'Solicitud inválida', 'El email no admite reintento.'),
  PLANTILLA_DESCONOCIDA: d(500, 'Error interno del servidor', 'La plantilla de email no existe en el registro.'),
  UNSUBSCRIBE_TOKEN_INVALIDO: d(400, 'Token inválido', 'El enlace de desuscripción no es válido o expiró.'),
  UNSUBSCRIBE_NO_ENCONTRADO: d(404, 'Recurso no encontrado', 'La desuscripción no existe en esta plaza.'),

  // ── Calendario (módulo 10) ─────────────────────────────────────────────────
  EVENTO_NO_ENCONTRADO: d(404, 'Recurso no encontrado', 'El evento de calendario no existe en esta plaza.'),
  RANGO_INVALIDO: d(400, 'Solicitud inválida', 'El rango de fechas no es válido.'),

  // ── Reportes (módulo 11) ───────────────────────────────────────────────────
  JSREPORT_ERROR: d(502, 'Error del servicio de reportes', 'No se pudo generar el reporte.'),
  ENTIDAD_INVALIDA: d(400, 'Solicitud inválida', 'Entidad de reporte desconocida.'),
  FILTROS_INVALIDOS: d(400, 'Solicitud inválida', 'Los filtros del reporte no son válidos.'),
  RANGO_EXCEDIDO: d(413, 'Rango demasiado grande', 'El rango máximo de exportación es 12 meses.'),
  REPORTE_DEMASIADO_GRANDE: d(413, 'Reporte demasiado grande', 'El reporte supera el máximo de filas; reduce el rango.'),

  // ── Permisos / RBAC granular (módulo 14, T-RBAC-1) ─────────────────────────
  PERMISSION_DENIED: d(403, 'Acceso denegado', 'No tienes permiso para realizar esta acción.'),
  ROL_SISTEMA_NO_MODIFICABLE: d(409, 'Conflicto con el estado actual', 'El rol del sistema es inamovible; no se puede modificar su código, nombre ni plaza.'),
  ROL_SISTEMA_NO_BORRABLE: d(409, 'Conflicto con el estado actual', 'El rol del sistema es inamovible; no se puede eliminar.'),
  PERMISO_NO_ENCONTRADO: d(404, 'Recurso no encontrado', 'El permiso no existe en el catálogo.'),
} satisfies Record<string, DomainErrorDef>;

export type DomainErrorCode = keyof typeof DOMAIN_ERRORS;

/**
 * Excepción canónica de dominio (T-152). El `AllExceptionsFilter` la traduce
 * al envelope RFC 7807 (`type`, `title`, `status`, `detail`, `instance`,
 * `code`, `requestId`).
 *
 *   throw new DomainException('CONTRATO_OVERLAP',
 *     `El contrato se solapa con ${otro.id}.`, { contratoId: otro.id });
 */
export class DomainException extends HttpException {
  constructor(code: DomainErrorCode, detail?: string, meta?: Record<string, unknown>) {
    const def = DOMAIN_ERRORS[code];
    super(
      {
        code,
        title: def.title,
        message: detail ?? def.detailTemplate,
        ...(meta ? { meta } : {}),
      },
      def.status,
    );
  }
}

function d(status: number, title: string, detailTemplate: string): DomainErrorDef {
  return { status: status as HttpStatus, title, detailTemplate };
}

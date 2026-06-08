import { SetMetadata } from '@nestjs/common';

export const AUDITABLE_KEY = 'auditable';
export const SKIP_AUDITORIA_KEY = 'skipAuditoria';

export interface AuditableOptions {
  /** Acción en formato `entidad.verbo` (e.g. `auth.password_reset`). */
  accion: string;
  entidadTipo: string;
  /**
   * Nombre del param de ruta con el ID de la entidad (default `id`).
   * Para PATCH/DELETE el interceptor intenta capturar el `antes` con un
   * SELECT genérico sobre el modelo Prisma `entidadTipo`.
   */
  paramId?: string;
  /** Extrae el entidad_id de la response (e.g. en POST de creación). */
  getIdFromResponse?: (response: unknown) => string | null;
  /**
   * No persistir el body de la request como `despues` (default false).
   * Úsese en endpoints con credenciales; además el interceptor SIEMPRE
   * redacta llaves sensibles (password, token, etc.).
   */
  omitirBody?: boolean;
}

/**
 * T-150: marca un endpoint POST/PATCH/DELETE para captura automática de
 * auditoría por `AuditoriaInterceptor`. El interceptor es OPT-IN: sin este
 * decorador no captura nada (los services con auditoría manual rica de los
 * módulos 02-11 se mantienen — decisión owner 2026-06-07, sin duplicación).
 */
export const Auditable = (options: AuditableOptions): MethodDecorator & ClassDecorator =>
  SetMetadata(AUDITABLE_KEY, options);

/**
 * Excluye explícitamente un endpoint de la captura automática (e.g. health
 * checks, endpoints dev de cron). Documental hoy (el interceptor es opt-in),
 * vinculante si algún día se pasa a opt-out.
 */
export const SkipAuditoria = (): MethodDecorator & ClassDecorator =>
  SetMetadata(SKIP_AUDITORIA_KEY, true);

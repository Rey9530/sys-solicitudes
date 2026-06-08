import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
  AUDITABLE_KEY,
  SKIP_AUDITORIA_KEY,
  type AuditableOptions,
} from '../decorators/auditable.decorator';
import { AuditoriaService } from '../../modules/auditoria/auditoria.service';
import { PrismaAdminService } from '../../prisma/prisma-admin.service';
import type { AuthenticatedUser } from '../../modules/auth/types/jwt-payload';

/** Llaves que NUNCA se persisten en auditoría (SEC-7). */
const LLAVES_SENSIBLES = new Set([
  'password',
  'passwordactual',
  'passwordnueva',
  'token',
  'refreshtoken',
  'accesstoken',
  'secret',
  'authorization',
]);

const METODOS_MUTACION = new Set(['POST', 'PATCH', 'DELETE']);

/**
 * T-150 (SEC-7): captura automática de auditoría en POST/PATCH/DELETE.
 *
 * OPT-IN vía `@Auditable({ accion, entidadTipo, ... })` (decisión owner:
 * los módulos 02-11 ya auditan manualmente desde sus services con
 * antes/después curados; este interceptor cubre los huecos y es el patrón
 * oficial para endpoints nuevos). `@SkipAuditoria()` excluye explícitamente.
 *
 * - PATCH/DELETE: `antes` = SELECT genérico del modelo Prisma `entidadTipo`
 *   por el param de ruta (best-effort; si el modelo no existe queda null).
 * - POST: `antes` = null; `despues` = body redactado (o la response si hay
 *   `getIdFromResponse`). DELETE: `despues` = null.
 * - Si el handler lanza, NO se inserta (solo queda el log de pino del filter).
 */
@Injectable()
export class AuditoriaInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditoriaInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditoria: AuditoriaService,
    private readonly prismaAdmin: PrismaAdminService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const opts = this.reflector.getAllAndOverride<AuditableOptions | undefined>(AUDITABLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_AUDITORIA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser; id?: string }>();

    if (!opts || skip || !METODOS_MUTACION.has(request.method)) {
      return next.handle();
    }

    const entidadId = (request.params?.[opts.paramId ?? 'id'] as string | undefined) ?? null;
    const antes =
      request.method === 'POST' ? null : await this.snapshotAntes(opts.entidadTipo, entidadId);

    return next.handle().pipe(
      tap((response) => {
        const user = request.user;
        const idFinal =
          entidadId ?? (opts.getIdFromResponse ? opts.getIdFromResponse(response) : null);
        const despues =
          request.method === 'DELETE'
            ? null
            : opts.omitirBody
              ? null
              : this.redactar((request.body as Record<string, unknown>) ?? null);
        // Best-effort: un fallo al auditar no debe tumbar la respuesta.
        void this.auditoria.record({
          accion: opts.accion,
          entidadTipo: opts.entidadTipo,
          entidadId: idFinal,
          plazaId: user?.plazaId ?? null,
          usuarioId: user?.sub ?? null,
          antes,
          despues,
          ip: request.ip ?? null,
          userAgent: request.headers['user-agent'] ?? null,
          requestId:
            request.id ?? (request.headers['x-request-id'] as string | undefined) ?? null,
        });
      }),
    );
  }

  /** SELECT genérico best-effort del estado previo (PATCH/DELETE). */
  private async snapshotAntes(entidadTipo: string, id: string | null): Promise<unknown> {
    if (!id) return null;
    try {
      const modelo = (
        this.prismaAdmin as unknown as Record<
          string,
          { findUnique?: (args: { where: { id: string } }) => Promise<unknown> }
        >
      )[entidadTipo];
      if (!modelo?.findUnique) return null;
      const fila = await modelo.findUnique({ where: { id } });
      return fila ? this.redactar(fila as Record<string, unknown>) : null;
    } catch (err) {
      this.logger.warn(`snapshot 'antes' de ${entidadTipo}/${id} falló: ${String(err)}`);
      return null;
    }
  }

  /** Elimina llaves sensibles (case-insensitive) de un objeto plano. */
  private redactar(obj: Record<string, unknown> | null): Record<string, unknown> | null {
    if (!obj || typeof obj !== 'object') return obj;
    const limpio: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      limpio[k] = LLAVES_SENSIBLES.has(k.toLowerCase()) ? '[REDACTADO]' : v;
    }
    return limpio;
  }
}

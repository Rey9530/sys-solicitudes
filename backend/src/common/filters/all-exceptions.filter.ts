import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Filtro global que convierte TODA excepción a un formato RFC 7807
 * con códigos de dominio. Detalles: ver PLANIFICACION/12-seguridad-auditoria.md (T-152).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();

    const requestId = (request.id ?? '') as string;
    const path = request.url ?? '';
    const method = request.method ?? '';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let title = 'Error interno del servidor';
    let detail = 'Ha ocurrido un error inesperado. Por favor intente de nuevo.';
    let meta: Record<string, unknown> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const responseObj = typeof exceptionResponse === 'string'
        ? { message: exceptionResponse }
        : (exceptionResponse as Record<string, unknown>);

      code = (responseObj.code as string) ?? this.statusToCode(status);
      title = (responseObj.title as string) ?? this.statusToTitle(status);
      detail = (responseObj.message as string) ?? (responseObj.detail as string) ?? title;
      meta = responseObj.meta as Record<string, unknown> | undefined;
    } else if (exception instanceof Error) {
      // Error no controlado: loguear stack completo (Sentry cuando esté disponible)
      this.logger.error(
        `[${requestId}] ${method} ${path} → 500 ${exception.name}: ${exception.message}`,
        exception.stack,
      );
    }

    // No exponer stack ni detalles internos en 4xx
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${requestId}] ${method} ${path} → ${status} ${code}: ${detail}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(
        `[${requestId}] ${method} ${path} → ${status} ${code}: ${detail}`,
      );
    }

    response.status(status).json({
      type: `https://plazapp.com/errors/${code.toLowerCase().replace(/_/g, '-')}`,
      title,
      status,
      detail,
      instance: path,
      code,
      requestId,
      ...(meta ? { meta } : {}),
    });
  }

  private statusToCode(status: number): string {
    const map: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      413: 'PAYLOAD_TOO_LARGE',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_ERROR',
      502: 'BAD_GATEWAY',
      503: 'SERVICE_UNAVAILABLE',
    };
    return map[status] ?? 'ERROR';
  }

  private statusToTitle(status: number): string {
    const map: Record<number, string> = {
      400: 'Solicitud inválida',
      401: 'No autenticado',
      403: 'Acceso denegado',
      404: 'Recurso no encontrado',
      409: 'Conflicto con el estado actual',
      413: 'Carga demasiado grande',
      422: 'Entidad no procesable',
      429: 'Demasiadas solicitudes',
      500: 'Error interno del servidor',
      502: 'Gateway incorrecto',
      503: 'Servicio no disponible',
    };
    return map[status] ?? 'Error';
  }
}

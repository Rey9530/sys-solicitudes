import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Filtro específico para HttpException: usa el código `code` del response si existe,
 * o genera uno a partir del status. Complementa al AllExceptionsFilter.
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();
    // T-152: instance + requestId en TODOS los caminos del envelope RFC 7807.
    const instance = request.url ?? '';
    const requestId = (request.id ?? request.headers['x-request-id'] ?? '') as string;
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();
    const responseObj = typeof exceptionResponse === 'string'
      ? { message: exceptionResponse }
      : (exceptionResponse as Record<string, unknown>);

    const code = (responseObj.code as string) ?? null;
    const message = (responseObj.message as string | string[]) ?? exception.message;
    const meta = responseObj.meta as Record<string, unknown> | undefined;

    // Si ya viene en formato RFC 7807, lo reenviamos completándolo
    if (code && responseObj.title) {
      response.status(status).json({
        type: `https://plazapp.com/errors/${code.toLowerCase().replace(/_/g, '-')}`,
        ...responseObj,
        detail: (responseObj.message as string) ?? (responseObj.detail as string),
        status,
        instance,
        requestId,
      });
      return;
    }

    const detail = Array.isArray(message) ? message.join('; ') : message;
    this.logger.warn(`HTTP ${status} ${code ?? 'NO_CODE'}: ${detail}`);

    response.status(status).json({
      type: `https://plazapp.com/errors/${(code ?? `http-${status}`).toLowerCase().replace(/_/g, '-')}`,
      title: this.statusToTitle(status),
      status,
      detail,
      instance,
      code: code ?? this.statusToCode(status),
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
    };
    return map[status] ?? 'Error';
  }
}

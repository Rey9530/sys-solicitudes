import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

/**
 * Filtro específico para errores de Prisma (PrismaClientKnownRequestError +
 * PrismaClientValidationError). Mapea códigos canónicos a envelopes RFC 7807
 * con códigos de dominio. Complementa a `AllExceptionsFilter` (que captura
 * cualquier excepción no controlada).
 *
 * Orden de registro: este filtro debe ir ANTES de `AllExceptionsFilter` en
 * `main.ts` (NestJS evalúa los filtros en orden; el primer `@Catch` que
 * coincida gana). `@Catch(PrismaClientKnownRequestError, PrismaClientValidationError)`
 * filtra específicamente por tipo.
 *
 * Detalle de códigos Prisma:
 *  - P2002: unique constraint violation. `meta.target` indica la(s) columna(s).
 *  - P2003: foreign key constraint violation. `meta.field_name` indica el campo.
 *  - P2025: record not found (operación esperaba al menos 1 fila).
 *  - P2010..P2030: errores varios, generalmente bugs del código de aplicación.
 */
@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientValidationError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();
    const requestId = (request.id ?? '') as string;
    const path = request.url ?? '';
    const method = request.method ?? '';

    let status: number;
    let code: string;
    let detail: string;
    let title: string;

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002': {
          status = HttpStatus.CONFLICT;
          code = this.uniqueConstraintCode(exception.meta);
          title = 'Conflicto con el estado actual';
          detail = this.uniqueConstraintDetail(exception.meta);
          break;
        }
        case 'P2003': {
          status = HttpStatus.BAD_REQUEST;
          code = 'FK_VIOLATION';
          title = 'Violación de llave foránea';
          detail = `El registro referencia un valor que no existe${
            exception.meta?.field_name ? ` (campo: ${String(exception.meta.field_name)})` : ''
          }.`;
          break;
        }
        case 'P2025': {
          status = HttpStatus.NOT_FOUND;
          code = 'RECORD_NOT_FOUND';
          title = 'Recurso no encontrado';
          detail =
            typeof exception.meta?.cause === 'string'
              ? exception.meta.cause
              : 'El registro solicitado no existe o fue eliminado.';
          break;
        }
        default: {
          status = HttpStatus.INTERNAL_SERVER_ERROR;
          code = `PRISMA_${exception.code}`;
          title = 'Error de base de datos';
          detail = `Error Prisma ${exception.code}: revise los datos enviados.`;
          break;
        }
      }
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      code = 'PRISMA_VALIDATION';
      title = 'Datos inválidos para la base de datos';
      detail =
        'Los datos enviados no cumplen el esquema de Prisma. Revise tipos y campos requeridos.';
    } else {
      // Nunca debería llegar aquí (Catch filtra), pero defensa.
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      code = 'PRISMA_UNKNOWN';
      title = 'Error de Prisma';
      detail = 'Ha ocurrido un error inesperado de base de datos.';
    }

    this.logger.error(
      `[${requestId}] ${method} ${path} → ${status} ${code}: ${detail}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    const prismaCode =
      exception instanceof Prisma.PrismaClientKnownRequestError ? exception.code : undefined;

    response.status(status).json({
      type: `https://plazapp.com/errors/${code.toLowerCase().replace(/_/g, '-')}`,
      title,
      status,
      detail,
      instance: path,
      code,
      requestId,
      ...(prismaCode ? { prismaCode } : {}),
    });
  }

  /**
   * Genera un código de dominio legible a partir del `meta.target` de P2002.
   * Si no podemos inferir el constraint, devolvemos `UNIQUE_VIOLATION` genérico.
   */
  private uniqueConstraintCode(meta: Prisma.PrismaClientKnownRequestError['meta']): string {
    const target = meta?.target;
    const fields = Array.isArray(target) ? target.map(String) : [];
    const signature = fields.join(',');

    // Mapea pares de campos comunes a códigos de dominio existentes en el sistema.
    const KNOWN: Record<string, string> = {
      'plaza_id,codigo': 'UNIQUE_PLAZA_CODIGO',
      'plaza_id,nombre': 'UNIQUE_PLAZA_NOMBRE',
      'plaza_id,email': 'USUARIO_EMAIL_DUPLICADO',
      'codigo': 'UNIQUE_CODIGO',
    };
    if (KNOWN[signature]) return KNOWN[signature];

    // Heurística por un solo campo.
    if (fields.length === 1) {
      const f = fields[0];
      if (f === 'email') return 'USUARIO_EMAIL_DUPLICADO';
      if (f === 'codigo') return 'CODIGO_DUPLICADO';
      return `UNIQUE_${(f ?? '').toUpperCase()}`;
    }
    return 'UNIQUE_VIOLATION';
  }

  private uniqueConstraintDetail(meta: Prisma.PrismaClientKnownRequestError['meta']): string {
    const target = meta?.target;
    const fields = Array.isArray(target) ? target.map(String) : [];
    if (fields.length > 0) {
      return `Ya existe un registro con los mismos valores en: ${fields.join(', ')}.`;
    }
    return 'Ya existe un registro con esos valores únicos.';
  }
}
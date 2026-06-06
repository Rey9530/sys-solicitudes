import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import type { ZodType } from 'zod';

/**
 * Pipe que valida/parsea un valor con un schema Zod de `@app/contracts`.
 * En error lanza 400 con código `VALIDATION_ERROR` (formato RFC 7807 vía el filter).
 *
 * Uso: `@Body(new ZodValidationPipe(LoginSchema)) body: LoginInput`.
 * Materializa D7 (validación compartida FE/BE). Detalles: PLANIFICACION/02 (T-022).
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}

  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        title: 'Solicitud inválida',
        message: result.error.issues.map(
          (issue) => `${issue.path.join('.') || '(raíz)'}: ${issue.message}`,
        ),
        meta: { issues: result.error.issues },
      });
    }
    return result.data;
  }
}

import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';

/**
 * Throttler por IP real del cliente detrás de un proxy/CDN.
 *
 * Usa `req.ip`, que Express resuelve con `trust proxy` (ver main.ts): toma la
 * dirección más a la derecha de `X-Forwarded-For` que no sea un proxy confiable.
 * Antes se usaba el PRIMER hop de `X-Forwarded-For`, que el cliente controla
 * (evasión trivial del rate limit) y que no existía en las llamadas del BFF de
 * Next.js, por lo que todos los usuarios compartían el mismo contador.
 *
 * Detalles: PLANIFICACION/01-setup-base.md (T-014).
 *
 * Throttler v6 cambió la API: `getTracker(req)` ahora es `getTracker(req, _ctx)`.
 */
@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  protected override getTracker(req: Record<string, unknown>): Promise<string> {
    const r = req as unknown as Request;
    return Promise.resolve(r.ip || r.socket?.remoteAddress || 'unknown');
  }
}

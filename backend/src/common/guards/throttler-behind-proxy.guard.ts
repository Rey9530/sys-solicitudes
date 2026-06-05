import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';

/**
 * Throttler que lee la IP real del cliente detrás de un proxy/CDN.
 * Usa `X-Forwarded-For` (primer hop) si está presente, si no usa `req.ip`.
 *
 * Detalles: PLANIFICACION/01-setup-base.md (T-014).
 *
 * Throttler v6 cambió la API: `getTracker(req)` ahora es `getTracker(req, _ctx)`.
 * Esta implementación extrae solo la IP ignorando el contexto.
 */
@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  protected override getTracker(req: Record<string, unknown>): Promise<string> {
    const r = req as unknown as Request;
    const xff = r.headers?.['x-forwarded-for'];
    const ip =
      (typeof xff === 'string' && xff.split(',')[0]?.trim()) ||
      r.ip ||
      r.socket?.remoteAddress ||
      'unknown';
    return Promise.resolve(ip);
  }
}

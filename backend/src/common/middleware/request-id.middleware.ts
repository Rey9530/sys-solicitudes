import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';

/**
 * Asigna un `requestId` (UUID v4) a cada request entrante.
 * Si el cliente envía `x-request-id` se respeta; si no, se genera uno nuevo.
 * El ID se expone en el response header `x-request-id` para correlación.
 *
 * Ver PLANIFICACION/01-setup-base.md (T-013) y 13-observabilidad-despliegue.md (T-153).
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers['x-request-id'];
  const id = typeof incoming === 'string' && incoming.length > 0 && incoming.length <= 128
    ? incoming
    : randomUUID();
  (req as Request & { id: string }).id = id;
  res.setHeader('x-request-id', id);
  next();
}

/**
 * Noop temporal para que el import de main.ts no falle.
 * Se invoca el middleware en main.ts mediante `app.use(requestIdMiddleware)`.
 */
export function setupRequestContext(): void {
  // placeholder
}

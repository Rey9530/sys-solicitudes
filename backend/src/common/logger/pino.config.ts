import { randomUUID } from 'node:crypto';
import type { Params } from 'nestjs-pino';
import type { IncomingMessage, ServerResponse } from 'node:http';

interface RequestWithUser extends IncomingMessage {
  user?: { sub?: string; plazaId?: string; rol?: string };
}

/**
 * Configuración central del logger pino. Usada por `LoggerModule.forRootAsync`
 * en `app.module.ts` (T-013).
 *
 * Comportamiento:
 *   - Producción: JSON estructurado a stdout.
 *   - Desarrollo: pino-pretty (una línea, color, timestamp legible).
 *   - Redacción automática de: authorization, cookie, password, token, refreshToken, accessToken.
 *   - Cada log incluye `requestId`, `userId`, `plazaId` si están disponibles.
 *
 * Detalles: PLANIFICACION/01-setup-base.md (T-013) y 13-observabilidad-despliegue.md (T-153).
 */
export function buildPinoOptions(): Params {
  return {
    pinoHttp: {
      level: process.env.LOG_LEVEL ?? 'info',
      genReqId: (req: IncomingMessage, res: ServerResponse): string => {
        const incoming = req.headers['x-request-id'];
        const id =
          (typeof incoming === 'string' && incoming.length > 0 && incoming.length <= 128
            ? incoming
            : randomUUID()) as string;
        res.setHeader('x-request-id', id);
        return id;
      },
      transport:
        process.env.NODE_ENV === 'production'
          ? undefined
          : {
              target: 'pino-pretty',
              options: {
                singleLine: true,
                translateTime: 'HH:MM:ss.l',
                colorize: true,
                ignore: 'pid,hostname',
              },
            },
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.headers["x-plaza-slug"]',
          '*.password',
          '*.passwordHash',
          '*.token',
          '*.refreshToken',
          '*.accessToken',
          '*.newPassword',
          '*.currentPassword',
        ],
        remove: false,
        censor: '[REDACTED]',
      },
      customProps: (req) => {
        const r = req as RequestWithUser;
        return {
          userId: r.user?.sub,
          plazaId: r.user?.plazaId,
          rol: r.user?.rol,
        };
      },
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
      customSuccessMessage: (req, res) =>
        `${(req as IncomingMessage).method ?? '?'} ${(req as IncomingMessage).url ?? '?'} → ${res.statusCode}`,
      customErrorMessage: (req, res, err) =>
        `${(req as IncomingMessage).method ?? '?'} ${(req as IncomingMessage).url ?? '?'} → ${res.statusCode} ${err.message}`,
    },
  };
}

/** Logger tipado para uso en services fuera del ciclo de request. */
export const SYSTEM_LOGGER = 'System';

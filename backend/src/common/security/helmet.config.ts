import helmet from 'helmet';
import type { RequestHandler } from 'express';

/**
 * Configuración estricta de Helmet con CSP estricta para producción.
 * Detalles: PLANIFICACION/01-setup-base.md (T-015) y 12-seguridad-auditoria.md (T-147).
 */
export function buildHelmet(): RequestHandler {
  const isProd = process.env.NODE_ENV === 'production';

  return helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        // T-147: 'unsafe-eval' SOLO en dev (Swagger UI lo necesita); en prod
        // queda únicamente 'unsafe-inline' (init inline de Swagger).
        scriptSrc: isProd
          ? ["'self'", "'unsafe-inline'"]
          : ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: [
          "'self'",
          // jsreport solo si se usa inline (proxy BFF normaliza)
          process.env.JSREPORT_URL ?? 'http://localhost:5488',
        ],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: isProd ? [] : null,
      },
    },
    // HSTS: 1 año, incluir subdominios, permitir preload
    strictTransportSecurity: isProd
      ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
      : false,
    // X-Content-Type-Options: nosniff
    noSniff: true,
    // X-Frame-Options: DENY (no permitimos iframes)
    frameguard: { action: 'deny' },
    // Referrer policy
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    // X-DNS-Prefetch-Control: off
    dnsPrefetchControl: { allow: false },
    // X-Permitted-Cross-Domain-Policies: none
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    // Ocultar X-Powered-By
    hidePoweredBy: true,
    // Cross-Origin-Resource-Policy / Embedder-Policy (deshabilitados en dev para no romper HMR)
    crossOriginResourcePolicy: { policy: 'same-site' },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
  });
}

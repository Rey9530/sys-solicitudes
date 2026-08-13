/**
 * @app/contracts
 *
 * Schemas Zod 4 compartidos entre frontend (Next.js) y backend (NestJS).
 *
 * Convenciones:
 *  - Un archivo por dominio: `auth.ts`, `usuarios.ts`, `solicitudes.ts`, etc.
 *  - Cada schema exporta además el tipo inferido: `type LoginInput = z.infer<typeof LoginSchema>`.
 *  - Los schemas van en PascalCase con sufijo `Schema` (LoginSchema, SolicitudCreateSchema).
 *  - Los tipos derivados van en PascalCase sin sufijo (LoginInput, SolicitudCreate).
 *
 * Detalles: PLANIFICACION/01-setup-base.md (T-005) y 02-autenticacion-usuarios.md (T-022).
 */

// Re-exports por dominio
export * from './adjuntos/index.js';
export * from './admin/index.js';
export * from './auditoria/index.js';
export * from './auth/index.js';
export * from './calendario/index.js';
export * from './categorias/index.js';
export * from './common/index.js';
export * from './contratos/index.js';
export * from './locales/index.js';
export * from './notificaciones/index.js';
export * from './permisos/index.js';
export * from './plazas/index.js';
export * from './reportes/index.js';
export * from './roles-staff/index.js';
export * from './solicitudes/index.js';
export * from './tipos-solicitud/index.js';
export * from './usuarios/index.js';

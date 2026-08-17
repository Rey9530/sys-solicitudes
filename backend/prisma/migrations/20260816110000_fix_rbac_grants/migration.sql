-- =============================================================================
-- Fix: GRANTs faltantes para `syssol_app` sobre tablas RBAC (T-RBAC-1 / modulo_14)
--
-- Bitácora (2026-08-16):
--   - Síntoma:    login admin_plaza devolvía 500 INTERNAL_ERROR con
--                 `DriverAdapterError: permission denied for table rol_staff_permiso`.
--                 Inquilino/superadmin funcionaban porque no requieren cargar
--                 el array `permisos` (ambos tienen permisos vacíos o derivados
--                 de la matriz legacy); admin_plaza sí lo requiere en el JWT.
--   - Causa:      La migración `20260624000001_modulo_14_rbac_permisos` ejecutó
--                 CREATE TABLE + ALTER TABLE ... ENABLE/FORCE RLS + CREATE POLICY,
--                 pero NO ejecutó los GRANTs que contenía (`GRANT SELECT ON
--                 "permiso" TO syssol_app;` y `GRANT SELECT, INSERT, UPDATE,
--                 DELETE ON "rol_staff_permiso" TO syssol_app;`). La migración
--                 quedó registrada como `finished_at IS NOT NULL` en
--                 `_prisma_migrations` a pesar de que las 3 últimas sentencias
--                 (GRANT a `permiso` + GRANT a `rol_staff_permiso` + GRANTs
--                 SELECT a `rol_staff` indirecto) no se ejecutaron sobre la BD.
--   - Diagnóstico: `has_table_privilege('syssol_app', 'rol_staff_permiso',
--                 'SELECT')` retornó `false` antes del fix.
--   - Fix manual:  Aplicado vía psql el 2026-08-16 por Claude Code. BD ya
--                 sincronizada.
--   - Esta migración: existe para documentar el desfase y para que un
--                 `prisma migrate reset` futuro en una BD afectada aplique
--                 los GRANTs. Como son idempotentes (IF NOT EXISTS no es
--                 necesario para GRANT — re-ejecutar sobre una BD que ya
--                 tiene el GRANT es un no-op), también se puede aplicar
--                 directamente con `prisma migrate deploy`.
--
-- Decisiones:
--   - Se usa `DO $$ ... GRANT ... TO syssol_app` con IF NOT EXISTS-style guard
--     vía `has_table_privilege` para que la migración sea idempotente y segura
--     de correr en cualquier BD.
--   - `rol_staff` también recibe GRANT SELECT porque la policy RLS de
--     `rol_staff_permiso` hace un `EXISTS (SELECT 1 FROM rol_staff ...)` que
--     requiere SELECT a `rol_staff`. Aunque `rol_staff` se creó en una
--     migración previa (`modulo_06_roles`), confirmar su GRANT previene el
--     mismo fallo en una BD de fresh setup donde la policy ya esté activa.
--   - INSERT/UPDATE/DELETE en `rol_staff_permiso` son idempotentes pero la
--     policy RLS los limita al tenant del JWT — comportamiento deseado.
-- =============================================================================

DO $$
BEGIN
  -- `permiso`: solo SELECT (catálogo global, sin RLS)
  IF NOT has_table_privilege('syssol_app', 'permiso', 'SELECT') THEN
    GRANT SELECT ON "permiso" TO syssol_app;
  END IF;

  -- `rol_staff`: SELECT (cataloga roles por tenant; la app escribe via
  -- servicios admin que usan el cliente `prisma` con bypass RLS en seeds/install)
  IF NOT has_table_privilege('syssol_app', 'rol_staff', 'SELECT') THEN
    GRANT SELECT ON "rol_staff" TO syssol_app;
  END IF;

  -- `rol_staff_permiso`: CRUD (la policy RLS por tenant ya filtra)
  IF NOT has_table_privilege('syssol_app', 'rol_staff_permiso', 'SELECT') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "rol_staff_permiso" TO syssol_app;
  END IF;
END $$;

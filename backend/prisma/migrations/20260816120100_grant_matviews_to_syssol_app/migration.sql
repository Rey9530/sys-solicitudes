-- =============================================================================
-- Fix: GRANT SELECT a `syssol_app` sobre las materialized views de negocio.
--
-- Bitácora (2026-08-16):
--   - Síntoma: `GET /solicitudes/bandeja` (el endpoint de la bandeja
--     priorizada del admin, T-099/T-106) devolvía 500 INTERNAL_ERROR
--     aunque había 4 solicitudes asignadas al admin en la BD. Todos los
--     demás endpoints de negocio (`/locales`, `/solicitudes`, etc.)
--     funcionaban correctamente después del fix de GRANTs de la
--     migración `20260816120000_grant_business_tables_to_syssol_app`.
--   - Causa: `aprobaciones.service.ts:349` ejecuta una raw query
--     `SELECT id, status FROM solicitud_sla_view WHERE id = ANY(...)
--     ` para anotar el semáforo SLA de los items de la bandeja. La
--     materialized view `solicitud_sla_view` (creada en módulo 07, T-101)
--     NO recibió GRANT para `syssol_app` en su migración original. La
--     policy RLS no aplica a material views (no son tablas), pero el
--     GRANT sí es obligatorio para que el query planner llegue al
--     resultset.
--   - Por qué la migración de tablas no lo cubrió: el bucle de
--     `20260816120000` filtraba por `c.relkind = 'r'` (ordinary tables),
--     excluyendo implícitamente material views (`relkind = 'm'`).
--   - Fix manual: `GRANT SELECT ON solicitud_sla_view TO syssol_app`
--     ejecutado vía psql el 2026-08-16. `GET /solicitudes/bandeja`
--     volvió a 200 con los 4 items esperados (ordenados por prioridad
--     y enviada_at DESC).
--   - Fix durable: esta migración. Bucle idempotente sobre
--     `pg_matviews WHERE schemaname='public'` con guard
--     `has_table_privilege` para no-op si ya está aplicado. Cubre la
--     matview actual y previene el mismo bug para cualquier matview
--     futura.
--   - Por qué solo SELECT: las matviews son derivadas de otras tablas
--     (la `solicitud_sla_view` se refresca con `REFRESH MATERIALIZED
--     VIEW` desde el cron `sla-refresh.cron.ts`, que corre con el
--     cliente admin `prisma` con bypass RLS). `syssol_app` solo lee.
-- =============================================================================

DO $$
DECLARE
  v_matview text;
  v_grant_sql text;
BEGIN
  FOR v_matview IN
    SELECT matviewname
    FROM pg_matviews
    WHERE schemaname = 'public'
  LOOP
    IF NOT has_table_privilege('syssol_app', v_matview::regclass, 'SELECT') THEN
      v_grant_sql := format(
        'GRANT SELECT ON MATERIALIZED VIEW public.%I TO syssol_app',
        v_matview
      );
      EXECUTE v_grant_sql;
      RAISE NOTICE '[grant_matviews_to_syssol_app] GRANT SELECT ON % TO syssol_app', v_matview;
    END IF;
  END LOOP;
END $$;

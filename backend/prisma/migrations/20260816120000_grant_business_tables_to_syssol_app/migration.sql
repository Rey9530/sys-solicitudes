-- =============================================================================
-- Fix sistémico: GRANT CRUD a `syssol_app` sobre TODAS las tablas de negocio
-- creadas por migraciones de módulos 04-14.
--
-- Bitácora (2026-08-16):
--   - Síntoma:    tras el fix de `rol_staff_permiso` (migración
--                 `20260816110000_fix_rbac_grants`), el login admin_plaza
--                 funciona pero los endpoints de negocio siguen 500
--                 INTERNAL_ERROR (`/locales`, `/contratos`, `/solicitudes`,
--                 `/reportes/kpis`, `/reportes/dashboard`, `/categorias`,
--                 `/notificaciones`). El `AllExceptionsFilter` enmascara el
--                 `PrismaClientKnownRequestError` con mensaje genérico.
--   - Causa:      auditoría con `has_table_privilege('syssol_app', '<tabla>',
--                 'SELECT')` reveló que **24 tablas de negocio** NO tienen
--                 GRANT para `syssol_app`:
--                   adjunto, auditoria, auditoria_login, categoria,
--                   comentario, configuracion, contrato, email_log,
--                   evento_calendario, inquilino, kpi_snapshot, local,
--                   password_reset_token, plaza, refresh_token, rol,
--                   solicitud, solicitud_codigo_seq, solicitud_historial,
--                   solicitud_tipo_config, subcategoria,
--                   subcategoria_supervisor, unsubscribe, usuario.
--   - Por qué:    el patrón `GRANT SELECT, INSERT, UPDATE, DELETE ON <tabla>
--                 TO syssol_app` se aplicó en la migración `20260604_*
--                 enable_rls` SOLO a las tablas existentes en ese momento
--                 (vía bucle `FOR t IN SELECT table_name FROM
--                 information_schema.tables ...`). Las migraciones de
--                 módulos 04-14 que CREARON tablas nuevas no ejecutaron
--                 ese bucle, por lo que `syssol_app` quedó sin acceso a
--                 las 24 tablas de negocio. La migración `modulo_14`
--                 INCLUÍA GRANTs pero no se ejecutaron (incidente
--                 documentado en `20260816110000_fix_rbac_grants`).
--   - Fix:        nuevo bucle idempotente que otorga CRUD a `syssol_app`
--                 sobre TODAS las tablas de `public` excepto la metadata
--                 interna de Prisma (`_prisma_migrations`). El guard
--                 `has_table_privilege` lo hace no-op si ya está aplicado.
--   - Cumplimiento RLS: las tablas de negocio tienen RLS + FORCE RLS
--                 habilitado, por lo que `syssol_app` sigue sin poder
--                 leer/escribir fuera del tenant del JWT. El GRANT
--                 solo permite que la query llegue a la policy RLS; la
--                 policy hace el resto.
--
-- Referencia:
--   - `CLAUDE.md` §"Hallazgos de versiones (módulo 12)" y §"Stack
--     confirmado" — multi-tenancy estricta con RLS como segunda capa.
--   - `docs/04-modelo-de-datos.md` §4.10 — esquema completo.
--   - `docs/07-arquitectura.md` §7.4 — convenciones multi-tenant.
-- =============================================================================

DO $$
DECLARE
  v_table text;
  v_grant_sql text;
BEGIN
  FOR v_table IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'  -- only ordinary tables
      AND c.relname <> '_prisma_migrations'  -- metadata de Prisma, no es de negocio
  LOOP
    -- Idempotencia: solo aplicamos GRANT si falta SEL.
    IF NOT has_table_privilege('syssol_app', format('%I', v_table), 'SELECT') THEN
      v_grant_sql := format(
        'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO syssol_app',
        v_table
      );
      EXECUTE v_grant_sql;
      RAISE NOTICE '[grant_business_tables_to_syssol_app] GRANT CRUD ON % TO syssol_app', v_table;
    END IF;
  END LOOP;
END $$;

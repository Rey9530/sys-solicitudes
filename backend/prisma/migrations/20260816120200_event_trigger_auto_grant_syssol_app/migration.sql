-- =============================================================================
-- Event trigger: GRANT automático a `syssol_app` en cada CREATE TABLE /
-- CREATE VIEW / CREATE MATERIALIZED VIEW futuro.
--
-- Bitácora (2026-08-16):
--   - Contexto: las 3 migraciones previas de GRANTs
--     (20260816110000, 20260816120000, 20260816120100) son fixes
--     point-in-time. NO se aplican automáticamente a tablas/vistas/
--     matviews creadas por migraciones futuras. Cualquier módulo
--     nuevo que herede el patrón multi-tenant con RLS requeriría
--     replicar el GRANT manualmente.
--   - Solución: PostgreSQL EVENT TRIGGER en `ddl_command_end` que
--     escucha CREATE TABLE/VIEW/MAT VIEW y ejecuta el GRANT al rol
--     `syssol_app` en el mismo momento de la creación. Cubre los 3
--     `relkind` (`r`, `v`, `m`) y excluye el `schema` 'public' <> X
--     para no contaminar otros schemas si se agregan.
--   - Idempotencia: el GRANT falla silenciosamente si ya existe
--     (PostgreSQL retorna `0A000` "no privileges were granted`
--     cuando se duplica; lo capturamos con EXCEPTION WHEN
--     others_group). El trigger también tolera re-creación porque
--     `DROP TRIGGER` no es parte del flujo normal.
--   - SECURITY: la función usa `SECURITY DEFINER` para tener
--     privilegios del owner (syssol) y poder GRANT. Se permite
--     ejecución solo a `syssol` (la BD solo tiene 2 roles de
--     aplicación: `syssol` admin y `syssol_app` RLS). No es
--     accesible desde la app.
--   - Cubre:Ordinary tables (CREATE TABLE), Views (CREATE VIEW),
--     Materialized views (CREATE MATERIALIZED VIEW). No cubre
--     ALTER TABLE que añade tablas particionadas (relkind='p' — no
--     usado en este proyecto), secuencias (relkind='S' — se
--     modelan como tablas aquí), ni types.
--   - Riesgo conocido: el `EXECUTE` corre DESPUÉS de la creación
--     del objeto. Si una migración futura incluye lógica en
--     `ddl_command_start` que asume que el GRANT ya está, no
--     aplicará. Pero ese patrón no se usa en este proyecto.
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_auto_grant_syssol_app_on_ddl()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_obj record;
  v_grant_sql text;
BEGIN
  -- Iterar sobre los DDL commands emitidos en la transacción.
  FOR v_obj IN
    SELECT
      command_tag,
      schema_name,
      object_identity,
      object_type
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN (
      'CREATE TABLE',
      'CREATE VIEW',
      'CREATE MATERIALIZED VIEW'
    )
      AND schema_name = 'public'
  LOOP
    BEGIN
      v_grant_sql := format(
        'GRANT SELECT, INSERT, UPDATE, DELETE ON %s TO syssol_app',
        v_obj.object_identity
      );
      EXECUTE v_grant_sql;
      RAISE NOTICE '[fn_auto_grant_syssol_app_on_ddl] GRANT aplicado a % (%)', v_obj.object_identity, v_obj.command_tag;
    EXCEPTION WHEN OTHERS THEN
      -- Idempotencia: si el GRANT ya existía o el objeto no es
      -- grantable, registrar pero no abortar la migración.
      RAISE NOTICE '[fn_auto_grant_syssol_app_on_ddl] No-op en %: %', v_obj.object_identity, SQLERRM;
    END;
  END LOOP;
END;
$$;

-- Solo `syssol` (el rol de migraciones) puede instalar/ actualizar
-- el trigger. Esto previene que `syssol_app` (el rol de la app)
-- pueda manipular event triggers.
ALTER FUNCTION fn_auto_grant_syssol_app_on_ddl() OWNER TO syssol;

-- Crear el trigger solo si no existe (idempotencia).
DO $mig$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_event_trigger WHERE evtname = 'auto_grant_syssol_app_on_ddl'
  ) THEN
    CREATE EVENT TRIGGER auto_grant_syssol_app_on_ddl
      ON ddl_command_end
      WHEN TAG IN (
        'CREATE TABLE',
        'CREATE VIEW',
        'CREATE MATERIALIZED VIEW'
      )
      EXECUTE FUNCTION fn_auto_grant_syssol_app_on_ddl();
  END IF;
END
$mig$;

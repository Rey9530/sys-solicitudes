-- T-038 · Row Level Security (segunda capa de defensa multi-tenant).
--
-- Crea el rol de aplicación `syssol_app` (LOGIN, sin BYPASSRLS) y activa RLS
-- forzada en las tablas de negocio existentes. La app conecta como syssol_app y
-- ejecuta `SELECT set_config('app.plaza_id', '<uuid>', true)` (= SET LOCAL) al
-- inicio de cada transacción con scope de plaza (helper PrismaService.withTenant).
-- El superadmin y los flujos de auth pre-sesión usan el superusuario `syssol`
-- (admin client), que bypassa RLS por diseño.
--
-- Las tablas de módulos futuros (local, contrato, solicitud, …) añadirán su
-- propia RLS en sus respectivas migraciones.

-- 1) Rol de aplicación (idempotente). ⚠️ Solo dev: password fija; en prod usar secreto.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'syssol_app') THEN
    CREATE ROLE syssol_app LOGIN PASSWORD 'syssol_app'
      NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;

-- 2) Privilegios sobre el esquema y los objetos (presentes y futuros).
GRANT USAGE ON SCHEMA public TO syssol_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO syssol_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO syssol_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO syssol_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO syssol_app;

-- 3) RLS en la tabla raíz `plaza` (el tenant es su propio `id`).
ALTER TABLE "plaza" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "plaza" FORCE ROW LEVEL SECURITY;
CREATE POLICY plaza_tenant_isolation ON "plaza"
  USING (id = current_setting('app.plaza_id', true)::uuid)
  WITH CHECK (id = current_setting('app.plaza_id', true)::uuid);

-- 4) RLS en tablas con discriminador `plaza_id`.
--    Nota: usuario.plaza_id y auditoria_login.plaza_id son nullable (superadmin /
--    intentos con email inexistente). Esas filas NO son visibles para el app
--    client (NULL = uuid → false); se acceden por el admin client. Correcto.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['configuracion','usuario','rol_staff','auditoria_login']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I '
      'USING (plaza_id = current_setting(''app.plaza_id'', true)::uuid) '
      'WITH CHECK (plaza_id = current_setting(''app.plaza_id'', true)::uuid);',
      t || '_tenant_isolation', t);
  END LOOP;
END
$$;

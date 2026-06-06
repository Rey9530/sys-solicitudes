-- T-038 (hardening) · RLS restrictiva en las tablas de tokens.
--
-- `refresh_token` y `password_reset_token` no tienen `plaza_id` (su scope es por
-- usuario/token), así que no aplica la política por plaza. Para que el app client
-- (`syssol_app`) NUNCA pueda leerlas/escribirlas, se aplica una política
-- `USING (false)`: solo el admin client (superusuario `syssol`, que bypassa RLS)
-- opera sobre ellas. Todo el acceso va por AuthService/TokenService (admin client).
ALTER TABLE "refresh_token" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "refresh_token" FORCE ROW LEVEL SECURITY;
CREATE POLICY refresh_token_admin_only ON "refresh_token"
  USING (false) WITH CHECK (false);

ALTER TABLE "password_reset_token" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "password_reset_token" FORCE ROW LEVEL SECURITY;
CREATE POLICY password_reset_token_admin_only ON "password_reset_token"
  USING (false) WITH CHECK (false);

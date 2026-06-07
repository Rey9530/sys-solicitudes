-- Módulo 09 (T-125): tabla de desuscripciones de emails no críticos
-- (S-Unsubscribe, RN-NE-4). Por (plaza, email, plantilla); el admin la
-- resetea desde /admin/notificaciones.

-- CreateTable
CREATE TABLE "unsubscribe" (
    "id" UUID NOT NULL,
    "plaza_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "plantilla" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unsubscribe_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "unsubscribe_plaza_id_email_plantilla_key" ON "unsubscribe"("plaza_id", "email", "plantilla");
CREATE INDEX "unsubscribe_email_idx" ON "unsubscribe"("email");

-- AddForeignKey
ALTER TABLE "unsubscribe" ADD CONSTRAINT "unsubscribe_plaza_id_fkey"
  FOREIGN KEY ("plaza_id") REFERENCES "plaza"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS (T-038, segunda capa multi-tenant) — mismo patrón que el resto de
-- tablas de negocio. El endpoint público de unsubscribe usa el admin client
-- (sin contexto de tenant) y el plaza_id viene firmado en el token.
GRANT SELECT, INSERT, UPDATE, DELETE ON "unsubscribe" TO syssol_app;
ALTER TABLE "unsubscribe" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "unsubscribe" FORCE ROW LEVEL SECURITY;
CREATE POLICY "unsubscribe_tenant_isolation" ON "unsubscribe"
  USING (plaza_id = current_setting('app.plaza_id', true)::uuid)
  WITH CHECK (plaza_id = current_setting('app.plaza_id', true)::uuid);

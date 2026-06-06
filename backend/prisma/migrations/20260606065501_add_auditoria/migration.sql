-- CreateTable
CREATE TABLE "auditoria" (
    "id" UUID NOT NULL,
    "plaza_id" UUID,
    "usuario_id" UUID,
    "accion" TEXT NOT NULL,
    "entidad_tipo" TEXT NOT NULL,
    "entidad_id" UUID,
    "antes" JSONB,
    "despues" JSONB,
    "ip" TEXT,
    "user_agent" TEXT,
    "request_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auditoria_plaza_id_created_at_idx" ON "auditoria"("plaza_id", "created_at");

-- CreateIndex
CREATE INDEX "auditoria_entidad_tipo_entidad_id_idx" ON "auditoria"("entidad_tipo", "entidad_id");

-- RLS para auditoria (T-038): aislada por plaza. Las inserciones del superadmin
-- (acciones de plataforma o sobre una plaza concreta) van por el admin client y
-- bypassan RLS; las de admin_plaza (withTenant) cumplen WITH CHECK.
GRANT SELECT, INSERT, UPDATE, DELETE ON "auditoria" TO syssol_app;
ALTER TABLE "auditoria" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "auditoria" FORCE ROW LEVEL SECURITY;
CREATE POLICY auditoria_tenant_isolation ON "auditoria"
  USING (plaza_id = current_setting('app.plaza_id', true)::uuid)
  WITH CHECK (plaza_id = current_setting('app.plaza_id', true)::uuid);

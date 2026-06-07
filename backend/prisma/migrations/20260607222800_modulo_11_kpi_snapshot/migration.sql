-- Módulo 11 (T-142): snapshot de KPIs cada 15 min para histórico del
-- dashboard (S-PA-B, S-KPI). Retención 90 días (limpieza en el cron).

-- CreateTable
CREATE TABLE "kpi_snapshot" (
    "id" UUID NOT NULL,
    "plaza_id" UUID NOT NULL,
    "fecha" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metricas" JSONB NOT NULL,

    CONSTRAINT "kpi_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kpi_snapshot_plaza_id_fecha_idx" ON "kpi_snapshot"("plaza_id", "fecha");

-- AddForeignKey
ALTER TABLE "kpi_snapshot" ADD CONSTRAINT "kpi_snapshot_plaza_id_fkey"
  FOREIGN KEY ("plaza_id") REFERENCES "plaza"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS (T-038): mismo patrón estándar multi-tenant.
GRANT SELECT, INSERT, UPDATE, DELETE ON "kpi_snapshot" TO syssol_app;
ALTER TABLE "kpi_snapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "kpi_snapshot" FORCE ROW LEVEL SECURITY;
CREATE POLICY "kpi_snapshot_tenant_isolation" ON "kpi_snapshot"
  USING (plaza_id = current_setting('app.plaza_id', true)::uuid)
  WITH CHECK (plaza_id = current_setting('app.plaza_id', true)::uuid);

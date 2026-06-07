-- DropForeignKey
ALTER TABLE "solicitud_codigo_seq" DROP CONSTRAINT "solicitud_codigo_seq_plaza_id_fkey";

-- AlterTable
ALTER TABLE "local" ADD COLUMN     "fecha_fin_mantenimiento" DATE,
ADD COLUMN     "fecha_inicio_mantenimiento" DATE;

-- CreateTable
CREATE TABLE "evento_calendario" (
    "id" UUID NOT NULL,
    "plaza_id" UUID NOT NULL,
    "solicitud_id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "inicio" TIMESTAMPTZ(6) NOT NULL,
    "fin" TIMESTAMPTZ(6) NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#10b981',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "evento_calendario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "evento_calendario_solicitud_id_key" ON "evento_calendario"("solicitud_id");

-- CreateIndex
CREATE INDEX "evento_calendario_plaza_id_inicio_idx" ON "evento_calendario"("plaza_id", "inicio");

-- CreateIndex
CREATE INDEX "evento_calendario_plaza_id_deleted_at_idx" ON "evento_calendario"("plaza_id", "deleted_at");

-- AddForeignKey
ALTER TABLE "solicitud_codigo_seq" ADD CONSTRAINT "solicitud_codigo_seq_plaza_id_fkey" FOREIGN KEY ("plaza_id") REFERENCES "plaza"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento_calendario" ADD CONSTRAINT "evento_calendario_plaza_id_fkey" FOREIGN KEY ("plaza_id") REFERENCES "plaza"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento_calendario" ADD CONSTRAINT "evento_calendario_solicitud_id_fkey" FOREIGN KEY ("solicitud_id") REFERENCES "solicitud"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- SQL manual del módulo 07 (no expresable en Prisma)
-- ─────────────────────────────────────────────────────────────────────────────

-- T-128: coherencia de rango del evento.
ALTER TABLE "evento_calendario"
  ADD CONSTRAINT "evento_calendario_rango_chk" CHECK ("fin" > "inicio");

-- RLS (T-038) para evento_calendario. Patrón estándar por plaza_id.
GRANT SELECT, INSERT, UPDATE, DELETE ON "evento_calendario" TO syssol_app;
ALTER TABLE "evento_calendario" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "evento_calendario" FORCE ROW LEVEL SECURITY;
CREATE POLICY "evento_calendario_tenant_isolation" ON "evento_calendario"
  USING (plaza_id = current_setting('app.plaza_id', true)::uuid)
  WITH CHECK (plaza_id = current_setting('app.plaza_id', true)::uuid);

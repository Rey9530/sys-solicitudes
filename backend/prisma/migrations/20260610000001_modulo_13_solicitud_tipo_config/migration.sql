-- Módulo 13 (T-V20: TIPO_CONFIGURABLE_POR_PLAZA).
--
-- Crea la tabla `solicitud_tipo_config` para que cada plaza controle la
-- presentación (etiqueta, descripción, orden, activo) de los 4 tipos
-- canónicos del enum `solicitud_tipo`. El `codigo` es inalterable y
-- siempre uno de los 4 valores del enum (enforced por CHECK + app).

-- CreateTable
CREATE TABLE "solicitud_tipo_config" (
    "id" UUID NOT NULL,
    "plaza_id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "etiqueta" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "solicitud_tipo_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "solicitud_tipo_config_plaza_id_codigo_key" ON "solicitud_tipo_config"("plaza_id", "codigo");

-- CreateIndex
CREATE INDEX "solicitud_tipo_config_plaza_id_activo_orden_idx" ON "solicitud_tipo_config"("plaza_id", "activo", "orden");

-- AddForeignKey
ALTER TABLE "solicitud_tipo_config" ADD CONSTRAINT "solicitud_tipo_config_plaza_id_fkey" FOREIGN KEY ("plaza_id") REFERENCES "plaza"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- SQL manual (no expresable en Prisma)
-- ─────────────────────────────────────────────────────────────────────────────

-- CHECK: el codigo debe ser uno de los 4 valores del enum canónico.
-- La regla "otro siempre activo" se enforce en la app (servicio + form).
ALTER TABLE "solicitud_tipo_config"
  ADD CONSTRAINT "solicitud_tipo_config_codigo_check"
  CHECK ("codigo" IN ('mantenimiento', 'evento', 'remodelacion', 'otro'));

-- RLS multi-tenant (T-038, segunda capa).
GRANT SELECT, INSERT, UPDATE, DELETE ON "solicitud_tipo_config" TO syssol_app;
ALTER TABLE "solicitud_tipo_config" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "solicitud_tipo_config" FORCE ROW LEVEL SECURITY;
CREATE POLICY "solicitud_tipo_config_tenant_isolation" ON "solicitud_tipo_config"
  USING ("plaza_id" = current_setting('app.plaza_id', true)::uuid)
  WITH CHECK ("plaza_id" = current_setting('app.plaza_id', true)::uuid);

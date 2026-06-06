-- CreateEnum
CREATE TYPE "local_estado" AS ENUM ('disponible', 'alquilado', 'en_mantenimiento', 'fuera_de_servicio');

-- CreateEnum
CREATE TYPE "contrato_estado" AS ENUM ('vigente', 'finalizado', 'cancelado');

-- CreateEnum
CREATE TYPE "adjunto_entidad_tipo" AS ENUM ('solicitud', 'local', 'contrato');

-- CreateTable
CREATE TABLE "local" (
    "id" UUID NOT NULL,
    "plaza_id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT,
    "metraje_m2" DECIMAL(10,2),
    "piso" TEXT,
    "sector" TEXT,
    "descripcion" TEXT,
    "estado" "local_estado" NOT NULL DEFAULT 'disponible',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "local_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inquilino" (
    "id" UUID NOT NULL,
    "plaza_id" UUID NOT NULL,
    "razon_social" TEXT NOT NULL,
    "identificacion" TEXT,
    "direccion" TEXT,
    "contacto_nombre" TEXT,
    "contacto_email" TEXT,
    "contacto_telefono" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "inquilino_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contrato" (
    "id" UUID NOT NULL,
    "plaza_id" UUID NOT NULL,
    "local_id" UUID NOT NULL,
    "inquilino_id" UUID NOT NULL,
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE,
    "monto_mensual" DECIMAL(12,2),
    "moneda" CHAR(3) NOT NULL DEFAULT 'USD',
    "condiciones" TEXT,
    "estado" "contrato_estado" NOT NULL DEFAULT 'vigente',
    "fecha_fin_efectiva" DATE,
    "motivo_fin" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "contrato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adjunto" (
    "id" UUID NOT NULL,
    "plaza_id" UUID NOT NULL,
    "entidad_tipo" "adjunto_entidad_tipo" NOT NULL,
    "entidad_id" UUID NOT NULL,
    "nombre_original" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "tamano_bytes" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "usuario_subio_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "adjunto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_log" (
    "id" UUID NOT NULL,
    "plaza_id" UUID NOT NULL,
    "destinatario" TEXT NOT NULL,
    "plantilla" TEXT NOT NULL,
    "variables" JSONB,
    "estado" TEXT NOT NULL DEFAULT 'pendiente',
    "reintentos" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "sent_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "local_plaza_id_estado_idx" ON "local"("plaza_id", "estado");

-- CreateIndex
CREATE INDEX "local_deleted_at_idx" ON "local"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "local_plaza_id_codigo_key" ON "local"("plaza_id", "codigo");

-- CreateIndex
CREATE INDEX "inquilino_plaza_id_idx" ON "inquilino"("plaza_id");

-- CreateIndex
CREATE INDEX "contrato_plaza_id_local_id_estado_idx" ON "contrato"("plaza_id", "local_id", "estado");

-- CreateIndex
CREATE INDEX "contrato_plaza_id_inquilino_id_estado_idx" ON "contrato"("plaza_id", "inquilino_id", "estado");

-- CreateIndex
CREATE INDEX "contrato_fecha_fin_idx" ON "contrato"("fecha_fin");

-- CreateIndex
CREATE INDEX "adjunto_plaza_id_entidad_tipo_entidad_id_idx" ON "adjunto"("plaza_id", "entidad_tipo", "entidad_id");

-- CreateIndex
CREATE INDEX "email_log_plaza_id_plantilla_created_at_idx" ON "email_log"("plaza_id", "plantilla", "created_at");

-- CreateIndex
CREATE INDEX "email_log_estado_reintentos_idx" ON "email_log"("estado", "reintentos");

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_inquilino_id_fkey" FOREIGN KEY ("inquilino_id") REFERENCES "inquilino"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "local" ADD CONSTRAINT "local_plaza_id_fkey" FOREIGN KEY ("plaza_id") REFERENCES "plaza"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquilino" ADD CONSTRAINT "inquilino_plaza_id_fkey" FOREIGN KEY ("plaza_id") REFERENCES "plaza"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato" ADD CONSTRAINT "contrato_plaza_id_fkey" FOREIGN KEY ("plaza_id") REFERENCES "plaza"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato" ADD CONSTRAINT "contrato_local_id_fkey" FOREIGN KEY ("local_id") REFERENCES "local"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contrato" ADD CONSTRAINT "contrato_inquilino_id_fkey" FOREIGN KEY ("inquilino_id") REFERENCES "inquilino"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adjunto" ADD CONSTRAINT "adjunto_plaza_id_fkey" FOREIGN KEY ("plaza_id") REFERENCES "plaza"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_plaza_id_fkey" FOREIGN KEY ("plaza_id") REFERENCES "plaza"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- SQL manual del módulo 04 (no expresable en Prisma)
-- ─────────────────────────────────────────────────────────────────────────────

-- T-048: UNIQUE parcial — identificación única por plaza solo cuando no es NULL.
CREATE UNIQUE INDEX "inquilino_plaza_identificacion_uniq"
  ON "inquilino" ("plaza_id", "identificacion")
  WHERE "identificacion" IS NOT NULL;

-- T-049: CHECK de coherencia de fechas (S-ContratoIndefinido: fecha_fin NULL ok).
ALTER TABLE "contrato"
  ADD CONSTRAINT "contrato_fechas_chk"
  CHECK ("fecha_fin" IS NULL OR "fecha_fin" >= "fecha_inicio");

-- RLS (T-038, segunda capa multi-tenant) para las 5 tablas nuevas.
-- Mismo patrón que enable_rls/add_auditoria: ENABLE + FORCE + policy por
-- plaza_id contra current_setting('app.plaza_id'). El admin client (syssol)
-- bypassa RLS solo para flujos cross-tenant (cron T-056, superadmin).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['local','inquilino','contrato','adjunto','email_log']
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO syssol_app;', t);
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

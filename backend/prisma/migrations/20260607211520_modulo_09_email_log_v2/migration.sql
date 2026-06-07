-- Módulo 09 (T-118): email_log v2 — cola completa con reintentos.
-- Completa la versión mínima de T-056: ENUM de estado, solicitud_id para
-- deduplicación (T-123), next_retry_at para backoff 1m/5m/30m (T-122),
-- CHECK RI-4 e índices del worker. RLS ya está habilitado (módulo 04).

-- CreateEnum
CREATE TYPE "email_log_estado" AS ENUM ('pendiente', 'enviado', 'fallido');

-- Conversión estado TEXT → ENUM sin pérdida de datos (USING).
-- Los valores existentes ('pendiente'/'enviado'/'fallido') son compatibles.
ALTER TABLE "email_log"
  ALTER COLUMN "estado" DROP DEFAULT;
ALTER TABLE "email_log"
  ALTER COLUMN "estado" TYPE "email_log_estado" USING ("estado"::"email_log_estado");
ALTER TABLE "email_log"
  ALTER COLUMN "estado" SET DEFAULT 'pendiente';

-- AlterTable: columnas nuevas
ALTER TABLE "email_log" ADD COLUMN "solicitud_id" UUID;
ALTER TABLE "email_log" ADD COLUMN "next_retry_at" TIMESTAMPTZ(6);

-- AddForeignKey
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_solicitud_id_fkey"
  FOREIGN KEY ("solicitud_id") REFERENCES "solicitud"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "email_log_plaza_id_estado_created_at_idx" ON "email_log"("plaza_id", "estado", "created_at");
CREATE INDEX "email_log_destinatario_idx" ON "email_log"("destinatario");
CREATE INDEX "email_log_solicitud_id_destinatario_plantilla_idx" ON "email_log"("solicitud_id", "destinatario", "plantilla");

-- RI-4: estado = 'enviado' IMPLIES sent_at IS NOT NULL
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_enviado_sent_at_check"
  CHECK ("estado" <> 'enviado' OR "sent_at" IS NOT NULL);

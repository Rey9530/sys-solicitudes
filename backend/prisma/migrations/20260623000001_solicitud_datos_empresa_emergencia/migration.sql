-- T-V22 (2026-06-23): bloque transversal de empresa ejecutante + modo
-- emergencia. Añade 7 columnas a `solicitud` y un índice compuesto que
-- soporta la consulta del límite mensual de emergencias por inquilino
-- (SolicitudesService.assertLimiteEmergencia).
--
-- Decisiones:
--   - NOT NULL con defaults ('' / false) para no romper filas existentes.
--   - Defaults se mantendrán como "placeholder" hasta que el usuario edite
--     la solicitud (T-080 permite editar en borrador y requerida_subsanacion).
--   - Sin CHECK constraint sobre es_emergencia (es boolean puro).
--   - El índice compuesto (plaza_id, es_emergencia, created_at) cubre la
--     query `count({ where: { inquilino_id, es_emergencia: true, created_at: { gte: inicioMes } } })`
--     dentro del tenant del RLS.

-- AlterTable
ALTER TABLE "solicitud"
  ADD COLUMN "empresa_nombre"      TEXT    NOT NULL DEFAULT '',
  ADD COLUMN "empresa_responsable" TEXT    NOT NULL DEFAULT '',
  ADD COLUMN "empresa_telefono"    TEXT    NOT NULL DEFAULT '',
  ADD COLUMN "empresa_email"       TEXT    NOT NULL DEFAULT '',
  ADD COLUMN "emergencia_contacto" TEXT    NOT NULL DEFAULT '',
  ADD COLUMN "emergencia_telefono" TEXT    NOT NULL DEFAULT '',
  ADD COLUMN "es_emergencia"       BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "solicitud_plaza_id_es_emergencia_created_at_idx"
  ON "solicitud" ("plaza_id", "es_emergencia", "created_at");
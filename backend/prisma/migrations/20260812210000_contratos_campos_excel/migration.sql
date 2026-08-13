-- Reestructuración del CRUD de contratos según formato Excel Hoja 2 (columnas U-AK).
-- T-V14+ — Bitácora de cambios:
--   11 columnas nuevas nullable. No hay renames (los campos ya en BD como
--   `fecha_inicio`/`fecha_fin` se conservan; AI `VENCIMIENTO DEL CONTRATO` se
--   ignora por decisión del usuario; Y/Z/AA `TOTAL*` se derivan en frontend).
--
-- La policy RLS `contrato_tenant_isolation` no requiere cambios (verifica
-- `plaza_id`, no columnas específicas).
--
-- El trigger `tg_contrato_no_overlap` tampoco: valida fechas (fecha_inicio,
-- fecha_fin), no las nuevas columnas.

ALTER TABLE "contrato" ADD COLUMN IF NOT EXISTS "plazo_anios"                   INTEGER;
ALTER TABLE "contrato" ADD COLUMN IF NOT EXISTS "area_mt2_medicion_real"        DECIMAL(12, 2);
ALTER TABLE "contrato" ADD COLUMN IF NOT EXISTS "cuota_arrendamiento"           DECIMAL(12, 2);
ALTER TABLE "contrato" ADD COLUMN IF NOT EXISTS "cuota_cam"                     DECIMAL(12, 2);
ALTER TABLE "contrato" ADD COLUMN IF NOT EXISTS "deposito_garantia"             DECIMAL(12, 2);
ALTER TABLE "contrato" ADD COLUMN IF NOT EXISTS "fecha_pago_deposito"           DATE;
ALTER TABLE "contrato" ADD COLUMN IF NOT EXISTS "fecha_entrega_local"           DATE;
ALTER TABLE "contrato" ADD COLUMN IF NOT EXISTS "periodo_gracia"                VARCHAR(40);
ALTER TABLE "contrato" ADD COLUMN IF NOT EXISTS "inicio_operaciones"            DATE;
ALTER TABLE "contrato" ADD COLUMN IF NOT EXISTS "aviso_terminacion"             DATE;
ALTER TABLE "contrato" ADD COLUMN IF NOT EXISTS "condiciones_incremento_canon"  TEXT;
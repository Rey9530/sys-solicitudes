-- Reestructuración del CRUD de locales según formato Excel
-- "INFORMACION PARA CREACION DE LOCALES" (Hoja 1).
--
-- Cambios:
--   sector      → modulo        (renombre, preserva datos)
--   piso        → nivel         (renombre, preserva datos)
--   metraje_m2  → area_m2       (renombre, preserva datos)
--   nombre, descripcion        (DROP: no aparecen en el formato)
--   medidor_energia, medidor_agua  (nuevos, NULL permitidos)
--
-- ⚠️ Los renombres preservan los 2 locales seed con datos no nulos en
-- `piso`, `sector`, `metraje_m2` y `nombre`/`descripcion`. Los `nombre` y
-- `descripcion` se eliminan — si tenías datos de negocio allí, no se
-- recuperan.
--
-- La policy RLS `local_tenant_isolation` (creada en
-- 20260606220306_modulo_04_locales_contratos) no requiere cambios: solo
-- referencia `plaza_id`, no las columnas de la tabla.

-- 1) Renombres (preservan datos)
ALTER TABLE "local" RENAME COLUMN "sector"     TO "modulo";
ALTER TABLE "local" RENAME COLUMN "piso"       TO "nivel";
ALTER TABLE "local" RENAME COLUMN "metraje_m2" TO "area_m2";

-- 2) Eliminaciones (no aparecen en el Excel del cliente)
ALTER TABLE "local" DROP COLUMN "nombre";
ALTER TABLE "local" DROP COLUMN "descripcion";

-- 3) Nuevos campos: medidores (string permite ceros a la izquierda y
--    números > 2^31). Vacíos → NULL manejado en app layer (Zod + service).
ALTER TABLE "local" ADD COLUMN "medidor_energia" VARCHAR(20);
ALTER TABLE "local" ADD COLUMN "medidor_agua"    VARCHAR(20);

-- Reestructuración del CRUD de inquilinos según formato Excel
-- "INFORMACION PARA CREACION DE INQUILINOS" (Hoja 2, columnas B-T + AL).
--
-- Cambios:
--   contacto_nombre   → contacto1_nombre   (renombre, preserva datos)
--   contacto_email    → contacto1_email    (renombre, preserva datos)
--   contacto_telefono → contacto1_telefono (renombre, preserva datos)
--   Nuevos:
--     nombre_comercial, representante_legal, numero_nrc,
--     correo_recepcion_dte, numero_telefono,
--     contacto1_cargo,
--     contacto2_{nombre, cargo, email, telefono},
--     tipo_cliente (enum), giro_autorizado, categoria, subcategoria,
--     comentarios.
--
-- ⚠️ Los 3 renombres preservan los datos seed (inquilinos demo). El contrato
-- "alta rápida de usuario" usa el campo `contacto_nombre`/`_email` para
-- pre-llenar el dialog — frontend se migra a `contacto1_*`.
--
-- La policy RLS `inquilino_tenant_isolation` (creada en
-- 20260606220306_modulo_04_locales_contratos) no requiere cambios: solo
-- referencia `plaza_id`, no las columnas.
--
-- Los 16 campos del primer contrato (U-AK) NO se incluyen: viven en `contrato`.

-- 1) Tipo enum (debe existir antes de la columna que lo usa)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inquilino_tipo_cliente') THEN
    CREATE TYPE "inquilino_tipo_cliente" AS ENUM ('grande', 'mediano', 'otro');
  END IF;
END
$$;

-- 2) Renombres (preservan datos)
ALTER TABLE "inquilino" RENAME COLUMN "contacto_nombre"   TO "contacto1_nombre";
ALTER TABLE "inquilino" RENAME COLUMN "contacto_email"    TO "contacto1_email";
ALTER TABLE "inquilino" RENAME COLUMN "contacto_telefono" TO "contacto1_telefono";

-- 3) Nuevas columnas (todas NULL permitidas; longitudes alineadas con Zod)
ALTER TABLE "inquilino" ADD COLUMN IF NOT EXISTS "nombre_comercial"     VARCHAR(160);
ALTER TABLE "inquilino" ADD COLUMN IF NOT EXISTS "representante_legal"  VARCHAR(160);
ALTER TABLE "inquilino" ADD COLUMN IF NOT EXISTS "numero_nrc"           VARCHAR(40);
ALTER TABLE "inquilino" ADD COLUMN IF NOT EXISTS "correo_recepcion_dte" VARCHAR(160);
ALTER TABLE "inquilino" ADD COLUMN IF NOT EXISTS "numero_telefono"      VARCHAR(40);
ALTER TABLE "inquilino" ADD COLUMN IF NOT EXISTS "contacto1_cargo"      VARCHAR(80);
ALTER TABLE "inquilino" ADD COLUMN IF NOT EXISTS "contacto2_nombre"     VARCHAR(120);
ALTER TABLE "inquilino" ADD COLUMN IF NOT EXISTS "contacto2_cargo"      VARCHAR(80);
ALTER TABLE "inquilino" ADD COLUMN IF NOT EXISTS "contacto2_email"      VARCHAR(160);
ALTER TABLE "inquilino" ADD COLUMN IF NOT EXISTS "contacto2_telefono"   VARCHAR(40);
ALTER TABLE "inquilino" ADD COLUMN IF NOT EXISTS "tipo_cliente"         "inquilino_tipo_cliente";
ALTER TABLE "inquilino" ADD COLUMN IF NOT EXISTS "giro_autorizado"      VARCHAR(160);
ALTER TABLE "inquilino" ADD COLUMN IF NOT EXISTS "categoria"            VARCHAR(120);
ALTER TABLE "inquilino" ADD COLUMN IF NOT EXISTS "subcategoria"         VARCHAR(120);
ALTER TABLE "inquilino" ADD COLUMN IF NOT EXISTS "comentarios"          TEXT;

-- Conversión semántica de campos contractuales (2026-08-21).
--   plazo_anios (Int, "años")     → plazo_meses (Int, "meses")
--   periodo_gracia (VarChar(40))   → periodo_gracia_dias (Int, "días")
--
-- Datos existentes:
--   * plazo_anios en el seed representaba AÑOS (valores 1–22). Para preservar el
--     significado del contrato se multiplican por 12 antes de renombrar.
--   * periodo_gracia era texto libre (ej. '3 meses'). Los valores no parseables
--     a un entero entre 0 y 3650 se nulean antes de cambiar el tipo a INTEGER.
--
-- Los CHECK constraints se agregan AL FINAL (después del UPDATE y el ALTER TYPE)
-- para no rechazar valores preexistentes durante la conversión.

-- 1) plazo_anios (años) → plazo_meses (meses).
UPDATE "contrato"
   SET plazo_anios = plazo_anios * 12
 WHERE plazo_anios IS NOT NULL;

ALTER TABLE "contrato" RENAME COLUMN "plazo_anios" TO "plazo_meses";

-- 2) periodo_gracia (texto) → periodo_gracia_dias (int).
--    Parseo defensivo: extraer dígitos, validar rango, nulear si no aplica.
DO $$
DECLARE
  v_dias integer;
  v_row  record;
BEGIN
  FOR v_row IN
    SELECT id, periodo_gracia
      FROM "contrato"
     WHERE periodo_gracia IS NOT NULL
  LOOP
    BEGIN
      v_dias := regexp_replace(v_row.periodo_gracia, '[^0-9]', '', 'g')::int;
      IF v_dias < 0 OR v_dias > 3650 THEN
        UPDATE "contrato" SET periodo_gracia = NULL WHERE id = v_row.id;
      ELSE
        UPDATE "contrato" SET periodo_gracia = v_dias::text WHERE id = v_row.id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      UPDATE "contrato" SET periodo_gracia = NULL WHERE id = v_row.id;
    END;
  END LOOP;
END $$;

ALTER TABLE "contrato"
  ALTER COLUMN "periodo_gracia" TYPE INTEGER
  USING NULLIF(periodo_gracia, '')::int;

ALTER TABLE "contrato" RENAME COLUMN "periodo_gracia" TO "periodo_gracia_dias";

-- 3) CHECK constraints (defensa-en-profundidad; Zod es la guard primaria).
ALTER TABLE "contrato"
  ADD CONSTRAINT "contrato_plazo_meses_range"
  CHECK (plazo_meses IS NULL OR (plazo_meses >= 1 AND plazo_meses <= 1200));

ALTER TABLE "contrato"
  ADD CONSTRAINT "contrato_periodo_gracia_dias_range"
  CHECK (periodo_gracia_dias IS NULL OR (periodo_gracia_dias >= 0 AND periodo_gracia_dias <= 3650));

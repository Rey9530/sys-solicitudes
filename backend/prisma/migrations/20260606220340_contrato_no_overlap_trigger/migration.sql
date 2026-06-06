-- T-050 · Trigger anti-solapamiento de contratos vigentes (RN-CO-3, docs/04 §1.1).
--
-- Rechaza cualquier INSERT/UPDATE que deje un contrato `vigente` cuyo rango
-- [fecha_inicio, fecha_fin) intersecte con otro contrato vigente del MISMO
-- local. `fecha_fin` NULL se trata como +infinito (S-ContratoIndefinido):
-- daterange(inicio, NULL, '[)') es un rango abierto por la derecha.
--
-- Notas:
--  - Solo valida cuando NEW.estado = 'vigente' (cerrar/cancelar nunca bloquea).
--  - Excluye el propio registro (c.id <> NEW.id) para que el UPDATE de un
--    contrato no se auto-bloquee.
--  - El mensaje empieza con 'CONTRATO_OVERLAP' para que el backend lo mapee
--    a 409 Conflict con código de dominio CONTRATO_OVERLAP (RFC 7807).

CREATE OR REPLACE FUNCTION fn_contrato_no_overlap() RETURNS trigger AS $$
BEGIN
  IF NEW.estado <> 'vigente' THEN
    RETURN NEW;
  END IF;

  -- Fechas invertidas: dejar pasar para que el CHECK contrato_fechas_chk
  -- rechace la fila con su propio error (daterange() lanzaría uno confuso).
  IF NEW.fecha_fin IS NOT NULL AND NEW.fecha_fin < NEW.fecha_inicio THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM contrato c
    WHERE c.local_id = NEW.local_id
      AND c.id <> NEW.id
      AND c.estado = 'vigente'
      AND daterange(c.fecha_inicio, c.fecha_fin, '[)')
          && daterange(NEW.fecha_inicio, NEW.fecha_fin, '[)')
  ) THEN
    RAISE EXCEPTION 'CONTRATO_OVERLAP: ya existe un contrato vigente solapado para el local %', NEW.local_id
      USING ERRCODE = 'exclusion_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_contrato_no_overlap
  BEFORE INSERT OR UPDATE ON contrato
  FOR EACH ROW
  EXECUTE FUNCTION fn_contrato_no_overlap();

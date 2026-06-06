-- T-066: máximo 5 supervisores por subcategoría (S-SC-A, S-MD-M).
-- BEFORE INSERT: la fila nueva aún no existe, por lo que `>= 5` equivale a
-- "ya hay 5 y este sería el 6º". DELETE no se restringe (permite re-INSERT).
-- UPDATE de la PK compuesta no se usa en la app (se hace DELETE + INSERT);
-- aun así el trigger cubre UPDATE OF subcategoria_id sin doble conteo porque
-- excluye la fila propia (OLD) cuando cambia de subcategoría.
CREATE OR REPLACE FUNCTION fn_subcategoria_max_5_supervisores()
RETURNS trigger AS $$
DECLARE
  supervisores_actuales integer;
BEGIN
  SELECT count(*) INTO supervisores_actuales
  FROM subcategoria_supervisor ss
  WHERE ss.subcategoria_id = NEW.subcategoria_id
    AND (TG_OP = 'INSERT' OR ss.usuario_id <> OLD.usuario_id);

  IF supervisores_actuales >= 5 THEN
    RAISE EXCEPTION 'SUBCATEGORIA_MAX_5_SUPERVISORES: la subcategoria % ya tiene 5 supervisores', NEW.subcategoria_id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_subcategoria_max_5_supervisores
  BEFORE INSERT OR UPDATE OF subcategoria_id ON subcategoria_supervisor
  FOR EACH ROW
  EXECUTE FUNCTION fn_subcategoria_max_5_supervisores();

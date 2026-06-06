-- T-074: generación de `codigo` SOL-{SLUG}-{seq} con secuencia por plaza.
--
-- ⚠️ ÚNICO punto que escapa al patrón RLS: la función es SECURITY DEFINER
-- (owner: superusuario de la migración) porque corre dentro del INSERT del
-- rol syssol_app y necesita (a) leer plaza.slug y (b) upsert en la tabla de
-- contadores, ambas fuera de la policy del tenant en curso no serían
-- accesibles de otro modo. El contador NO expone datos de negocio.
CREATE TABLE solicitud_codigo_seq (
  plaza_id     UUID PRIMARY KEY REFERENCES plaza(id),
  ultimo_valor BIGINT NOT NULL DEFAULT 0
);
-- Sin GRANT a syssol_app: solo la función SECURITY DEFINER la toca.

CREATE OR REPLACE FUNCTION fn_solicitud_set_codigo()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug text;
  v_seq  bigint;
BEGIN
  -- Respetar un codigo explícito (restore/imports); '' es el default de Prisma.
  IF NEW.codigo IS NOT NULL AND NEW.codigo <> '' THEN
    RETURN NEW;
  END IF;

  SELECT upper(left(slug, 8)) INTO v_slug FROM plaza WHERE id = NEW.plaza_id;

  INSERT INTO solicitud_codigo_seq (plaza_id, ultimo_valor)
  VALUES (NEW.plaza_id, 1)
  ON CONFLICT (plaza_id)
  DO UPDATE SET ultimo_valor = solicitud_codigo_seq.ultimo_valor + 1
  RETURNING ultimo_valor INTO v_seq;

  NEW.codigo := 'SOL-' || coalesce(v_slug, 'PLZ') || '-' || v_seq;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_solicitud_set_codigo
  BEFORE INSERT ON solicitud
  FOR EACH ROW
  EXECUTE FUNCTION fn_solicitud_set_codigo();

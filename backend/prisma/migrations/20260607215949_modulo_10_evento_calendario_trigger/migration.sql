-- Módulo 10 (cierre de T-128, decisión owner 2026-06-07): si una solicitud
-- aprobada de tipo `evento` cambia de estado (reversión solo-BD por
-- superadmin, S-FS-B), su evento_calendario se soft-deletea automáticamente.
--
-- SECURITY DEFINER: la reversión la ejecuta el superusuario directamente en
-- BD (sin contexto app.plaza_id), y el UPDATE del evento debe pasar por
-- encima de la policy RLS del tenant.

CREATE OR REPLACE FUNCTION fn_evento_calendario_soft_delete()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Solo aplica cuando deja de estar aprobada (la transición inversa
  -- aprobada → otro estado no existe en la state machine: es manual).
  IF OLD.estado = 'aprobada' AND NEW.estado <> 'aprobada' THEN
    UPDATE evento_calendario
       SET deleted_at = now()
     WHERE solicitud_id = NEW.id
       AND deleted_at IS NULL;
  END IF;
  -- Si vuelve a aprobarse (re-reversión), se restaura el evento.
  IF OLD.estado <> 'aprobada' AND NEW.estado = 'aprobada' THEN
    UPDATE evento_calendario
       SET deleted_at = NULL
     WHERE solicitud_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_evento_calendario_soft_delete ON solicitud;
CREATE TRIGGER tg_evento_calendario_soft_delete
  AFTER UPDATE OF estado ON solicitud
  FOR EACH ROW
  EXECUTE FUNCTION fn_evento_calendario_soft_delete();

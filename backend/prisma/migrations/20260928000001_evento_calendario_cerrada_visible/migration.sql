-- Calendario: las solicitudes CERRADAS siguen visibles (2026-09-28).
--
-- Bitácora:
--   - Síntoma:  al cerrar una solicitud aprobada (aprobada → cerrada,
--               T-091e-cerrar) su evento desaparecía del calendario del admin.
--   - Causa:    `fn_evento_calendario_soft_delete` (módulo 10) soft-deleteaba el
--               evento en CUALQUIER salida de `aprobada`; se escribió cuando
--               `aprobada` era terminal y la transición a `cerrada` no existía.
--   - Fix:      el evento solo se soft-deletea si la solicitud pasa a un estado
--               distinto de `aprobada`/`cerrada` (reversión manual en BD).
--   - Backfill: (1) restaura los eventos de solicitudes ya cerradas;
--               (2) crea el evento de las solicitudes `evento` aprobadas/cerradas
--               con fecha que no lo tienen (aprobadas antes del módulo 10).
--               Misma lógica que `AprobacionesService.upsertEventoCalendario`:
--               hora por defecto 00:00 / 23:59 en UTC-6; si fin <= inicio → +1h.
--   Idempotente.

CREATE OR REPLACE FUNCTION fn_evento_calendario_soft_delete()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Deja de estar vigente en el calendario solo si sale de aprobada/cerrada.
  IF OLD.estado IN ('aprobada', 'cerrada')
     AND NEW.estado NOT IN ('aprobada', 'cerrada') THEN
    UPDATE evento_calendario
       SET deleted_at = now()
     WHERE solicitud_id = NEW.id
       AND deleted_at IS NULL;
  END IF;
  -- Si vuelve a aprobada/cerrada (re-reversión), se restaura el evento.
  IF OLD.estado NOT IN ('aprobada', 'cerrada')
     AND NEW.estado IN ('aprobada', 'cerrada') THEN
    UPDATE evento_calendario
       SET deleted_at = NULL
     WHERE solicitud_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- (1) Restaurar eventos de solicitudes cerradas.
UPDATE evento_calendario e
   SET deleted_at = NULL,
       updated_at = CURRENT_TIMESTAMP
  FROM solicitud s
 WHERE s.id = e.solicitud_id
   AND s.estado IN ('aprobada', 'cerrada')
   AND e.deleted_at IS NOT NULL;

-- (2) Crear los eventos faltantes.
INSERT INTO evento_calendario (id, plaza_id, solicitud_id, titulo, inicio, fin, created_at, updated_at)
SELECT gen_random_uuid(),
       s.plaza_id,
       s.id,
       s.titulo,
       x.inicio,
       CASE WHEN x.fin <= x.inicio THEN x.inicio + INTERVAL '1 hour' ELSE x.fin END,
       CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP
  FROM solicitud s
 CROSS JOIN LATERAL (
         SELECT (s.fecha_evento_inicio::text || ' ' || COALESCE(s.hora_inicio, '00:00') || ':00-06')::timestamptz AS inicio,
                (COALESCE(s.fecha_evento_fin, s.fecha_evento_inicio)::text || ' ' || COALESCE(s.hora_fin, '23:59') || ':00-06')::timestamptz AS fin
       ) x
 WHERE s.tipo = 'evento'
   AND s.estado IN ('aprobada', 'cerrada')
   AND s.fecha_evento_inicio IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM evento_calendario e WHERE e.solicitud_id = s.id);

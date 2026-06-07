-- T-101: vista materializada del SLA visual (S-SLA, T-V03).
--
-- SLA efectivo = sla_dias_por_tipo[tipo] * sla_multiplicador_por_prioridad[prioridad].
-- El timer cuenta desde `enviada_at` (T-V03), NO desde asignada_at.
-- Refresco: cron diario 02:00 America/El_Salvador (REFRESH CONCURRENTLY).
--
-- RLS: las matviews no heredan políticas. syssol_app solo tiene SELECT y la
-- bandeja (admin-only) SIEMPRE filtra por el plaza_id del JWT en la query.
CREATE MATERIALIZED VIEW solicitud_sla_view AS
SELECT
  s.id,
  s.plaza_id,
  s.tipo,
  s.prioridad,
  s.enviada_at,
  ((c.sla_dias_por_tipo ->> s.tipo::text)::numeric
    * (c.sla_multiplicador_por_prioridad ->> s.prioridad::text)::numeric) AS sla_dias,
  CASE
    WHEN s.enviada_at IS NULL THEN NULL
    ELSE EXTRACT(EPOCH FROM (now() - s.enviada_at)) / 86400.0
      / NULLIF(((c.sla_dias_por_tipo ->> s.tipo::text)::numeric
        * (c.sla_multiplicador_por_prioridad ->> s.prioridad::text)::numeric), 0)
  END AS porcentaje,
  CASE
    WHEN s.enviada_at IS NULL THEN NULL
    WHEN EXTRACT(EPOCH FROM (now() - s.enviada_at)) / 86400.0
      / NULLIF(((c.sla_dias_por_tipo ->> s.tipo::text)::numeric
        * (c.sla_multiplicador_por_prioridad ->> s.prioridad::text)::numeric), 0) < 0.5
      THEN 'verde'
    WHEN EXTRACT(EPOCH FROM (now() - s.enviada_at)) / 86400.0
      / NULLIF(((c.sla_dias_por_tipo ->> s.tipo::text)::numeric
        * (c.sla_multiplicador_por_prioridad ->> s.prioridad::text)::numeric), 0) < 1.0
      THEN 'amarillo'
    ELSE 'rojo'
  END AS status
FROM solicitud s
JOIN configuracion c ON c.plaza_id = s.plaza_id
WHERE s.estado IN ('enviada', 'asignado', 'en_revision', 'requerida_subsanacion');

-- UNIQUE para poder usar REFRESH MATERIALIZED VIEW CONCURRENTLY.
CREATE UNIQUE INDEX solicitud_sla_view_id_idx ON solicitud_sla_view (id);
CREATE INDEX solicitud_sla_view_plaza_status_idx ON solicitud_sla_view (plaza_id, status);

GRANT SELECT ON solicitud_sla_view TO syssol_app;

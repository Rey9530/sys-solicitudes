-- T-091d-pausar: nuevo estado `pausada` y eventos de historial.
--
-- Estado `pausada`: reversible, congela el SLA (la matview solicitud_sla_view
--   ya filtra `estado IN ('enviada','asignado','en_revision','requerida_subsanacion')`
--   por lo que las solicitudes pausadas NO aparecen automáticamente — no
--   hay que reconstruir la matview).
-- Eventos `pausada`/`reanudada`: ciclo de la transición para auditoría.
--
-- ⚠️ GOTCHA — Prisma 7 envuelve las migraciones en BEGIN/COMMIT. En
-- PostgreSQL <14, `ALTER TYPE ... ADD VALUE IF NOT EXISTS` dentro de una
-- transacción se commitea OCULTAMENTE y Prisma marca la migración como
-- aplicada, pero los valores pueden quedar ROLLBACK al cerrar la tx.
-- Síntoma: `migrate status` dice OK, pero `enum_range(NULL::solicitud_estado)`
-- no incluye el nuevo valor. Lo vimos en PG 16 con Prisma 7.8: la migración
-- quedó marcada como aplicada pero los ALTER no se ejecutaron. Workaround:
-- ejecutar los ALTER manualmente desde una conexión FUERA de transacción
-- (psql, pg Client directo, Prisma Studio). PlanIFICACION/14 documenta
-- la secuencia exacta.
--
-- PG 12+: ALTER TYPE ... ADD VALUE se permite dentro de una transacción,
-- pero los nuevos valores no pueden USARSE hasta que la transacción
-- confirme. Aquí solo añadimos valores, no los usamos, por lo que es seguro.
ALTER TYPE solicitud_estado ADD VALUE IF NOT EXISTS 'pausada';

ALTER TYPE solicitud_historial_evento ADD VALUE IF NOT EXISTS 'pausada';
ALTER TYPE solicitud_historial_evento ADD VALUE IF NOT EXISTS 'reanudada';

-- T-091e-cerrar: nuevo estado terminal `cerrada` + resultado de cierre.
--
-- Cambio semántico: `aprobada` DEJA DE SER TERMINAL. Pasa a significar
-- "autorizada, pendiente de ejecución"; el terminal es ahora `cerrada`.
--
-- `solicitud_sla_view` NO se toca: su filtro
--   WHERE estado IN ('enviada','asignado','en_revision','requerida_subsanacion')
-- ya excluye `aprobada`, por lo que `cerrada` queda fuera automáticamente.
-- No se agrega SLA de ejecución (decisión del owner): el semáforo sigue
-- congelado desde la aprobación.
--
-- ⚠️ GOTCHA — Prisma 7 envuelve las migraciones en BEGIN/COMMIT. Ya lo
-- sufrimos en 20260727000001_solicitud_pausada: `migrate status` marcó la
-- migración como aplicada pero `enum_range(NULL::solicitud_estado)` no
-- incluía el valor nuevo. Si tras aplicar esta migración el enum no lista
-- 'cerrada', ejecutar los ALTER TYPE manualmente desde una conexión FUERA
-- de transacción (psql) y luego `prisma generate`.
--
-- PG 12+: ALTER TYPE ... ADD VALUE se permite dentro de una transacción,
-- pero los nuevos valores no pueden USARSE hasta que la transacción
-- confirme. Aquí solo los añadimos (el CREATE TYPE / ALTER TABLE de abajo
-- no referencian 'cerrada' como literal), por lo que es seguro.
ALTER TYPE solicitud_estado ADD VALUE IF NOT EXISTS 'cerrada';

ALTER TYPE solicitud_historial_evento ADD VALUE IF NOT EXISTS 'cerrada';

-- Resultado del cierre. Si NO es 'exitoso', `cierre_comentario` es
-- obligatorio (se valida en Zod + en SolicitudStateService.cerrar; no se
-- pone CHECK en BD para no bloquear backfills futuros).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'solicitud_resultado_cierre') THEN
    CREATE TYPE solicitud_resultado_cierre AS ENUM ('exitoso', 'parcial', 'fallido', 'no_realizado');
  END IF;
END
$$;

ALTER TABLE "solicitud"
  ADD COLUMN IF NOT EXISTS "resultado_cierre"  solicitud_resultado_cierre,
  ADD COLUMN IF NOT EXISTS "cierre_comentario" TEXT,
  ADD COLUMN IF NOT EXISTS "cerrada_at"        TIMESTAMPTZ(6);

-- Bandeja "aprobadas pendientes de cierre".
CREATE INDEX IF NOT EXISTS "solicitud_plaza_id_estado_decision_at_idx"
  ON "solicitud" ("plaza_id", "estado", "decision_at");

-- ── Permiso `solicitudes.cerrar` ────────────────────────────────────────────
-- El seed (seedPermisos/seedRolAdmin) solo cubre la plaza demo, así que aquí
-- lo propagamos a TODOS los roles de TODAS las plazas que ya podían aprobar.
-- Criterio: quien aprueba, cierra (misma persona autoriza y confirma).
INSERT INTO "permiso" ("id", "codigo", "modulo", "accion", "descripcion")
VALUES (
  gen_random_uuid(),
  'solicitudes.cerrar',
  'solicitudes',
  'cerrar',
  'Cerrar una solicitud aprobada indicando el resultado de la actividad (estado terminal).'
)
ON CONFLICT ("codigo") DO NOTHING;

INSERT INTO "rol_staff_permiso" ("rol_staff_id", "permiso_id", "plaza_id")
SELECT rsp."rol_staff_id", nuevo."id", rsp."plaza_id"
FROM "rol_staff_permiso" rsp
JOIN "permiso" origen ON origen."id" = rsp."permiso_id" AND origen."codigo" = 'solicitudes.aprobar'
CROSS JOIN (SELECT "id" FROM "permiso" WHERE "codigo" = 'solicitudes.cerrar') nuevo
ON CONFLICT ("rol_staff_id", "permiso_id") DO NOTHING;


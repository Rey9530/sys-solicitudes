-- Carga inicial desde Excel (PLANIFICACION/18-carga-inicial-excel.md, D10).
--
-- ── Permiso `contratos.importar` ────────────────────────────────────────────
-- El seed (seedPermisos/seedRolAdmin) solo cubre la plaza demo, así que aquí
-- lo propagamos a TODOS los roles de TODAS las plazas que ya podían crear
-- contratos. Criterio: quien da de alta contratos puede hacer la carga inicial.
INSERT INTO "permiso" ("id", "codigo", "modulo", "accion", "descripcion")
VALUES (
  gen_random_uuid(),
  'contratos.importar',
  'contratos',
  'importar',
  'Carga inicial desde Excel: crea locales, inquilinos y contratos en un solo paso.'
)
ON CONFLICT ("codigo") DO NOTHING;

INSERT INTO "rol_staff_permiso" ("rol_staff_id", "permiso_id", "plaza_id")
SELECT rsp."rol_staff_id", nuevo."id", rsp."plaza_id"
FROM "rol_staff_permiso" rsp
JOIN "permiso" origen ON origen."id" = rsp."permiso_id" AND origen."codigo" = 'contratos.crear'
CROSS JOIN (SELECT "id" FROM "permiso" WHERE "codigo" = 'contratos.importar') nuevo
ON CONFLICT ("rol_staff_id", "permiso_id") DO NOTHING;

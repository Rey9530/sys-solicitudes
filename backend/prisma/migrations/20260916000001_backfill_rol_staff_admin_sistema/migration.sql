-- Backfill: rol_staff "admin" del sistema para plazas que no lo tienen (2026-09-16).
--
-- Bitácora:
--   - Síntoma:  el admin inicial de una plaza creada vía POST /plazas quedaba
--               con un rol_staff (tecnico/ingeniero/supervisor) SIN permisos y
--               recibía 403 PERMISSION_DENIED en todo el panel.
--   - Causa:    PlazasService.create solo creaba los 3 roles por defecto; el rol
--               "admin" (es_sistema=true, todos los permisos) solo lo sembraba
--               `prisma/seed.ts` para la plaza demo.
--   - Fix app:  PlazasService.create ahora crea el rol "admin" con todos los
--               permisos del catálogo y lo usa por defecto para el admin inicial.
--   - Esta migración corrige las plazas YA existentes. Idempotente: solo inserta
--               el rol si falta y solo los permisos que falten.

INSERT INTO "rol_staff" (id, plaza_id, codigo, nombre, descripcion, es_sistema, activo, created_at, updated_at)
SELECT gen_random_uuid(),
       p.id,
       'admin',
       'Administrador del sistema',
       'Rol inamovible con todos los permisos del sistema. Único capaz de gestionar roles y asignar permisos. Se siembra automáticamente; no se puede borrar ni renombrar.',
       TRUE,
       TRUE,
       CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP
  FROM "plaza" p
 WHERE NOT EXISTS (
         SELECT 1 FROM "rol_staff" r WHERE r.plaza_id = p.id AND r.codigo = 'admin'
       );

INSERT INTO "rol_staff_permiso" (rol_staff_id, permiso_id, plaza_id, created_at)
SELECT r.id, pe.id, r.plaza_id, CURRENT_TIMESTAMP
  FROM "rol_staff" r
 CROSS JOIN "permiso" pe
 WHERE r.codigo = 'admin'
   AND r.es_sistema = TRUE
ON CONFLICT (rol_staff_id, permiso_id) DO NOTHING;

-- Plazas "huérfanas": ningún usuario activo tiene el rol del sistema, así que
-- nadie puede gestionar roles ni permisos. Se promueve a "admin" a los
-- admin_plaza activos cuyo rol_staff no tiene NINGÚN permiso (el caso del admin
-- inicial creado con tecnico/ingeniero/supervisor). No toca plazas que ya tienen
-- un administrador del sistema ni usuarios con permisos asignados.
UPDATE "usuario" u
   SET rol_staff_id = r_admin.id,
       updated_at   = CURRENT_TIMESTAMP
  FROM "rol" rol, "rol_staff" r_admin
 WHERE rol.id = u.rol_id
   AND rol.codigo = 'admin_plaza'
   AND u.deleted_at IS NULL
   AND u.plaza_id IS NOT NULL
   AND r_admin.plaza_id = u.plaza_id
   AND r_admin.codigo = 'admin'
   AND r_admin.es_sistema = TRUE
   AND NOT EXISTS (
         SELECT 1 FROM "rol_staff_permiso" rsp WHERE rsp.rol_staff_id = u.rol_staff_id
       )
   AND NOT EXISTS (
         SELECT 1
           FROM "usuario" u2
           JOIN "rol_staff" r2 ON r2.id = u2.rol_staff_id
          WHERE u2.plaza_id = u.plaza_id
            AND u2.deleted_at IS NULL
            AND r2.es_sistema = TRUE
       );

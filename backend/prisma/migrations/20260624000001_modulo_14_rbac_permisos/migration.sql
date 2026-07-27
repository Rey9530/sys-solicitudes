-- T-RBAC-1 · Módulo 14: RBAC granular (permisos + pivote rol_staff_permiso)
--
-- Cambios:
--   1. Catálogo global de permisos (`permiso`): sin plaza_id, sin RLS. Compartido
--      por todas las plazas; el gating por rol se aplica en la capa de aplicación
--      (solo admin_plaza / superadmin ven la matriz de permisos).
--   2. Pivote N:M `rol_staff_permiso`: PK compuesta `[rol_staff_id, permiso_id]`,
--      con `plaza_id` desnormalizado para soportar RLS. RLS heredada del
--      `rol_staff` (vía EXISTS) — mismo patrón que `subcategoria_supervisor`
--      hereda de `subcategoria`. Esto evita duplicar la lógica de aislamiento.
--   3. Campo `es_sistema BOOLEAN NOT NULL DEFAULT FALSE` en `rol_staff`: marca
--      roles inamovibles (e.g., "admin" del sistema). El backend rechaza DELETE
--      y edición de código/nombre cuando es_sistema=true.
--
-- Decisiones:
--   - Catálogo GLOBAL para `permiso` (no se replica por plaza).
--   - `rol_staff_permiso` hereda la RLS del `rol_staff` padre (EXISTS) para
--     mantener una sola fuente de verdad del aislamiento por tenant.
--   - `permiso` sin RLS: solo el admin client (superusuario) puede escribir;
--     el app client (syssol_app) solo tiene SELECT. La escritura se hace
--     exclusivamente desde `prisma db seed`.

-- CreateTable
CREATE TABLE "permiso" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "modulo" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "descripcion" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permiso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rol_staff_permiso" (
    "rol_staff_id" UUID NOT NULL,
    "permiso_id" UUID NOT NULL,
    "plaza_id" UUID NOT NULL,
    "otorgado_por" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rol_staff_permiso_pkey" PRIMARY KEY ("rol_staff_id","permiso_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "permiso_codigo_key" ON "permiso"("codigo");

-- CreateIndex
CREATE INDEX "rol_staff_permiso_plaza_id_idx" ON "rol_staff_permiso"("plaza_id");

-- CreateIndex
CREATE INDEX "rol_staff_permiso_permiso_id_idx" ON "rol_staff_permiso"("permiso_id");

-- AddForeignKey
ALTER TABLE "rol_staff_permiso" ADD CONSTRAINT "rol_staff_permiso_rol_staff_id_fkey" FOREIGN KEY ("rol_staff_id") REFERENCES "rol_staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rol_staff_permiso" ADD CONSTRAINT "rol_staff_permiso_permiso_id_fkey" FOREIGN KEY ("permiso_id") REFERENCES "permiso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rol_staff_permiso" ADD CONSTRAINT "rol_staff_permiso_otorgado_por_fkey" FOREIGN KEY ("otorgado_por") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- SQL manual del módulo 14 (no expresable en Prisma)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Campo es_sistema en rol_staff. Default false: los roles existentes
--    (tecnico, ingeniero, supervisor del seed) NO son roles del sistema.
ALTER TABLE "rol_staff" ADD COLUMN "es_sistema" BOOLEAN NOT NULL DEFAULT FALSE;

-- 2) RLS de `permiso` (T-RBAC-1): tabla GLOBAL (sin plaza_id). El admin client
--    (`syssol`) escribe los registros iniciales desde el seed. El app client
--    (`syssol_app`) solo puede SELECT. NO se aplica RLS porque no hay
--    discriminador de tenant; la visibilidad se controla por `@Roles` decorator
--    en el backend (solo admin_plaza / superadmin).
GRANT SELECT ON "permiso" TO syssol_app;

-- 3) RLS de `rol_staff_permiso`: hereda el aislamiento del `rol_staff` padre
--    vía EXISTS, igual que `subcategoria_supervisor` hereda de `subcategoria`.
--    Esto garantiza que un admin de plaza A jamás pueda ver/modificar los
--    permisos de un rol de la plaza B, aunque conozca el UUID del rol.
GRANT SELECT, INSERT, UPDATE, DELETE ON "rol_staff_permiso" TO syssol_app;
ALTER TABLE "rol_staff_permiso" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rol_staff_permiso" FORCE ROW LEVEL SECURITY;
CREATE POLICY "rol_staff_permiso_tenant_isolation" ON "rol_staff_permiso"
  USING (EXISTS (
    SELECT 1 FROM "rol_staff" r
    WHERE r."id" = "rol_staff_permiso"."rol_staff_id"
      AND r."plaza_id" = current_setting('app.plaza_id', true)::uuid
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "rol_staff" r
    WHERE r."id" = "rol_staff_permiso"."rol_staff_id"
      AND r."plaza_id" = current_setting('app.plaza_id', true)::uuid
  ));

-- 4) Defensa: el rol "admin" del sistema es inamovible. La validación fuerte
--    vive en el backend (`RolStaffService.guardar()`), pero aquí añadimos un
--    trigger que rechaza DELETE y UPDATE de campos críticos (codigo, nombre,
--    plaza_id) cuando es_sistema = true. Esto blinda la BD incluso si alguien
--    manipula la BD directamente.
CREATE OR REPLACE FUNCTION fn_rol_staff_sistema_inamovible()
RETURNS trigger AS $$
BEGIN
  IF OLD.es_sistema = TRUE THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'ROL_SISTEMA_NO_BORRABLE: el rol "%" es del sistema y no se puede eliminar', OLD.codigo
        USING ERRCODE = 'check_violation';
    END IF;
    -- UPDATE: rechazar cambios en codigo / nombre / plaza_id. Permite cambiar
    -- descripcion y activo para futuras necesidades (e.g., desactivar admin
    -- en casos extremos).
    IF NEW.codigo IS DISTINCT FROM OLD.codigo
       OR NEW.nombre IS DISTINCT FROM OLD.nombre
       OR NEW.plaza_id IS DISTINCT FROM OLD.plaza_id THEN
      RAISE EXCEPTION 'ROL_SISTEMA_NO_MODIFICABLE: el rol "%" es del sistema; codigo/nombre/plaza_id son inmutables', OLD.codigo
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_rol_staff_sistema_inamovible ON rol_staff;
CREATE TRIGGER tg_rol_staff_sistema_inamovible
  BEFORE UPDATE OR DELETE ON rol_staff
  FOR EACH ROW
  EXECUTE FUNCTION fn_rol_staff_sistema_inamovible();
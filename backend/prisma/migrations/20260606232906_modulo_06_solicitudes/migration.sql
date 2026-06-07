-- CreateEnum
CREATE TYPE "solicitud_estado" AS ENUM ('borrador', 'enviada', 'asignado', 'en_revision', 'requerida_subsanacion', 'aprobada', 'rechazada', 'cancelada');

-- CreateEnum
CREATE TYPE "solicitud_tipo" AS ENUM ('mantenimiento', 'evento', 'remodelacion', 'otro');

-- CreateEnum
CREATE TYPE "solicitud_historial_evento" AS ENUM ('creada', 'enviada', 'asignada', 'tomada', 'aprobada', 'rechazada', 'subsanada', 'reasignada', 'cancelada', 'comentario', 'adjunto_agregado', 'prioridad_cambiada');

-- CreateEnum
CREATE TYPE "comentario_tipo" AS ENUM ('decision', 'subsanacion', 'general');

-- CreateTable
CREATE TABLE "solicitud" (
    "id" UUID NOT NULL,
    "plaza_id" UUID NOT NULL,
    "local_id" UUID NOT NULL,
    "inquilino_id" UUID NOT NULL,
    "usuario_creador_id" UUID NOT NULL,
    "admin_asignado_id" UUID,
    "categoria_id" UUID,
    "subcategoria_id" UUID,
    "codigo" TEXT NOT NULL DEFAULT '',
    "tipo" "solicitud_tipo" NOT NULL,
    "prioridad" "solicitud_prioridad" NOT NULL DEFAULT 'B',
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "estado" "solicitud_estado" NOT NULL DEFAULT 'borrador',
    "campos_extra" JSONB NOT NULL DEFAULT '{}',
    "fecha_evento_inicio" DATE,
    "fecha_evento_fin" DATE,
    "hora_inicio" TEXT,
    "hora_fin" TEXT,
    "enviada_at" TIMESTAMPTZ(6),
    "asignada_at" TIMESTAMPTZ(6),
    "decision_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "solicitud_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitud_historial" (
    "id" UUID NOT NULL,
    "plaza_id" UUID NOT NULL,
    "solicitud_id" UUID NOT NULL,
    "usuario_id" UUID,
    "evento" "solicitud_historial_evento" NOT NULL,
    "estado_anterior" "solicitud_estado",
    "estado_nuevo" "solicitud_estado",
    "comentario" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitud_historial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comentario" (
    "id" UUID NOT NULL,
    "plaza_id" UUID NOT NULL,
    "solicitud_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "tipo" "comentario_tipo" NOT NULL DEFAULT 'general',
    "cuerpo" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comentario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "solicitud_plaza_id_estado_idx" ON "solicitud"("plaza_id", "estado");

-- CreateIndex
CREATE INDEX "solicitud_plaza_id_local_id_created_at_idx" ON "solicitud"("plaza_id", "local_id", "created_at");

-- CreateIndex
CREATE INDEX "solicitud_plaza_id_tipo_created_at_idx" ON "solicitud"("plaza_id", "tipo", "created_at");

-- CreateIndex
CREATE INDEX "solicitud_plaza_id_fecha_evento_inicio_idx" ON "solicitud"("plaza_id", "fecha_evento_inicio");

-- CreateIndex
CREATE INDEX "solicitud_plaza_id_admin_asignado_id_estado_idx" ON "solicitud"("plaza_id", "admin_asignado_id", "estado");

-- CreateIndex
CREATE INDEX "solicitud_plaza_id_estado_enviada_at_idx" ON "solicitud"("plaza_id", "estado", "enviada_at");

-- CreateIndex
CREATE UNIQUE INDEX "solicitud_plaza_id_codigo_key" ON "solicitud"("plaza_id", "codigo");

-- CreateIndex
CREATE INDEX "solicitud_historial_solicitud_id_created_at_idx" ON "solicitud_historial"("solicitud_id", "created_at");

-- CreateIndex
CREATE INDEX "comentario_solicitud_id_created_at_idx" ON "comentario"("solicitud_id", "created_at");

-- AddForeignKey
ALTER TABLE "solicitud" ADD CONSTRAINT "solicitud_plaza_id_fkey" FOREIGN KEY ("plaza_id") REFERENCES "plaza"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud" ADD CONSTRAINT "solicitud_local_id_fkey" FOREIGN KEY ("local_id") REFERENCES "local"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud" ADD CONSTRAINT "solicitud_inquilino_id_fkey" FOREIGN KEY ("inquilino_id") REFERENCES "inquilino"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud" ADD CONSTRAINT "solicitud_usuario_creador_id_fkey" FOREIGN KEY ("usuario_creador_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud" ADD CONSTRAINT "solicitud_admin_asignado_id_fkey" FOREIGN KEY ("admin_asignado_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud" ADD CONSTRAINT "solicitud_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud" ADD CONSTRAINT "solicitud_subcategoria_id_fkey" FOREIGN KEY ("subcategoria_id") REFERENCES "subcategoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_historial" ADD CONSTRAINT "solicitud_historial_plaza_id_fkey" FOREIGN KEY ("plaza_id") REFERENCES "plaza"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_historial" ADD CONSTRAINT "solicitud_historial_solicitud_id_fkey" FOREIGN KEY ("solicitud_id") REFERENCES "solicitud"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitud_historial" ADD CONSTRAINT "solicitud_historial_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comentario" ADD CONSTRAINT "comentario_plaza_id_fkey" FOREIGN KEY ("plaza_id") REFERENCES "plaza"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comentario" ADD CONSTRAINT "comentario_solicitud_id_fkey" FOREIGN KEY ("solicitud_id") REFERENCES "solicitud"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comentario" ADD CONSTRAINT "comentario_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- SQL manual del módulo 06 (no expresable en Prisma)
-- ─────────────────────────────────────────────────────────────────────────────

-- RLS (T-038) para las 3 tablas nuevas. Patrón estándar por plaza_id.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['solicitud','solicitud_historial','comentario']
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO syssol_app;', t);
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I '
      'USING (plaza_id = current_setting(''app.plaza_id'', true)::uuid) '
      'WITH CHECK (plaza_id = current_setting(''app.plaza_id'', true)::uuid);',
      t || '_tenant_isolation', t);
  END LOOP;
END
$$;

-- T-075/T-105 (RI-1): solicitud_historial es APPEND-ONLY.
-- Defensa 1: el rol de la app pierde UPDATE/DELETE.
REVOKE UPDATE, DELETE ON "solicitud_historial" FROM syssol_app;
-- Defensa 2: trigger que rechaza UPDATE/DELETE de cualquier rol.
CREATE OR REPLACE FUNCTION fn_solicitud_historial_no_update_delete()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'SOLICITUD_HISTORIAL_INMUTABLE: la tabla solicitud_historial es append-only (%)', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_solicitud_historial_no_update_delete
  BEFORE UPDATE OR DELETE ON solicitud_historial
  FOR EACH ROW
  EXECUTE FUNCTION fn_solicitud_historial_no_update_delete();

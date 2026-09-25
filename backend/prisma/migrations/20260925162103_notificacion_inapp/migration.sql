-- Notificaciones in-app (campana del topbar, PLANIFICACION/16). Bandeja por
-- usuario generada por el backend en la misma tx que cada transición/evento.

-- CreateTable
CREATE TABLE "notificacion" (
    "id" UUID NOT NULL,
    "plaza_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "solicitud_id" UUID,
    "contrato_id" UUID,
    "leida_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notificacion_usuario_id_leida_at_idx" ON "notificacion"("usuario_id", "leida_at");

-- CreateIndex
CREATE INDEX "notificacion_usuario_id_created_at_idx" ON "notificacion"("usuario_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notificacion_created_at_idx" ON "notificacion"("created_at");

-- AddForeignKey
ALTER TABLE "notificacion" ADD CONSTRAINT "notificacion_plaza_id_fkey" FOREIGN KEY ("plaza_id") REFERENCES "plaza"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacion" ADD CONSTRAINT "notificacion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacion" ADD CONSTRAINT "notificacion_solicitud_id_fkey" FOREIGN KEY ("solicitud_id") REFERENCES "solicitud"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacion" ADD CONSTRAINT "notificacion_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "contrato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS (T-038, segunda capa multi-tenant) — mismo patrón que el resto de
-- tablas de negocio. El servicio además filtra por usuario_id = JWT.sub.
-- El cron de limpieza (90 días) usa el admin client (sin contexto de tenant).
GRANT SELECT, INSERT, UPDATE, DELETE ON "notificacion" TO syssol_app;
ALTER TABLE "notificacion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notificacion" FORCE ROW LEVEL SECURITY;
CREATE POLICY "notificacion_tenant_isolation" ON "notificacion"
  USING (plaza_id = current_setting('app.plaza_id', true)::uuid)
  WITH CHECK (plaza_id = current_setting('app.plaza_id', true)::uuid);

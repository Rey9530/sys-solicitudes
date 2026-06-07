-- CreateIndex
CREATE INDEX "adjunto_entidad_tipo_entidad_id_idx" ON "adjunto"("entidad_tipo", "entidad_id");

-- CreateIndex
CREATE INDEX "adjunto_deleted_at_idx" ON "adjunto"("deleted_at");

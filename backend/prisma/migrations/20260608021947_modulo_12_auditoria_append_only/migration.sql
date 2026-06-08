-- Módulo 12 (T-146): endurecimiento de `auditoria` (append-only).
-- La tabla existe desde T-040 (versión mínima); aquí se completa:
--   1. Índices faltantes del plan: (usuario_id, created_at) y (accion).
--   2. Trigger que rechaza UPDATE/DELETE (mismo patrón que solicitud_historial).
--   3. REVOKE UPDATE/DELETE al rol de la app (solo INSERT + SELECT).

-- CreateIndex
CREATE INDEX "auditoria_usuario_id_created_at_idx" ON "auditoria"("usuario_id", "created_at");
CREATE INDEX "auditoria_accion_idx" ON "auditoria"("accion");

-- Trigger append-only (RI: la auditoría es inmutable).
CREATE OR REPLACE FUNCTION fn_auditoria_no_update_delete()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'auditoria es append-only: % no permitido', TG_OP
    USING ERRCODE = 'raise_exception';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_auditoria_no_update_delete ON auditoria;
CREATE TRIGGER tg_auditoria_no_update_delete
  BEFORE UPDATE OR DELETE ON auditoria
  FOR EACH ROW
  EXECUTE FUNCTION fn_auditoria_no_update_delete();

-- Defensa en profundidad: el rol de la app ni siquiera tiene el privilegio.
REVOKE UPDATE, DELETE ON "auditoria" FROM syssol_app;

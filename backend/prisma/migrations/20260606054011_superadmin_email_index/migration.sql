-- Índice parcial único para emails de superadmin (plaza_id IS NULL).
-- UNIQUE(plaza_id, email) no aplica unicidad cuando plaza_id es NULL
-- (en SQL los NULL se consideran distintos entre sí), por lo que se refuerza
-- la unicidad de superadmins por email. Detalles: PLANIFICACION/02 T-018, RN-AU-1.
CREATE UNIQUE INDEX "usuario_email_superadmin_uniq" ON "usuario" ("email") WHERE "plaza_id" IS NULL;

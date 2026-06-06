-- CreateEnum
CREATE TYPE "solicitud_prioridad" AS ENUM ('A', 'B', 'C', 'D', 'F');

-- CreateTable
CREATE TABLE "categoria" (
    "id" UUID NOT NULL,
    "plaza_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subcategoria" (
    "id" UUID NOT NULL,
    "plaza_id" UUID NOT NULL,
    "categoria_id" UUID NOT NULL,
    "responsable_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "prioridad" "solicitud_prioridad" NOT NULL DEFAULT 'B',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "subcategoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subcategoria_supervisor" (
    "subcategoria_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subcategoria_supervisor_pkey" PRIMARY KEY ("subcategoria_id","usuario_id")
);

-- CreateIndex
CREATE INDEX "categoria_plaza_id_activo_idx" ON "categoria"("plaza_id", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "categoria_plaza_id_nombre_key" ON "categoria"("plaza_id", "nombre");

-- CreateIndex
CREATE INDEX "subcategoria_plaza_id_activo_idx" ON "subcategoria"("plaza_id", "activo");

-- CreateIndex
CREATE INDEX "subcategoria_responsable_id_idx" ON "subcategoria"("responsable_id");

-- CreateIndex
CREATE UNIQUE INDEX "subcategoria_categoria_id_nombre_key" ON "subcategoria"("categoria_id", "nombre");

-- CreateIndex
CREATE INDEX "subcategoria_supervisor_usuario_id_idx" ON "subcategoria_supervisor"("usuario_id");

-- AddForeignKey
ALTER TABLE "categoria" ADD CONSTRAINT "categoria_plaza_id_fkey" FOREIGN KEY ("plaza_id") REFERENCES "plaza"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subcategoria" ADD CONSTRAINT "subcategoria_plaza_id_fkey" FOREIGN KEY ("plaza_id") REFERENCES "plaza"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subcategoria" ADD CONSTRAINT "subcategoria_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subcategoria" ADD CONSTRAINT "subcategoria_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subcategoria_supervisor" ADD CONSTRAINT "subcategoria_supervisor_subcategoria_id_fkey" FOREIGN KEY ("subcategoria_id") REFERENCES "subcategoria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subcategoria_supervisor" ADD CONSTRAINT "subcategoria_supervisor_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- SQL manual del módulo 05 (no expresable en Prisma)
-- ─────────────────────────────────────────────────────────────────────────────

-- RLS (T-038, segunda capa multi-tenant) para categoria y subcategoria.
-- Mismo patrón que módulos anteriores: ENABLE + FORCE + policy por plaza_id.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['categoria','subcategoria']
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

-- RLS de subcategoria_supervisor (T-065): sin plaza_id propio, hereda el
-- aislamiento de la subcategoria via EXISTS (la subquery interna también
-- corre bajo la policy de subcategoria, que ya filtra por app.plaza_id).
GRANT SELECT, INSERT, UPDATE, DELETE ON "subcategoria_supervisor" TO syssol_app;
ALTER TABLE "subcategoria_supervisor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subcategoria_supervisor" FORCE ROW LEVEL SECURITY;
CREATE POLICY "subcategoria_supervisor_tenant_isolation" ON "subcategoria_supervisor"
  USING (EXISTS (
    SELECT 1 FROM "subcategoria" s
    WHERE s."id" = "subcategoria_supervisor"."subcategoria_id"
      AND s."plaza_id" = current_setting('app.plaza_id', true)::uuid
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "subcategoria" s
    WHERE s."id" = "subcategoria_supervisor"."subcategoria_id"
      AND s."plaza_id" = current_setting('app.plaza_id', true)::uuid
  ));

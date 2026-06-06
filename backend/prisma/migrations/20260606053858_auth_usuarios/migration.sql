-- CreateTable
CREATE TABLE "rol" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plaza" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "nombre_comercial" TEXT NOT NULL,
    "email_contacto" TEXT,
    "telefono_contacto" TEXT,
    "logo_url" TEXT,
    "color_primario" TEXT NOT NULL DEFAULT '#2563eb',
    "timezone" TEXT NOT NULL DEFAULT 'America/El_Salvador',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "plaza_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracion" (
    "id" UUID NOT NULL,
    "plaza_id" UUID NOT NULL,
    "tamanio_max_archivo_mb" INTEGER NOT NULL DEFAULT 50,
    "mime_types_permitidos" JSONB NOT NULL DEFAULT '["application/pdf","image/jpeg","image/png","image/webp","application/vnd.ms-excel","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/dwg"]',
    "sla_dias_por_tipo" JSONB NOT NULL DEFAULT '{"mantenimiento":5,"evento":3,"remodelacion":15,"otro":7}',
    "sla_multiplicador_por_prioridad" JSONB NOT NULL DEFAULT '{"A":0.5,"B":1.0,"C":1.5,"D":2.0,"F":3.0}',
    "calendar_mostrar_hitos_contrato" BOOLEAN NOT NULL DEFAULT true,
    "aprobacion_especial_asistentes_min" INTEGER NOT NULL DEFAULT 200,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "configuracion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id" UUID NOT NULL,
    "plaza_id" UUID,
    "inquilino_id" UUID,
    "rol_id" UUID NOT NULL,
    "rol_staff_id" UUID,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "email_invalido" BOOLEAN NOT NULL DEFAULT false,
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rol_staff" (
    "id" UUID NOT NULL,
    "plaza_id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "rol_staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_token" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "user_agent" TEXT,
    "ip" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_token" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditoria_login" (
    "id" UUID NOT NULL,
    "plaza_id" UUID,
    "usuario_id" UUID,
    "email" TEXT NOT NULL,
    "exitoso" BOOLEAN NOT NULL,
    "motivo_fallo" TEXT,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_login_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rol_codigo_key" ON "rol"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "plaza_slug_key" ON "plaza"("slug");

-- CreateIndex
CREATE INDEX "plaza_deleted_at_idx" ON "plaza"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "configuracion_plaza_id_key" ON "configuracion"("plaza_id");

-- CreateIndex
CREATE INDEX "usuario_rol_id_idx" ON "usuario"("rol_id");

-- CreateIndex
CREATE INDEX "usuario_deleted_at_idx" ON "usuario"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_plaza_id_email_key" ON "usuario"("plaza_id", "email");

-- CreateIndex
CREATE INDEX "rol_staff_plaza_id_activo_idx" ON "rol_staff"("plaza_id", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "rol_staff_plaza_id_codigo_key" ON "rol_staff"("plaza_id", "codigo");

-- CreateIndex
CREATE INDEX "refresh_token_usuario_id_idx" ON "refresh_token"("usuario_id");

-- CreateIndex
CREATE INDEX "password_reset_token_usuario_id_idx" ON "password_reset_token"("usuario_id");

-- CreateIndex
CREATE INDEX "auditoria_login_email_created_at_idx" ON "auditoria_login"("email", "created_at");

-- CreateIndex
CREATE INDEX "auditoria_login_plaza_id_created_at_idx" ON "auditoria_login"("plaza_id", "created_at");

-- AddForeignKey
ALTER TABLE "configuracion" ADD CONSTRAINT "configuracion_plaza_id_fkey" FOREIGN KEY ("plaza_id") REFERENCES "plaza"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_plaza_id_fkey" FOREIGN KEY ("plaza_id") REFERENCES "plaza"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "rol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_rol_staff_id_fkey" FOREIGN KEY ("rol_staff_id") REFERENCES "rol_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rol_staff" ADD CONSTRAINT "rol_staff_plaza_id_fkey" FOREIGN KEY ("plaza_id") REFERENCES "plaza"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_token" ADD CONSTRAINT "refresh_token_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_token" ADD CONSTRAINT "password_reset_token_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria_login" ADD CONSTRAINT "auditoria_login_plaza_id_fkey" FOREIGN KEY ("plaza_id") REFERENCES "plaza"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria_login" ADD CONSTRAINT "auditoria_login_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

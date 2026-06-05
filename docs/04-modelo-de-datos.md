# 04 · Modelo de Datos

> **Código del documento:** `DOC-04-MD`
> **Estado:** Borrador para validación
> **Origen:** Decisiones D1, D2, D3 + análisis de los 9 módulos de la cotización
> **ORM de referencia:** Prisma (`schema.prisma`). SQL canónico en §4.10.

---

## 4.1. Principios de diseño

1. **Multi-tenant por discriminador `plaza_id`:** toda tabla de negocio tiene `plaza_id NOT NULL` y FK a `plaza.id`. Los `superadmin` no usan `plaza_id`.
2. **Soft delete por defecto:** `deleted_at` (nullable) en `plaza`, `usuario`, `inquilino`, `local`, `contrato`. Las solicitudes nunca se borran.
3. **Timestamps universales:** `created_at` y `updated_at` en todas las tablas (`TIMESTAMPTZ`).
4. **UUIDs como PK:** `UUID v4` para todas las PK. Secuencias enteras solo donde el rendimiento lo justifique.
5. **Campos JSONB validados:** los campos dinámicos (campos extra por tipo de solicitud, variables de email, configuración de plaza) se almacenan como `JSONB` con un esquema Zod en la capa de aplicación.
6. **Inmutabilidad de auditoría:** tablas `solicitud_historial`, `email_log`, `auditoria` son append-only.
7. **Row-Level Security (RLS):** habilitada como segunda capa en PostgreSQL. Política `USING (plaza_id = current_setting('app.plaza_id')::uuid)`.

---

## 4.2. Diagrama Entidad-Relación

```mermaid
erDiagram
    plaza ||--o{ usuario : "tiene"
    plaza ||--o{ local : "agrupa"
    plaza ||--o{ inquilino : "agrupa"
    plaza ||--o{ solicitud : "contiene"
    plaza ||--o{ email_log : "emite"
    plaza ||--o{ auditoria : "registra"
    plaza ||--o{ configuracion : "tiene"
    plaza ||--o{ reporte_programado : "define"

    usuario ||--o{ refresh_token : "tiene"
    usuario ||--o{ password_reset_token : "solicita"
    usuario }o--|| rol : "tiene"
    usuario }o--o| inquilino : "representa (si rol=inquilino)"

    inquilino ||--o{ contrato : "firma"
    inquilino ||--o{ solicitud : "origina"

    local ||--o{ contrato : "es_alquilado_en"
    local ||--o{ solicitud : "es_objeto_de"
    local ||--o{ adjunto : "tiene (planos)"

    contrato ||--o{ adjunto_contrato : "tiene (PDF firmado)"

    solicitud ||--o{ solicitud_historial : "registra"
    solicitud ||--o{ comentario : "tiene"
    solicitud ||--o{ adjunto : "tiene"
    solicitud ||--|| evento_calendario : "genera (si tipo=evento y aprobada)"

    plaza {
        uuid id PK
        string slug UK
        string nombre_comercial
        string email_contacto
        string telefono_contacto
        string logo_url
        string color_primario
        string timezone
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }
    usuario {
        uuid id PK
        uuid plaza_id FK
        uuid inquilino_id FK "nullable, solo si rol=inquilino"
        uuid rol_id FK
        string email
        string password_hash
        string nombre
        string telefono
        boolean email_invalido
        timestamp last_login_at
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }
    rol {
        uuid id PK
        string codigo UK "superadmin|admin_plaza|inquilino"
        string nombre
        string descripcion
    }
    inquilino {
        uuid id PK
        uuid plaza_id FK
        string razon_social
        string identificacion "RUC/ID"
        string direccion
        string contacto_nombre
        string contacto_email
        string contacto_telefono
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }
    local {
        uuid id PK
        uuid plaza_id FK
        string codigo
        string nombre
        decimal metraje_m2
        string piso
        string sector
        string descripcion
        string estado "disponible|alquilado|en_mantenimiento|fuera_de_servicio"
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }
    contrato {
        uuid id PK
        uuid plaza_id FK
        uuid local_id FK
        uuid inquilino_id FK
        date fecha_inicio
        date fecha_fin "nullable=indefinido (SUPUESTO)"
        decimal monto_mensual
        string moneda "USD/PEN/etc"
        string condiciones
        string estado "vigente|finalizado|cancelado"
        date fecha_fin_efectiva
        string motivo_fin
        timestamp created_at
        timestamp updated_at
    }
    solicitud {
        uuid id PK
        uuid plaza_id FK
        uuid local_id FK
        uuid inquilino_id FK
        uuid usuario_creador_id FK
        uuid admin_asignado_id FK "nullable"
        string codigo "formato SOL-{plaza_id_short}-{seq}"
        string tipo "mantenimiento|evento|remodelacion|otro"
        string titulo
        string descripcion
        string estado "borrador|enviada|en_revision|aprobada|rechazada|cancelada|requerida_subsanacion"
        jsonb campos_extra
        date fecha_evento_inicio "si tipo=evento"
        date fecha_evento_fin
        time hora_inicio
        time hora_fin
        timestamp enviada_at
        timestamp decision_at
        timestamp created_at
        timestamp updated_at
    }
    solicitud_historial {
        uuid id PK
        uuid plaza_id FK
        uuid solicitud_id FK
        uuid usuario_id FK
        string evento "creada|enviada|tomada|aprobada|rechazada|subsanada|cancelada|comentario|adjunto_agregado"
        string estado_anterior
        string estado_nuevo
        string comentario
        timestamp created_at
    }
    comentario {
        uuid id PK
        uuid plaza_id FK
        uuid solicitud_id FK
        uuid usuario_id FK
        string tipo "decision|subsanacion|general"
        text cuerpo
        timestamp created_at
    }
    adjunto {
        uuid id PK
        uuid plaza_id FK
        string entidad_tipo "solicitud|local|contrato"
        uuid entidad_id
        string nombre_original
        string mime_type
        integer tamano_bytes
        string storage_key "ruta en MinIO"
        uuid usuario_subio_id FK
        timestamp created_at
        timestamp deleted_at
    }
    evento_calendario {
        uuid id PK
        uuid plaza_id FK
        uuid solicitud_id FK UK
        string titulo
        timestamp inicio
        timestamp fin
        string color
    }
    refresh_token {
        uuid id PK
        uuid usuario_id FK
        string token_hash
        timestamp expires_at
        timestamp revoked_at
        string user_agent
        string ip
        timestamp created_at
    }
    password_reset_token {
        uuid id PK
        uuid usuario_id FK
        string token_hash
        timestamp expires_at
        timestamp used_at
        timestamp created_at
    }
    email_log {
        uuid id PK
        uuid plaza_id FK
        string destinatario
        string plantilla
        jsonb variables
        string estado "pendiente|enviado|fallido"
        integer reintentos
        string last_error
        timestamp sent_at
        timestamp created_at
    }
    auditoria {
        uuid id PK
        uuid plaza_id FK "nullable para superadmin"
        uuid usuario_id FK
        string accion
        string entidad_tipo
        uuid entidad_id
        jsonb antes
        jsonb despues
        string ip
        string user_agent
        timestamp created_at
    }
    configuracion {
        uuid id PK
        uuid plaza_id FK UK
        jsonb tamanio_max_archivo_mb
        jsonb mime_types_permitidos
        jsonb sla_dias_por_tipo
        boolean calendar_mostrar_hitos_contrato
        timestamp updated_at
    }
    reporte_programado {
        uuid id PK
        uuid plaza_id FK
        string nombre
        string tipo_reporte
        jsonb filtros
        string cron
        string destinatarios
        boolean activo
        timestamp created_at
    }
```

---

## 4.3. Tablas: descripción detallada

### 4.3.1. `plaza`

Raíz del multi-tenant. Una fila por plaza comercial dada de alta.

| Atributo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `slug` | TEXT UNIQUE NOT NULL | Inmutable. Se usa para resolver el tenant por subdominio/path. |
| `nombre_comercial` | TEXT NOT NULL | Aparece en el header y en los emails. |
| `email_contacto` | TEXT | |
| `telefono_contacto` | TEXT | |
| `logo_url` | TEXT | Apunta a un objeto en MinIO. |
| `color_primario` | TEXT | HEX. Usado como variable CSS. |
| `timezone` | TEXT NOT NULL | IANA, p. ej. `America/Costa_Rica`. |
| `created_at`, `updated_at`, `deleted_at` | TIMESTAMPTZ | |

**Índices:** UNIQUE(`slug`), INDEX(`deleted_at`).

### 4.3.2. `rol`

Catálogo fijo cargado por migración (no editable por UI).

| `codigo` | Uso |
|---|---|
| `superadmin` | Plataforma. Gestiona plazas. |
| `admin_plaza` | Cliente. Gestiona su plaza. |
| `inquilino` | Cliente. Gestiona sus solicitudes. |

### 4.3.3. `usuario`

| Atributo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `plaza_id` | UUID FK → `plaza.id` | NULL para `superadmin`. |
| `inquilino_id` | UUID FK → `inquilino.id` | NULL salvo si `rol=inquilino`. |
| `rol_id` | UUID FK → `rol.id` | |
| `email` | TEXT NOT NULL | Único por plaza: `UNIQUE(plaza_id, email)`. |
| `password_hash` | TEXT NOT NULL | bcrypt cost 12. |
| `nombre` | TEXT NOT NULL | |
| `telefono` | TEXT | |
| `email_invalido` | BOOLEAN | Marcado tras hard bounce. |
| `last_login_at` | TIMESTAMPTZ | |
| `created_at`, `updated_at`, `deleted_at` | TIMESTAMPTZ | |

**Índices:** UNIQUE(`plaza_id`, `email`), INDEX(`rol_id`), INDEX(`deleted_at`).

### 4.3.4. `inquilino`

Persona jurídica o física que alquila locales. Independiente de la cuenta de usuario (un inquilino puede tener varios usuarios).

| Atributo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `plaza_id` | UUID FK → `plaza.id` | |
| `razon_social` | TEXT NOT NULL | |
| `identificacion` | TEXT | RUC/ID. |
| `direccion` | TEXT | |
| `contacto_nombre` | TEXT | |
| `contacto_email` | TEXT | |
| `contacto_telefono` | TEXT | |

**Índices:** INDEX(`plaza_id`), UNIQUE(`plaza_id`, `identificacion`) cuando identificación no es NULL.

### 4.3.5. `local`

| Atributo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `plaza_id` | UUID FK | |
| `codigo` | TEXT NOT NULL | Único por plaza. |
| `nombre` | TEXT | |
| `metraje_m2` | DECIMAL(10,2) | |
| `piso`, `sector` | TEXT | |
| `descripcion` | TEXT | |
| `estado` | ENUM | `disponible`, `alquilado`, `en_mantenimiento`, `fuera_de_servicio`. |

**Índices:** UNIQUE(`plaza_id`, `codigo`), INDEX(`plaza_id`, `estado`).

### 4.3.6. `contrato`

| Atributo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `plaza_id`, `local_id`, `inquilino_id` | UUID FK | |
| `fecha_inicio` | DATE NOT NULL | |
| `fecha_fin` | DATE | NULL = indefinido. |
| `monto_mensual` | DECIMAL(12,2) | Referencial. |
| `moneda` | CHAR(3) | ISO 4217. |
| `condiciones` | TEXT | |
| `estado` | ENUM | `vigente`, `finalizado`, `cancelado`. |
| `fecha_fin_efectiva` | DATE | |
| `motivo_fin` | TEXT | |

**Índices:** INDEX(`plaza_id`, `local_id`, `estado`), INDEX(`plaza_id`, `inquilino_id`, `estado`).

**Restricción:** no se permiten dos contratos `vigente` solapados para el mismo `local_id`. Se implementa con un trigger o con una vista materializada y validación en backend.

### 4.3.7. `solicitud`

Núcleo del sistema. Ver [`05-flujo-de-solicitudes.md`](./05-flujo-de-solicitudes.md) para la máquina de estados.

| Atributo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `plaza_id` | UUID FK | |
| `local_id` | UUID FK | |
| `inquilino_id` | UUID FK | |
| `usuario_creador_id` | UUID FK → `usuario.id` | |
| `admin_asignado_id` | UUID FK → `usuario.id` | NULL hasta que se toma. |
| `codigo` | TEXT | Formato `SOL-{plaza_short}-{seq}` (SUPUESTO). |
| `tipo` | ENUM | `mantenimiento`, `evento`, `remodelacion`, `otro`. |
| `titulo` | TEXT | ≤ 120 chars. |
| `descripcion` | TEXT | ≤ 4000 chars. |
| `estado` | ENUM | Ver §4.3.8. |
| `campos_extra` | JSONB | Validados con Zod por tipo. |
| `fecha_evento_inicio`, `fecha_evento_fin` | DATE | Solo si tipo = `evento` o `remodelacion`. |
| `hora_inicio`, `hora_fin` | TIME | Solo si tipo = `evento`. |
| `enviada_at`, `decision_at` | TIMESTAMPTZ | |

**Índices:**
- UNIQUE(`plaza_id`, `codigo`).
- INDEX(`plaza_id`, `estado`).
- INDEX(`plaza_id`, `local_id`, `created_at`).
- INDEX(`plaza_id`, `tipo`, `created_at`).
- INDEX(`plaza_id`, `fecha_evento_inicio`).

### 4.3.8. ENUM `solicitud_estado`

```sql
CREATE TYPE solicitud_estado AS ENUM (
  'borrador',
  'enviada',
  'en_revision',
  'aprobada',
  'rechazada',
  'cancelada',
  'requerida_subsanacion'
);
```

### 4.3.9. `solicitud_historial`

Append-only. Una fila por evento relevante de la solicitud.

| Atributo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `plaza_id` | UUID FK | |
| `solicitud_id` | UUID FK | |
| `usuario_id` | UUID FK | Quién causó el evento. |
| `evento` | ENUM | `creada`, `enviada`, `tomada`, `aprobada`, `rechazada`, `subsanada`, `cancelada`, `comentario`, `adjunto_agregado`. |
| `estado_anterior`, `estado_nuevo` | `solicitud_estado` | |
| `comentario` | TEXT | |

**Índices:** INDEX(`solicitud_id`, `created_at`).

### 4.3.10. `comentario`

| Atributo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `plaza_id`, `solicitud_id`, `usuario_id` | UUID FK | |
| `tipo` | ENUM | `decision`, `subsanacion`, `general`. |
| `cuerpo` | TEXT NOT NULL | |

### 4.3.11. `adjunto` (polimórfico)

| Atributo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `plaza_id` | UUID FK | |
| `entidad_tipo` | ENUM | `solicitud`, `local`, `contrato`. |
| `entidad_id` | UUID | FK lógica (no se declara para mantener polimorfismo). |
| `nombre_original` | TEXT | |
| `mime_type` | TEXT | |
| `tamano_bytes` | INT | |
| `storage_key` | TEXT | `bucket/{plaza_id}/{entidad_tipo}/{entidad_id}/{uuid}.{ext}`. |
| `usuario_subio_id` | UUID FK | |
| `deleted_at` | TIMESTAMPTZ | |

**Índices:** INDEX(`plaza_id`, `entidad_tipo`, `entidad_id`).

### 4.3.12. `evento_calendario`

| Atributo | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `plaza_id` | UUID FK | |
| `solicitud_id` | UUID FK UNIQUE | 1:1 con solicitud de tipo `evento` aprobada. |
| `titulo` | TEXT | |
| `inicio`, `fin` | TIMESTAMPTZ | |

**Índices:** INDEX(`plaza_id`, `inicio`).

### 4.3.13. `refresh_token`, `password_reset_token`

Tablas técnicas. `token_hash` es SHA-256 del token (no se guarda el token plano).

### 4.3.14. `email_log`

Ver §5 del stack. `variables` (JSONB) guarda el render final para depuración.

### 4.3.15. `auditoria`

Append-only. Captura cualquier cambio en entidades de negocio. Ver §1.7 (R10).

### 4.3.16. `configuracion`

Una fila por plaza. `sla_dias_por_tipo`, `tamanio_max_archivo_mb`, `mime_types_permitidos`, `calendar_mostrar_hitos_contrato`.

### 4.3.17. `reporte_programado`

FUERA DE ALCANCE v1 (SUPUESTO S-ScheduledReports). La tabla se define por completitud.

---

## 4.4. Relaciones clave (resumen)

| Origen | Cardinalidad | Destino | Descripción |
|---|---|---|---|
| `plaza` | 1 — N | `usuario` | Una plaza tiene muchos usuarios (excepto superadmin). |
| `plaza` | 1 — N | `local` | |
| `plaza` | 1 — N | `inquilino` | |
| `plaza` | 1 — N | `solicitud` | |
| `inquilino` | 1 — N | `usuario` | Un inquilino puede tener varios usuarios. |
| `inquilino` | 1 — N | `contrato` | |
| `inquilino` | 1 — N | `solicitud` | |
| `local` | 1 — N | `contrato` | Históricamente, pero solo uno vigente a la vez. |
| `local` | 1 — N | `solicitud` | |
| `solicitud` | 1 — N | `solicitud_historial` | |
| `solicitud` | 1 — N | `comentario` | |
| `solicitud` | 1 — N | `adjunto` | (entidad_tipo = `solicitud`) |
| `solicitud` | 1 — 1 | `evento_calendario` | Solo si tipo=`evento` y estado=`aprobada`. |

---

## 4.5. Estrategia multi-tenant: detalles

### 4.5.1. Discriminador `plaza_id`

- Toda tabla de negocio (no catálogos) lleva `plaza_id NOT NULL`.
- Toda consulta a la base de datos pasa por un `PlazaScopeInterceptor` en NestJS que inyecta `WHERE plaza_id = :plaza_id` extraído del JWT.
- RLS de PostgreSQL como segunda capa: la app hace `SET LOCAL app.plaza_id = '...'` al inicio de cada transacción.

### 4.5.2. Definición de RLS (referencia)

```sql
ALTER TABLE solicitud ENABLE ROW LEVEL SECURITY;
CREATE POLICY solicitud_plaza_isolation ON solicitud
  USING (plaza_id = current_setting('app.plaza_id', true)::uuid);
```

> **SUPUESTO:** la conexión a PostgreSQL se hace con un rol que **no** es `superuser` para que RLS aplique.

### 4.5.3. Catálogos globales (sin `plaza_id`)

- `rol` (catálogo cargado por migración).
- Tablas internas como `solicitud_estado` (tipo ENUM).

### 4.5.4. Alternativas consideradas

| Estrategia | Pros | Contras | Decisión |
|---|---|---|---|
| **DB compartida + `plaza_id`** (elegida) | Simple, migraciones únicas, bajo costo | Riesgo de bugs sin RLS | ✅ Recomendada para v1 |
| Schema por tenant | Aislamiento físico | Migraciones N veces, complejo | Descartada |
| DB por tenant | Máximo aislamiento | Caro, gestión de conexiones | Descartada |

---

## 4.6. Reglas de integridad destacadas

- **RI-1:** `DELETE` directo está prohibido en `solicitud` y `solicitud_historial` (triggers o permisos).
- **RI-2:** `local.estado = 'alquilado'` debe coincidir con la existencia de un `contrato.vigente` que lo cubra. Se valida con un trigger.
- **RI-3:** una `solicitud` no puede pasar a `aprobada` sin `decision_at` y `admin_asignado_id` distintos de NULL.
- **RI-4:** un `email_log.estado = 'enviado'` requiere `sent_at` no NULL.
- **RI-5:** los `password_hash` siempre son `bcrypt` (validado por prefijo `$2b$` o `$2a$`).

---

## 4.7. Consideraciones de rendimiento

- **Particionamiento por `created_at`:** las tablas `solicitud`, `solicitud_historial`, `email_log`, `auditoria` se particionan por mes (RANGE partitioning en PostgreSQL). Política de retención: 24 meses online; histórico en tabla `archivo_YYYY`. (SUPUESTO S-Particionamiento.)
- **Read replicas:** para reportes pesados, se direccionan queries a una réplica de lectura. (SUPUESTO S-Replicas.)
- **Conexiones:** pool PgBouncer en producción. (SUPUESTO.)
- **Cache de catálogos:** `rol`, `plaza` (configuración), `configuracion` se cachean en Redis con TTL 5 min. (SUPUESTO S-Redis.)

---

## 4.8. Política de retención y backups

- **Retención de auditoría:** indefinida. (SUPUESTO — verificar con cliente si hay requisitos legales locales.)
- **Retención de adjuntos borrados:** 30 días en `quarantine-{plaza_id}`, luego purga. (SUPUESTO S-Quarantine.)
- **Backups:** diario completo + PITR (point-in-time recovery) con 7 días de WAL. (SUPUESTO S-Backups.)
- **Baja de plaza:** `deleted_at` se setea; los datos quedan inaccesibles pero no se borran hasta cumplir período de retención.

---

## 4.9. Versionado del esquema

- **Migraciones Prisma:** versionadas en `prisma/migrations/`, ordenadas, idempotentes.
- **Política de cambios destructivos:** cualquier `DROP COLUMN` o cambio de tipo requiere:
  1. Aprobación del cliente.
  2. Script de migración de datos.
  3. Feature flag si el cambio afecta comportamiento de la app.
- **Catálogos versionados:** si en el futuro se permite `tipos` de solicitud personalizados, se introduce una tabla `solicitud_tipo_config` con versionado.

---

## 4.10. SQL canónico (DDL esencial)

> Vista de alto nivel. El `schema.prisma` completo se entrega en la fase de implementación.

```sql
-- PLATAFORMA
CREATE TYPE rol_codigo AS ENUM ('superadmin','admin_plaza','inquilino');
CREATE TABLE rol (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo rol_codigo UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT
);

CREATE TABLE plaza (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  nombre_comercial TEXT NOT NULL,
  email_contacto TEXT,
  telefono_contacto TEXT,
  logo_url TEXT,
  color_primario TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/Costa_Rica',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- USUARIOS
CREATE TABLE usuario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plaza_id UUID REFERENCES plaza(id),
  inquilino_id UUID REFERENCES inquilino(id),
  rol_id UUID NOT NULL REFERENCES rol(id),
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  nombre TEXT NOT NULL,
  telefono TEXT,
  email_invalido BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT usuario_email_uniq_por_plaza UNIQUE (plaza_id, email)
);

-- INQUILINOS
CREATE TABLE inquilino (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plaza_id UUID NOT NULL REFERENCES plaza(id),
  razon_social TEXT NOT NULL,
  identificacion TEXT,
  direccion TEXT,
  contacto_nombre TEXT,
  contacto_email TEXT,
  contacto_telefono TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- LOCALES
CREATE TYPE local_estado AS ENUM ('disponible','alquilado','en_mantenimiento','fuera_de_servicio');
CREATE TABLE local (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plaza_id UUID NOT NULL REFERENCES plaza(id),
  codigo TEXT NOT NULL,
  nombre TEXT,
  metraje_m2 NUMERIC(10,2),
  piso TEXT,
  sector TEXT,
  descripcion TEXT,
  estado local_estado NOT NULL DEFAULT 'disponible',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT local_codigo_uniq_por_plaza UNIQUE (plaza_id, codigo)
);

-- CONTRATOS
CREATE TYPE contrato_estado AS ENUM ('vigente','finalizado','cancelado');
CREATE TABLE contrato (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plaza_id UUID NOT NULL REFERENCES plaza(id),
  local_id UUID NOT NULL REFERENCES local(id),
  inquilino_id UUID NOT NULL REFERENCES inquilino(id),
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE,
  monto_mensual NUMERIC(12,2),
  moneda CHAR(3) NOT NULL DEFAULT 'USD',
  condiciones TEXT,
  estado contrato_estado NOT NULL DEFAULT 'vigente',
  fecha_fin_efectiva DATE,
  motivo_fin TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);

-- SOLICITUDES
CREATE TYPE solicitud_tipo AS ENUM ('mantenimiento','evento','remodelacion','otro');
CREATE TYPE solicitud_estado AS ENUM (
  'borrador','enviada','en_revision','aprobada','rechazada','cancelada','requerida_subsanacion'
);
CREATE TABLE solicitud (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plaza_id UUID NOT NULL REFERENCES plaza(id),
  local_id UUID NOT NULL REFERENCES local(id),
  inquilino_id UUID NOT NULL REFERENCES inquilino(id),
  usuario_creador_id UUID NOT NULL REFERENCES usuario(id),
  admin_asignado_id UUID REFERENCES usuario(id),
  codigo TEXT NOT NULL,
  tipo solicitud_tipo NOT NULL,
  titulo TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  estado solicitud_estado NOT NULL DEFAULT 'borrador',
  campos_extra JSONB NOT NULL DEFAULT '{}'::jsonb,
  fecha_evento_inicio DATE,
  fecha_evento_fin DATE,
  hora_inicio TIME,
  hora_fin TIME,
  enviada_at TIMESTAMPTZ,
  decision_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT solicitud_codigo_uniq_por_plaza UNIQUE (plaza_id, codigo)
);

-- HISTORIAL, COMENTARIOS, ADJUNTOS, CALENDARIO, ETC.
-- (definidos en §4.3; abreviados aquí por espacio)
```

---

## 4.11. SUPUESTOS del modelo de datos

| ID | Supuesto |
|---|---|
| S-MD-A | UUID v4 como PK en todas las tablas. |
| S-MD-B | Soft delete en `plaza`, `usuario`, `inquilino`, `local`, `contrato`. |
| S-MD-C | `solicitud` y `solicitud_historial` no se borran nunca. |
| S-MD-D | RLS habilitado como segunda capa de defensa. |
| S-MD-E | Particionamiento mensual en tablas de alto volumen (`solicitud`, `auditoria`, `email_log`). |
| S-MD-F | Códigos `SOL-{plaza_short}-{seq}` autogenerados por plaza. |
| S-MD-G | `configuracion` con una fila por plaza (1:1). |
| S-MD-H | Campos dinámicos en JSONB validados con Zod en backend. |
| S-MD-I | La conexión a PostgreSQL se hace con un rol sin `BYPASSRLS`. |
| S-MD-J | Tabla `reporte_programado` existe por completitud, sin uso en v1. |

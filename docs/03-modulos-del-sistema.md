# 03 · Módulos del Sistema

> **Código del documento:** `DOC-03-MS`
> **Estado:** Borrador para validación
> **Origen:** Cotización COT-2026-0012 (Helixsys · 20/05/2026), sección 2
> **Núcleo de la documentación.** Este archivo es el más extenso y debe validarse sección por sección.

---

## 0. Cómo leer este documento

Cada módulo se documenta con la misma plantilla:

1. **Propósito** — qué problema resuelve.
2. **Casos de uso** — lista numerada de funcionalidades concretas.
3. **Entidades involucradas** — modelos de datos que toca (ver [`04-modelo-de-datos.md`](./04-modelo-de-datos.md)).
4. **Roles que interactúan** — quién puede hacer qué.
5. **Reglas de negocio** — invariantes y validaciones específicas.
6. **Dependencias con otros módulos** — qué necesita de otros módulos.
7. **SUPUESTOS del módulo** — decisiones a confirmar.

---

## 0.1 Concepto transversal — Multi-plaza (Multi-tenant)

> **No es un módulo de la cotización, pero condiciona a todos los demás.** Se documenta como prólogo.

### Propósito

Aislar los datos y la configuración de cada **plaza comercial** dentro de una misma instalación del sistema. Cada plaza es un cliente SaaS independiente con sus propios usuarios, locales, contratos, solicitudes, calendario y reportes.

### Casos de uso

- **CU-MT-1 · Alta de plaza:** el superadministrador crea una plaza con nombre comercial, slug único, subdominio, color primario, datos de contacto.
- **CU-MT-2 · Edición de plaza:** el superadministrador (o el admin de plaza para datos no sensibles) actualiza datos básicos.
- **CU-MT-3 · Baja lógica de plaza:** `deleted_at` se setea; los datos quedan inaccesibles pero conservados por auditoría.
- **CU-MT-4 · Resolución de tenant:** el frontend identifica la plaza actual por subdominio (`acme.plazapp.com`) o path (`/p/acme/...`).
- **CU-MT-5 · Branding por plaza:** logo, color primario y nombre comercial se aplican en login, header, emails y reportes.

### Entidades

- `plaza` (raíz de toda la jerarquía de datos).
- Todas las demás entidades de negocio tienen `plaza_id` como FK obligatoria.

### Roles

- **Superadministrador** opera a nivel plataforma: da de alta plazas, ve métricas agregadas.
- **Administrador de plaza** opera dentro de su plaza. El token JWT carga `plaza_id` y un `PlazaScopeGuard` rechaza cualquier acceso a datos fuera de su plaza.
- **Inquilino** ve y opera solo sobre los locales de su plaza.

### Reglas de negocio

- **RN-MT-1:** ninguna operación de negocio puede ejecutarse sin un `plaza_id` válido en el token.
- **RN-MT-2:** el `slug` de la plaza es único en toda la plataforma y se usa para resolver el tenant.
- **RN-MT-3:** un usuario pertenece a **una sola plaza** (SUPUESTO). Un administrador multi-plaza no se contempla en v1.
- **RN-MT-4:** un inquilino pertenece a una sola plaza. Sus contratos y solicitudes son solo de esa plaza.
- **RN-MT-5:** los `slug` de las plazas se reservan en minúsculas, sin espacios, sin caracteres especiales.

### Dependencias

- Es transversal: lo consumen **todos** los módulos. Particularmente:
  - `usuarios` necesita `plaza_id` para scoping.
  - `locales`, `contratos`, `solicitudes`, `adjuntos`, `calendario`, `reportes` filtran siempre por `plaza_id`.

### SUPUESTOS del concepto transversal

- **S-MT-A — Resolución por subdominio** en producción y por path en desarrollo/local. Confirmar DNS/TLS del cliente.
- **S-MT-B — Slug inmutable:** una vez creado el slug, no se renombra para no romper URLs. Si se requiere renombrar, se crea nueva plaza.
- **S-MT-C — Multi-rol por usuario:** un usuario NO puede ser `admin_plaza` y `inquilino` a la vez. Si se requiere (p. ej. el dueño de un local que además es staff), se crean dos usuarios.

---

## 1. Módulo: Autenticación y Usuarios

> **Origen PDF:** "Registro, login, roles (negocio/administrador), recuperación de contraseña."

### 1.1 Propósito

Administrar las identidades digitales de los usuarios del sistema y controlar el acceso a los recursos según su rol y su plaza.

### 1.2 Casos de uso

- **CU-AU-1 · Registro de usuario por administrador de plaza:** un `admin_plaza` da de alta usuarios `inquilino` o más `admin_plaza` (SUPUESTO: solo el primer admin lo hace el superadmin; los siguientes los crea el propio admin de plaza).
- **CU-AU-2 · Registro por superadministrador:** el `superadmin` da de alta el primer `admin_plaza` de cada plaza nueva y, opcionalmente, usuarios `inquilino` durante el onboarding.
- **CU-AU-3 · Login con email + contraseña:** desde `/login`. El frontend llama a `POST /api/v1/auth/login` (vía Credentials Provider de NextAuth) y recibe JWT.
- **CU-AU-4 · Logout:** revoca el refresh token y limpia la cookie.
- **CU-AU-5 · Cambio de contraseña con sesión activa:** desde perfil.
- **CU-AU-6 · Recuperación de contraseña:** "olvidé mi contraseña" → email con enlace de un solo uso (token, 30 min de expiración) → formulario de nueva contraseña.
- **CU-AU-7 · Edición de perfil:** nombre, teléfono, foto (opcional).
- **CU-AU-8 · Desactivación de usuario:** soft delete (`deleted_at`); el usuario no puede entrar pero sus solicitudes/acciones se preservan para auditoría.
- **CU-AU-9 · Listado y búsqueda de usuarios por plaza:** con filtros por rol, estado y nombre/email.
- **CU-AU-10 · Asignación de inquilino a usuario:** un usuario con rol `inquilino` queda asociado a un registro de `inquilino` (persona jurídica) que a su vez tiene N locales.

### 1.3 Entidades

- `usuario`
- `rol` (catálogo: `superadmin`, `admin_plaza`, `inquilino`)
- `usuario_rol` (tabla pivote — un usuario puede tener varios roles en el futuro; en v1 se restringe a uno)
- `refresh_token`
- `password_reset_token`
- `auditoria_login` (intentos, éxitos, fallos, IP, user agent)

### 1.4 Roles

| Acción | superadmin | admin_plaza | inquilino |
|---|---|---|---|
| Crear plaza + primer admin | ✅ | — | — |
| Crear usuarios en su plaza | ✅ | ✅ (excepto otros `superadmin`) | — |
| Ver listado de usuarios de su plaza | ✅ | ✅ | ❌ (solo ve su perfil) |
| Editar su propio perfil | ✅ | ✅ | ✅ |
| Cambiar contraseña propia | ✅ | ✅ | ✅ |
| Solicitar reset de contraseña | ✅ | ✅ | ✅ |
| Desactivar usuario | ✅ | ✅ (de su plaza) | — |

### 1.5 Reglas de negocio

- **RN-AU-1:** email único por plaza (no global). Un mismo email no puede existir dos veces en la misma plaza, pero sí en plazas distintas (SUPUESTO — alineado con multi-tenant).
- **RN-AU-2:** contraseña mínimo 10 caracteres, al menos una mayúscula, una minúscula, un dígito y un símbolo. Hash con **bcrypt** (cost 12). (SUPUESTO S-PwdPolicy.)
- **RN-AU-3:** la cuenta se bloquea temporalmente tras 5 intentos fallidos en 15 min. (SUPUESTO S-Lockout.)
- **RN-AU-4:** el token de reset de contraseña es de un solo uso, expira en 30 min y se invalida al usarse.
- **RN-AU-5:** un usuario no puede desactivarse a sí mismo si es el único `admin_plaza` activo de la plaza.
- **RN-AU-6:** toda sesión emite `iat`, `exp`, `sub`, `plaza_id`, `rol`, `usuario_id`. Ver `JWT` en §2.6.
- **RN-AU-7:** un `inquilino` solo puede iniciar sesión si su `inquilino` asociado está activo y pertenece a la misma plaza.
- **RN-AU-8:** el email de bienvenida se envía siempre (SUPUESTO).
- **RN-AU-9:** el `superadmin` **no** puede crear solicitudes, locales ni contratos. Es un usuario de plataforma, no cliente final.

### 1.6 Dependencias

- Depende de **`plazas`** (todo usuario pertenece a una plaza excepto `superadmin`).
- Es consumido por **todos los módulos** (cada operación requiere `request.user`).

### 1.7 SUPUESTOS del módulo

- **S-AU-A:** no se contemplan OAuth (Google, Microsoft) en v1.
- **S-AU-B:** no hay verificación de email al registrarse (los usuarios los crea el admin, no se registran solos).
- **S-AU-C:** no hay 2FA/MFA en v1.
- **S-AU-D:** las sesiones son `JWT` en cookie httpOnly. No se almacenan sesiones en servidor.
- **S-AU-E:** un usuario solo puede pertenecer a **una** plaza. Multi-plaza para staff no se contempla.

---

## 2. Módulo: Gestión de Locales

> **Origen PDF:** "CRUD de locales por negocio, asignación múltiple, información del arrendatario."

### 2.1 Propósito

Administrar el inventario de locales de una plaza: alta, baja, edición, consulta y mantenimiento de información física y operativa (código, metraje, ubicación, estado, disponibilidad, arrendatario).

> **SUPUESTO D2:** Los **contratos de alquiler** se documentan como sub-sección (§2.2) dentro de este módulo, no como módulo independiente.

### 2.2 Casos de uso

#### Locales

- **CU-LO-1 · Alta de local:** `admin_plaza` crea un local con código, nombre, metraje (m²), ubicación (piso, sector, número), descripción y estado inicial (`disponible`).
- **CU-LO-2 · Edición de local:** modificar cualquier campo, excepto código si ya tiene contratos (RN-LO-2).
- **CU-LO-3 · Cambio de estado:** `disponible`, `alquilado`, `en_mantenimiento`, `fuera_de_servicio`. (SUPUESTO S-EstadosLocal.)
- **CU-LO-4 · Baja lógica de local:** `deleted_at`. Se permite solo si no tiene contratos activos (RN-LO-3).
- **CU-LO-5 · Listado paginado y filtrado:** por código, nombre, estado, sector, disponibilidad, inquilino.
- **CU-LO-6 · Detalle de local:** incluye contrato vigente, histórico de contratos, solicitudes recientes, adjuntos.
- **CU-LO-7 · Asignación múltiple de locales a un mismo inquilino:** un inquilino puede administrar varios locales.
- **CU-LO-8 · Subir plano / fotos del local:** adjuntos a nivel de local (no de solicitud).
- **CU-LO-9 · Carga masiva de locales:** importador CSV (SUPUESTO S-CSV) para el onboarding inicial.

#### Inquilinos (arrendatarios)

- **CU-LO-10 · Alta de inquilino:** persona jurídica o física con razón social, RUC/ID, dirección, contacto principal.
- **CU-LO-11 · Edición de inquilino:** datos básicos.
- **CU-LO-12 · Baja lógica de inquilino:** solo si no tiene contratos activos.
- **CU-LO-13 · Listado y búsqueda de inquilinos** de la plaza.

#### 2.1 Sub-sección: Contratos de Alquiler

> Vinculan un **local** con un **inquilino** durante un período. La cotización no los enumera explícitamente, pero son necesarios para saber "qué local está alquilado y a quién" (objetivo del negocio). Se modelan aquí, no como módulo aparte, por decisión D2.

- **CU-CO-1 · Alta de contrato:** `admin_plaza` crea un contrato para un local y un inquilino con `fecha_inicio`, `fecha_fin` (opcional si es indefinido, SUPUESTO S-ContratoIndefinido), `monto_mensual` (referencial, no se procesan pagos), `moneda`, `condiciones` (texto libre), `estado` inicial (`vigente`).
- **CU-CO-2 · Edición de contrato:** solo se permiten cambios menores mientras esté `vigente`. Cambios grandes ⇒ crear uno nuevo y cerrar el anterior.
- **CU-CO-3 · Cierre de contrato:** fecha de fin efectiva, motivo, estado `finalizado`.
- **CU-CO-4 · Renovación de contrato:** crea un nuevo contrato encadenado al anterior.
- **CU-CO-5 · Historial de contratos de un local:** línea de tiempo.
- **CU-CO-6 · Historial de contratos de un inquilino:** vista 360 del inquilino.
- **CU-CO-7 · Alertas de vencimiento:** notificación al admin_plaza T-30 y T-7 días antes del fin del contrato. (SUPUESTO S-AlertaVencimiento.)
- **CU-CO-8 · Subir contrato firmado (PDF):** adjunto por contrato, no por local.

### 2.3 Entidades

- `local`
- `inquilino`
- `contrato`
- `adjunto_local` (planos, fotos)
- `adjunto_contrato` (PDF firmado)

### 2.4 Roles

| Acción | superadmin | admin_plaza | inquilino |
|---|---|---|---|
| Crear/editar/desactivar local | ✅ | ✅ (de su plaza) | ❌ |
| Ver locales de su plaza | ✅ | ✅ | ✅ (solo los suyos) |
| Cargar plano de local | ✅ | ✅ | ❌ |
| Crear/editar inquilino | ✅ | ✅ | ❌ |
| Ver inquilinos de su plaza | ✅ | ✅ | ❌ (solo el propio) |
| Crear/editar/cerrar contrato | ✅ | ✅ | ❌ |
| Ver su propio contrato | ✅ | ✅ | ✅ |
| Subir contrato firmado | ✅ | ✅ | ✅ (SUPUESTO — usualmente lo sube el admin) |

### 2.5 Reglas de negocio

- **RN-LO-1:** el código del local es único dentro de la plaza (`UNIQUE (plaza_id, codigo)`).
- **RN-LO-2:** el código de un local con contratos históricos no se puede modificar.
- **RN-LO-3:** un local con contrato `vigente` no se puede dar de baja lógica.
- **RN-LO-4:** un local cambia automáticamente a estado `alquilado` cuando existe un contrato `vigente` que lo cubre en la fecha actual.
- **RN-LO-5:** un local con estado `en_mantenimiento` o `fuera_de_servicio` puede seguir teniendo contrato vigente, pero el sistema lo marca visualmente.
- **RN-LO-6:** un local en estado `alquilado` no puede volver a `disponible` mientras tenga contrato vigente. (SUPUESTO.)
- **RN-CO-1:** las fechas del contrato deben cumplir `fecha_inicio <= fecha_fin` (si `fecha_fin` existe).
- **RN-CO-2:** no puede haber dos contratos `vigente` solapados para el mismo local.
- **RN-CO-3:** el `monto_mensual` es referencial; el sistema no calcula ni cobra. (No está en alcance.)
- **RN-CO-4:** un contrato finalizado no se reabre; se crea uno nuevo.
- **RN-CO-5:** al cerrar un contrato, todas las solicitudes pendientes del local no se ven afectadas, pero quedan marcadas con el contrato histórico en su metadata.

### 2.6 Dependencias

- `plazas` (todo local pertenece a una plaza).
- `usuarios` (los usuarios inquilinos se asocian a un registro de `inquilino`).
- `solicitudes` (las solicitudes referencian un local).
- `adjuntos` (planos y contratos firmados se almacenan en MinIO).

### 2.7 SUPUESTOS del módulo

- **S-LO-A:** el sistema no gestiona pagos ni facturación; el `monto_mensual` es solo referencial.
- **S-LO-B:** los estados de local pueden ser editables manualmente por el admin para reflejar mantenimiento.
- **S-LO-C:** la importación CSV es para el onboarding; no se mantiene una UI de mapeo de columnas.
- **S-CO-A:** los contratos no se firman digitalmente dentro del sistema; el PDF firmado se sube como adjunto.
- **S-CO-B:** las alertas de vencimiento (T-30/T-7) son SUPUESTO; si el cliente quiere, se implementa con `@nestjs/schedule`.

---

## 3. Módulo: Solicitudes

> **Origen PDF:** "Creación y seguimiento de solicitudes: mantenimientos, eventos, remodelaciones y otros."

### 3.1 Propósito

Permitir a los inquilinos registrar formalmente cualquier petición que requiera aprobación de la administración de la plaza, darle seguimiento a su estado y consultar el histórico.

### 3.2 Casos de uso

- **CU-SO-1 · Crear solicitud (borrador):** el inquilino completa un formulario con tipo, local, título, descripción, fechas (si aplica), horario, adjuntos. Queda en estado `borrador`.
- **CU-SO-2 · Editar borrador:** mientras esté en `borrador`, el inquilino puede modificar cualquier campo.
- **CU-SO-3 · Adjuntar archivos a la solicitud:** PDFs, imágenes, planos.
- **CU-SO-4 · Enviar solicitud:** pasa de `borrador` a `enviada`. Se notifica al `admin_plaza` por email.
- **CU-SO-5 · Ver listado de mis solicitudes:** con filtros por tipo, local, estado y rango de fechas.
- **CU-SO-6 · Ver detalle de solicitud:** incluye historial de cambios, comentarios, adjuntos, transiciones de estado.
- **CU-SO-7 · Cancelar solicitud:** solo si está en `borrador` o `enviada` (no después de `en_revision`).
- **CU-SO-8 · Subsanar solicitud:** cuando el admin pide cambios, el inquilino edita y vuelve a enviar.
- **CU-SO-9 · Duplicar solicitud:** clona los datos de una solicitud anterior en un nuevo borrador. (SUPUESTO S-Duplicar.)
- **CU-SO-10 · Tipos soportados:** `mantenimiento`, `evento`, `remodelacion`, `otro`. Cada tipo puede tener campos extra. (SUPUESTO S-CamposTipo — ver §3.5.)
- **CU-SO-11 · Solicitudes recurrentes (eventos):** si el tipo es `evento`, se puede definir un patrón de repetición. (SUPUESTO S-Recurrencia; ver §3.5.)

### 3.3 Entidades

- `solicitud`
- `solicitud_historial` (todas las transiciones y eventos)
- `solicitud_campo_extra` (campos dinámicos según tipo)
- `solicitud_evento_recurrente` (hijos de un evento padre)
- `adjunto` (vinculado a solicitud)
- `comentario` (vinculado a solicitud)

### 3.4 Roles

| Acción | superadmin | admin_plaza | inquilino |
|---|---|---|---|
| Crear borrador | ❌ (SUPUESTO) | ❌ (SUPUESTO) | ✅ |
| Editar borrador propio | — | — | ✅ |
| Enviar solicitud | — | — | ✅ |
| Ver todas las solicitudes de su plaza | ✅ | ✅ | ❌ (solo las propias) |
| Ver detalle de solicitud | ✅ | ✅ | ✅ (si es de su inquilino) |
| Cancelar solicitud | — | ✅ (con motivo) | ✅ (solo propias, en `borrador`/`enviada`) |
| Subsanar | — | — | ✅ (cuando se requiere) |
| Comentar en una solicitud | — | ✅ | ✅ (en sus solicitudes) |

### 3.5 Reglas de negocio

- **RN-SO-1:** toda solicitud debe estar asociada a un **local** y, por lo tanto, a un **inquilino**. Un inquilino solo crea solicitudes para sus locales.
- **RN-SO-2:** al crear la solicitud, el `estado` inicial es siempre `borrador`.
- **RN-SO-3:** el paso `borrador → enviada` dispara email al `admin_plaza` y entrada en `solicitud_historial`.
- **RN-SO-4:** el `tipo` de la solicitud no se puede cambiar después de crearla. Si se requiere, se cancela y se crea una nueva.
- **RN-SO-5:** **campos extra por tipo** (SUPUESTO S-CamposTipo):
  - `mantenimiento`: `categoria` (electricidad, plomería, pintura, otro), `area_afectada`, `requiere_ingreso_a_local` (bool).
  - `evento`: `fecha_evento`, `hora_inicio`, `hora_fin`, `asistentes_estimados`, `requiere_corte_calle` (bool), `requiere_amplificacion` (bool).
  - `remodelacion`: `fecha_inicio_estimada`, `duracion_dias`, `empresa_constructora`, `monto_presupuesto` (referencial).
  - `otro`: `categoria_libre`, `descripcion_larga`.
- **RN-SO-6:** un `evento` con `asistentes_estimados > X` puede requerir aprobación especial (SUPUESTO: `X = 200`, configurable por plaza).
- **RN-SO-7:** el título es obligatorio y máximo 120 caracteres; la descripción máximo 4000.
- **RN-SO-8:** al menos 1 adjunto es opcional. (SUPUESTO — el cliente puede requerir obligatoriedad por tipo; configurable.)
- **RN-SO-9:** el histórico es inmutable: una vez escrito un evento, no se borra.

### 3.6 Dependencias

- `locales` y `contratos` (la solicitud referencia un local vigente).
- `usuarios` (solicitante = usuario inquilino).
- `aprobaciones` (es el módulo que consume las solicitudes en estado `enviada`).
- `notificaciones` (dispara emails en cada transición).
- `calendario` (los eventos aprobados alimentan el calendario).
- `adjuntos` (archivos de la solicitud).
- `auditoria` (todo queda registrado).

### 3.7 SUPUESTOS del módulo

- **S-SO-A:** los campos extra por tipo se almacenan como JSONB en PostgreSQL, validados con Zod por tipo.
- **S-SO-B:** la recurrencia de eventos no es obligatoria; se puede desactivar en la primera versión si el alcance se ajusta.
- **S-SO-C:** el `superadmin` **no** crea solicitudes en nombre de inquilinos.

---

## 4. Módulo: Aprobaciones

> **Origen PDF:** "Flujo de aprobación/rechazo por administrador con comentarios y notificación."

### 4.1 Propósito

Concentrar el flujo de revisión por el cual el `admin_plaza` toma una decisión formal sobre una solicitud: aprobarla, rechazarla o pedir subsanación. Es el corazón operativo del sistema.

### 4.2 Casos de uso

- **CU-AP-1 · Bandeja de entrada de solicitudes:** el `admin_plaza` ve una cola priorizada por antigüedad y tipo.
- **CU-AP-2 · Tomar una solicitud para revisión:** transición `enviada → en_revision` (revierte a `enviada` si la libera).
- **CU-AP-3 · Aprobar solicitud:** transición `en_revision → aprobada`. Se registra `comentario` opcional, fecha y admin que aprobó.
- **CU-AP-4 · Rechazar solicitud:** transición `en_revision → rechazada`. **Comentario obligatorio** con el motivo.
- **CU-AP-5 · Pedir subsanación:** transición `en_revision → requerida_subsanacion`. **Comentario obligatorio** con lo que se requiere.
- **CU-AP-6 · Comentar sin cambiar estado:** el admin puede dejar comentarios en cualquier momento.
- **CU-AP-7 · Asignar a otro admin_plaza:** la solicitud queda "en revisión por X". (SUPUESTO S-AsignacionAdmin.)
- **CU-AP-8 · Ver historial completo:** transiciones, comentarios, adjuntos.
- **CU-AP-9 · SLA visual:** cada solicitud muestra tiempo transcurrido y semáforo (verde/amarillo/rojo) según SLA configurable por plaza. (SUPUESTO S-SLA.)

### 4.3 Entidades

- `solicitud` (actualización de `estado`, `admin_asignado_id`, `decision_at`).
- `comentario` (vinculado a solicitud, incluye `tipo`: `decision` | `subsanacion` | `general`).
- `solicitud_historial` (cada acción queda registrada).
- `sla_config` (configuración por plaza, SUPUESTO S-SLA).

### 4.4 Roles

| Acción | superadmin | admin_plaza | inquilino |
|---|---|---|---|
| Ver bandeja de entrada | ❌ | ✅ | ❌ |
| Tomar para revisión | ❌ | ✅ | ❌ |
| Aprobar | ❌ | ✅ | ❌ |
| Rechazar | ❌ | ✅ (motivo obligatorio) | ❌ |
| Pedir subsanación | ❌ | ✅ (comentario obligatorio) | ❌ |
| Comentar | ❌ | ✅ | ✅ (en sus solicitudes) |
| Asignar a otro admin | ❌ | ✅ | ❌ |

### 4.5 Reglas de negocio

- **RN-AP-1:** solo se puede aprobar/rechazar/subsanar una solicitud en estado `en_revision`.
- **RN-AP-2:** la transición `en_revision → aprobada` o `en_revision → rechazada` es **terminal** (no se puede deshacer desde la UI; un SUPUESTO es que un `superadmin` podría revertir, pero no se contempla en v1).
- **RN-AP-3:** todo rechazo y toda subsanación requiere `comentario` no vacío.
- **RN-AP-4:** al aprobar una solicitud de tipo `evento`, se crea automáticamente el evento en el calendario (ver módulo Calendario).
- **RN-AP-5:** al aprobar una solicitud de tipo `remodelacion`, se actualiza el estado del local a `en_mantenimiento` durante el rango de fechas (SUPUESTO S-RemodelEstado).
- **RN-AP-6:** la "toma para revisión" (locking) evita que dos admins trabajen la misma solicitud a la vez. Lock expira a los 30 min sin actividad. (SUPUESTO S-LockTimeout.)
- **RN-AP-7:** si una solicitud lleva más de X días sin acción, aparece resaltada en la bandeja (SLA visual, SUPUESTO S-SLA).
- **RN-AP-8:** cada transición registra: `usuario_id`, `fecha`, `estado_anterior`, `estado_nuevo`, `comentario` (opcional salvo en rechazo/subsanación).

### 4.6 Dependencias

- `solicitudes` (lee y actualiza el estado).
- `notificaciones` (dispara emails en cada decisión).
- `calendario` (en caso de aprobar un evento).
- `locales` (en caso de aprobar una remodelación).
- `usuarios` (admin que tomó la decisión).
- `auditoria` (registro inmutable).

### 4.7 SUPUESTOS del módulo

- **S-AP-A:** un `admin_plaza` no puede aprobar sus propias solicitudes si se le permitiera crear alguna (en v1 no se permite, defense in depth).
- **S-AP-B:** no hay escalamiento jerárquico en v1 (no hay "gerente de plaza" por encima del admin).
- **S-AP-C:** la reversión de una decisión es manual vía base de datos o feature flag; no es un flujo de UI.

---

## 5. Módulo: Notificaciones Email

> **Origen PDF:** "Alertas automáticas por correo en cada cambio de estado de solicitud."

### 5.1 Propósito

Centralizar el envío de correos electrónicos transaccionales del sistema, mantener un log auditable y permitir reintentos en caso de fallo del proveedor SMTP.

### 5.2 Casos de uso

- **CU-NE-1 · Disparo automático de emails** ante eventos del sistema (ver tabla en §2.8.2 del stack).
- **CU-NE-2 · Plantillas HTML por evento:** mantenidas en `src/modules/notificaciones/templates/`.
- **CU-NE-3 · Log de envíos:** cada intento queda registrado con estado, timestamp, error, plantilla usada.
- **CU-NE-4 · Reintento automático:** 3 intentos con backoff exponencial (1 min, 5 min, 30 min).
- **CU-NE-5 · Reintento manual desde panel admin:** el admin puede reintentar un email `fallido` desde el log.
- **CU-NE-6 · Variables dinámicas:** cada plantilla recibe `{plaza, usuario, solicitud, etc.}`.
- **CU-NE-7 · Branding por plaza:** logo, color primario, nombre comercial aplicados al template.

### 5.3 Entidades

- `email_log` (`id`, `destinatario`, `plantilla`, `variables_jsonb`, `estado`, `reintentos`, `last_error`, `plaza_id`, `created_at`, `sent_at`).

### 5.4 Roles

| Acción | superadmin | admin_plaza | inquilino |
|---|---|---|---|
| Disparar email (automático) | — | — | — |
| Ver log de emails de su plaza | ✅ | ✅ | ❌ |
| Reintentar email fallido | ✅ | ✅ | ❌ |

### 5.5 Reglas de negocio

- **RN-NE-1:** un email se considera enviado solo cuando el servidor SMTP responde `250 OK`.
- **RN-NE-2:** si el destinatario rebota (hard bounce), se marca el email del usuario como `invalido` y se notifica al admin_plaza. (SUPUESTO S-Bounce.)
- **RN-NE-3:** los emails críticos (reset de contraseña, aprobación/rechazo) **no** se desactivan por configuración.
- **RN-NE-4:** el contenido siempre incluye un enlace para desuscribirse de notificaciones **no críticas** (SUPUESTO S-Unsubscribe).
- **RN-NE-5:** los emails se ponen en cola; un worker los procesa cada 1 minuto. Esto desacopla la respuesta HTTP del envío.

### 5.6 Dependencias

- `solicitudes` y `aprobaciones` (eventos disparadores).
- `usuarios` y `plazas` (datos de remitente y destinatario).
- SMTP externo (configurado por env vars).

### 5.7 SUPUESTOS del módulo

- **S-NE-A:** no hay editor WYSIWYG de plantillas; las plantillas son archivos `.html` versionados en el repo.
- **S-NE-B:** no se permite al admin editar plantillas desde la UI en v1.
- **S-NE-C:** el servidor SMTP es responsabilidad del cliente (SendGrid, Mailgun, SES, o SMTP propio). MailHog se usa en desarrollo.

---

## 6. Módulo: Calendario

> **Origen PDF:** "Visualización de eventos y mantenimientos programados en calendario interactivo."

### 6.1 Propósito

Proveer una vista unificada de todas las actividades programadas en la plaza: eventos aprobados, mantenimientos programados y fechas relevantes de contratos.

### 6.2 Casos de uso

- **CU-CA-1 · Vista de calendario mensual / semanal / diaria / lista:** filtros por tipo, local, inquilino, responsable.
- **CU-CA-2 · Eventos en el calendario:** los `evento` aprobados de las solicitudes se muestran como eventos en el calendario.
- **CU-CA-3 · Mantenimientos programados:** los `remodelacion` aprobados bloquean el local en el calendario durante el rango.
- **CU-CA-4 · Hitos contractuales:** fechas de inicio y fin de contrato de cada local (opcional de mostrar).
- **CU-CA-5 · Detalle del evento al hacer click:** abre el detalle de la solicitud original.
- **CU-CA-6 · Exportar calendario:** iCal (`.ics`) por local, por inquilino o por plaza. (SUPUESTO S-ICalExport.)
- **CU-CA-7 · Detección visual de choques:** dos eventos que usan el mismo espacio se marcan en rojo. (SUPUESTO S-Choques.)
- **CU-CA-8 · Crear evento desde el calendario:** crea una solicitud tipo `evento` en estado `borrador`. (SUPUESTO S-CrearDesdeCalendario.)

### 6.3 Entidades

- `evento_calendario` (vista materializada o query que une solicitudes aprobadas + contratos).
- `solicitud` (fuente principal de eventos).

### 6.4 Roles

| Acción | superadmin | admin_plaza | inquilino |
|---|---|---|---|
| Ver calendario de su plaza | ✅ | ✅ | ❌ |
| Ver calendario de sus locales | — | — | ✅ |
| Filtrar por local/inquilino/tipo | ✅ | ✅ | ✅ (limitado a sus locales) |
| Exportar iCal | ✅ | ✅ | ✅ |

### 6.5 Reglas de negocio

- **RN-CA-1:** solo se muestran en el calendario las solicitudes **aprobadas** (no las pendientes o rechazadas).
- **RN-CA-2:** un evento se representa con: `titulo`, `fecha_inicio`, `fecha_fin` (opcional), `local`, `inquilino`, `tipo`, `color_por_tipo` (SUPUESTO S-ColorTipo).
- **RN-CA-3:** la zona horaria del calendario es la de la plaza (configurada en `plaza.timezone`). (SUPUESTO S-Timezone.)
- **RN-CA-4:** el admin puede ocultar el calendario de hitos contractuales si lo desea (configuración por plaza). (SUPUESTO.)

### 6.6 Dependencias

- `solicitudes` (eventos aprobados).
- `locales` y `contratos` (hitos contractuales).
- `aprobaciones` (cuando se aprueba un evento, se materializa en el calendario).

### 6.7 SUPUESTOS del módulo

- **S-CA-A:** el componente es **FullCalendar React** (Client Component).
- **S-CA-B:** la vista de choques es solo visual; el sistema **no** impide crear eventos que se solapan.
- **S-CA-C:** no hay RSVP o gestión de asistentes en el calendario.

---

## 7. Módulo: Documentos Adjuntos

> **Origen PDF:** "Carga y descarga de archivos (planos, permisos, fotos) asociados a solicitudes."

### 7.1 Propósito

Gestionar el ciclo de vida de los archivos adjuntos a solicitudes y a locales/contratos, con almacenamiento en MinIO, control de acceso por plaza y trazabilidad.

### 7.2 Casos de uso

- **CU-AD-1 · Subir archivo a una solicitud:** desde el formulario de creación/edición o en la vista de detalle.
- **CU-AD-2 · Subir archivo a un local:** plano, fotos del estado actual.
- **CU-AD-3 · Subir archivo a un contrato:** PDF firmado.
- **CU-AD-4 · Listar adjuntos de una solicitud / local / contrato:** con nombre, tamaño, fecha, usuario que lo subió.
- **CU-AD-5 · Descargar adjunto:** URL pre-firmada con expiración de 15 min.
- **CU-AD-6 · Eliminar adjunto:** solo el `admin_plaza` o el `inquilino` que lo subió (si la solicitud aún está en `borrador`).
- **CU-AD-7 · Reemplazar archivo:** sube uno nuevo y archiva el anterior.
- **CU-AD-8 · Previsualización:** el visor integrado muestra PDFs e imágenes inline. (SUPUESTO S-Preview.)

### 7.3 Entidades

- `adjunto` (polimórfico: `entidad_tipo` = `solicitud` | `local` | `contrato`, `entidad_id`).
- Almacenamiento físico en MinIO con `bucket/{plaza_id}/{entidad_tipo}/{entidad_id}/{uuid}.{ext}`.

### 7.4 Roles

| Acción | superadmin | admin_plaza | inquilino |
|---|---|---|---|
| Subir a solicitud propia | ❌ | ❌ | ✅ |
| Subir a solicitud de su plaza | ✅ | ✅ | ❌ (no de otras solicitudes) |
| Subir a local de su plaza | ✅ | ✅ | ❌ |
| Subir a su contrato | ✅ | ✅ | ✅ |
| Descargar | ✅ | ✅ | ✅ (si tiene acceso al recurso padre) |
| Eliminar | ✅ | ✅ | ✅ (solo lo que subió y la solicitud está en `borrador`) |

### 7.5 Reglas de negocio

- **RN-AD-1:** tamaño máximo por archivo: **25 MB** (SUPUESTO S-TamañoMax). Configurable por plaza.
- **RN-AD-2:** tipos MIME permitidos: `application/pdf`, `image/jpeg`, `image/png`, `image/webp`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `image/vnd.dwg` (SUPUESTO S-MimeTypes). Configurable por plaza.
- **RN-AD-3:** el nombre del archivo en MinIO es siempre un UUID; el nombre original se guarda en BD.
- **RN-AD-4:** las URLs pre-firmadas expiran en 15 min.
- **RN-AD-5:** no se realiza escaneo antivirus en v1. (SUPUESTO — debería confirmarse con el cliente.)
- **RN-AD-6:** no se permite subir ejecutables (`.exe`, `.bat`, `.sh`, `.msi`). Validado en backend.

### 7.6 Dependencias

- `solicitudes`, `locales`, `contratos` (entidades padre).
- MinIO (storage físico).
- `auditoria` (queda registro de quién subió y descargó cada archivo).

### 7.7 SUPUESTOS del módulo

- **S-AD-A:** no se hace OCR ni procesamiento del contenido del archivo.
- **S-AD-B:** el versionado de archivos es simple: reemplazar crea una nueva versión; el histórico se conserva.
- **S-AD-C:** los adjuntos eliminados van a un bucket `quarantine-{plaza_id}` por 30 días, luego se purgan. (SUPUESTO S-Quarantine.)

---

## 8. Módulo: Reportes y Estadísticas

> **Origen PDF:** "Reportes filtrados por tipo, local, estado y período con exportación."

### 8.1 Propósito

Brindar a la administración de la plaza visibilidad histórica y operativa sobre las solicitudes, con filtros, exportación y métricas clave.

### 8.2 Casos de uso

- **CU-RE-1 · Reporte de solicitudes:** filtros combinables por tipo, local, estado, inquilino, fecha de creación, fecha de cierre. Vista tabular + exportación CSV/XLSX. (SUPUESTO S-Exportación — formatos CSV y XLSX.)
- **CU-RE-2 · Reporte por local:** histórico de solicitudes y mantenimientos de un local específico.
- **CU-RE-3 · Reporte por inquilino:** productividad, tasa de aprobación, tiempo medio de respuesta.
- **CU-RE-4 · KPIs del panel administrativo:** total solicitudes, aprobadas, rechazadas, tiempo medio de aprobación, tasa de aprobación, eventos próximos.
- **CU-RE-5 · Reporte de adjuntos por solicitud:** cuántos archivos, tamaño total, tipos.
- **CU-RE-6 · Tendencia mensual:** series de tiempo con solicitudes creadas vs. aprobadas vs. rechazadas.
- **CU-RE-7 · Exportación a CSV/XLSX:** los reportes se exportan completos, no solo la vista actual.
- **CU-RE-8 · Reportes programados (SUPUESTO S-ScheduledReports):** envío automático por correo el primer día de cada mes. (FUERA DE ALCANCE v1 — SUPUESTO.)

### 8.3 Entidades

- `reporte_programado` (configuración — SUPUESTO).
- Vistas materializadas o queries agregadas sobre `solicitud`, `solicitud_historial`, `local`, `inquilino`.

### 8.4 Roles

| Acción | superadmin | admin_plaza | inquilino |
|---|---|---|---|
| Ver reportes de su plaza | ✅ | ✅ | ❌ (SUPUESTO) |
| Exportar reportes | ✅ | ✅ | ❌ |
| Ver KPIs del panel | ✅ (globales) | ✅ (de su plaza) | ❌ |

### 8.5 Reglas de negocio

- **RN-RE-1:** todos los reportes respetan el `plaza_id` del token.
- **RN-RE-2:** el rango máximo de fechas es 12 meses para vistas rápidas; reportes históricos requieren carga explícita. (SUPUESTO.)
- **RN-RE-3:** la exportación a CSV usa coma como separador y UTF-8 con BOM para Excel. (SUPUESTO.)
- **RN-RE-4:** la exportación a XLSX usa una librería que respete formatos y ancho de columnas. (SUPUESTO: `exceljs`.)
- **RN-RE-5:** los reportes pesados (más de 10 000 filas) se procesan de forma asíncrona y se notifican al usuario. (SUPUESTO S-AsyncReport.)
- **RN-RE-6:** los inquilinos **no** ven reportes en v1 (SUPUESTO). Si el cliente lo requiere, se define un subconjunto mínimo.

### 8.6 Dependencias

- `solicitudes`, `solicitud_historial`, `locales`, `inquilinos`, `contratos`, `usuarios`.
- `notificaciones` (envío de reportes programados, si se activa).

### 8.7 SUPUESTOS del módulo

- **S-RE-A:** los inquilinos no ven reportes. (Confirmar con cliente.)
- **S-RE-B:** los reportes programados son opcionales y se pueden diferir a v1.1.
- **S-RE-C:** la biblioteca de gráficos es `recharts` (SUPUESTO).

---

## 9. Módulo: Panel Administrativo

> **Origen PDF:** "Dashboard con métricas, gestión de usuarios, configuración del sistema."

### 9.1 Propósito

Concentrar la vista de operación del `admin_plaza` con los indicadores clave (KPIs), el acceso rápido a las funciones de gestión y la configuración de la plaza.

### 9.2 Casos de uso

#### Dashboard

- **CU-PA-1 · KPIs principales:** solicitudes pendientes, aprobadas hoy, rechazadas hoy, eventos próximos (7 días), contratos por vencer (30 días).
- **CU-PA-2 · Gráficos de tendencia:** solicitudes por tipo (últimos 30 días), tasa de aprobación, tiempo medio de respuesta.
- **CU-PA-3 · Actividad reciente:** feed de las últimas N acciones (cambios de estado, comentarios, uploads).
- **CU-PA-4 · Bandeja priorizada:** top 5 solicitudes con más tiempo sin atención.

#### Gestión de usuarios

- **CU-PA-5 · Listado y filtros de usuarios** (delegado a Módulo 1, expuesto aquí con atajos).
- **CU-PA-6 · Alta rápida de inquilino + usuario** (combo).

#### Configuración de la plaza

- **CU-PA-7 · Datos básicos de la plaza:** nombre comercial, slug, datos de contacto, logo, color primario, zona horaria.
- **CU-PA-8 · Tipos de solicitud personalizados:** activar/desactivar tipos. (SUPUESTO S-TiposCustom — v1 tiene tipos fijos.)
- **CU-PA-9 · SLA por tipo de solicitud:** días máximos por tipo. (SUPUESTO S-SLA.)
- **CU-PA-10 · Tamaño máximo de adjuntos y MIME permitidos.**
- **CU-PA-11 · Plantillas de email activas:** ver qué plantillas están en uso.
- **CU-PA-12 · Zona horaria y formato de fecha.**

#### Plataforma (solo superadmin)

- **CU-PA-13 · Listado de plazas:** ver, crear, editar, desactivar.
- **CU-PA-14 · Métricas globales de la plataforma:** número de plazas activas, total de usuarios, MRR si aplica. (SUPUESTO.)
- **CU-PA-15 · Auditoría global:** últimos eventos de plataforma.

### 9.3 Entidades

- `plaza` (configuración).
- `kpi_snapshot` (tabla con métricas precalculadas — SUPUESTO S-KPI).
- `auditoria` (eventos transversales).

### 9.4 Roles

| Acción | superadmin | admin_plaza | inquilino |
|---|---|---|---|
| Ver dashboard de su plaza | ❌ | ✅ | ❌ |
| Ver dashboard global de plataforma | ✅ | ❌ | ❌ |
| Configurar datos de su plaza | ❌ | ✅ (excepto slug, dado de baja) | ❌ |
| Configurar plataforma | ✅ | ❌ | ❌ |

### 9.5 Reglas de negocio

- **RN-PA-1:** los KPIs del dashboard se calculan en queries SQL agregadas, no en la app, para mantener performance.
- **RN-PA-2:** el dashboard de la plaza solo muestra datos del `plaza_id` del token.
- **RN-PA-3:** la configuración de la plaza es inmutable para el `slug` después del alta. Cualquier otro campo es editable.
- **RN-PA-4:** los cambios de configuración se registran en `auditoria`.

### 9.6 Dependencias

- **Todos los demás módulos:** el panel es un agregador de información.

### 9.7 SUPUESTOS del módulo

- **S-PA-A:** los tipos de solicitud son fijos en v1; no hay editor visual de tipos.
- **S-PA-B:** los KPIs precalculados se refrescan con un cron cada 15 minutos. (SUPUESTO.)
- **S-PA-C:** no hay sistema de facturación/MRR en v1; las "métricas globales" se limitan a conteos.

---

## 10. Mapa de dependencias entre módulos

```
                ┌──────────────┐
                │  PLAZAS (MT) │  ← transversal
                └──────┬───────┘
                       │
                ┌──────▼───────┐
                │   USUARIOS   │
                │(Autenticación)│
                └──────┬───────┘
                       │
        ┌──────────────┼──────────────────┐
        │              │                  │
   ┌────▼─────┐   ┌────▼──────┐    ┌──────▼──────┐
   │ LOCALES  │   │ INQUILINOS│    │  REPORTES   │
   │ +CONTRATOS│   └────┬──────┘    │  PANEL ADM  │
   └────┬──────┘        │           └──────▲──────┘
        │               │                  │
        │        ┌──────▼──────┐           │
        │        │ SOLICITUDES │           │
        │        └──────┬──────┘           │
        │               │                  │
        │        ┌──────▼──────┐           │
        │        │ APROBACIONES│           │
        │        └─┬───────┬───┘           │
        │          │       │               │
   ┌────▼───┐  ┌───▼──┐  ┌─▼────────┐      │
   │ADJUNTOS│  │NOTIF.│  │CALENDARIO│      │
   │(MinIO) │  │SMTP  │  └──────────┘      │
   └────────┘  └──────┘                    │
                                            │
        (todo reporta a REPORTES y PANEL) ──┘
```

---

## 11. Resumen de SUPUESTOS pendientes de validar

| ID | Módulo | Supuesto |
|---|---|---|
| S-MT-A | MT | Resolución de tenant por subdominio en prod, path en dev |
| S-MT-B | MT | Slug de plaza inmutable |
| S-MT-C | MT | Un usuario no puede ser admin_plaza e inquilino a la vez |
| S-AU-A | Autenticación | Sin OAuth |
| S-AU-B | Autenticación | Sin verificación de email al alta |
| S-AU-C | Autenticación | Sin 2FA |
| S-AU-D | Autenticación | Sesiones JWT en cookie httpOnly |
| S-AU-E | Autenticación | Usuario pertenece a una sola plaza |
| S-PwdPolicy | Autenticación | Política de contraseñas fuerte (10 chars, mixto) |
| S-Lockout | Autenticación | Bloqueo tras 5 intentos fallidos / 15 min |
| S-Reset | Autenticación | Token de reset de 30 min, un solo uso |
| S-EstadosLocal | Locales | Estados: disponible, alquilado, en_mantenimiento, fuera_de_servicio |
| S-CSV | Locales | Importador CSV para onboarding |
| S-ContratoIndefinido | Contratos | Contratos sin fecha_fin (indefinidos) permitidos |
| S-AlertaVencimiento | Contratos | Alertas T-30 y T-7 antes del fin |
| S-CamposTipo | Solicitudes | Campos extra por tipo (RN-SO-5) |
| S-Duplicar | Solicitudes | Botón "duplicar solicitud" |
| S-Recurrencia | Solicitudes | Eventos recurrentes |
| S-AsignacionAdmin | Aprobaciones | Asignar solicitud a otro admin |
| S-SLA | Aprobaciones | SLA visual por tipo |
| S-LockTimeout | Aprobaciones | Lock expira a 30 min |
| S-RemodelEstado | Aprobaciones | Aprobar remodelación cambia estado del local |
| S-Bounce | Notificaciones | Manejo de hard bounce |
| S-Unsubscribe | Notificaciones | Link de desuscripción en emails no críticos |
| S-ICalExport | Calendario | Exportar a iCal |
| S-Choques | Calendario | Detección visual de choques |
| S-CrearDesdeCalendario | Calendario | Crear solicitud desde el calendario |
| S-ColorTipo | Calendario | Color por tipo de evento |
| S-Timezone | Calendario | Zona horaria de la plaza |
| S-TamañoMax | Adjuntos | 25 MB por archivo |
| S-MimeTypes | Adjuntos | Lista cerrada de MIME types |
| S-Preview | Adjuntos | Visor inline para PDF e imágenes |
| S-Quarantine | Adjuntos | Cuarentena de 30 días para borrados |
| S-Exportación | Reportes | CSV + XLSX |
| S-AsyncReport | Reportes | Reportes grandes se procesan asíncronos |
| S-ScheduledReports | Reportes | Envío automático mensual |
| S-TiposCustom | Panel | Tipos de solicitud fijos en v1 |
| S-KPI | Panel | KPIs precalculados con cron de 15 min |

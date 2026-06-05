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
- `rol` (catálogo global fijo: `superadmin`, `admin_plaza`, `inquilino`)
- `rol_staff` (catálogo configurable por plaza: `tecnico`, `ingeniero-hvac`, etc.)
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
- **RN-AU-6:** toda sesión emite `iat`, `exp`, `sub`, `plaza_id`, `rol`, `rol_staff_id` (si aplica), `usuario_id`. Ver `JWT` en §2.6.
- **RN-AU-7:** un `inquilino` solo puede iniciar sesión si su `inquilino` asociado está activo y pertenece a la misma plaza.
- **RN-AU-8:** el email de bienvenida se envía siempre (SUPUESTO).
- **RN-AU-9:** el `superadmin` **no** puede crear solicitudes, locales ni contratos. Es un usuario de plataforma, no cliente final.
- **RN-AU-10:** todo usuario con rol global `admin_plaza` debe tener un `rol_staff_id` asignado (NOT NULL) para poder operar; usuarios `superadmin` e `inquilino` lo tienen NULL. (SUPUESTO S-ResponsabilidadStaff.)

### 1.6 Dependencias

- Depende de **`plazas`** (todo usuario pertenece a una plaza excepto `superadmin`).
- Depende de **`roles-staff`** (todo `admin_plaza` debe tener un `rol_staff`).
- Es consumido por **todos los módulos** (cada operación requiere `request.user`).

### 1.7 SUPUESTOS del módulo

- **S-AU-A:** no se contemplan OAuth (Google, Microsoft) en v1.
- **S-AU-B:** no hay verificación de email al registrarse (los usuarios los crea el admin, no se registran solos).
- **S-AU-C:** no hay 2FA/MFA en v1.
- **S-AU-D:** las sesiones son `JWT` en cookie httpOnly. No se almacenan sesiones en servidor.
- **S-AU-E:** un usuario solo puede pertenecer a **una** plaza. Multi-plaza para staff no se contempla.
- **S-AU-F:** un usuario con rol global `admin_plaza` debe tener un `rol_staff` configurado para ser dado de alta; sin él no puede operar (RN-AU-10).

---

## 1A. Módulo: Roles de Staff (CRUD)

> **Módulo nuevo.** Habilita que cada `admin_plaza` defina sus propios roles operativos (técnico, ingeniero, supervisor, etc.) y los asigne a los usuarios de su plaza.

### 1A.1. Propósito

Proveer un catálogo **configurable por plaza** de roles operativos del personal de la administración. Cada plaza crea los roles que necesite mediante un CRUD simple (`GET/POST/PATCH/DELETE /api/v1/roles-staff`). El rol de staff se asigna luego a cada usuario `admin_plaza` y define sus capacidades operativas (p. ej. "puede ser responsable de subcategorías de tipo mantenimiento").

### 1A.2. Casos de uso

- **CU-RS-1 · Listar roles de staff de la plaza:** filtrado por `activo=true/false`. Disponible para `admin_plaza` (CRUD) e `inquilino` (solo lectura, para usar en selección).
- **CU-RS-2 · Crear rol de staff:** alta con código (slug), nombre, descripción opcional.
- **CU-RS-3 · Editar rol de staff:** modificar nombre, descripción, activo. El `codigo` es inmutable.
- **CU-RS-4 · Desactivar rol de staff:** soft delete (`activo=false`). Los usuarios que ya lo tienen asignado lo conservan pero la UI los marca "rol inactivo".
- **CU-RS-5 · Asignar rol de staff a un usuario `admin_plaza`:** desde el CRUD de usuarios (§1, CU-AU-1/CU-AU-2) se selecciona un `rol_staff` de la lista activa de la plaza.

### 1A.3. Entidades

- `rol_staff` (per-plaza, configurable).

### 1A.4. Roles

| Acción | superadmin | admin_plaza | inquilino |
|---|---|---|---|
| Listar roles activos de su plaza | ✅ | ✅ | ✅ (read-only, para formularios) |
| Crear / editar / desactivar `rol_staff` | ✅ (multi-plaza) | ✅ (de su plaza) | ❌ |
| Asignar `rol_staff` a un usuario | ✅ | ✅ (de su plaza) | ❌ |

### 1A.5. Reglas de negocio

- **RN-RS-1:** cada `rol_staff` es único por `(plaza_id, codigo)`. El `codigo` es slug inmutable.
- **RN-RS-2:** solo `admin_plaza` puede gestionar `rol_staff`; `inquilino` solo ve el catálogo activo en modo lectura.
- **RN-RS-3:** un `admin_plaza` que desactive un `rol_staff` con usuarios asignados debe resignarlos antes (o el sistema advierte, pero no bloquea; los usuarios quedan con el FK en estado "inactivo" visible en UI).
- **RN-RS-4:** los roles de staff son a nivel **plaza**: dos plazas distintas pueden tener roles con el mismo `codigo` y distinto `nombre`/`descripcion`.

### 1A.6. Dependencias

- `plazas` (todo `rol_staff` pertenece a una plaza).
- `usuarios` (el `rol_staff` se asigna a un usuario `admin_plaza`).

### 1A.7. SUPUESTOS del módulo

- **S-RS-A:** los roles de staff son configurables libremente por cada plaza. No hay catálogo de plataforma fijo en v1.
- **S-RS-B:** no hay jerarquía entre roles de staff (ningún rol "supervisa" a otro automáticamente); las relaciones de supervisión se modelan en subcategorías (módulo §3A).

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

- **CU-SO-1 · Crear solicitud (borrador):** el inquilino completa un formulario con tipo, local, **categoría**, **subcategoría** (obligatorios salvo `tipo=otro`), título, descripción, fechas (si aplica), horario, adjuntos. Queda en estado `borrador`.
- **CU-SO-2 · Editar borrador:** mientras esté en `borrador`, el inquilino puede modificar cualquier campo (incluida la categoría/subcategoría).
- **CU-SO-3 · Adjuntar archivos a la solicitud:** PDFs, imágenes, planos.
- **CU-SO-4 · Enviar solicitud:** pasa de `borrador` a `en_revision` **directamente**, con auto-asignación al responsable de la subcategoría (T2, ver §5.4). Se notifica al responsable y a los supervisores por email.
- **CU-SO-5 · Ver listado de mis solicitudes:** con filtros por tipo, categoría, subcategoría, local, estado, prioridad y rango de fechas.
- **CU-SO-6 · Ver detalle de solicitud:** incluye historial de cambios, comentarios, adjuntos, transiciones de estado, **responsable y supervisores asignados**.
- **CU-SO-7 · Cancelar solicitud:** solo si está en `borrador` o `en_revision` (no después de aprobada/rechazada).
- **CU-SO-8 · Subsanar solicitud:** cuando el admin pide cambios, el inquilino edita y vuelve a enviar (`requerida_subsanacion → en_revision` con auto-asignación al responsable que pidió la subsanación, ver T9 en §5.4).
- **CU-SO-9 · Duplicar solicitud:** clona los datos de una solicitud anterior en un nuevo borrador. (SUPUESTO S-Duplicar.)
- **CU-SO-10 · Tipos soportados:** `mantenimiento`, `evento`, `remodelacion`, `otro`. Cada tipo puede tener campos extra. (SUPUESTO S-CamposTipo — ver §3.5.) El enrutamiento se hace por **categoría + subcategoría** (§3A).
- **CU-SO-11 · Solicitudes recurrentes (eventos):** si el tipo es `evento`, se puede definir un patrón de repetición. (SUPUESTO S-Recurrencia; ver §3.5.)
- **CU-SO-12 · Selección de categoría + subcategoría:** al crear una solicitud (excepto `tipo=otro`), el inquilino debe elegir una categoría activa y luego una subcategoría activa de esa categoría. La prioridad se hereda de la subcategoría.
- **CU-SO-13 · Cambio de prioridad:** el `admin_plaza` puede modificar la prioridad de una solicitud existente con `PATCH /solicitudes/:id` (campo `prioridad`). Queda registrado en `solicitud_historial`.

### 3.3 Entidades

- `solicitud`
- `solicitud_historial` (todas las transiciones y eventos)
- `solicitud_campo_extra` (campos dinámicos según tipo)
- `solicitud_evento_recurrente` (hijos de un evento padre)
- `adjunto` (vinculado a solicitud)
- `comentario` (vinculado a solicitud)
- `categoria`, `subcategoria`, `subcategoria_supervisor` (ver §3A): enrutamiento y auto-asignación.

### 3.4 Roles

| Acción | superadmin | admin_plaza | inquilino |
|---|---|---|---|
| Crear borrador | ❌ (SUPUESTO) | ❌ (SUPUESTO) | ✅ |
| Editar borrador propio | — | — | ✅ |
| Enviar solicitud (auto-asignada) | — | — | ✅ |
| Ver todas las solicitudes de su plaza | ✅ | ✅ | ❌ (solo las propias) |
| Ver detalle de solicitud | ✅ | ✅ | ✅ (si es de su inquilino) |
| Cancelar solicitud | — | ✅ (con motivo) | ✅ (solo propias, en `borrador`/`en_revision`) |
| Subsanar | — | — | ✅ (cuando se requiere) |
| Comentar en una solicitud | — | ✅ | ✅ (en sus solicitudes) |
| Cambiar prioridad de solicitud | ❌ | ✅ | ❌ |

### 3.5 Reglas de negocio

- **RN-SO-1:** toda solicitud debe estar asociada a un **local** y, por lo tanto, a un **inquilino**. Un inquilino solo crea solicitudes para sus locales.
- **RN-SO-2:** al crear la solicitud, el `estado` inicial es siempre `borrador`.
- **RN-SO-3:** el envío (`borrador → en_revision`) dispara **auto-asignación al responsable de la subcategoría** (T2 en §5.4), email al responsable, emails a los supervisores de la subcategoría, y entrada en `solicitud_historial`. Ver módulo §3A.
- **RN-SO-4:** el `tipo` de la solicitud no se puede cambiar después de crearla. Si se requiere, se cancela y se crea una nueva.
- **RN-SO-5:** **campos extra por tipo** (SUPUESTO S-CamposTipo):
  - `mantenimiento`, `evento`, `remodelacion`: requieren **`categoria_id` y `subcategoria_id` no NULL** (elegidos de los catálogos activos de la plaza).
  - `otro`: `categoria_libre` (texto libre, opcional) y `descripcion_larga`; `categoria_id` y `subcategoria_id` pueden ser NULL.
  - Campos extra adicionales: `mantenimiento` → `area_afectada`, `requiere_ingreso_a_local` (bool); `evento` → `asistentes_estimados`, `requiere_corte_calle` (bool), `requiere_amplificacion` (bool); `remodelacion` → `fecha_inicio_estimada`, `duracion_dias`, `empresa_constructora`, `monto_presupuesto` (referencial).
- **RN-SO-6:** un `evento` con `asistentes_estimados > X` puede requerir aprobación especial (SUPUESTO: `X = 200`, configurable por plaza).
- **RN-SO-7:** el título es obligatorio y máximo 120 caracteres; la descripción máximo 4000.
- **RN-SO-8:** al menos 1 adjunto es opcional. (SUPUESTO — el cliente puede requerir obligatoriedad por tipo; configurable.)
- **RN-SO-9:** el histórico es inmutable: una vez escrito un evento, no se borra.
- **RN-SO-10:** la `prioridad` se hereda de `subcategoria.prioridad` al enviar (T2), y puede ser modificada después por el `admin_plaza` con `PATCH /solicitudes/:id` (campo `prioridad`). El cambio queda registrado en `solicitud_historial`. Ver SUPUESTO S-Prioridad.
- **RN-SO-11:** la `subcategoria` seleccionada al crear la solicitud debe estar `activo=true`; de lo contrario el backend rechaza con `404 SUBCATEGORIA_INACTIVA` o `400 SUBCATEGORIA_REQUERIDA`.

### 3.6 Dependencias

- `locales` y `contratos` (la solicitud referencia un local vigente).
- `usuarios` (solicitante = usuario inquilino).
- **`categorias` (§3A)** — la solicitud requiere `categoria_id` y `subcategoria_id`; la subcategoría define el responsable y los supervisores.
- `aprobaciones` (es el módulo que consume las solicitudes en estado `en_revision`).
- `notificaciones` (dispara emails en cada transición).
- `calendario` (los eventos aprobados alimentan el calendario).
- `adjuntos` (archivos de la solicitud).
- `auditoria` (todo queda registrado).

### 3.7 SUPUESTOS del módulo

- **S-SO-A:** los campos extra por tipo se almacenan como JSONB en PostgreSQL, validados con Zod por tipo.
- **S-SO-B:** la recurrencia de eventos no es obligatoria; se puede desactivar en la primera versión si el alcance se ajusta.
- **S-SO-C:** el `superadmin` **no** crea solicitudes en nombre de inquilinos.
- **S-SO-Prioridad-1:** la prioridad se hereda de la subcategoría al crear la solicitud y es modificable por el `admin_plaza` con `PATCH /solicitudes/:id`. Valores permitidos: `A | B | C | D | F`.
- **S-SO-Prioridad-2:** el `inquilino` no puede modificar la prioridad al crear (siempre se hereda).

---

## 3A. Módulo: Categorías y Subcategorías (CRUD)

> **Módulo nuevo.** Configura el enrutamiento de las solicitudes: qué categorías existen en la plaza, qué subcategorías dependen de cada una, quién las resuelve (responsable) y quién las supervisa (hasta 5 usuarios). Reemplaza al enum embebido `campos_extra.categoria` de la versión anterior y habilita la **auto-asignación** de solicitudes (§3.5 RN-SO-3, §5.4 T2).

### 3A.1. Propósito

Permitir que cada `admin_plaza` configure su propio catálogo de categorías y subcategorías de solicitudes, y para cada subcategoría defina:
- Una **persona responsable** (un usuario con rol de staff) que recibirá automáticamente la solicitud al crearse.
- Hasta **5 supervisores** (también usuarios con rol de staff) que serán notificados de cada nueva solicitud.
- Una **prioridad** por defecto (`A | B | C | D | F`) que se heredará a las solicitudes creadas con esta subcategoría.

### 3A.2. Casos de uso

#### Categorías

- **CU-CA-1 · Listar categorías de la plaza:** filtrado por `activo=true/false`. Visible para `admin_plaza` (CRUD) e `inquilino` (read-only, para usar en el formulario de crear solicitud).
- **CU-CA-2 · Crear categoría:** alta con nombre único, descripción opcional.
- **CU-CA-3 · Editar categoría:** nombre, descripción, activo.
- **CU-CA-4 · Desactivar categoría:** soft delete (`activo=false`); no se puede desactivar si tiene subcategorías activas con solicitudes en curso (RN-CA-2).
- **CU-CA-5 · Listar subcategorías de una categoría:** para drill-down en el formulario del inquilino y para gestión interna del admin.

#### Subcategorías

- **CU-SC-1 · Crear subcategoría:** con `categoria_id`, nombre único dentro de la categoría, descripción, `prioridad` (default `B`), `responsable_id` (usuario `admin_plaza` con `rol_staff` activo), y opcionalmente hasta 5 supervisores.
- **CU-SC-2 · Editar subcategoría:** cualquier campo excepto que cambiar `responsable_id` reasigna las solicitudes futuras (no las ya en curso).
- **CU-SC-3 · Desactivar subcategoría:** soft delete. Las solicitudes nuevas no pueden usar esta subcategoría; las ya existentes siguen referenciándola (RN-SC-4).
- **CU-SC-4 · Asignar responsable a subcategoría:** el `admin_plaza` elige un usuario con rol global `admin_plaza` y `rol_staff` activo en la misma plaza.
- **CU-SC-5 · Asignar supervisores a subcategoría:** hasta 5 usuarios con los mismos requisitos. La API rechaza el 6º con `409 SUBCATEGORIA_MAX_5_SUPERVISORES`.
- **CU-SC-6 · Quitar supervisor:** `DELETE /api/v1/categorias/:id/subcategorias/:subId/supervisores/:usuarioId`.
- **CU-SC-7 · Ver responsables y supervisores de una subcategoría:** desde la UI de gestión y desde el detalle de la solicitud (para inquilino y admin).

### 3A.3. Entidades

- `categoria` (per-plaza, configurable).
- `subcategoria` (per-plaza, con `responsable_id` FK a `usuario`).
- `subcategoria_supervisor` (tabla N:M, max 5 enforced por trigger PG).

### 3A.4. Roles

| Acción | superadmin | admin_plaza | inquilino |
|---|---|---|---|
| Listar categorías/subcategorías activas | ✅ | ✅ | ✅ (read-only, para formularios) |
| Crear / editar / desactivar categoría | ✅ (multi-plaza) | ✅ (de su plaza) | ❌ |
| Crear / editar / desactivar subcategoría | ✅ (multi-plaza) | ✅ (de su plaza) | ❌ |
| Asignar responsable a subcategoría | ✅ | ✅ | ❌ |
| Asignar / quitar supervisores | ✅ | ✅ | ❌ |

### 3A.5. Reglas de negocio

- **RN-CA-1:** `UNIQUE(plaza_id, nombre)` en `categoria`.
- **RN-CA-2:** no se puede desactivar una categoría que tenga subcategorías activas. Se desactivan primero las subcategorías.
- **RN-SC-1:** `UNIQUE(categoria_id, nombre)` en `subcategoria`.
- **RN-SC-2:** el `responsable_id` debe ser un usuario con rol global `admin_plaza`, con `rol_staff_id` activo y con el mismo `plaza_id` que la subcategoría. Validado en app y en SC-6 de §6.3.
- **RN-SC-3:** los supervisores cumplen los mismos requisitos que el responsable. Máximo 5 por subcategoría (enforced por `RI-7` y `tg_subcategoria_max_5_supervisores` en BD).
- **RN-SC-4:** al desactivar una subcategoría, las solicitudes nuevas no pueden usarla; las solicitudes ya creadas siguen referenciándola (la FK no se borra).
- **RN-SC-5:** al cambiar el `responsable_id` de una subcategoría, las solicitudes **en curso** (`en_revision`, `requerida_subsanacion`) no se reasignan automáticamente; el responsable actual sigue siendo el dueño hasta que termine el lock o se reasigne manualmente (T12, §5.4).

### 3A.6. Dependencias

- `plazas` (toda categoría/subcategoría pertenece a una plaza).
- `usuarios` (responsable y supervisores son usuarios con `admin_plaza` + `rol_staff`).
- `solicitudes` (la solicitud referencia `categoria_id` y `subcategoria_id`; el enrutamiento se resuelve aquí).

### 3A.7. SUPUESTOS del módulo

- **S-CA-A:** `categoria` y `subcategoria` son configurables por cada plaza; no hay catálogo global.
- **S-SC-A:** una subcategoría tiene exactamente 1 responsable y entre 0 y 5 supervisores.
- **S-SC-B:** el `admin_plaza` no puede asignar como responsable/supervisor a un usuario que pertenezca a otra plaza, a un `inquilino`, a un `superadmin` o a un usuario con `rol_staff` inactivo.

---

## 4. Módulo: Aprobaciones

> **Origen PDF:** "Flujo de aprobación/rechazo por administrador con comentarios y notificación."

### 4.1 Propósito

Concentrar el flujo de revisión por el cual el `admin_plaza` toma una decisión formal sobre una solicitud: aprobarla, rechazarla o pedir subsanación. Es el corazón operativo del sistema.

### 4.2 Casos de uso

- **CU-AP-1 · Bandeja de entrada de solicitudes:** el `admin_plaza` ve una cola priorizada por **antigüedad**, **tipo** y **prioridad** (A→F como criterio secundario).
- **CU-AP-2 · Tomar una solicitud para revisión:** la solicitud nueva entra **directamente** a `en_revision` con auto-asignación al responsable de la subcategoría (T2, §5.4). El "tomar manual" se reduce a la reasignación (CU-AP-7) cuando el responsable libera o el lock expira.
- **CU-AP-3 · Aprobar solicitud:** transición `en_revision → aprobada`. Se registra `comentario` opcional, fecha y admin que aprobó.
- **CU-AP-4 · Rechazar solicitud:** transición `en_revision → rechazada`. **Comentario obligatorio** con el motivo.
- **CU-AP-5 · Pedir subsanación:** transición `en_revision → requerida_subsanacion`. **Comentario obligatorio** con lo que se requiere.
- **CU-AP-6 · Comentar sin cambiar estado:** el admin puede dejar comentarios en cualquier momento.
- **CU-AP-7 · Asignar / reasignar a otro admin_plaza:** `POST /api/v1/solicitudes/:id/reasignar { nuevo_responsable_id, comentario? }`. Libera el lock actual, asigna el nuevo responsable con lock 30 min, envía email `solicitud-reasignada.html`. Cualquier `admin_plaza` (no solo supervisores) puede hacerlo (SUPUESTO S-Reasignacion).
- **CU-AP-8 · Ver historial completo:** transiciones, comentarios, adjuntos, asignaciones.
- **CU-AP-9 · SLA visual:** cada solicitud muestra tiempo transcurrido y semáforo (verde/amarillo/rojo) según SLA configurable por plaza **multiplicado por la prioridad** (SUPUESTO S-SLA-Prioridad).

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
- **RN-AP-6:** la "toma para revisión" (locking) evita que dos admins trabajen la misma solicitud a la vez. Lock expira a los 30 min sin actividad. (SUPUESTO S-LockTimeout.) **En el flujo nuevo**, el lock se setea **automáticamente** en T2 al enviar la solicitud, con `admin_asignado_id = subcategoria.responsable_id`. Reasignar (T12) reinicia el lock con el nuevo responsable.
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
- **CU-NE-2 · Plantillas HTML por evento:** mantenidas en `src/modules/notificaciones/templates/`. Plantillas nuevas: `solicitud-asignada-responsable.html`, `solicitud-nueva-supervisor.html`, `solicitud-reasignada.html`.
- **CU-NE-3 · Notificación multi-destinatario:** un mismo evento (p. ej. "nueva solicitud") puede generar N emails — uno al responsable y otro a cada supervisor. Cada email se enqueua por separado en `email_log` y se deduplica si el mismo usuario aparece como responsable **y** supervisor.
- **CU-NE-4 · Log de envíos:** cada intento queda registrado con estado, timestamp, error, plantilla usada.
- **CU-NE-5 · Reintento automático:** 3 intentos con backoff exponencial (1 min, 5 min, 30 min).
- **CU-NE-6 · Reintento manual desde panel admin:** el admin puede reintentar un email `fallido` desde el log.
- **CU-NE-7 · Variables dinámicas:** cada plantilla recibe `{plaza, usuario, solicitud, responsable, supervisores, etc.}`.
- **CU-NE-8 · Branding por plaza:** logo, color primario, nombre comercial aplicados al template.

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
- **RN-NE-6:** para eventos multi-destinatario (CU-NE-3), se enqueua un email por destinatario. Si un destinatario es a la vez responsable y supervisor de la misma solicitud, se envía **una sola vez** (deduplicación por `(solicitud_id, destinatario, evento)`).

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
- **RN-RE-4:** los archivos XLSX se generan delegando a jsreport (`recipe: 'xlsx'`); las plantillas HTML con tablas se mantienen en `backend/src/modules/reportes/templates/` y se envían inline en el `template.content` del POST a jsreport.
- **RN-RE-4b:** los archivos PDF se generan delegando a jsreport (`recipe: 'chrome-pdf'`); el backend no instala librerías de generación (sin pdfkit, puppeteer, etc.).
- **RN-RE-5:** los reportes pesados (más de 10 000 filas) se procesan de forma asíncrona y se notifican al usuario. (SUPUESTO S-AsyncReport.)
- **RN-RE-6:** los inquilinos **no** ven reportes en v1 (SUPUESTO). Si el cliente lo requiere, se define un subconjunto mínimo.

### 8.6 Dependencias

- `solicitudes`, `solicitud_historial`, `locales`, `inquilinos`, `contratos`, `usuarios`.
- `notificaciones` (envío de reportes programados, si se activa).
- **jsreport** (contenedor Docker, [`jsreport/jsreport:4.13.0`](https://jsreport.net/learn/docker)): recibe `{ template.content, data }` y devuelve el binario PDF/XLSX. No accede a la BD directamente.

### 8.7 SUPUESTOS del módulo

- **S-RE-A:** los inquilinos no ven reportes. (Confirmar con cliente.)
- **S-RE-B:** los reportes programados son opcionales y se pueden diferir a v1.1.
- **S-RE-C:** la biblioteca de gráficos es `recharts` (SUPUESTO, gráficos del panel admin en el frontend, no afecta a la generación de reportes).
- **S-RE-D:** las plantillas de reportes viven en `backend/src/modules/reportes/templates/` como archivos HTML/Handlebars y se envían inline a jsreport en cada request (`template.content`). No se persisten dentro del contenedor de jsreport.

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
- **CU-PA-8 · Gestión de categorías y subcategorías:** CRUD de `categoria` y `subcategoria`, con asignación de responsable y supervisores (delega al módulo §3A).
- **CU-PA-9 · SLA por tipo de solicitud:** días máximos por tipo, **multiplicador de SLA por prioridad** (`configuracion.sla_multiplicador_por_prioridad`). (SUPUESTO S-SLA y S-SLA-Prioridad.)
- **CU-PA-10 · Tamaño máximo de adjuntos y MIME permitidos.**
- **CU-PA-11 · Plantillas de email activas:** ver qué plantillas están en uso.
- **CU-PA-12 · Zona horaria y formato de fecha.**

#### Gestión de personal

- **CU-PA-13 · Gestión de roles de staff:** CRUD de `rol_staff` (delega al módulo §1A). Asignación de `rol_staff` a usuarios `admin_plaza`.

#### Plataforma (solo superadmin)

- **CU-PA-14 · Listado de plazas:** ver, crear, editar, desactivar.
- **CU-PA-15 · Métricas globales de la plataforma:** número de plazas activas, total de usuarios, MRR si aplica. (SUPUESTO.)
- **CU-PA-16 · Auditoría global:** últimos eventos de plataforma.

### 9.3 Entidades

- `plaza` (configuración).
- `configuracion` (incluye `sla_multiplicador_por_prioridad`).
- `kpi_snapshot` (tabla con métricas precalculadas — SUPUESTO S-KPI).
- `auditoria` (eventos transversales).
- `rol_staff`, `categoria`, `subcategoria` (delegados a módulos §1A y §3A; la UI los expone aquí).

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

- **S-PA-A:** las "categorías" y "subcategorías" son configurables por plaza (CU-PA-8). Los "tipos" macro (`mantenimiento`, `evento`, `remodelacion`, `otro`) siguen siendo fijos en v1.
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
| S-AU-F | Autenticación | `admin_plaza` debe tener `rol_staff` configurado |
| S-RS-A | Roles de Staff | Roles configurables libremente por plaza, sin catálogo de plataforma |
| S-RS-B | Roles de Staff | No hay jerarquía entre roles de staff |
| S-CA-A | Categorías | `categoria` y `subcategoria` configurables por plaza |
| S-SC-A | Subcategorías | 1 responsable y 0–5 supervisores por subcategoría |
| S-SC-B | Subcategorías | Responsable/supervisor debe ser `admin_plaza` con `rol_staff` activo, misma plaza |
| S-SO-Prioridad-1 | Solicitudes | Prioridad heredada de subcategoría, modificable por admin |
| S-SO-Prioridad-2 | Solicitudes | Inquilino no puede modificar la prioridad al crear |
| S-AutoAsignacion | Solicitudes | Envío asigna automáticamente al responsable de la subcategoría |
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
| S-SLA-Prioridad | Aprobaciones | Multiplicador de SLA por prioridad |
| S-LockTimeout | Aprobaciones | Lock expira a 30 min |
| S-Reasignacion | Aprobaciones | Cualquier `admin_plaza` puede reasignar una solicitud |
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
| S-Exportación | Reportes | CSV inline (backend) + XLSX/PDF via jsreport |
| S-AsyncReport | Reportes | Reportes grandes se procesan asíncronos |
| S-ScheduledReports | Reportes | Envío automático mensual |
| S-JSReport | Reportes | jsreport 4.13 como contenedor separado; backend sin libs de generación |
| S-TiposCustom | Panel | Tipos de solicitud fijos en v1 |
| S-KPI | Panel | KPIs precalculados con cron de 15 min |

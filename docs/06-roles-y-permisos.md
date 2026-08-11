# 06 · Roles y Permisos

> **Código del documento:** `DOC-06-RP`
> **Estado:** Borrador para validación
> **Complementa:** [`03-modulos-del-sistema.md`](./03-modulos-del-sistema.md) (permisos por módulo) y [`05-flujo-de-solicitudes.md`](./05-flujo-de-solicitudes.md) (transiciones).

---

## 6.1. Roles definidos

El sistema contempla **tres roles globales** con scopes distintos y complementarios, más **roles de staff configurables por plaza** que afinan las capacidades operativas de cada `admin_plaza`.

#### Eje 1 — Rol global (catálogo fijo, no editable)

| Código | Nombre | Scope | Propósito |
|---|---|---|---|
| `superadmin` | Superadministrador | Plataforma | Operador de Helixsys / SaaS manager. Da de alta plazas, asigna el primer admin de cada plaza, ve métricas globales. |
| `admin_plaza` | Administrador de plaza | Una plaza | Personal de la empresa administradora de la plaza. Configura su plaza, gestiona usuarios, aprueba solicitudes, ve reportes. **No es un rol monolítico**: cada usuario de staff se complementa con un `rol_staff` (eje 2). |
| `inquilino` | Inquilino / Negocio | Una plaza, un inquilino | Comercio o negocio arrendatario. Crea, envía y da seguimiento a sus solicitudes. |

#### Eje 2 — Rol de staff (configurable por plaza, ver §6.2.X)

| Atributo | Detalle |
|---|---|
| **Alcance** | Una plaza. Dos plazas distintas pueden tener roles con el mismo `codigo` y distinto `nombre` (p. ej. `tecnico` en una plaza puede ser distinto que `tecnico` en otra). |
| **Asignación** | Cada usuario con rol global `admin_plaza` debe tener **un** `rol_staff` asignado (NOT NULL) para poder operar. |
| **Uso** | Define capacidades operativas (p. ej. ser responsable/supervisor de subcategorías). **En la v1, las capacidades de aprobación/rechazo son uniformes para todos los `admin_plaza` independientemente de su `rol_staff`**; las capacidades específicas (p. ej. "solo técnicos pueden ser responsables de subcategorías de tipo mantenimiento") son SUPUESTO a validar con el cliente. |

> **SUPUESTO S-RP-A:** un usuario pertenece a **una sola plaza** y tiene **un solo rol global**. No hay multi-plaza para staff ni multi-rol global por usuario en v1. Un usuario `admin_plaza` puede tener un `rol_staff` que cambia a lo largo del tiempo (con historial no modelado en v1).

### 6.1.1. Jerarquía

```
                ┌─────────────────┐
                │   superadmin    │  ← nivel plataforma (1..N plazas)
                └────────┬────────┘
                         │ crea
                ┌────────▼────────┐
                │  admin_plaza    │  ← nivel plaza (1..N por plaza)
                └────────┬────────┘
                         │ crea
                ┌────────▼────────┐
                │    inquilino    │  ← nivel plaza/inquilino
                └─────────────────┘
```

---

## 6.2. Matriz de permisos por módulo

Leyenda: `✅` permitido · `❌` prohibido · `⚠️` permitido con restricción (ver nota) · `—` no aplica.

### 6.2.1. Plazas (multi-tenant)

| Acción | superadmin | admin_plaza | inquilino |
|---|---|---|---|
| Listar todas las plazas | ✅ | ❌ | ❌ |
| Crear plaza | ✅ | ❌ | ❌ |
| Editar datos básicos de la plaza | ✅ | ⚠️ (no puede cambiar slug ni desactivar) | ❌ |
| Ver configuración de su plaza | ✅ | ✅ | ❌ |
| Editar configuración de su plaza | ❌ | ✅ | ❌ |
| Desactivar plaza (soft delete) | ✅ | ❌ | ❌ |

### 6.2.2. Autenticación y Usuarios

| Acción | superadmin | admin_plaza | inquilino |
|---|---|---|---|
| Crear usuario `superadmin` | ✅ | ❌ | ❌ |
| Crear usuario `admin_plaza` en su plaza (con `rol_staff` obligatorio) | ✅ | ✅ (excepto otros superadmin) | ❌ |
| Crear usuario `inquilino` en su plaza | ✅ | ✅ | ❌ |
| Listar usuarios de su plaza | ✅ | ✅ | ❌ (solo su perfil) |
| Editar perfil propio | ✅ | ✅ | ✅ |
| Cambiar contraseña propia | ✅ | ✅ | ✅ |
| Solicitar reset de contraseña | ✅ | ✅ | ✅ |
| Desactivar usuario | ✅ | ✅ (de su plaza) | ❌ |
| Ver bitácora de login | ✅ | ✅ (de su plaza) | ❌ |
| Asignar / cambiar `rol_staff` de un usuario `admin_plaza` | ✅ | ✅ (de su plaza) | ❌ |

### 6.2.3. Locales

| Acción | superadmin | admin_plaza | inquilino |
|---|---|---|---|
| Crear / editar / desactivar local | ✅ | ✅ | ❌ |
| Ver locales de su plaza | ✅ | ✅ | ⚠️ (solo los suyos) |
| Subir plano / fotos del local | ✅ | ✅ | ❌ |
| Ver locales sin contratos vigentes | ✅ | ✅ | ❌ |

### 6.2.4. Inquilinos y Contratos

| Acción | superadmin | admin_plaza | inquilino |
|---|---|---|---|
| Crear / editar inquilino | ✅ | ✅ | ❌ |
| Ver inquilinos de su plaza | ✅ | ✅ | ❌ (solo el propio) |
| Crear / editar / cerrar contrato | ✅ | ✅ | ❌ |
| Ver contratos de su inquilino | ✅ | ✅ | ✅ (los suyos) |
| Subir contrato firmado | ✅ | ✅ | ✅ (SUPUESTO) |
| Ver alertas de vencimiento | ✅ | ✅ | ❌ |

### 6.2.5. Solicitudes

| Acción | superadmin | admin_plaza | inquilino |
|---|---|---|---|
| Crear borrador (con `categoria_id` + `subcategoria_id` salvo `tipo=otro`) | ❌ | ❌ | ✅ |
| Editar borrador propio | — | — | ✅ |
| Enviar solicitud (auto-asignada al responsable) | — | — | ✅ |
| Ver todas las solicitudes de su plaza | ✅ | ✅ | ❌ |
| Ver solicitudes de su inquilino | ✅ | ✅ | ✅ |
| Cancelar solicitud en `borrador` / `en_revision` | — | ✅ (con motivo) | ✅ (las propias) |
| Comentar en una solicitud | — | ✅ | ✅ (en sus solicitudes) |
| Adjuntar archivos | — | ✅ (en revisión) | ✅ (en borrador/subsanación) |
| Reenviar tras subsanación (auto-asignada) | — | — | ✅ |
| Cambiar prioridad de solicitud | ❌ | ✅ | ❌ |
| Reasignar solicitud a otro `admin_plaza` (T12) | ❌ | ✅ (cualquier admin) | ❌ |

### 6.2.6. Aprobaciones

| Acción | superadmin | admin_plaza | inquilino |
|---|---|---|---|
| Ver bandeja de entrada | ❌ | ✅ | ❌ |
| Tomar para revisión | ❌ | ✅ | ❌ |
| Aprobar | ❌ | ✅ (asignado) | ❌ |
| Rechazar | ❌ | ✅ (asignado, motivo obligatorio) | ❌ |
| Pedir subsanación | ❌ | ✅ (asignado, comentario obligatorio) | ❌ |
| Asignar a otro admin (T12) | ❌ | ✅ (cualquier admin) | ❌ |
| Liberar (T13) | ❌ | ✅ (asignado) | ❌ |
| Pausar (T14, T-091d-pausar) | ❌ | ✅ (asignado) | ❌ |
| Reanudar (T15, T-091d-pausar) | ❌ | ✅ (asignado) | ❌ |
| **Cerrar (T16, T-091e-cerrar)** | ❌ | ✅ (asignado; resultado + comentario obligatorio si ≠ `exitoso`) | ❌ |

### 6.2.7. Notificaciones

| Acción | superadmin | admin_plaza | inquilino |
|---|---|---|---|
| Ver log de emails de su plaza | ✅ | ✅ | ❌ |
| Reintentar email fallido | ✅ | ✅ | ❌ |
| Ver plantillas activas | ✅ | ✅ (solo lectura) | ❌ |
| Editar plantillas | ❌ | ❌ | ❌ |

### 6.2.8. Calendario

| Acción | superadmin | admin_plaza | inquilino |
|---|---|---|---|
| Ver calendario de su plaza | ✅ | ✅ | ❌ |
| Ver calendario de sus locales | — | — | ✅ |
| Filtrar por local/inquilino/tipo | ✅ | ✅ | ✅ (limitado a sus locales) |
| Exportar iCal | ✅ | ✅ | ✅ |

### 6.2.9. Documentos Adjuntos

| Acción | superadmin | admin_plaza | inquilino |
|---|---|---|---|
| Subir a solicitud propia | ❌ | ❌ | ✅ |
| Subir a solicitud de su plaza | ✅ | ✅ | ❌ |
| Subir a local de su plaza | ✅ | ✅ | ❌ |
| Subir a su contrato | ✅ | ✅ | ✅ |
| Descargar | ✅ | ✅ | ✅ (si tiene acceso al padre) |
| Eliminar | ✅ | ✅ | ✅ (solo lo que subió y la solicitud en `borrador`) |

### 6.2.10. Reportes y Estadísticas

| Acción | superadmin | admin_plaza | inquilino |
|---|---|---|---|
| Ver reportes de su plaza | ✅ | ✅ | ❌ (SUPUESTO S-RE-A) |
| Exportar CSV / XLSX | ✅ | ✅ | ❌ |
| Ver KPIs del panel | ✅ (globales) | ✅ (de su plaza) | ❌ |
| Crear reporte programado | ✅ | ✅ | ❌ (FUERA DE ALCANCE v1) |

### 6.2.11. Panel Administrativo

| Acción | superadmin | admin_plaza | inquilino |
|---|---|---|---|
| Ver dashboard de su plaza | ❌ | ✅ | ❌ |
| Ver dashboard global de plataforma | ✅ | ❌ | ❌ |
| Configurar tipos de solicitud | ❌ (fijos en v1) | ❌ (fijos en v1) | ❌ |
| Configurar SLA por tipo y multiplicador por prioridad | ❌ | ✅ | ❌ |
| Configurar tamaño máximo de adjuntos | ❌ | ✅ | ❌ |
| Configurar MIME permitidos | ❌ | ✅ | ❌ |
| Configurar branding de la plaza | ❌ | ✅ | ❌ |
| Listar/desactivar plazas | ✅ | ❌ | ❌ |

### 6.2.12. Roles de Staff (CRUD)

> **Nueva sección.** Ver módulo §1A en `03-modulos-del-sistema.md`.

| Acción | superadmin | admin_plaza | inquilino |
|---|---|---|---|
| Listar `rol_staff` activos de su plaza | ✅ | ✅ | ✅ (read-only, para formularios) |
| Listar `rol_staff` inactivos | ✅ | ✅ | ❌ |
| Crear `rol_staff` | ✅ (multi-plaza) | ✅ (de su plaza) | ❌ |
| Editar `rol_staff` | ✅ | ✅ | ❌ |
| Desactivar `rol_staff` (soft delete) | ✅ | ✅ | ❌ |
| Asignar `rol_staff` a un usuario `admin_plaza` | ✅ | ✅ | ❌ |

### 6.2.13. Categorías (CRUD)

> **Nueva sección.** Ver módulo §3A.

| Acción | superadmin | admin_plaza | inquilino |
|---|---|---|---|
| Listar categorías activas | ✅ | ✅ | ✅ (read-only) |
| Listar categorías inactivas | ✅ | ✅ | ❌ |
| Crear / editar / desactivar `categoria` | ✅ (multi-plaza) | ✅ (de su plaza) | ❌ |

### 6.2.14. Subcategorías (CRUD)

> **Nueva sección.** Ver módulo §3A.

| Acción | superadmin | admin_plaza | inquilino |
|---|---|---|---|
| Listar subcategorías activas (filtradas por categoría) | ✅ | ✅ | ✅ (read-only) |
| Crear `subcategoria` con responsable y hasta 5 supervisores | ✅ (multi-plaza) | ✅ (de su plaza) | ❌ |
| Editar `subcategoria` (incluye cambiar responsable) | ✅ | ✅ | ❌ |
| Asignar / quitar supervisores (hasta 5) | ✅ | ✅ | ❌ |
| Desactivar `subcategoria` (soft delete) | ✅ | ✅ | ❌ |

---

## 6.3. Restricciones de scope transversales

Estas restricciones aplican a **todas** las operaciones, no solo a las listadas:

- **SC-1 — Scope por plaza:** todo `admin_plaza` e `inquilino` solo puede ver y operar datos de su `plaza_id`. El backend aplica `PlazaScopeGuard` que rechaza operaciones fuera de scope con `403 Forbidden`.
- **SC-2 — Scope por inquilino (inquilinos):** un `inquilino` solo ve locales, contratos y solicitudes cuyo `inquilino_id` coincide con el de su cuenta. Si un usuario `inquilino` representa a varios inquilinos (caso no soportado en v1, ver S-MT-C), la restricción se amplía.
- **SC-3 — Scope por sí mismo (perfil):** un usuario solo edita su propio perfil y contraseña. La edición de otros perfiles requiere rol `admin_plaza` o `superadmin`.
- **SC-4 — Defense in depth:** un `admin_plaza` **no** puede aprobar/rechazar solicitudes creadas por él mismo si en el futuro se le permitiera crear (en v1 no aplica, pero se deja la guarda).
- **SC-5 — Superadmin no opera negocio:** un `superadmin` no puede crear solicitudes, locales ni contratos en nombre de un inquilino. Solo configura la plataforma.
- **SC-6 — Restricción de responsable/supervisor (nuevo):** el `responsable_id` y cada supervisor de una `subcategoria` deben ser usuarios con rol global `admin_plaza`, con `rol_staff_id` activo y con `plaza_id` igual al de la subcategoría. El backend valida con `403 RESPONSABLE_INVALIDO` o `403 SUPERVISOR_INVALIDO` si no coincide. La API de asignación rechaza al 6º supervisor con `409 SUBCATEGORIA_MAX_5_SUPERVISORES`.

---

## 6.4. Guards de NestJS

La autorización se implementa con tres guards en serie (ver [`07-arquitectura.md`](./07-arquitectura.md)):

1. **`JwtAuthGuard`** — valida el token, hidrata `request.user`.
2. **`PlazaScopeGuard`** — verifica que cualquier registro cargado/operado pertenezca al `plaza_id` del token.
3. **`RolesGuard`** + decorator `@Roles('admin_plaza', 'superadmin')` — verifica que el rol del usuario esté en la lista permitida.

### 6.4.1. Ejemplo de uso (referencia)

```ts
@Post(':id/aprobar')
@UseGuards(JwtAuthGuard, PlazaScopeGuard, RolesGuard)
@Roles('admin_plaza', 'superadmin')
async aprobar(@Param('id') id: string, @CurrentUser() user) {
  return this.aprobacionesService.aprobar(id, user);
}
```

---

## 6.5. Matriz de endpoints → rol (referencia rápida)

| Endpoint | Método | Roles permitidos | Notas |
|---|---|---|---|
| `/api/v1/auth/login` | POST | público | |
| `/api/v1/auth/logout` | POST | autenticado | |
| `/api/v1/auth/reset-password` | POST | público | |
| `/api/v1/plazas` | GET | superadmin | |
| `/api/v1/plazas` | POST | superadmin | |
| `/api/v1/plazas/:id` | PATCH | superadmin, admin_plaza (restringido) | |
| `/api/v1/usuarios` | GET | superadmin, admin_plaza | Scope por plaza. |
| `/api/v1/usuarios` | POST | superadmin, admin_plaza | |
| `/api/v1/locales` | GET | superadmin, admin_plaza, inquilino (filtrado) | |
| `/api/v1/locales` | POST | superadmin, admin_plaza | |
| `/api/v1/contratos` | POST | superadmin, admin_plaza | |
| `/api/v1/solicitudes` | GET | superadmin, admin_plaza, inquilino (filtrado) | Soporta filtro `?prioridad=A&categoriaId=&subcategoriaId=`. |
| `/api/v1/solicitudes` | POST | inquilino | Body debe incluir `categoria_id` + `subcategoria_id` (salvo `tipo=otro`). |
| `/api/v1/solicitudes/:id/enviar` | POST | inquilino (dueño) | T2: auto-asignada al responsable de la subcategoría. |
| `/api/v1/solicitudes/:id/prioridad` | PATCH | admin_plaza | Body: `{ prioridad }`. |
| `/api/v1/solicitudes/:id/reasignar` | POST | admin_plaza (cualquiera) | T12: body `{ nuevo_responsable_id, comentario? }`. |
| `/api/v1/solicitudes/:id/tomar` | POST | admin_plaza | Legacy: solo si la solicitud quedó en `enviada` por lock expirado. |
| `/api/v1/solicitudes/:id/liberar` | POST | admin_plaza | Legacy / reasignación. |
| `/api/v1/solicitudes/:id/aprobar` | POST | admin_plaza | |
| `/api/v1/solicitudes/:id/rechazar` | POST | admin_plaza | |
| `/api/v1/solicitudes/:id/subsanar` | POST | admin_plaza | |
| `/api/v1/solicitudes/:id/cancelar` | POST | admin_plaza, inquilino (dueño) | |
| `/api/v1/roles-staff` | GET | superadmin, admin_plaza, inquilino (read-only) | |
| `/api/v1/roles-staff` | POST | superadmin, admin_plaza | |
| `/api/v1/roles-staff/:id` | PATCH | superadmin, admin_plaza | |
| `/api/v1/roles-staff/:id` | DELETE | superadmin, admin_plaza | Soft delete. |
| `/api/v1/categorias` | GET | superadmin, admin_plaza, inquilino (read-only activos) | |
| `/api/v1/categorias` | POST | superadmin, admin_plaza | |
| `/api/v1/categorias/:id` | PATCH | superadmin, admin_plaza | |
| `/api/v1/categorias/:id` | DELETE | superadmin, admin_plaza | Soft delete. |
| `/api/v1/categorias/:id/subcategorias` | GET | superadmin, admin_plaza, inquilino (read-only activos) | |
| `/api/v1/categorias/:id/subcategorias` | POST | superadmin, admin_plaza | Crea con responsable y hasta 5 supervisores. |
| `/api/v1/categorias/:id/subcategorias/:subId` | PATCH | superadmin, admin_plaza | |
| `/api/v1/categorias/:id/subcategorias/:subId` | DELETE | superadmin, admin_plaza | Soft delete. |
| `/api/v1/categorias/:id/subcategorias/:subId/supervisores` | POST | superadmin, admin_plaza | Body `{ usuario_id }`. 6º rechazado con 409. |
| `/api/v1/categorias/:id/subcategorias/:subId/supervisores/:usuarioId` | DELETE | superadmin, admin_plaza | |
| `/api/v1/calendario/eventos` | GET | superadmin, admin_plaza, inquilino (filtrado) | |
| `/api/v1/reportes/...` | GET | superadmin, admin_plaza | |
| `/api/v1/admin/...` | * | superadmin | Prefijo reservado al superadmin. |

---

## 6.6. Reglas adicionales de seguridad

- **SEC-1:** todas las contraseñas se almacenan con **bcrypt cost 12** y nunca se loguean.
- **SEC-2:** ningún endpoint expone `password_hash` ni tokens.
- **SEC-3:** rate limit global: 100 req/min por IP. Login: 5 req/min por IP. (SUPUESTO S-RateLimit.)
- **SEC-4:** tokens JWT **no** se aceptan en query string, solo en header `Authorization` o en cookie httpOnly.
- **SEC-5:** CORS restringido al dominio del frontend conocido por variable de entorno. (SUPUESTO S-CORS.)
- **SEC-6:** todas las requests se loguean con `requestId` para correlación.
- **SEC-7:** cualquier error 5xx se loguea con stack trace; los 4xx no exponen detalles internos al cliente.

---

## 6.7. Resumen de SUPUESTOS del documento

| ID | Supuesto |
|---|---|
| S-RP-A | Un usuario pertenece a una sola plaza y un solo rol. |
| S-RP-B | El `superadmin` no opera negocio (no crea solicitudes/locales/contratos). |
| S-RP-C | Los inquilinos no ven reportes en v1. |
| S-RP-D | Los reportes programados están fuera del alcance v1. |
| S-RP-E | Sin multi-rol por usuario, sin multi-plaza para staff. |
| S-RP-F | Tipos de solicitud fijos en v1, no editables desde el panel. |
| S-RP-G | `admin_plaza` puede crear otros `admin_plaza` (no superadmin). |
| S-RP-H | Rate limit global y de login según valores propuestos. |
| S-RP-I | CORS restrictivo, configurable por entorno. |
| S-RP-J | Las capacidades operativas (aprobar, reasignar) son uniformes para todos los `admin_plaza` independientemente de su `rol_staff`. Las diferencias por `rol_staff` (p. ej. "solo técnicos son responsables de mantenimiento") son SUPUESTO a validar. |
| S-RP-K | El responsable y los supervisores de una subcategoría deben ser `admin_plaza` con `rol_staff` activo y misma plaza (SC-6). |

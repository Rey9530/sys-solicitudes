# 06 · Roles y Permisos

> **Código del documento:** `DOC-06-RP`
> **Estado:** Borrador para validación
> **Complementa:** [`03-modulos-del-sistema.md`](./03-modulos-del-sistema.md) (permisos por módulo) y [`05-flujo-de-solicitudes.md`](./05-flujo-de-solicitudes.md) (transiciones).

---

## 6.1. Roles definidos

El sistema contempla **tres roles** conScopes distintos y complementarios.

| Código | Nombre | Scope | Propósito |
|---|---|---|---|
| `superadmin` | Superadministrador | Plataforma | Operador de Helixsys / SaaS manager. Da de alta plazas, asigna el primer admin de cada plaza, ve métricas globales. |
| `admin_plaza` | Administrador de plaza | Una plaza | Personal de la empresa administradora de la plaza. Configura su plaza, gestiona usuarios, aprueba solicitudes, ve reportes. |
| `inquilino` | Inquilino / Negocio | Una plaza, un inquilino | Comercio o negocio arrendatario. Crea, envía y da seguimiento a sus solicitudes. |

> **SUPUESTO S-RP-A:** un usuario pertenece a **una sola plaza** y tiene **un solo rol**. No hay multi-plaza para staff ni multi-rol por usuario en v1.

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
| Crear usuario `admin_plaza` en su plaza | ✅ | ✅ (excepto otros superadmin) | ❌ |
| Crear usuario `inquilino` en su plaza | ✅ | ✅ | ❌ |
| Listar usuarios de su plaza | ✅ | ✅ | ❌ (solo su perfil) |
| Editar perfil propio | ✅ | ✅ | ✅ |
| Cambiar contraseña propia | ✅ | ✅ | ✅ |
| Solicitar reset de contraseña | ✅ | ✅ | ✅ |
| Desactivar usuario | ✅ | ✅ (de su plaza) | ❌ |
| Ver bitácora de login | ✅ | ✅ (de su plaza) | ❌ |

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
| Crear borrador | ❌ | ❌ | ✅ |
| Editar borrador propio | — | — | ✅ |
| Enviar solicitud | — | — | ✅ |
| Ver todas las solicitudes de su plaza | ✅ | ✅ | ❌ |
| Ver solicitudes de su inquilino | ✅ | ✅ | ✅ |
| Cancelar solicitud en `borrador` / `enviada` | — | ✅ (con motivo) | ✅ (las propias) |
| Comentar en una solicitud | — | ✅ | ✅ (en sus solicitudes) |
| Adjuntar archivos | — | ✅ (en revisión) | ✅ (en borrador/subsanación) |
| Reenviar tras subsanación | — | — | ✅ |

### 6.2.6. Aprobaciones

| Acción | superadmin | admin_plaza | inquilino |
|---|---|---|---|
| Ver bandeja de entrada | ❌ | ✅ | ❌ |
| Tomar para revisión | ❌ | ✅ | ❌ |
| Aprobar | ❌ | ✅ | ❌ |
| Rechazar | ❌ | ✅ (motivo obligatorio) | ❌ |
| Pedir subsanación | ❌ | ✅ (comentario obligatorio) | ❌ |
| Asignar a otro admin | ❌ | ✅ | ❌ |
| Liberar lock de revisión | ❌ | ✅ | ❌ |

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
| Configurar SLA por tipo | ❌ | ✅ | ❌ |
| Configurar tamaño máximo de adjuntos | ❌ | ✅ | ❌ |
| Configurar MIME permitidos | ❌ | ✅ | ❌ |
| Configurar branding de la plaza | ❌ | ✅ | ❌ |
| Listar/desactivar plazas | ✅ | ❌ | ❌ |

---

## 6.3. Restricciones de scope transversales

Estas restricciones aplican a **todas** las operaciones, no solo a las listadas:

- **SC-1 — Scope por plaza:** todo `admin_plaza` e `inquilino` solo puede ver y operar datos de su `plaza_id`. El backend aplica `PlazaScopeGuard` que rechaza operaciones fuera de scope con `403 Forbidden`.
- **SC-2 — Scope por inquilino (inquilinos):** un `inquilino` solo ve locales, contratos y solicitudes cuyo `inquilino_id` coincide con el de su cuenta. Si un usuario `inquilino` representa a varios inquilinos (caso no soportado en v1, ver S-MT-C), la restricción se amplía.
- **SC-3 — Scope por sí mismo (perfil):** un usuario solo edita su propio perfil y contraseña. La edición de otros perfiles requiere rol `admin_plaza` o `superadmin`.
- **SC-4 — Defense in depth:** un `admin_plaza` **no** puede aprobar/rechazar solicitudes creadas por él mismo si en el futuro se le permitiera crear (en v1 no aplica, pero se deja la guarda).
- **SC-5 — Superadmin no opera negocio:** un `superadmin` no puede crear solicitudes, locales ni contratos en nombre de un inquilino. Solo configura la plataforma.

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
| `/api/v1/solicitudes` | GET | superadmin, admin_plaza, inquilino (filtrado) | |
| `/api/v1/solicitudes` | POST | inquilino | |
| `/api/v1/solicitudes/:id/enviar` | POST | inquilino (dueño) | |
| `/api/v1/solicitudes/:id/tomar` | POST | admin_plaza | |
| `/api/v1/solicitudes/:id/aprobar` | POST | admin_plaza | |
| `/api/v1/solicitudes/:id/rechazar` | POST | admin_plaza | |
| `/api/v1/solicitudes/:id/subsanar` | POST | admin_plaza | |
| `/api/v1/solicitudes/:id/cancelar` | POST | admin_plaza, inquilino (dueño) | |
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

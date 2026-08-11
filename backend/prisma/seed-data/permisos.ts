/**
 * Catálogo hardcoded de permisos granulares del sistema RBAC de Plazapp.
 *
 * Convenciones (T-RBAC-1):
 *   - Códigos en snake_case lowercase, formato `<modulo>.<accion>`.
 *   - `modulo` agrupa permisos en la UI (matriz de roles-permisos).
 *   - `descripcion` explica el permiso en lenguaje de negocio.
 *   - El catálogo es GLOBAL (compartido por todas las plazas).
 *   - Permisos nuevos se añaden aquí Y se siembran en BD con `prisma db seed`.
 *   - El rol_staff "admin" (es_sistema = true) recibe TODOS los permisos en el seed.
 *
 * ⚠️ Cualquier permiso nuevo debe añadirse ANTES de que se use en código:
 *   1. Agregar entrada aquí.
 *   2. Correr `npm run prisma:seed` (idempotente; solo agrega los nuevos).
 *   3. Aplicar `@RequirePermission('nuevo.permiso')` en backend.
 *   4. Aplicar `await assertCan('nuevo.permiso')` en el Server Action del FE.
 *   5. Aplicar `<Can permiso="nuevo.permiso">` en el Client Component del FE.
 *   6. (Si el rol "admin" debe poder otorgarlo a otros roles) ya queda auto-asignado.
 *
 * Detalles: PERMISOS_README.md y PLANIFICACION/permisos-rbac.md.
 */

export interface PermisoCatalogo {
  codigo: string;
  modulo: string;
  accion: string;
  descripcion: string;
}

/**
 * Lista maestra de permisos. El orden define el orden en la matriz UI.
 * Para permisos nuevos: añadir al final del módulo correspondiente.
 */
export const PERMISOS_CATALOG: readonly PermisoCatalogo[] = [
  // ── Permisos del sistema ────────────────────────────────────────────────
  { codigo: 'permisos.ver_matriz', modulo: 'permisos', accion: 'ver_matriz', descripcion: 'Ver la matriz de permisos disponibles y los asignados a cada rol.' },
  { codigo: 'permisos.asignar_a_roles', modulo: 'permisos', accion: 'asignar_a_roles', descripcion: 'Asignar o quitar permisos de los roles de staff. Reservado al rol "admin".' },

  // ── Gestión de usuarios de plaza ────────────────────────────────────────
  { codigo: 'usuarios_plaza.listar', modulo: 'usuarios-plaza', accion: 'listar', descripcion: 'Listar y buscar usuarios administradores de la plaza.' },
  { codigo: 'usuarios_plaza.crear', modulo: 'usuarios-plaza', accion: 'crear', descripcion: 'Crear nuevos usuarios administradores (alta de admins de plaza).' },
  { codigo: 'usuarios_plaza.editar', modulo: 'usuarios-plaza', accion: 'editar', descripcion: 'Editar datos básicos de un admin de plaza (nombre, teléfono, rol_staff).' },
  { codigo: 'usuarios_plaza.deshabilitar', modulo: 'usuarios-plaza', accion: 'deshabilitar', descripcion: 'Deshabilitar (soft delete) un admin de plaza. Requiere motivo.' },
  { codigo: 'usuarios_plaza.reactivar', modulo: 'usuarios-plaza', accion: 'reactivar', descripcion: 'Reactivar un admin de plaza previamente deshabilitado.' },
  { codigo: 'usuarios_plaza.resetear_clave', modulo: 'usuarios-plaza', accion: 'resetear_clave', descripcion: 'Generar contraseña temporal y forzar cambio en próximo login.' },

  // ── Roles de staff ──────────────────────────────────────────────────────
  { codigo: 'roles_staff.listar', modulo: 'usuarios-plaza', accion: 'listar_roles', descripcion: 'Listar roles de staff disponibles en la plaza.' },
  { codigo: 'roles_staff.crear', modulo: 'usuarios-plaza', accion: 'crear_rol', descripcion: 'Crear nuevos roles de staff en la plaza.' },
  { codigo: 'roles_staff.editar', modulo: 'usuarios-plaza', accion: 'editar_rol', descripcion: 'Editar nombre y descripción de un rol de staff.' },
  { codigo: 'roles_staff.deshabilitar', modulo: 'usuarios-plaza', accion: 'deshabilitar_rol', descripcion: 'Deshabilitar un rol de staff (no se puede si hay usuarios asignados).' },
  { codigo: 'roles_staff.gestionar_permisos', modulo: 'usuarios-plaza', accion: 'gestionar_permisos', descripcion: 'Asignar o quitar permisos de un rol de staff. Reservado al rol "admin".' },

  // ── Solicitudes: bandeja y detalle ──────────────────────────────────────
  { codigo: 'solicitudes.bandeja.ver', modulo: 'solicitudes', accion: 'bandeja_ver', descripcion: 'Ver la bandeja de solicitudes de la plaza (asignadas y sin asignar).' },
  { codigo: 'solicitudes.bandeja.asignadas_a_mi', modulo: 'solicitudes', accion: 'bandeja_asignadas_a_mi', descripcion: 'Ver solicitudes asignadas al propio usuario.' },
  { codigo: 'solicitudes.detalle.ver', modulo: 'solicitudes', accion: 'detalle_ver', descripcion: 'Ver el detalle completo de una solicitud (datos, comentarios, historial, adjuntos).' },
  { codigo: 'solicitudes.tomar', modulo: 'solicitudes', accion: 'tomar', descripcion: 'Tomar una solicitud asignada para pasarla a revisión.' },
  { codigo: 'solicitudes.liberar', modulo: 'solicitudes', accion: 'liberar', descripcion: 'Liberar una solicitud que el admin había tomado.' },
  { codigo: 'solicitudes.aprobar', modulo: 'solicitudes', accion: 'aprobar', descripcion: 'Aprobar una solicitud (autoriza la actividad; queda pendiente de cierre).' },
  { codigo: 'solicitudes.cerrar', modulo: 'solicitudes', accion: 'cerrar', descripcion: 'Cerrar una solicitud aprobada indicando el resultado de la actividad (estado terminal).' },
  { codigo: 'solicitudes.rechazar', modulo: 'solicitudes', accion: 'rechazar', descripcion: 'Rechazar una solicitud. Requiere comentario obligatorio.' },
  { codigo: 'solicitudes.pedir_subsanacion', modulo: 'solicitudes', accion: 'pedir_subsanacion', descripcion: 'Pedir subsanación al inquilino. Requiere comentario obligatorio.' },
  { codigo: 'solicitudes.reasignar', modulo: 'solicitudes', accion: 'reasignar', descripcion: 'Reasignar una solicitud a otro admin de la plaza.' },
  { codigo: 'solicitudes.cambiar_prioridad', modulo: 'solicitudes', accion: 'cambiar_prioridad', descripcion: 'Cambiar la prioridad de una solicitud (A-F).' },
  { codigo: 'solicitudes.cancelar', modulo: 'solicitudes', accion: 'cancelar', descripcion: 'Cancelar una solicitud en estado no terminal.' },
  { codigo: 'solicitudes.pausar', modulo: 'solicitudes', accion: 'pausar', descripcion: 'Pausar una solicitud activa (asignado|en_revision). Congela el SLA.' },
  { codigo: 'solicitudes.reanudar', modulo: 'solicitudes', accion: 'reanudar', descripcion: 'Reanudar una solicitud pausada (vuelve a en_revision conservando el asignado).' },
  { codigo: 'solicitudes.comentar', modulo: 'solicitudes', accion: 'comentar', descripcion: 'Añadir comentarios a una solicitud.' },
  { codigo: 'solicitudes.adjuntos.subir', modulo: 'solicitudes', accion: 'adjuntos_subir', descripcion: 'Subir adjuntos a una solicitud.' },
  { codigo: 'solicitudes.adjuntos.descargar', modulo: 'solicitudes', accion: 'adjuntos_descargar', descripcion: 'Descargar adjuntos de una solicitud.' },
  { codigo: 'solicitudes.adjuntos.eliminar', modulo: 'solicitudes', accion: 'adjuntos_eliminar', descripcion: 'Eliminar adjuntos de una solicitud.' },

  // ── Locales ─────────────────────────────────────────────────────────────
  { codigo: 'locales.listar', modulo: 'locales', accion: 'listar', descripcion: 'Listar locales de la plaza con sus filtros.' },
  { codigo: 'locales.crear', modulo: 'locales', accion: 'crear', descripcion: 'Crear nuevos locales en la plaza.' },
  { codigo: 'locales.editar', modulo: 'locales', accion: 'editar', descripcion: 'Editar datos básicos de un local (metraje, piso, sector, descripción).' },
  { codigo: 'locales.deshabilitar', modulo: 'locales', accion: 'deshabilitar', descripcion: 'Deshabilitar (soft delete) un local.' },
  { codigo: 'locales.fuera_de_servicio', modulo: 'locales', accion: 'fuera_de_servicio', descripcion: 'Marcar un local como fuera de servicio temporalmente.' },
  { codigo: 'locales.adjuntos.subir', modulo: 'locales', accion: 'adjuntos_subir', descripcion: 'Subir planos u otros adjuntos al local.' },
  { codigo: 'locales.adjuntos.descargar', modulo: 'locales', accion: 'adjuntos_descargar', descripcion: 'Descargar adjuntos del local.' },
  { codigo: 'locales.adjuntos.eliminar', modulo: 'locales', accion: 'adjuntos_eliminar', descripcion: 'Eliminar adjuntos de un local (cuarentena + soft delete).' },

  // ── Inquilinos ──────────────────────────────────────────────────────────
  { codigo: 'inquilinos.listar', modulo: 'inquilinos', accion: 'listar', descripcion: 'Listar inquilinos de la plaza con sus filtros.' },
  { codigo: 'inquilinos.crear', modulo: 'inquilinos', accion: 'crear', descripcion: 'Crear nuevos inquilinos en la plaza.' },
  { codigo: 'inquilinos.editar', modulo: 'inquilinos', accion: 'editar', descripcion: 'Editar datos de un inquilino (razón social, contacto, etc.).' },
  { codigo: 'inquilinos.deshabilitar', modulo: 'inquilinos', accion: 'deshabilitar', descripcion: 'Deshabilitar un inquilino (soft delete).' },
  { codigo: 'inquilinos.alta_usuario', modulo: 'inquilinos', accion: 'alta_usuario', descripcion: 'Dar de alta un usuario para un inquilino (rol "inquilino").' },
  { codigo: 'inquilinos.resetear_clave', modulo: 'inquilinos', accion: 'resetear_clave', descripcion: 'Resetear la contraseña de un usuario inquilino.' },
  { codigo: 'inquilinos.deshabilitar_usuario', modulo: 'inquilinos', accion: 'deshabilitar_usuario', descripcion: 'Deshabilitar un usuario inquilino (soft delete).' },
  { codigo: 'inquilinos.reactivar_usuario', modulo: 'inquilinos', accion: 'reactivar_usuario', descripcion: 'Reactivar un usuario inquilino previamente deshabilitado.' },

  // ── Contratos ───────────────────────────────────────────────────────────
  { codigo: 'contratos.listar', modulo: 'contratos', accion: 'listar', descripcion: 'Listar contratos de la plaza con sus filtros.' },
  { codigo: 'contratos.crear', modulo: 'contratos', accion: 'crear', descripcion: 'Crear nuevos contratos (alquileres).' },
  { codigo: 'contratos.editar', modulo: 'contratos', accion: 'editar', descripcion: 'Editar un contrato vigente.' },
  { codigo: 'contratos.cerrar', modulo: 'contratos', accion: 'cerrar', descripcion: 'Cerrar un contrato (finalizar el alquiler).' },
  { codigo: 'contratos.renovar', modulo: 'contratos', accion: 'renovar', descripcion: 'Renovar un contrato creando uno nuevo con continuidad.' },
  { codigo: 'contratos.adjuntos.subir', modulo: 'contratos', accion: 'adjuntos_subir', descripcion: 'Subir adjuntos a un contrato.' },
  { codigo: 'contratos.adjuntos.descargar', modulo: 'contratos', accion: 'adjuntos_descargar', descripcion: 'Descargar adjuntos de un contrato.' },
  { codigo: 'contratos.adjuntos.eliminar', modulo: 'contratos', accion: 'adjuntos_eliminar', descripcion: 'Eliminar adjuntos de un contrato (cuarentena + soft delete).' },

  // ── Categorías y subcategorías ──────────────────────────────────────────
  { codigo: 'categorias.listar', modulo: 'categorias', accion: 'listar', descripcion: 'Listar categorías de la plaza.' },
  { codigo: 'categorias.crear', modulo: 'categorias', accion: 'crear', descripcion: 'Crear nuevas categorías en la plaza.' },
  { codigo: 'categorias.editar', modulo: 'categorias', accion: 'editar', descripcion: 'Editar categorías existentes.' },
  { codigo: 'categorias.deshabilitar', modulo: 'categorias', accion: 'deshabilitar', descripcion: 'Deshabilitar categorías (soft delete).' },
  { codigo: 'subcategorias.crear', modulo: 'categorias', accion: 'crear_subcategoria', descripcion: 'Crear subcategorías dentro de una categoría.' },
  { codigo: 'subcategorias.editar', modulo: 'categorias', accion: 'editar_subcategoria', descripcion: 'Editar subcategorías existentes.' },
  { codigo: 'subcategorias.deshabilitar', modulo: 'categorias', accion: 'deshabilitar_subcategoria', descripcion: 'Deshabilitar subcategorías.' },
  { codigo: 'subcategorias.asignar_responsable', modulo: 'categorias', accion: 'asignar_responsable', descripcion: 'Asignar o cambiar el responsable de una subcategoría.' },
  { codigo: 'subcategorias.gestionar_supervisores', modulo: 'categorias', accion: 'gestionar_supervisores', descripcion: 'Agregar o quitar supervisores (máx 5 por subcategoría).' },

  // ── Tipos de solicitud ──────────────────────────────────────────────────
  { codigo: 'tipos_solicitud.listar', modulo: 'tipos-solicitud', accion: 'listar', descripcion: 'Listar tipos de solicitud configurados.' },
  { codigo: 'tipos_solicitud.editar', modulo: 'tipos-solicitud', accion: 'editar', descripcion: 'Editar etiqueta, descripción y orden de los tipos de solicitud.' },

  // ── Reportes ────────────────────────────────────────────────────────────
  { codigo: 'reportes.dashboard.ver', modulo: 'reportes', accion: 'dashboard_ver', descripcion: 'Ver el dashboard con KPIs de la plaza.' },
  { codigo: 'reportes.kpis.ver', modulo: 'reportes', accion: 'kpis_ver', descripcion: 'Ver las métricas y KPIs.' },
  { codigo: 'reportes.preview', modulo: 'reportes', accion: 'preview', descripcion: 'Ver el preview tabular de un reporte antes de exportar.' },
  { codigo: 'reportes.exportar_csv', modulo: 'reportes', accion: 'exportar_csv', descripcion: 'Exportar reportes en formato CSV.' },
  { codigo: 'reportes.exportar_xlsx', modulo: 'reportes', accion: 'exportar_xlsx', descripcion: 'Exportar reportes en formato Excel (XLSX).' },
  { codigo: 'reportes.exportar_pdf', modulo: 'reportes', accion: 'exportar_pdf', descripcion: 'Exportar reportes en formato PDF.' },
  { codigo: 'reportes.ficha_local_pdf', modulo: 'reportes', accion: 'ficha_local_pdf', descripcion: 'Generar ficha PDF de un local.' },
  { codigo: 'reportes.ficha_inquilino_pdf', modulo: 'reportes', accion: 'ficha_inquilino_pdf', descripcion: 'Generar ficha PDF de un inquilino.' },

  // ── Auditoría ───────────────────────────────────────────────────────────
  { codigo: 'auditoria.ver', modulo: 'auditoria', accion: 'ver', descripcion: 'Ver el log de auditoría de la plaza.' },

  // ── Notificaciones ──────────────────────────────────────────────────────
  { codigo: 'notificaciones.ver_log', modulo: 'notificaciones', accion: 'ver_log', descripcion: 'Ver el log de emails enviados y pendientes.' },
  { codigo: 'notificaciones.reintentar', modulo: 'notificaciones', accion: 'reintentar', descripcion: 'Reintentar el envío de un email fallido.' },
  { codigo: 'notificaciones.ver_preview', modulo: 'notificaciones', accion: 'ver_preview', descripcion: 'Ver el contenido (preview) de un email enviado.' },
  { codigo: 'notificaciones.gestionar_desuscripciones', modulo: 'notificaciones', accion: 'gestionar_desuscripciones', descripcion: 'Gestionar la lista de desuscripciones.' },

  // ── Configuración ───────────────────────────────────────────────────────
  { codigo: 'configuracion.ver', modulo: 'configuracion', accion: 'ver', descripcion: 'Ver la configuración de la plaza.' },
  { codigo: 'configuracion.editar_general', modulo: 'configuracion', accion: 'editar_general', descripcion: 'Editar datos generales (nombre comercial, email, teléfono).' },
  { codigo: 'configuracion.editar_branding', modulo: 'configuracion', accion: 'editar_branding', descripcion: 'Editar branding (color primario y logo).' },
  { codigo: 'configuracion.editar_sla', modulo: 'configuracion', accion: 'editar_sla', descripcion: 'Editar configuración de SLA por tipo de solicitud y prioridad.' },
  { codigo: 'configuracion.editar_adjuntos', modulo: 'configuracion', accion: 'editar_adjuntos', descripcion: 'Editar tipos MIME permitidos y tamaño máximo de adjuntos.' },
  { codigo: 'configuracion.editar_calendario', modulo: 'configuracion', accion: 'editar_calendario', descripcion: 'Editar opciones del calendario (mostrar hitos de contrato, etc.).' },

  // ── Calendario ──────────────────────────────────────────────────────────
  { codigo: 'calendario.ver', modulo: 'calendario', accion: 'ver', descripcion: 'Ver el calendario de la plaza con eventos.' },
  { codigo: 'calendario.exportar_ics', modulo: 'calendario', accion: 'exportar_ics', descripcion: 'Exportar eventos del calendario en formato ICS.' },
  { codigo: 'calendario.choques.ver', modulo: 'calendario', accion: 'choques_ver', descripcion: 'Ver los choques y solapamientos detectados en el calendario.' },
  { codigo: 'calendario.mover_evento', modulo: 'calendario', accion: 'mover_evento', descripcion: 'Mover un evento del calendario a otra fecha.' },
] as const;

/**
 * Set de permisos que el rol_staff "admin" del sistema recibe al sembrarse.
 * En esta implementación recibe TODOS los permisos del catálogo (es el rol
 * "super-admin" del módulo de admin_plaza). No editable desde la UI.
 */
export const PERMISOS_ROL_ADMIN_TODOS: readonly string[] = PERMISOS_CATALOG.map(
  (p) => p.codigo,
);
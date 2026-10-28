import 'package:flutter/material.dart';

import '../auth/sesion.dart';

/// Ítem del menú lateral. [permiso] null = siempre visible para el rol.
class ItemMenu {
  const ItemMenu(
    this.etiqueta,
    this.icono,
    this.ruta, {
    this.permiso,
    this.grupo,
  });

  final String etiqueta;
  final IconData icono;
  final String ruta;
  final Object? permiso;
  final String? grupo;
}

/// Home de cada rol (igual que `frontend/src/lib/home-redirect.ts`).
String homePara(Rol rol) => switch (rol) {
  Rol.superadmin => '/superadmin/plazas',
  Rol.adminPlaza => '/admin/dashboard',
  Rol.inquilino => '/inquilino/solicitudes',
};

const _itemsAdmin = <ItemMenu>[
  ItemMenu('Dashboard', Icons.dashboard_outlined, '/admin/dashboard'),
  ItemMenu(
    'Solicitudes',
    Icons.inbox_outlined,
    '/admin/solicitudes',
    permiso: ['solicitudes.bandeja.ver', 'solicitudes.bandeja.asignadas_a_mi'],
    grupo: 'Operación',
  ),
  ItemMenu(
    'Calendario',
    Icons.calendar_month_outlined,
    '/admin/calendario',
    permiso: 'calendario.ver',
    grupo: 'Operación',
  ),
  ItemMenu(
    'Locales',
    Icons.storefront_outlined,
    '/admin/locales',
    permiso: 'locales.listar',
    grupo: 'Catálogo',
  ),
  ItemMenu(
    'Inquilinos',
    Icons.groups_outlined,
    '/admin/inquilinos',
    permiso: 'inquilinos.listar',
    grupo: 'Catálogo',
  ),
  ItemMenu(
    'Contratos',
    Icons.description_outlined,
    '/admin/contratos',
    permiso: 'contratos.listar',
    grupo: 'Catálogo',
  ),
  ItemMenu(
    'Categorías',
    Icons.sell_outlined,
    '/admin/categorias',
    permiso: 'categorias.listar',
    grupo: 'Catálogo',
  ),
  ItemMenu(
    'Tipos de solicitud',
    Icons.category_outlined,
    '/admin/catalogos/tipos-solicitud',
    permiso: 'tipos_solicitud.listar',
    grupo: 'Catálogo',
  ),
  ItemMenu(
    'Usuarios | Roles',
    Icons.manage_accounts_outlined,
    '/admin/usuarios-plaza',
    permiso: 'usuarios_plaza.listar',
    grupo: 'Plataforma',
  ),
  ItemMenu(
    'Reportes',
    Icons.bar_chart_outlined,
    '/admin/reportes',
    permiso: 'reportes.dashboard.ver',
    grupo: 'Plataforma',
  ),
  ItemMenu(
    'Auditoría',
    Icons.receipt_long_outlined,
    '/admin/auditoria',
    permiso: 'auditoria.ver',
    grupo: 'Plataforma',
  ),
  ItemMenu(
    'Notificaciones',
    Icons.notifications_none_outlined,
    '/admin/notificaciones',
    permiso: 'notificaciones.ver_log',
    grupo: 'Plataforma',
  ),
  ItemMenu(
    'Configuración',
    Icons.settings_outlined,
    '/admin/configuracion',
    permiso: 'configuracion.ver',
    grupo: 'Plataforma',
  ),
];

const _itemsInquilino = <ItemMenu>[
  ItemMenu(
    'Mis solicitudes',
    Icons.inbox_outlined,
    '/inquilino/solicitudes',
    grupo: 'Portal',
  ),
  ItemMenu(
    'Calendario',
    Icons.calendar_month_outlined,
    '/inquilino/calendario',
    grupo: 'Portal',
  ),
  // En el web la pantalla existe pero no estaba en el menú (ruta huérfana).
  ItemMenu(
    'Mis contratos',
    Icons.description_outlined,
    '/inquilino/contratos',
    grupo: 'Portal',
  ),
];

const _itemsSuperadminGlobal = <ItemMenu>[
  ItemMenu(
    'Dashboard global',
    Icons.dashboard_outlined,
    '/superadmin/dashboard',
  ),
  ItemMenu(
    'Plazas',
    Icons.apartment_outlined,
    '/superadmin/plazas',
    grupo: 'Plataforma',
  ),
  ItemMenu(
    'Solicitudes globales',
    Icons.public,
    '/superadmin/solicitudes',
    grupo: 'Operación global',
  ),
];

/// Pantallas de plaza que el superadmin no puede usar: el backend le responde
/// 403 (bug F8 de la auditoría web; en la app se ocultan).
const _vedadasSuperadmin = {'/admin/calendario', '/admin/configuracion'};

/// Menú del rol, filtrado por permisos. El superadmin ve además las pantallas
/// de plaza (agrupadas como "Gestión") cuando eligió una plaza.
List<ItemMenu> menuPara(Sesion sesion, {required bool conPlaza}) {
  switch (sesion.rol) {
    case Rol.inquilino:
      return _itemsInquilino;
    case Rol.adminPlaza:
      return _itemsAdmin
          .where((i) => i.permiso == null || sesion.puede(i.permiso!))
          .toList();
    case Rol.superadmin:
      if (!conPlaza) return _itemsSuperadminGlobal;
      return [
        ..._itemsSuperadminGlobal,
        for (final i in _itemsAdmin.skip(1))
          if (!_vedadasSuperadmin.contains(i.ruta))
            ItemMenu(i.etiqueta, i.icono, i.ruta, grupo: 'Plaza seleccionada'),
      ];
  }
}

/// Ítem activo: la ruta coincide o es una subruta.
bool esRutaActiva(ItemMenu item, String ruta) =>
    ruta == item.ruta || ruta.startsWith('${item.ruta}/');

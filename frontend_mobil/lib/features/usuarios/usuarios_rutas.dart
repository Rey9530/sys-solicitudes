import 'package:go_router/go_router.dart';

import '../../core/widgets/en_construccion_page.dart';

/// Rutas del módulo (mismas URLs que el web). Stub: lo reemplaza la tarea
/// del plan que implementa este módulo, sin cambiar la firma.
List<RouteBase> rutasUsuarios() => [
  GoRoute(
    path: '/admin/usuarios-plaza',
    builder: (context, state) =>
        const EnConstruccionPage(titulo: 'Usuarios de plaza'),
  ),
  GoRoute(
    path: '/admin/usuarios-plaza/permisos',
    builder: (context, state) =>
        const EnConstruccionPage(titulo: 'Permisos de roles'),
  ),
  GoRoute(
    path: '/admin/usuarios-plaza/:id',
    builder: (context, state) =>
        const EnConstruccionPage(titulo: 'Usuario de plaza'),
  ),
];

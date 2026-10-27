import 'package:go_router/go_router.dart';

import '../../core/widgets/en_construccion_page.dart';

/// Rutas del módulo (mismas URLs que el web). Stub: lo reemplaza la tarea
/// del plan que implementa este módulo, sin cambiar la firma.
List<RouteBase> rutasLocales() => [
  GoRoute(
    path: '/admin/locales',
    builder: (context, state) => const EnConstruccionPage(titulo: 'Locales'),
  ),
  GoRoute(
    path: '/admin/locales/nuevo',
    builder: (context, state) =>
        const EnConstruccionPage(titulo: 'Nuevo local'),
  ),
  GoRoute(
    path: '/admin/locales/:id',
    builder: (context, state) =>
        const EnConstruccionPage(titulo: 'Detalle de local'),
  ),
];

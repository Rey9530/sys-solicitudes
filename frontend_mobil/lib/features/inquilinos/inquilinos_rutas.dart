import 'package:go_router/go_router.dart';

import '../../core/widgets/en_construccion_page.dart';

/// Rutas del módulo (mismas URLs que el web). Stub: lo reemplaza la tarea
/// del plan que implementa este módulo, sin cambiar la firma.
List<RouteBase> rutasInquilinos() => [
  GoRoute(
    path: '/admin/inquilinos',
    builder: (context, state) => const EnConstruccionPage(titulo: 'Inquilinos'),
  ),
  GoRoute(
    path: '/admin/inquilinos/nuevo',
    builder: (context, state) =>
        const EnConstruccionPage(titulo: 'Nuevo inquilino'),
  ),
  GoRoute(
    path: '/admin/inquilinos/:id',
    builder: (context, state) =>
        const EnConstruccionPage(titulo: 'Detalle de inquilino'),
  ),
];

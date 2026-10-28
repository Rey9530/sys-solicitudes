import 'package:go_router/go_router.dart';

import 'inquilino_detalle_page.dart';
import 'inquilino_form_page.dart';
import 'inquilinos_page.dart';

/// Rutas del módulo (mismas URLs que el web). `nuevo` va antes de `:id`.
List<RouteBase> rutasInquilinos() => [
  GoRoute(
    path: '/admin/inquilinos',
    builder: (context, state) => const InquilinosPage(),
  ),
  GoRoute(
    path: '/admin/inquilinos/nuevo',
    builder: (context, state) => const InquilinoFormPage(),
  ),
  GoRoute(
    path: '/admin/inquilinos/:id',
    builder: (context, state) =>
        InquilinoDetallePage(id: state.pathParameters['id']!),
  ),
];

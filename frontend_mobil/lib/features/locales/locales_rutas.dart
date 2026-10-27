import 'package:go_router/go_router.dart';

import 'local_detalle_page.dart';
import 'local_form_page.dart';
import 'locales_page.dart';

/// Rutas del módulo (mismas URLs que el web). `nuevo` va antes de `:id`.
List<RouteBase> rutasLocales() => [
  GoRoute(
    path: '/admin/locales',
    builder: (context, state) => const LocalesPage(),
  ),
  GoRoute(
    path: '/admin/locales/nuevo',
    builder: (context, state) => const LocalFormPage(),
  ),
  GoRoute(
    path: '/admin/locales/:id',
    builder: (context, state) =>
        LocalDetallePage(id: state.pathParameters['id']!),
  ),
];

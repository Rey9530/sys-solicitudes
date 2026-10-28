import 'package:go_router/go_router.dart';

import 'configuracion_page.dart';

/// Rutas del módulo (mismas URLs que el web).
List<RouteBase> rutasConfiguracion() => [
  GoRoute(
    path: '/admin/configuracion',
    builder: (context, state) => const ConfiguracionPage(),
  ),
];

import 'package:go_router/go_router.dart';

import 'reportes_page.dart';

/// Rutas del módulo (mismas URLs que el web).
List<RouteBase> rutasReportes() => [
  GoRoute(
    path: '/admin/reportes',
    builder: (context, state) => const ReportesPage(),
  ),
];

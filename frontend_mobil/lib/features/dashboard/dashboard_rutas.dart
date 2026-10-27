import 'package:go_router/go_router.dart';

import 'dashboard_page.dart';

/// Rutas del módulo (mismas URLs que el web).
List<RouteBase> rutasDashboard() => [
  GoRoute(
    path: '/admin/dashboard',
    builder: (context, state) => const DashboardPage(),
  ),
];

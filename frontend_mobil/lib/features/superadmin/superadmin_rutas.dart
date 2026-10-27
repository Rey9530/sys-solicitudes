import 'package:go_router/go_router.dart';

import 'dashboard_global_page.dart';
import 'plazas_page.dart';

/// Rutas del superadmin (mismas URLs que el web). Las de solicitudes globales
/// viven en `features/solicitudes`.
List<RouteBase> rutasSuperadmin() => [
  GoRoute(
    path: '/superadmin/plazas',
    builder: (context, state) => const PlazasPage(),
  ),
  GoRoute(
    path: '/superadmin/dashboard',
    builder: (context, state) => const DashboardGlobalPage(),
  ),
];

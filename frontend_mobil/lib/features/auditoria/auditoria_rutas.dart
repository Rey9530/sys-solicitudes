import 'package:go_router/go_router.dart';

import 'auditoria_page.dart';

/// Rutas del módulo (mismas URLs que el web).
List<RouteBase> rutasAuditoria() => [
  GoRoute(
    path: '/admin/auditoria',
    builder: (context, state) => const AuditoriaPage(),
  ),
];

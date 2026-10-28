import 'package:go_router/go_router.dart';

import 'log_emails_page.dart';

/// Rutas del módulo (mismas URLs que el web).
List<RouteBase> rutasNotificaciones() => [
  GoRoute(
    path: '/admin/notificaciones',
    builder: (context, state) => const LogEmailsPage(),
  ),
];

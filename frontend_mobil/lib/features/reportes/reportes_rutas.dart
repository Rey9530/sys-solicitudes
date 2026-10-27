import 'package:go_router/go_router.dart';

import '../../core/widgets/en_construccion_page.dart';

/// Rutas del módulo (mismas URLs que el web). Stub: lo reemplaza la tarea
/// del plan que implementa este módulo, sin cambiar la firma.
List<RouteBase> rutasReportes() => [
  GoRoute(
    path: '/admin/reportes',
    builder: (context, state) => const EnConstruccionPage(titulo: 'Reportes'),
  ),
];

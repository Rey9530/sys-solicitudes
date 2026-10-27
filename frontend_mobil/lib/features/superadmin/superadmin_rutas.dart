import 'package:go_router/go_router.dart';

import '../../core/widgets/en_construccion_page.dart';

/// Rutas del módulo (mismas URLs que el web). Stub: lo reemplaza la tarea
/// del plan que implementa este módulo, sin cambiar la firma.
List<RouteBase> rutasSuperadmin() => [
  GoRoute(
    path: '/superadmin/plazas',
    builder: (context, state) => const EnConstruccionPage(titulo: 'Plazas'),
  ),
  GoRoute(
    path: '/superadmin/dashboard',
    builder: (context, state) =>
        const EnConstruccionPage(titulo: 'Dashboard global'),
  ),
];

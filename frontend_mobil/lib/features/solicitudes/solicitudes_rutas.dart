import 'package:go_router/go_router.dart';

import '../../core/widgets/en_construccion_page.dart';

/// Rutas del módulo (mismas URLs que el web). Stub: lo reemplaza la tarea
/// del plan que implementa este módulo, sin cambiar la firma.
List<RouteBase> rutasSolicitudesAdmin() => [
  GoRoute(
    path: '/admin/solicitudes',
    builder: (context, state) =>
        const EnConstruccionPage(titulo: 'Bandeja de solicitudes'),
  ),
  GoRoute(
    path: '/admin/solicitudes/:id',
    builder: (context, state) =>
        const EnConstruccionPage(titulo: 'Detalle de solicitud'),
  ),
];

/// Rutas del módulo (mismas URLs que el web). Stub: lo reemplaza la tarea
/// del plan que implementa este módulo, sin cambiar la firma.
List<RouteBase> rutasSolicitudesInquilino() => [
  GoRoute(
    path: '/inquilino/solicitudes',
    builder: (context, state) =>
        const EnConstruccionPage(titulo: 'Mis solicitudes'),
  ),
  GoRoute(
    path: '/inquilino/solicitudes/nueva',
    builder: (context, state) =>
        const EnConstruccionPage(titulo: 'Nueva solicitud'),
  ),
  GoRoute(
    path: '/inquilino/solicitudes/:id',
    builder: (context, state) =>
        const EnConstruccionPage(titulo: 'Detalle de solicitud'),
  ),
  GoRoute(
    path: '/inquilino/solicitudes/:id/editar',
    builder: (context, state) =>
        const EnConstruccionPage(titulo: 'Editar solicitud'),
  ),
];

/// Vista global del superadmin (cross-plaza, solo lectura).
List<RouteBase> rutasSolicitudesGlobales() => [
  GoRoute(
    path: '/superadmin/solicitudes',
    builder: (context, state) =>
        const EnConstruccionPage(titulo: 'Solicitudes globales'),
  ),
  GoRoute(
    path: '/superadmin/solicitudes/:id',
    builder: (context, state) =>
        const EnConstruccionPage(titulo: 'Solicitud global'),
  ),
];

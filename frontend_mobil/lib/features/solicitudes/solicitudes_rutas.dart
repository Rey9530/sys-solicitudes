import 'package:go_router/go_router.dart';

import 'admin/bandeja_page.dart';
import 'admin/detalle_admin_page.dart';
import 'global/solicitud_global_page.dart';
import 'global/solicitudes_globales_page.dart';
import 'inquilino/detalle_inquilino_page.dart';
import 'inquilino/mis_solicitudes_page.dart';
import 'inquilino/wizard/formulario_solicitud.dart';
import 'inquilino/wizard_page.dart';

/// Rutas del módulo (mismas URLs que el web). Los detalles y formularios se
/// abren con `context.push` para que "atrás" vuelva al listado.

/// Admin de plaza (y superadmin con plaza elegida).
List<RouteBase> rutasSolicitudesAdmin() => [
  GoRoute(
    path: '/admin/solicitudes',
    builder: (context, state) => const BandejaPage(),
  ),
  GoRoute(
    path: '/admin/solicitudes/:id',
    builder: (context, state) =>
        DetalleAdminPage(id: state.pathParameters['id']!),
  ),
];

/// Inquilino. `nueva` va antes de `:id` y acepta el prefill del calendario
/// (`?tipo=evento&fecha=YYYY-MM-DD&hora=HH:mm`).
List<RouteBase> rutasSolicitudesInquilino() => [
  GoRoute(
    path: '/inquilino/solicitudes',
    builder: (context, state) => const MisSolicitudesPage(),
  ),
  GoRoute(
    path: '/inquilino/solicitudes/nueva',
    builder: (context, state) => WizardSolicitudPage(
      prefill: PrefillWizard.desdeQuery(state.uri.queryParameters),
    ),
  ),
  GoRoute(
    path: '/inquilino/solicitudes/:id',
    builder: (context, state) =>
        DetalleInquilinoPage(id: state.pathParameters['id']!),
  ),
  GoRoute(
    path: '/inquilino/solicitudes/:id/editar',
    builder: (context, state) =>
        WizardSolicitudPage(solicitudId: state.pathParameters['id']),
  ),
];

/// Vista global del superadmin (cross-plaza, solo lectura).
List<RouteBase> rutasSolicitudesGlobales() => [
  GoRoute(
    path: '/superadmin/solicitudes',
    builder: (context, state) => const SolicitudesGlobalesPage(),
  ),
  GoRoute(
    path: '/superadmin/solicitudes/:id',
    builder: (context, state) =>
        SolicitudGlobalPage(id: state.pathParameters['id']!),
  ),
];

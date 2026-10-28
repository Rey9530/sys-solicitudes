import 'package:go_router/go_router.dart';

import 'calendario_page.dart';

/// Rutas del calendario (mismas URLs que el web). El admin necesita
/// `calendario.ver` (se valida en la página y en el backend); el superadmin no
/// lo usa (el backend lo excluye y el menú lo oculta).
List<RouteBase> rutasCalendario() => [
  GoRoute(
    path: '/admin/calendario',
    builder: (context, state) => const CalendarioPage(esInquilino: false),
  ),
  GoRoute(
    path: '/inquilino/calendario',
    builder: (context, state) => const CalendarioPage(esInquilino: true),
  ),
];

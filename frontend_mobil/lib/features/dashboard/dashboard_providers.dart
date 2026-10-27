import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_providers.dart';
import '../../core/plaza/plaza_seleccionada.dart';
import 'dashboard_api.dart';
import 'dashboard_modelos.dart';

/// Sin reintentos automáticos: un 403 por permisos no debe repetirse (la
/// pantalla se recarga sola cada 5 min, como el web).
Duration? _sinReintentos(int intento, Object error) => null;

/// Dashboard de la plaza (admin, o superadmin con plaza elegida). Depende de
/// la plaza elegida: si el superadmin cambia de plaza estando en el
/// dashboard (la ruta no cambia), los KPIs se vuelven a pedir.
final dashboardProvider = FutureProvider.autoDispose<DatosDashboard>((ref) {
  ref.watch(plazaSeleccionadaProvider);
  return cargarDashboard(ref.watch(apiClientProvider));
}, retry: _sinReintentos);

/// Dashboard global del superadmin: siempre sin `x-plaza-id`.
final dashboardGlobalProvider = FutureProvider.autoDispose<DatosDashboard>(
  (ref) => cargarDashboard(ref.watch(apiClientProvider), global: true),
  retry: _sinReintentos,
);

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_providers.dart';
import 'dashboard_api.dart';
import 'dashboard_modelos.dart';

/// Sin reintentos automáticos: un 403 por permisos no debe repetirse (la
/// pantalla se recarga sola cada 5 min, como el web).
Duration? _sinReintentos(int intento, Object error) => null;

/// Dashboard de la plaza (admin, o superadmin con plaza elegida).
final dashboardProvider = FutureProvider.autoDispose<DatosDashboard>(
  (ref) => cargarDashboard(ref.read(apiClientProvider)),
  retry: _sinReintentos,
);

/// Dashboard global del superadmin: siempre sin `x-plaza-id`.
final dashboardGlobalProvider = FutureProvider.autoDispose<DatosDashboard>(
  (ref) => cargarDashboard(ref.read(apiClientProvider), global: true),
  retry: _sinReintentos,
);

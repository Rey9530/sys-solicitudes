import '../../core/api/api_client.dart';
import 'dashboard_modelos.dart';

/// KPIs y gráficas en paralelo. Con [global] (dashboard del superadmin) no se
/// envía `x-plaza-id` aunque haya una plaza elegida, así las métricas son de
/// todas las plazas (bug C-R4 del web).
Future<DatosDashboard> cargarDashboard(
  ApiClient api, {
  bool global = false,
}) async {
  // `Future.wait` relanza el primer `ApiError` tal cual (la pantalla decide
  // por su `code`).
  final r = await Future.wait([
    api.get('/reportes/kpis', sinPlaza: global),
    api.get('/reportes/dashboard', sinPlaza: global),
  ], eagerError: true);
  return DatosDashboard(
    kpis: Kpis.fromJson(r[0] as Map<String, dynamic>),
    graficas: GraficasDashboard.fromJson(r[1] as Map<String, dynamic>),
  );
}

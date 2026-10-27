import '../../core/api/api_client.dart';
import '../../core/auth/sesion.dart';
import 'notificaciones_modelos.dart';

/// Bandeja in-app del usuario (campana). Solo admin de plaza e inquilino; el
/// backend rechaza al superadmin (C-R13).

Future<int> conteoNoLeidas(ApiClient api) async {
  final r =
      await api.get('/notificaciones/inbox/conteo') as Map<String, dynamic>;
  return (r['noLeidas'] as num?)?.toInt() ?? 0;
}

Future<BandejaNotificaciones> bandejaNotificaciones(
  ApiClient api, {
  int limit = 20,
}) async {
  final r = await api.get(
    '/notificaciones/inbox',
    query: {'limit': limit},
  ) as Map<String, dynamic>;
  return BandejaNotificaciones.fromJson(r);
}

/// Idempotente: si ya estaba leída responde 200 igual.
Future<void> marcarNotificacionLeida(ApiClient api, String id) =>
    api.post('/notificaciones/inbox/$id/leer');

Future<void> marcarTodasLeidas(ApiClient api) =>
    api.post('/notificaciones/inbox/leer-todas');

/// A dónde lleva tocar una notificación (`hrefFor` del web): la solicitud en
/// la ruta del rol, o el contrato. `null` = no navega.
String? rutaDeNotificacion(NotificacionInApp n, Rol? rol) {
  if (n.solicitudId != null) {
    return rol == Rol.inquilino
        ? '/inquilino/solicitudes/${n.solicitudId}'
        : '/admin/solicitudes/${n.solicitudId}';
  }
  if (n.contratoId != null) return '/admin/contratos/${n.contratoId}';
  return null;
}

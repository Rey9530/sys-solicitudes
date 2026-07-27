// lib/core/network/api_endpoints.dart
//
// Centraliza los paths de la API REST.
// Backend: NestJS en /api/v1/*. Multi-tenant: el plaza_id va en el JWT, no en la URL.

class ApiEndpoints {
  ApiEndpoints._();

  // ── Auth
  static const String login = '/auth/login';
  static const String refresh = '/auth/refresh';
  static const String logout = '/auth/logout';
  static const String me = '/auth/me';

  // ── Plazas (branding per-tenant)
  static const String plazas = '/plazas';
  static String plazaById(String id) => '/plazas/$id';

  // ── Solicitudes
  static const String solicitudes = '/solicitudes';
  static String solicitudById(String id) => '/solicitudes/$id';
  static String solicitudAprobar(String id) => '/solicitudes/$id/aprobar';
  static String solicitudRechazar(String id) => '/solicitudes/$id/rechazar';
  static String solicitudPedirSubsanacion(String id) =>
      '/solicitudes/$id/pedir-subsanacion';
  static String solicitudSubsanar(String id) => '/solicitudes/$id/subsanar';
  static String solicitudAsignar(String id) => '/solicitudes/$id/asignar';
  static String solicitudReasignar(String id) => '/solicitudes/$id/reasignar';
  static String solicitudLiberar(String id) => '/solicitudes/$id/liberar';
  static String solicitudTomar(String id) => '/solicitudes/$id/tomar';
  static String solicitudReenviar(String id) => '/solicitudes/$id/reenviar';
  static String solicitudCancelar(String id) => '/solicitudes/$id/cancelar';
  static String solicitudPausar(String id) => '/solicitudes/$id/pausar';
  static String solicitudReanudar(String id) => '/solicitudes/$id/reanudar';
  static String solicitudComentarios(String id) => '/solicitudes/$id/comentarios';
  static String solicitudHistorial(String id) => '/solicitudes/$id/historial';
  static String solicitudAdjuntos(String id) => '/solicitudes/$id/adjuntos';

  // ── Calendario
  static const String calendario = '/calendario';

  // ── Notificaciones
  static const String notificaciones = '/notificaciones';

  // ── Dashboard / reportes
  static const String dashboard = '/dashboard';
  static const String reportes = '/reportes';

  // ── Catálogo
  static const String locales = '/locales';
  static const String contratos = '/contratos';
  static const String inquilinos = '/inquilinos';
  static const String categorias = '/categorias';
  static const String tiposSolicitud = '/tipos-solicitud';
  static const String usuarios = '/usuarios';
}

/// URL base de la API. Por defecto `http://10.0.2.2:4000/api/v1` (loopback al
/// backend desde un emulador Android). En iOS simulator usar `localhost`.
///
/// Override en build/run con:
///   flutter run --dart-define=API_BASE_URL=https://staging.plazapp.com/api/v1
class ApiConfig {
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:4000/api/v1',
  );
}
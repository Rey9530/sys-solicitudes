// lib/core/router/routes.dart
//
// Nombres de rutas. Centralizados para evitar magic strings.

class Routes {
  Routes._();

  // Públicas
  static const String splash = '/';
  static const String login = '/login';
  static const String role = '/role';

  // Inquilino (bottom-nav)
  static const String inquilinoInicio = '/inquilino';
  static const String inquilinoSolicitudes = '/inquilino/solicitudes';
  static const String inquilinoCalendario = '/inquilino/calendario';
  static const String inquilinoPerfil = '/inquilino/perfil';
  static String inquilinoSolicitudDetail(String id) => '/inquilino/solicitudes/$id';

  // Admin de plaza (NavigationRail en tablets; BottomNav en móvil)
  static const String adminBandeja = '/admin';
  static const String adminCalendario = '/admin/calendario';
  static const String adminDashboard = '/admin/dashboard';
  static const String adminConfiguracion = '/admin/configuracion';
  static const String adminPerfil = '/admin/perfil';
  static String adminSolicitudDetail(String id) => '/admin/solicitudes/$id';

  // Superadmin (no usado en MVP móvil — redirige a web)
}
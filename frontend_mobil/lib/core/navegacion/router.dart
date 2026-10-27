import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auditoria/auditoria_rutas.dart';
import '../../features/auth/login_page.dart';
import '../../features/auth/reset_password_page.dart';
import '../../features/calendario/calendario_rutas.dart';
import '../../features/catalogos/catalogos_rutas.dart';
import '../../features/configuracion/configuracion_rutas.dart';
import '../../features/contratos/contratos_rutas.dart';
import '../../features/dashboard/dashboard_rutas.dart';
import '../../features/inquilinos/inquilinos_rutas.dart';
import '../../features/locales/locales_rutas.dart';
import '../../features/notificaciones/notificaciones_rutas.dart';
import '../../features/reportes/reportes_rutas.dart';
import '../../features/solicitudes/solicitudes_rutas.dart';
import '../../features/superadmin/superadmin_rutas.dart';
import '../../features/usuarios/usuarios_rutas.dart';
import '../auth/sesion.dart';
import '../auth/sesion_controller.dart';
import '../plaza/plaza_seleccionada.dart';
import '../widgets/app_scaffold.dart';
import '../widgets/selecciona_plaza_page.dart';
import 'menu.dart';

/// Router de la app. Usa las mismas URLs que el web para que enlaces y
/// notificaciones se traduzcan 1:1.
///
/// Convención: el menú navega con `context.go(ruta)`; abrir un detalle o un
/// formulario usa `context.push(ruta)` para que "atrás" vuelva al listado.
final routerProvider = Provider<GoRouter>((ref) {
  final refrescar = ValueNotifier<int>(0);
  ref.listen(sesionProvider, (_, _) => refrescar.value++);
  ref.listen(plazaSeleccionadaProvider, (_, _) => refrescar.value++);
  ref.onDispose(refrescar.dispose);

  return GoRouter(
    initialLocation: '/',
    refreshListenable: refrescar,
    redirect: (context, state) => redirigir(
      sesion: ref.read(sesionProvider),
      expiro: ref.read(sesionProvider.notifier).expiro,
      ruta: state.matchedLocation,
    ),
    routes: [
      GoRoute(path: '/', builder: (_, _) => const _Cargando()),
      GoRoute(
        path: '/login',
        builder: (_, state) => LoginPage(
          expirada: state.uri.queryParameters['expired'] == '1',
          passwordCambiada:
              state.uri.queryParameters['password_changed'] == '1',
        ),
      ),
      GoRoute(
        path: '/reset-password',
        builder: (_, _) => const ResetPasswordPage(),
      ),
      ShellRoute(
        builder: (context, state, child) => AppScaffold(
          rutaActual: state.matchedLocation,
          child: _PuertaPlaza(ruta: state.matchedLocation, child: child),
        ),
        routes: [
          ...rutasDashboard(),
          ...rutasSolicitudesAdmin(),
          ...rutasSolicitudesInquilino(),
          ...rutasSolicitudesGlobales(),
          ...rutasCalendario(),
          ...rutasLocales(),
          ...rutasInquilinos(),
          ...rutasContratos(),
          ...rutasCatalogos(),
          ...rutasUsuarios(),
          ...rutasReportes(),
          ...rutasAuditoria(),
          ...rutasNotificaciones(),
          ...rutasConfiguracion(),
          ...rutasSuperadmin(),
        ],
      ),
    ],
  );
});

/// Decide a dónde redirigir (lógica pura, probada en `router_test.dart`).
String? redirigir({
  required AsyncValue<Sesion?> sesion,
  required bool expiro,
  required String ruta,
}) {
  final publica = ruta == '/login' || ruta.startsWith('/reset-password');
  if (sesion.isLoading && !sesion.hasValue) return ruta == '/' ? null : '/';
  final s = sesion.value;
  if (s == null) {
    if (publica) return null;
    return expiro ? '/login?expired=1' : '/login';
  }
  final home = homePara(s.rol);
  if (publica || ruta == '/') return home;
  if (ruta.startsWith('/superadmin') && s.rol != Rol.superadmin) return home;
  if (ruta.startsWith('/inquilino') && s.rol != Rol.inquilino) return home;
  if (ruta.startsWith('/admin') && s.rol == Rol.inquilino) return home;
  return null;
}

/// Superadmin en una pantalla de plaza sin plaza elegida → aviso, nunca un
/// error del backend.
class _PuertaPlaza extends ConsumerWidget {
  const _PuertaPlaza({required this.ruta, required this.child});

  final String ruta;
  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sesion = ref.watch(sesionProvider).value;
    final plaza = ref.watch(plazaSeleccionadaProvider);
    if (sesion?.rol == Rol.superadmin &&
        ruta.startsWith('/admin') &&
        plaza == null) {
      return const SeleccionaPlazaPage();
    }
    return child;
  }
}

class _Cargando extends StatelessWidget {
  const _Cargando();

  @override
  Widget build(BuildContext context) =>
      const Scaffold(body: Center(child: CircularProgressIndicator()));
}

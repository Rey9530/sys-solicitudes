// lib/core/router/app_router.dart
//
// Configuración del router (go_router).
//   - Splash → decide redirige a /login o a /inquilino|/admin según AuthController.
//   - /login → pantalla pública.
//   - /role → selector post-login si el usuario tiene varios roles.
//   - /inquilino/* → shell con BottomNavigationBar (4 tabs).
//   - /admin/* → shell con NavigationRail (5 secciones en tablet / BottomNav en móvil).
//
// Deep-links: el backend push puede traer `solicitudes/{id}` → router.match resuelve.

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../features/auth/controllers/auth_controller.dart';
import '../../features/auth/domain/auth_session.dart';
import '../../features/auth/presentation/login_page.dart';
import '../../features/auth/presentation/role_selector_page.dart';
import '../../features/dashboard/presentation/dashboard_page.dart';
import '../../features/shell/admin_shell.dart';
import '../../features/shell/inicio_page.dart';
import '../../features/shell/inquilino_shell.dart';
import '../../features/solicitudes/presentation/solicitud_detail_page.dart';
import '../../features/solicitudes/presentation/solicitudes_page.dart';
import '../theme/plazapp_colors.dart';
import 'routes.dart';

class AppRouter {
  AppRouter._();

  static GoRouter build(AuthController auth) {
    return GoRouter(
      initialLocation: Routes.splash,
      refreshListenable: auth,
      debugLogDiagnostics: false,
      redirect: (context, state) {
        final loc = state.matchedLocation;
        // Splash → decidir a dónde ir
        if (loc == Routes.splash) {
          if (auth.status == AuthStatus.unknown) return null; // seguir mostrando splash
          if (!auth.isAuthenticated) return Routes.login;
          // Tiene sesión → si tiene varios roles, mostrar selector; si no, ir directo.
          final s = auth.session!;
          if (_hasMultipleRoles(s)) return Routes.role;
          if (s.isInquilino && !s.isAdminPlaza) return Routes.inquilinoInicio;
          if (s.isAdminPlaza) return Routes.adminBandeja;
          return Routes.login;
        }

        // Si está autenticado e intenta ir a /login → redirigir a su shell.
        if (auth.isAuthenticated && loc == Routes.login) {
          final s = auth.session!;
          if (_hasMultipleRoles(s)) return Routes.role;
          if (s.isInquilino && !s.isAdminPlaza) return Routes.inquilinoInicio;
          if (s.isAdminPlaza) return Routes.adminBandeja;
        }

        // Si no está autenticado y no está en /login → a /login.
        if (!auth.isAuthenticated && loc != Routes.login && loc != Routes.splash) {
          return Routes.login;
        }

        return null; // no redirigir
      },
      routes: [
        GoRoute(
          path: Routes.splash,
          builder: (_, __) => const _SplashPage(),
        ),
        GoRoute(
          path: Routes.login,
          builder: (_, __) => const LoginPage(),
        ),
        GoRoute(
          path: Routes.role,
          builder: (_, __) => const RoleSelectorPage(),
        ),

        // Shell inquilino
        StatefulShellRoute.indexedStack(
          builder: (context, state, navShell) => InquilinoShell(navShell: navShell),
          branches: [
            StatefulShellBranch(routes: [
              GoRoute(
                path: Routes.inquilinoInicio,
                builder: (_, __) => const InicioPage(),
              ),
            ]),
            StatefulShellBranch(routes: [
              GoRoute(
                path: Routes.inquilinoSolicitudes,
                builder: (_, __) => const SolicitudesPage(),
                routes: [
                  GoRoute(
                    path: ':id',
                    builder: (_, s) => SolicitudDetailPage(
                      id: s.pathParameters['id']!,
                      isAdmin: false,
                    ),
                  ),
                ],
              ),
            ]),
            StatefulShellBranch(routes: [
              GoRoute(
                path: Routes.inquilinoCalendario,
                builder: (_, __) => const _PlaceholderPage(title: 'Calendario'),
              ),
            ]),
            StatefulShellBranch(routes: [
              GoRoute(
                path: Routes.inquilinoPerfil,
                builder: (_, __) => const _PlaceholderPage(title: 'Perfil'),
              ),
            ]),
          ],
        ),

        // Shell admin de plaza
        StatefulShellRoute.indexedStack(
          builder: (context, state, navShell) => AdminShell(navShell: navShell),
          branches: [
            StatefulShellBranch(routes: [
              GoRoute(
                path: Routes.adminBandeja,
                builder: (_, __) => const SolicitudesPage(),
                routes: [
                  GoRoute(
                    path: 'solicitudes/:id',
                    builder: (_, s) => SolicitudDetailPage(
                      id: s.pathParameters['id']!,
                      isAdmin: true,
                    ),
                  ),
                ],
              ),
            ]),
            StatefulShellBranch(routes: [
              GoRoute(
                path: Routes.adminCalendario,
                builder: (_, __) => const _PlaceholderPage(title: 'Calendario admin'),
              ),
            ]),
            StatefulShellBranch(routes: [
              GoRoute(
                path: Routes.adminDashboard,
                builder: (_, __) => const DashboardPage(),
              ),
            ]),
            StatefulShellBranch(routes: [
              GoRoute(
                path: Routes.adminConfiguracion,
                builder: (_, __) => const _PlaceholderPage(title: 'Configuración'),
              ),
            ]),
            StatefulShellBranch(routes: [
              GoRoute(
                path: Routes.adminPerfil,
                builder: (_, __) => const _PlaceholderPage(title: 'Perfil admin'),
              ),
            ]),
          ],
        ),
      ],
    );
  }

  static bool _hasMultipleRoles(AuthSession s) {
    int n = 0;
    if (s.isInquilino) n++;
    if (s.isAdminPlaza) n++;
    if (s.isSuperadmin) n++;
    return n > 1;
  }
}

// ── Placeholders (se reemplazan en Fase 8) ─────────────────────────────

class _SplashPage extends StatelessWidget {
  const _SplashPage();
  @override
  Widget build(BuildContext context) {
    // Bootstrap dispara el redirect.
    final auth = context.read<AuthController>();
    WidgetsBinding.instance.addPostFrameCallback((_) => auth.bootstrap());
    final colors = Theme.of(context).extension<PlazappColors>();
    return Scaffold(
      backgroundColor: colors?.bg ?? Theme.of(context).colorScheme.surface,
      body: const Center(child: CircularProgressIndicator()),
    );
  }
}

class _PlaceholderPage extends StatelessWidget {
  const _PlaceholderPage({required this.title});
  final String title;
  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<PlazappColors>();
    final text = Theme.of(context).textTheme;
    return Scaffold(
      backgroundColor: colors?.bg,
      appBar: AppBar(title: Text(title)),
      body: Center(
        child: Text('Próximamente: $title', style: text.bodyLarge),
      ),
    );
  }
}
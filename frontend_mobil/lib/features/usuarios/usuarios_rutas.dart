import 'package:go_router/go_router.dart';

import 'matriz_permisos_page.dart';
import 'usuario_plaza_page.dart';
import 'usuarios_plaza_page.dart';

/// Rutas de usuarios de plaza, roles de staff y matriz de permisos (mismas
/// URLs que el web). `permisos` va antes de `:id` para que no la capture el
/// parámetro.
List<RouteBase> rutasUsuarios() => [
  GoRoute(
    path: '/admin/usuarios-plaza',
    builder: (context, state) =>
        UsuariosPlazaPage(tab: state.uri.queryParameters['tab']),
  ),
  GoRoute(
    path: '/admin/usuarios-plaza/permisos',
    builder: (context, state) => const MatrizPermisosPage(),
  ),
  GoRoute(
    path: '/admin/usuarios-plaza/:id',
    builder: (context, state) =>
        UsuarioPlazaPage(id: state.pathParameters['id']!),
  ),
];

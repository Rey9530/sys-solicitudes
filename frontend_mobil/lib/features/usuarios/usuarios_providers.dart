import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_error.dart';
import '../../core/api/api_providers.dart';
import '../../core/api/paginado.dart';
import 'usuarios_api.dart';
import 'usuarios_modelos.dart';

/// Pestaña Usuarios: admins de plaza (activos o deshabilitados).
final usuariosPlazaProvider = FutureProvider.autoDispose
    .family<Paginado<UsuarioPlaza>, FiltroUsuarios>(
      (ref, f) => listarUsuariosPlaza(ref.watch(apiClientProvider), f),
    );

/// Detalle de un usuario de plaza.
final usuarioPlazaProvider = FutureProvider.autoDispose
    .family<UsuarioPlaza, String>(
      (ref, id) => obtenerUsuarioPlaza(ref.watch(apiClientProvider), id),
    );

/// Las listas auxiliares (opciones de selectores, contadores) quedan vacías
/// si el backend las niega o falla, igual que en el web.
Future<T> _oVacio<T>(Future<T> Function() leer, T vacio) async {
  try {
    return await leer();
  } on ApiError {
    return vacio;
  }
}

/// Roles activos: opciones del alta y la edición de usuarios.
final rolesStaffActivosProvider = FutureProvider.autoDispose<List<RolStaff>>((
  ref,
) {
  final api = ref.watch(apiClientProvider);
  return _oVacio(
    () async =>
        (await listarRolesStaff(api, pageSize: 100, activo: true)).items,
    const [],
  );
});

/// Todos los roles (activos e inactivos): selector del detalle de usuario.
final rolesStaffTodosProvider = FutureProvider.autoDispose<List<RolStaff>>((
  ref,
) {
  final api = ref.watch(apiClientProvider);
  return _oVacio(
    () async => (await listarRolesStaff(api, pageSize: 100)).items,
    const [],
  );
});

/// Pestaña Roles de staff (paginada de 50 en 50).
final rolesStaffProvider = FutureProvider.autoDispose
    .family<Paginado<RolStaff>, int>(
      (ref, pagina) =>
          listarRolesStaff(ref.watch(apiClientProvider), pagina: pagina),
    );

/// Usuarios asignados por rol (columna "Usuarios asignados").
final usuariosAsignadosProvider = FutureProvider.autoDispose<Map<String, int>>((
  ref,
) {
  final api = ref.watch(apiClientProvider);
  return _oVacio(() => usuariosAsignadosPorRol(api), const {});
});

/// Total del catálogo de permisos (contador de la pestaña). Sin permiso para
/// verlo (403) cuenta 0, igual que el web.
final totalPermisosProvider = FutureProvider.autoDispose<int>((ref) {
  final api = ref.watch(apiClientProvider);
  return _oVacio(() async => (await obtenerCatalogoPermisos(api)).total, 0);
});

/// Datos de la matriz de permisos.
final matrizPermisosProvider = FutureProvider.autoDispose<DatosMatriz>(
  (ref) => cargarMatrizPermisos(ref.watch(apiClientProvider)),
);

/// Invalida todo lo que depende de usuarios (tras alta, edición, etc.).
void invalidarUsuarios(WidgetRef ref) {
  ref.invalidate(usuariosPlazaProvider);
  ref.invalidate(usuarioPlazaProvider);
  ref.invalidate(usuariosAsignadosProvider);
}

/// Invalida todo lo que depende de roles de staff.
void invalidarRoles(WidgetRef ref) {
  ref.invalidate(rolesStaffProvider);
  ref.invalidate(rolesStaffActivosProvider);
  ref.invalidate(rolesStaffTodosProvider);
  ref.invalidate(usuariosAsignadosProvider);
  // Los usuarios muestran el nombre y el estado de su rol.
  ref.invalidate(usuariosPlazaProvider);
  ref.invalidate(usuarioPlazaProvider);
}

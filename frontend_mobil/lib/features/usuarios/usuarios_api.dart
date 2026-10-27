import 'dart:convert';
import 'dart:math';

import '../../core/api/api_client.dart';
import '../../core/api/api_error.dart';
import '../../core/api/paginado.dart';
import 'usuarios_modelos.dart';

/// Filtros de la pestaña Usuarios. [deshabilitados] lista los deshabilitados
/// (`activo=false`) para poder reactivarlos.
typedef FiltroUsuarios = ({int pagina, String? buscar, bool deshabilitados});

/// Texto de formulario → valor del payload (`null` si queda vacío).
String? textoOpcional(String texto) {
  final t = texto.trim();
  return t.isEmpty ? null : t;
}

/// Contraseña temporal del alta, igual que el web:
/// `'Tmp' + base64url(9 bytes aleatorios) + '1a'` (cumple la política).
String generarPasswordTemporal([Random? aleatorio]) {
  final r = aleatorio ?? Random.secure();
  final bytes = List<int>.generate(9, (_) => r.nextInt(256));
  return 'Tmp${base64Url.encode(bytes)}1a';
}

// ── Usuarios admin_plaza ────────────────────────────────────────────────────

/// `GET /usuarios?rol=admin_plaza` (solo activos, o solo deshabilitados).
Future<Paginado<UsuarioPlaza>> listarUsuariosPlaza(
  ApiClient api,
  FiltroUsuarios f,
) async {
  final json = await api.get(
    '/usuarios',
    query: {
      'rol': 'admin_plaza',
      'page': f.pagina,
      'pageSize': 20,
      'search': f.buscar,
      if (f.deshabilitados) 'activo': false,
    },
  ) as Map<String, dynamic>;
  return Paginado.fromJson(json, UsuarioPlaza.fromJson);
}

/// `GET /usuarios/:id` (incluye deshabilitados).
Future<UsuarioPlaza> obtenerUsuarioPlaza(ApiClient api, String id) async =>
    UsuarioPlaza.fromJson(
      await api.get('/usuarios/$id') as Map<String, dynamic>,
    );

/// `POST /usuarios` con `rol: 'admin_plaza'`. Devuelve la contraseña temporal
/// generada (el backend no la devuelve: se muestra una sola vez).
Future<String> crearUsuarioPlaza(
  ApiClient api, {
  required String email,
  required String nombre,
  String? telefono,
  required String rolStaffId,
}) async {
  final password = generarPasswordTemporal();
  await api.post(
    '/usuarios',
    body: {
      'email': email.trim().toLowerCase(),
      'nombre': nombre,
      'telefono': ?telefono,
      'password': password,
      'rol': 'admin_plaza',
      'rolStaffId': rolStaffId,
    },
  );
  return password;
}

/// `PATCH /usuarios/:id`: nombre, teléfono (`null` lo borra) y rol de staff.
/// Errores: `ROL_STAFF_INVALIDO`, `ROL_STAFF_NO_EXISTE`, `ULTIMO_ADMIN_SISTEMA`.
Future<void> actualizarUsuarioPlaza(
  ApiClient api,
  String id, {
  required String nombre,
  String? telefono,
  required String rolStaffId,
}) => api.patch(
  '/usuarios/$id',
  body: {'nombre': nombre, 'telefono': telefono, 'rolStaffId': rolStaffId},
);

/// `DELETE /usuarios/:id` con el motivo (queda en auditoría).
/// Error `ULTIMO_ADMIN_ACTIVO` si es el único admin activo.
Future<void> deshabilitarUsuario(ApiClient api, String id, String motivo) =>
    api.delete('/usuarios/$id', body: {'motivo': motivo});

/// `POST /usuarios/:id/reactivate`.
Future<void> reactivarUsuario(ApiClient api, String id) =>
    api.post('/usuarios/$id/reactivate');

/// `POST /usuarios/:id/reset-password`: email con enlace válido 30 min.
Future<void> resetearClaveUsuario(ApiClient api, String id) =>
    api.post('/usuarios/$id/reset-password');

// ── Roles de staff ──────────────────────────────────────────────────────────

/// `GET /roles-staff` (activos primero, luego por nombre).
Future<Paginado<RolStaff>> listarRolesStaff(
  ApiClient api, {
  int pagina = 1,
  int pageSize = 50,
  bool? activo,
}) async {
  final json = await api.get(
    '/roles-staff',
    query: {'page': pagina, 'pageSize': pageSize, 'activo': activo},
  ) as Map<String, dynamic>;
  return Paginado.fromJson(json, RolStaff.fromJson);
}

/// `GET /roles-staff/con-asignaciones` → id de rol → usuarios asignados.
Future<Map<String, int>> usuariosAsignadosPorRol(ApiClient api) async {
  final lista = await api.get('/roles-staff/con-asignaciones') as List<dynamic>;
  return {
    for (final r in lista.cast<Map<String, dynamic>>().map(RolStaff.fromJson))
      r.id: r.usuariosAsignados,
  };
}

/// `POST /roles-staff`. Error `ROL_STAFF_CODIGO_DUPLICADO`.
Future<void> crearRolStaff(
  ApiClient api, {
  required String codigo,
  required String nombre,
  String? descripcion,
}) => api.post(
  '/roles-staff',
  body: {
    'codigo': codigo.trim().toLowerCase(),
    'nombre': nombre,
    'descripcion': ?descripcion,
  },
);

/// `PATCH /roles-staff/:id` (el código es inmutable).
Future<void> actualizarRolStaff(
  ApiClient api,
  String id, {
  required String nombre,
  String? descripcion,
  required bool activo,
}) => api.patch(
  '/roles-staff/$id',
  body: {'nombre': nombre, 'descripcion': descripcion, 'activo': activo},
);

/// `DELETE /roles-staff/:id` (desactiva; nunca bloquea).
Future<void> desactivarRolStaff(ApiClient api, String id) =>
    api.delete('/roles-staff/$id');

// ── Permisos ────────────────────────────────────────────────────────────────

/// `GET /permisos`: catálogo global agrupado por módulo.
Future<CatalogoPermisos> obtenerCatalogoPermisos(ApiClient api) async =>
    CatalogoPermisos.fromJson(
      await api.get('/permisos') as Map<String, dynamic>,
    );

/// `GET /permisos/roles/:id`.
Future<PermisosDeRol> obtenerPermisosDeRol(ApiClient api, String rolId) async =>
    PermisosDeRol.fromJson(
      await api.get('/permisos/roles/$rolId') as Map<String, dynamic>,
    );

/// `PUT /permisos/roles/:id`: **reemplaza** el set completo de permisos.
Future<void> guardarPermisosDeRol(
  ApiClient api,
  String rolId,
  Iterable<String> permisoIds,
) => api.put(
  '/permisos/roles/$rolId',
  body: {'permisoIds': permisoIds.toList()},
);

/// Carga la matriz: catálogo, todos los roles (activos e inactivos) y los
/// permisos de cada rol. Si falla un rol, queda sin permisos (como el web).
Future<DatosMatriz> cargarMatrizPermisos(ApiClient api) async {
  final CatalogoPermisos catalogo;
  try {
    catalogo = await obtenerCatalogoPermisos(api);
  } on ApiError catch (e) {
    throw _errorDeCarga(e, 'No se pudo cargar el catálogo de permisos');
  }
  final List<RolStaff> roles;
  try {
    roles = (await listarRolesStaff(api, pageSize: 100)).items;
  } on ApiError catch (e) {
    throw _errorDeCarga(e, 'No se pudo cargar la lista de roles de la plaza');
  }
  final porRol = await Future.wait(
    roles.map((r) async {
      try {
        return await obtenerPermisosDeRol(api, r.id);
      } on ApiError {
        return PermisosDeRol(esSistema: r.esSistema, permisoIds: const {});
      }
    }),
  );
  return DatosMatriz(
    catalogo: catalogo,
    roles: roles,
    permisosPorRol: {
      for (var i = 0; i < roles.length; i++) roles[i].id: porRol[i].permisoIds,
    },
    rolesSistema: {
      for (var i = 0; i < roles.length; i++)
        if (porRol[i].esSistema) roles[i].id,
    },
  );
}

ApiError _errorDeCarga(ApiError e, String mensaje) => ApiError(
  status: e.status,
  code: e.code,
  mensaje: e.status == 0 ? e.mensaje : '$mensaje (HTTP ${e.status}).',
  meta: e.meta,
);

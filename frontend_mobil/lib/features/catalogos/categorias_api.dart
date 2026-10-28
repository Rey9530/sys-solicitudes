import '../../core/api/api_client.dart';
import '../../core/api/paginado.dart';
import 'categorias_modelos.dart';

/// Filtros del listado de categorías (`activo` null = todas).
typedef FiltroCategorias = ({int pagina, bool? activo, String? buscar});

/// Filtros del listado de tipos de solicitud (`activo` null = todos).
typedef FiltroTipos = ({int pagina, bool? activo});

// ── Categorías ──────────────────────────────────────────────────────────────

/// `GET /categorias` (orden por nombre).
Future<Paginado<Categoria>> listarCategorias(
  ApiClient api,
  FiltroCategorias f,
) async {
  final json = await api.get(
    '/categorias',
    query: {
      'page': f.pagina,
      'pageSize': 20,
      'activo': f.activo,
      'search': f.buscar,
    },
  ) as Map<String, dynamic>;
  return Paginado.fromJson(json, Categoria.fromJson);
}

/// `GET /categorias/:id`: incluye solo las subcategorías activas.
Future<Categoria> obtenerCategoria(ApiClient api, String id) async =>
    Categoria.fromJson(
      await api.get('/categorias/$id') as Map<String, dynamic>,
    );

/// `POST /categorias`.
Future<void> crearCategoria(
  ApiClient api, {
  required String nombre,
  String? descripcion,
}) => api.post(
  '/categorias',
  body: {'nombre': nombre, 'descripcion': ?descripcion},
);

/// `PATCH /categorias/:id` (`descripcion` null la borra).
Future<void> actualizarCategoria(
  ApiClient api,
  String id, {
  required String nombre,
  String? descripcion,
}) => api.patch(
  '/categorias/$id',
  body: {'nombre': nombre, 'descripcion': descripcion},
);

/// `DELETE /categorias/:id`. Falla con `CATEGORIA_HAS_ACTIVE_SUBCATEGORIAS`.
Future<void> desactivarCategoria(ApiClient api, String id) =>
    api.delete('/categorias/$id');

// ── Subcategorías ───────────────────────────────────────────────────────────

/// `GET /categorias/:id/subcategorias`: todas (activas e inactivas).
Future<Paginado<Subcategoria>> listarSubcategorias(
  ApiClient api,
  String categoriaId,
) async {
  final json = await api.get(
    '/categorias/$categoriaId/subcategorias',
    query: {'page': 1, 'pageSize': 100},
  ) as Map<String, dynamic>;
  return Paginado.fromJson(json, Subcategoria.fromJson);
}

/// `POST /categorias/:id/subcategorias`. Los supervisores se gestionan
/// aparte, por eso siempre van vacíos.
Future<void> crearSubcategoria(
  ApiClient api,
  String categoriaId, {
  required String nombre,
  String? descripcion,
  required String prioridad,
  required String responsableId,
}) => api.post(
  '/categorias/$categoriaId/subcategorias',
  body: {
    'nombre': nombre,
    'descripcion': ?descripcion,
    'prioridad': prioridad,
    'responsableId': responsableId,
    'supervisorIds': <String>[],
  },
);

/// `PATCH /categorias/:id/subcategorias/:subId` (el responsable no se
/// cambia aquí).
Future<void> actualizarSubcategoria(
  ApiClient api,
  String categoriaId,
  String subId, {
  required String nombre,
  String? descripcion,
  required String prioridad,
}) => api.patch(
  '/categorias/$categoriaId/subcategorias/$subId',
  body: {'nombre': nombre, 'descripcion': descripcion, 'prioridad': prioridad},
);

/// `DELETE /categorias/:id/subcategorias/:subId`.
Future<void> desactivarSubcategoria(
  ApiClient api,
  String categoriaId,
  String subId,
) => api.delete('/categorias/$categoriaId/subcategorias/$subId');

/// `PATCH …/:subId/responsable`. El backend reasigna las solicitudes activas
/// de la subcategoría al nuevo responsable.
Future<void> cambiarResponsable(
  ApiClient api,
  String categoriaId,
  String subId,
  String responsableId,
) => api.patch(
  '/categorias/$categoriaId/subcategorias/$subId/responsable',
  body: {'responsableId': responsableId},
);

/// `POST …/:subId/supervisores`. Devuelve la subcategoría actualizada.
Future<Subcategoria> agregarSupervisor(
  ApiClient api,
  String categoriaId,
  String subId,
  String usuarioId,
) async => Subcategoria.fromJson(
  await api.post(
    '/categorias/$categoriaId/subcategorias/$subId/supervisores',
    body: {'usuarioId': usuarioId},
  ) as Map<String, dynamic>,
);

/// `DELETE …/:subId/supervisores/:usuarioId`. Devuelve la subcategoría
/// actualizada.
Future<Subcategoria> quitarSupervisor(
  ApiClient api,
  String categoriaId,
  String subId,
  String usuarioId,
) async => Subcategoria.fromJson(
  await api.delete(
    '/categorias/$categoriaId/subcategorias/$subId/supervisores/$usuarioId',
  ) as Map<String, dynamic>,
);

/// Staff elegible como responsable o supervisor (SC-6): admins de plaza con
/// rol de staff **activo** (`GET /usuarios?rol=admin_plaza`).
Future<List<PersonaStaff>> listarStaffElegible(ApiClient api) async {
  final json = await api.get(
    '/usuarios',
    query: {'rol': 'admin_plaza', 'page': 1, 'pageSize': 100},
  ) as Map<String, dynamic>;
  return (json['items'] as List<dynamic>? ?? const [])
      .cast<Map<String, dynamic>>()
      .where((u) => u['rolStaffActivo'] == true)
      .map(PersonaStaff.fromJson)
      .toList();
}

// ── Tipos de solicitud ──────────────────────────────────────────────────────

/// `GET /admin/tipos-solicitud` (orden por `orden`, `codigo`).
Future<Paginado<TipoSolicitudConfig>> listarTiposSolicitud(
  ApiClient api,
  FiltroTipos f,
) async {
  final json = await api.get(
    '/admin/tipos-solicitud',
    query: {'page': f.pagina, 'pageSize': 20, 'activo': f.activo},
  ) as Map<String, dynamic>;
  return Paginado.fromJson(json, TipoSolicitudConfig.fromJson);
}

/// `GET /admin/tipos-solicitud/:id`.
Future<TipoSolicitudConfig> obtenerTipoSolicitud(
  ApiClient api,
  String id,
) async => TipoSolicitudConfig.fromJson(
  await api.get('/admin/tipos-solicitud/$id') as Map<String, dynamic>,
);

/// `PATCH /admin/tipos-solicitud/:id` con **solo** los campos cambiados
/// (`etiqueta`, `descripcion`, `orden` o `activo`).
Future<void> actualizarTipoSolicitud(
  ApiClient api,
  String id,
  Map<String, Object?> cambios,
) => api.patch('/admin/tipos-solicitud/$id', body: cambios);

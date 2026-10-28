import 'dart:typed_data';

import '../../core/api/api_client.dart';
import '../../core/api/paginado.dart';
import 'solicitudes_modelos.dart';

/// Llamadas al backend del módulo de solicitudes (rutas relativas a
/// `/api/v1`). Equivalen a las server actions del web:
/// `inquilino/solicitudes/actions.ts`, `admin/solicitudes/actions.ts` y
/// `superadmin/solicitudes/actions.ts`.
///
/// Todas fallan con `ApiError`; la pantalla muestra `mensaje`.

Map<String, dynamic> _mapa(Object? json) => json as Map<String, dynamic>;

SolicitudItem _item(Object? json) => SolicitudItem.fromJson(_mapa(json));

/// Cuerpo opcional: `{clave: texto}` solo si hay texto (nunca `''`).
Map<String, Object?> _soloSiHay(String clave, String? texto) {
  final t = texto?.trim() ?? '';
  return t.isEmpty ? {} : {clave: t};
}

// ── Lectura ─────────────────────────────────────────────────────────────────

/// "Mis solicitudes" del inquilino (el backend filtra por su JWT).
Future<Paginado<SolicitudItem>> listarSolicitudes(
  ApiClient api,
  FiltroSolicitudes f,
) async => Paginado.fromJson(
  _mapa(await api.get('/solicitudes', query: f.query)),
  SolicitudItem.fromJson,
);

/// Detalle con adjuntos, comentarios e historial.
Future<SolicitudDetalle> obtenerSolicitud(ApiClient api, String id) async =>
    SolicitudDetalle.fromJson(_mapa(await api.get('/solicitudes/$id')));

/// PDF "Permiso de Trabajos" (cualquier estado).
Future<Uint8List> pdfPermiso(ApiClient api, String id) =>
    api.bytes('/reportes/solicitudes/$id/permiso.pdf');

/// Tipos activos de la plaza (lista, no paginada).
Future<List<TipoSolicitudOpcion>> listarTiposActivos(ApiClient api) async =>
    (await api.get('/solicitudes/tipos') as List<dynamic>)
        .cast<Map<String, dynamic>>()
        .map(TipoSolicitudOpcion.fromJson)
        .toList();

/// Categorías activas con sus subcategorías: la lista y luego el detalle de
/// cada una en paralelo (igual que `loadCategorias` del web). Una categoría
/// cuyo detalle falla se omite.
Future<List<CategoriaOpcion>> listarCategoriasConSubcategorias(
  ApiClient api,
) async {
  final lista = _mapa(
    await api.get('/categorias', query: {'page': 1, 'pageSize': 100}),
  );
  final ids = (lista['items'] as List<dynamic>)
      .cast<Map<String, dynamic>>()
      .map((c) => c['id'] as String);
  final detalles = await Future.wait(
    ids.map((id) async {
      try {
        return CategoriaOpcion.fromJson(
          _mapa(await api.get('/categorias/$id')),
        );
      } on Exception {
        return null;
      }
    }),
  );
  return detalles.whereType<CategoriaOpcion>().toList();
}

/// Locales del inquilino = los de sus contratos vigentes, sin repetir.
Future<List<LocalOpcion>> listarLocalesInquilino(ApiClient api) async {
  final r = _mapa(
    await api.get(
      '/contratos',
      query: {'estado': 'vigente', 'page': 1, 'pageSize': 100},
    ),
  );
  final vistos = <String>{};
  final locales = <LocalOpcion>[];
  for (final c in (r['items'] as List<dynamic>).cast<Map<String, dynamic>>()) {
    final id = c['localId'] as String;
    if (vistos.add(id)) {
      locales.add(
        LocalOpcion(id: id, codigo: c['localCodigo'] as String? ?? id),
      );
    }
  }
  return locales;
}

/// Solicitudes recientes del mismo local y tipo (aviso no bloqueante).
Future<List<SolicitudItem>> buscarDuplicados(
  ApiClient api,
  String localId,
  String tipo,
) async => (await api.get(
  '/solicitudes/duplicados',
  query: {'localId': localId, 'tipo': tipo},
) as List<dynamic>).map(_item).toList();

// ── Inquilino: crear, editar y transiciones ─────────────────────────────────

/// Crea la solicitud (siempre nace en `borrador`).
Future<SolicitudItem> crearSolicitud(
  ApiClient api,
  Map<String, Object?> body,
) async => _item(await api.post('/solicitudes', body: body));

/// Edita la solicitud. El cuerpo DEBE incluir `esEmergencia`: el backend lo
/// pone en `false` si falta (bug A1-R2).
Future<SolicitudItem> actualizarSolicitud(
  ApiClient api,
  String id,
  Map<String, Object?> body,
) async {
  if (!body.containsKey('esEmergencia')) {
    throw ArgumentError.value(
      body,
      'body',
      'El PATCH de solicitud siempre debe incluir esEmergencia',
    );
  }
  return _item(await api.patch('/solicitudes/$id', body: body));
}

/// `borrador → enviada`.
Future<SolicitudItem> enviar(ApiClient api, String id) async =>
    _item(await api.post('/solicitudes/$id/enviar'));

/// Reenvío tras subsanación: `requerida_subsanacion → enviada`.
Future<SolicitudItem> subsanar(ApiClient api, String id) async =>
    _item(await api.post('/solicitudes/$id/subsanar'));

/// Cancelación por el inquilino (motivo opcional).
Future<SolicitudItem> cancelar(
  ApiClient api,
  String id, {
  String? motivo,
}) async => _item(
  await api.post(
    '/solicitudes/$id/cancelar',
    body: _soloSiHay('motivo', motivo),
  ),
);

/// Nuevo borrador "Copia de …" (sin fechas ni adjuntos).
Future<SolicitudItem> duplicar(ApiClient api, String id) async =>
    _item(await api.post('/solicitudes/$id/duplicar'));

/// Comentario general (inquilino y admin).
Future<Comentario> comentar(ApiClient api, String id, String cuerpo) async =>
    Comentario.fromJson(
      _mapa(
        await api.post(
          '/solicitudes/$id/comentarios',
          body: {'cuerpo': cuerpo.trim()},
        ),
      ),
    );

/// Sube un adjunto (un archivo por request, campo `file`, MIME declarado).
Future<void> subirAdjuntoSolicitud(
  ApiClient api,
  String id,
  String nombre,
  Uint8List bytes,
  String mime,
) => api.subir(
  '/solicitudes/$id/adjuntos',
  nombreArchivo: nombre,
  contenido: bytes,
  mimeType: mime,
);

// ── Admin de plaza ──────────────────────────────────────────────────────────

/// Bandeja con semáforo SLA (único endpoint que lo calcula).
Future<Paginado<SolicitudItem>> bandeja(ApiClient api, FiltroBandeja f) async =>
    Paginado.fromJson(
      _mapa(await api.get('/solicitudes/bandeja', query: f.query)),
      SolicitudItem.fromJson,
    );

Future<SolicitudItem> _accion(
  ApiClient api,
  String id,
  String accion, [
  Map<String, Object?> body = const {},
]) async => _item(await api.post('/solicitudes/$id/$accion', body: body));

/// `enviada|asignado → en_revision`.
Future<SolicitudItem> tomar(ApiClient api, String id) =>
    _accion(api, id, 'tomar');

/// `en_revision → aprobada` (comentario opcional).
Future<SolicitudItem> aprobar(ApiClient api, String id, {String? comentario}) =>
    _accion(api, id, 'aprobar', _soloSiHay('comentario', comentario));

/// `en_revision → rechazada` (comentario obligatorio).
Future<SolicitudItem> rechazar(ApiClient api, String id, String comentario) =>
    _accion(api, id, 'rechazar', {'comentario': comentario.trim()});

/// `en_revision → requerida_subsanacion` (comentario obligatorio).
Future<SolicitudItem> pedirSubsanacion(
  ApiClient api,
  String id,
  String comentario,
) => _accion(api, id, 'pedir-subsanacion', {'comentario': comentario.trim()});

/// `asignado|en_revision → pausada` (motivo opcional).
Future<SolicitudItem> pausar(ApiClient api, String id, {String? motivo}) =>
    _accion(api, id, 'pausar', _soloSiHay('motivo', motivo));

/// `pausada → en_revision`.
Future<SolicitudItem> reanudar(ApiClient api, String id) =>
    _accion(api, id, 'reanudar');

/// `aprobada → cerrada`. El comentario se envía siempre que haya texto,
/// también con `exitoso` (el web lo descartaba).
Future<SolicitudItem> cerrar(
  ApiClient api,
  String id, {
  required String resultado,
  String? comentario,
}) => _accion(api, id, 'cerrar', {
  'resultado': resultado,
  ..._soloSiHay('comentario', comentario),
});

/// Cambia el responsable (mismo estado).
Future<SolicitudItem> reasignar(
  ApiClient api,
  String id,
  String nuevoResponsableId, {
  String? comentario,
}) => _accion(api, id, 'reasignar', {
  'nuevoResponsableId': nuevoResponsableId,
  ..._soloSiHay('comentario', comentario),
});

/// Devuelve la solicitud a la cola: `asignado|en_revision → enviada`.
Future<SolicitudItem> liberar(ApiClient api, String id, {String? motivo}) =>
    _accion(api, id, 'liberar', _soloSiHay('motivo', motivo));

/// Cancelación por el admin (la UI exige el motivo).
Future<SolicitudItem> cancelarAdmin(ApiClient api, String id, String motivo) =>
    _accion(api, id, 'cancelar', _soloSiHay('motivo', motivo));

/// Cambio de prioridad (no es transición de estado).
Future<SolicitudItem> cambiarPrioridad(
  ApiClient api,
  String id,
  String prioridad,
) async => _item(
  await api.patch('/solicitudes/$id/prioridad', body: {'prioridad': prioridad}),
);

/// Admins de plaza con rol de staff activo (candidatos a reasignar).
Future<List<AdminOpcion>> listarAdminsPlaza(ApiClient api) async {
  final r = _mapa(
    await api.get(
      '/usuarios',
      query: {'rol': 'admin_plaza', 'page': 1, 'pageSize': 100},
    ),
  );
  return (r['items'] as List<dynamic>)
      .cast<Map<String, dynamic>>()
      .map(AdminOpcion.fromJson)
      .where((a) => a.rolStaffActivo)
      .toList();
}

// ── Superadmin (vista global, solo lectura) ─────────────────────────────────

/// Solicitudes de todas las plazas (ignora `x-plaza-id`).
Future<Paginado<SolicitudItem>> solicitudesGlobales(
  ApiClient api,
  FiltroGlobal f,
) async => Paginado.fromJson(
  _mapa(await api.get('/admin/solicitudes', query: f.query)),
  SolicitudItem.fromJson,
);

/// Detalle cross-plaza (`SolicitudDetailOutput` + `plaza`).
Future<SolicitudDetalle> solicitudGlobal(ApiClient api, String id) async =>
    SolicitudDetalle.fromJson(_mapa(await api.get('/admin/solicitudes/$id')));

/// CSV con los mismos filtros, sin paginación (tope 10 000 filas).
Future<Uint8List> exportarCsvGlobal(ApiClient api, FiltroGlobal f) =>
    api.bytes('/admin/solicitudes/export.csv', query: f.queryExportar);

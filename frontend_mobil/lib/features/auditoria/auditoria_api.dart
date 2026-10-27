import '../../core/api/api_client.dart';
import '../../core/api/paginado.dart';
import '../../core/theme/colores.dart';
import 'auditoria_modelos.dart';

/// `GET /auditoria` (20 por página, más recientes primero).
Future<Paginado<RegistroAuditoria>> listarAuditoria(
  ApiClient api,
  FiltrosAuditoria f,
) async {
  final r = await api.get(
    '/auditoria',
    query: {
      'page': f.pagina,
      'pageSize': 20,
      'accion': f.accion,
      'entidadTipo': f.entidadTipo,
      'fechaDesde': f.desde,
      'fechaHasta': f.hasta,
    },
  ) as Map<String, dynamic>;
  return Paginado.fromJson(r, RegistroAuditoria.fromJson);
}

/// Tono del badge de la acción por su sufijo (`.create`, `.update`, `.delete`).
Tono tonoAccion(String accion) => switch (accion.split('.').last) {
  'create' => Tono.ok,
  'update' => Tono.info,
  'delete' => Tono.danger,
  _ => Tono.neutral,
};

/// Ruta del detalle de la entidad auditada, o `null` si la app no tiene esa
/// pantalla (p. ej. `plaza`: el web enlazaba a una ruta inexistente, C-R6).
String? rutaEntidadAuditada(RegistroAuditoria r) {
  final id = r.entidadId;
  if (id == null) return null;
  // Una subcategoría no tiene detalle propio: se abre la lista de su
  // categoría, que solo viene en el payload de alta/edición/baja (en
  // responsable y supervisores no hay forma fiable de saberla).
  if (r.entidadTipo == 'subcategoria') {
    final categoriaId =
        _texto(r.despues, 'categoriaId') ?? _texto(r.antes, 'categoriaId');
    return categoriaId == null
        ? null
        : '/admin/categorias/$categoriaId/subcategorias';
  }
  final base = switch (r.entidadTipo) {
    'local' => '/admin/locales',
    'inquilino' => '/admin/inquilinos',
    'contrato' => '/admin/contratos',
    'solicitud' => '/admin/solicitudes',
    'categoria' => '/admin/categorias',
    'usuario' => '/admin/usuarios-plaza',
    _ => null,
  };
  return base == null ? null : '$base/$id';
}

/// `payload[clave]` si [payload] es un objeto JSON y el valor es texto.
String? _texto(Object? payload, String clave) {
  if (payload is! Map<String, dynamic>) return null;
  final v = payload[clave];
  return v is String && v.isNotEmpty ? v : null;
}

/// Primeros 8 caracteres de un id.
String idCorto(String id) => id.length > 8 ? id.substring(0, 8) : id;

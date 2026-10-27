import 'dart:typed_data';

import '../../core/api/api_client.dart';
import '../../core/api/api_error.dart';
import '../../core/format/texto.dart';

/// Entidades exportables (`ENTIDADES` del web).
const entidadesReporte = <(String, String)>[
  ('solicitudes', 'Solicitudes'),
  ('locales', 'Locales'),
  ('inquilinos', 'Inquilinos'),
];

/// Formatos de exportación y su MIME.
const formatosReporte = <String, String>{
  'csv': 'text/csv',
  'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'pdf': 'application/pdf',
};

/// Opciones de los filtros: locales, inquilinos y tipos de la plaza. Como en
/// el web, si una lista no se puede cargar queda vacía (la pantalla sigue
/// funcionando).
class OpcionesReporte {
  const OpcionesReporte({
    required this.locales,
    required this.inquilinos,
    required this.tipos,
  });

  /// (id, código).
  final List<(String, String)> locales;

  /// (id, razón social).
  final List<(String, String)> inquilinos;

  /// (código, etiqueta).
  final List<(String, String)> tipos;
}

/// Previsualización: primeras filas (≤ 10) y total de registros.
class PreviewReporte {
  const PreviewReporte({required this.filas, required this.total});

  final List<Map<String, dynamic>> filas;
  final int total;
}

Future<OpcionesReporte> cargarOpcionesReporte(ApiClient api) async {
  Future<List<dynamic>> items(String path, Map<String, Object?>? q) async {
    try {
      final r = await api.get(path, query: q);
      if (r is List<dynamic>) return r;
      return (r as Map<String, dynamic>)['items'] as List<dynamic>? ?? const [];
    } on ApiError {
      return const [];
    }
  }

  final r = await Future.wait([
    items('/locales', {'page': 1, 'pageSize': 100}),
    items('/inquilinos', {'page': 1, 'pageSize': 100}),
    items('/solicitudes/tipos', null),
  ]);
  List<(String, String)> pares(List<dynamic> l, String id, String texto) => [
    for (final e in l.cast<Map<String, dynamic>>())
      (e[id] as String, decodificarHtml(e[texto] as String?)),
  ];
  return OpcionesReporte(
    locales: pares(r[0], 'id', 'codigo'),
    inquilinos: pares(r[1], 'id', 'razonSocial'),
    tipos: pares(r[2], 'codigo', 'etiqueta'),
  );
}

/// `GET /reportes/{entidad}/preview?<filtros>`.
Future<PreviewReporte> previsualizarReporte(
  ApiClient api,
  String entidad,
  Map<String, String> filtros,
) async {
  final r = await api.get(
    '/reportes/$entidad/preview',
    query: filtros,
  ) as Map<String, dynamic>;
  return PreviewReporte(
    filas: (r['items'] as List<dynamic>? ?? const [])
        .cast<Map<String, dynamic>>(),
    total: (r['total'] as num?)?.toInt() ?? 0,
  );
}

/// `GET /reportes/{entidad}/export.{csv|xlsx|pdf}?<filtros>`.
Future<Uint8List> exportarReporte(
  ApiClient api,
  String entidad,
  String formato,
  Map<String, String> filtros,
) => api.bytes('/reportes/$entidad/export.$formato', query: filtros);

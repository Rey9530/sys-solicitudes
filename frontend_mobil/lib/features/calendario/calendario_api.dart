import 'dart:typed_data';

import '../../core/api/api_client.dart';
import '../../core/api/api_error.dart';
import '../../core/format/fechas.dart';
import '../../core/format/texto.dart';
import 'calendario_modelos.dart';

/// Llamadas del calendario (Inv §5.5). Espejo de
/// `frontend/src/app/calendario-actions.ts` y de las páginas de calendario.

/// Instante → ISO con el desfase de la plaza (`2026-09-28T00:00:00-06:00`),
/// formato que piden `GET /calendario` y `PATCH /calendario/eventos/:id/fechas`.
String isoPlaza(DateTime instante) {
  final p = aHoraPlaza(instante);
  String dos(int n) => n.toString().padLeft(2, '0');
  return '${ymd(p)}T${dos(p.hour)}:${dos(p.minute)}:${dos(p.second)}-06:00';
}

/// Feed `GET /calendario`. Los filtros vacíos se omiten; `tipo` también se
/// omite cuando están los cuatro (igual que el web).
Future<List<EventoCalendario>> feedCalendario(
  ApiClient api, {
  required DateTime desde,
  required DateTime hasta,
  List<String>? locales,
  List<String>? inquilinos,
  Set<String>? tipos,
}) async {
  // Sin tipos o con los cuatro marcados = todos (no se envía el parámetro).
  final tipo =
      tipos == null ||
          tipos.isEmpty ||
          todosLosTiposCalendario.every(tipos.contains)
      ? null
      : (tipos.toList()..sort());
  final r = await api.get(
    '/calendario',
    query: {
      'from': isoPlaza(desde),
      'to': isoPlaza(hasta),
      'localId': locales,
      'inquilinoId': inquilinos,
      'tipo': tipo,
    },
  ) as List<dynamic>;
  return r.cast<Map<String, dynamic>>().map(EventoCalendario.fromJson).toList();
}

/// Cambia las fechas de un evento aprobado (solo admin con
/// `calendario.mover_evento`). [eventoId] va sin el prefijo `evt-`.
Future<EventoCalendario> moverEvento(
  ApiClient api,
  String eventoId,
  DateTime inicio,
  DateTime fin,
) async {
  final id = eventoId.replaceFirst(RegExp(r'^evt-'), '');
  final r = await api.patch(
    '/calendario/eventos/$id/fechas',
    body: {'inicio': isoPlaza(inicio), 'fin': isoPlaza(fin)},
  );
  return EventoCalendario.fromJson(r as Map<String, dynamic>);
}

/// Archivo iCal (`text/calendar`) de los eventos aprobados, opcionalmente
/// filtrado por locales (el backend no filtra por fechas ni por tipo).
Future<Uint8List> exportarIcs(ApiClient api, {List<String>? locales}) =>
    api.bytes('/calendario/export.ics', query: {'localId': locales});

/// Opciones de filtros del admin: locales (`codigo`), inquilinos
/// (`razonSocial`) y el flag de hitos. Si algo falla se usa lista vacía (y
/// hitos visibles), como el web.
Future<OpcionesCalendario> opcionesAdmin(ApiClient api) async {
  final resultados = await Future.wait([
    _opciones(api, '/locales', (j) => j['codigo'] as String? ?? ''),
    _opciones(
      api,
      '/inquilinos',
      (j) => decodificarHtml(j['razonSocial'] as String?),
    ),
  ]);
  var mostrarHitos = true;
  try {
    final config = await api.get('/configuracion') as Map<String, dynamic>;
    mostrarHitos = config['calendarMostrarHitosContrato'] as bool? ?? true;
  } on ApiError {
    mostrarHitos = true;
  }
  return OpcionesCalendario(
    locales: resultados[0],
    inquilinos: resultados[1],
    mostrarHitos: mostrarHitos,
  );
}

/// Opciones del inquilino: locales de sus contratos vigentes, sin repetir.
Future<OpcionesCalendario> opcionesInquilino(ApiClient api) async {
  try {
    final r = await api.get(
      '/contratos',
      query: {'estado': 'vigente', 'page': 1, 'pageSize': 100},
    ) as Map<String, dynamic>;
    final vistos = <String>{};
    final locales = <OpcionFiltro>[];
    for (final c
        in (r['items'] as List<dynamic>).cast<Map<String, dynamic>>()) {
      final id = c['localId'] as String?;
      if (id == null || !vistos.add(id)) continue;
      locales.add(OpcionFiltro(id, c['localCodigo'] as String? ?? id));
    }
    return OpcionesCalendario(locales: locales);
  } on ApiError {
    return const OpcionesCalendario();
  }
}

Future<List<OpcionFiltro>> _opciones(
  ApiClient api,
  String ruta,
  String Function(Map<String, dynamic>) etiqueta,
) async {
  try {
    final r = await api.get(
      ruta,
      query: {'page': 1, 'pageSize': 100},
    ) as Map<String, dynamic>;
    return (r['items'] as List<dynamic>)
        .cast<Map<String, dynamic>>()
        .map((j) => OpcionFiltro(j['id'] as String, etiqueta(j)))
        .toList();
  } on ApiError {
    return const [];
  }
}

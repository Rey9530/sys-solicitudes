/// Datos de prueba del calendario. Los items `real*` se capturaron del
/// backend local (`GET /calendario`, semana del 21-09-2026); el resto son
/// casos borde (títulos largos, muchos eventos en un día, medianoche).
library;

const localSol = '238f1630-89bc-4cd1-be8a-0a0066ac7dac';

Map<String, dynamic> eventoJson({
  required String id,
  required String titulo,
  required String inicio,
  String? fin,
  String color = '#10b981',
  bool todoElDia = false,
  String tipo = 'evento',
  String? solicitudId,
  String? codigo,
  String? estado = 'aprobada',
  bool choque = false,
  String localCodigo = 'L-SOL-1',
}) => {
  'id': id,
  'title': titulo,
  'start': inicio,
  'end': fin,
  'color': color,
  if (todoElDia) 'allDay': true,
  'extendedProps': {
    'tipo': tipo,
    'solicitudId': ?solicitudId,
    'solicitudCodigo': ?codigo,
    'estado': ?estado,
    'localId': localSol,
    'localCodigo': localCodigo,
    'inquilinoId': '00000000-0000-0000-0000-000000000001',
    if (choque) 'choque': true,
  },
};

/// Evento aprobado real: 15:42–17:42 hora plaza (21:42Z), con choque.
final realEvento16 = {
  'id': 'evt-a0251907-3bf5-4114-aa20-f540534adcde',
  'title': 'SOL-DEMO-16 · E2E-CAL-1790278212016',
  'start': '2026-09-27T21:42:00.000Z',
  'end': '2026-09-27T23:42:00.000Z',
  'color': '#10b981',
  'extendedProps': {
    'tipo': 'evento',
    'solicitudId': 'c409cfdf-b1b6-48fa-bb59-62157643f417',
    'solicitudCodigo': 'SOL-DEMO-16',
    'estado': 'aprobada',
    'localId': localSol,
    'localCodigo': 'L-SOL-1',
    'inquilinoId': '00000000-0000-0000-0000-000000000001',
    'choque': true,
  },
};

/// Mantenimiento real de día completo (fin exclusivo: 1 y 2 de octubre).
final realMantenimiento = {
  'id': 'mnt-238f1630-89bc-4cd1-be8a-0a0066ac7dac',
  'title': 'SOL-DEMO-89 · Mantenimiento · L-SOL-1',
  'start': '2026-10-01',
  'end': '2026-10-03',
  'color': '#f59e0b',
  'allDay': true,
  'extendedProps': {
    'tipo': 'mantenimiento',
    'localId': localSol,
    'localCodigo': 'L-SOL-1',
    'solicitudId': '166fb1b6-6c9a-4251-9f2a-ac9fda997c5e',
    'solicitudCodigo': 'SOL-DEMO-89',
    'estado': 'cerrada',
  },
};

/// Item `solicitud` real (asignada, prioridad B) a la misma hora.
final realSolicitud18 = {
  'id': 'sol-bab27fbd-f1e3-4c7a-b257-2e005de61d7d',
  'title': 'SOL-DEMO-18 · E2E-CAL-1790278332809',
  'start': '2026-09-27T21:42:00.000Z',
  'end': '2026-09-27T23:42:00.000Z',
  'color': '#6366f1',
  'extendedProps': {
    'tipo': 'solicitud',
    'solicitudId': 'bab27fbd-f1e3-4c7a-b257-2e005de61d7d',
    'solicitudCodigo': 'SOL-DEMO-18',
    'estado': 'asignado',
    'prioridad': 'B',
    'localId': localSol,
    'localCodigo': 'L-SOL-1',
    'inquilinoId': '00000000-0000-0000-0000-000000000001',
  },
};

const tituloLargo =
    'Lanzamiento de temporada con desfile, música en vivo, degustaciones y '
    'activaciones de marca en el pasillo central del primer nivel';

/// Feed de la semana del 21 al 27 de septiembre de 2026 con muchos eventos
/// el domingo 27 (como la base local), textos largos y el mantenimiento del
/// 1–2 de octubre (visible en la rejilla del mes).
List<Map<String, dynamic>> feedSemana() => [
  realEvento16,
  realMantenimiento,
  for (var i = 17; i <= 23; i++)
    if (i != 18)
      eventoJson(
        id: 'evt-0000000$i',
        titulo: 'SOL-DEMO-$i · E2E-CAL-17902782$i',
        inicio: '2026-09-27T21:42:00.000Z',
        fin: '2026-09-27T23:42:00.000Z',
        solicitudId: 'sol-id-$i',
        codigo: 'SOL-DEMO-$i',
        choque: true,
      ),
  realSolicitud18,
  eventoJson(
    id: 'evt-cerrado',
    titulo: 'SOL-carga-qa-1234 · $tituloLargo',
    inicio: '2026-09-24T16:00:00.000Z',
    fin: '2026-09-24T17:00:00.000Z',
    color: '#10b981',
    solicitudId: 'sol-cerrada',
    codigo: 'SOL-carga-qa-1234',
    estado: 'cerrada',
    localCodigo: 'L-SOL-1-ANEXO-PLANTA-ALTA-PASILLO-NORTE',
  ),
  eventoJson(
    id: 'cto-1',
    titulo:
        'Vence contrato · L-SOL-1 (Inversiones y Comercializadora del '
        'Pacífico Centroamericano S.A. de C.V.)',
    inicio: '2026-09-23',
    color: '#8b5cf6',
    todoElDia: true,
    tipo: 'hito_contrato',
    estado: null,
  ),
];

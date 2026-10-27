import '../../helpers/api_falsa.dart';

/// Datos de prueba del dashboard (forma real capturada del backend local).

const tituloLargoDashboard =
    'Remodelación integral del local L-SOL-1 con cambio de piso, cielo falso, '
    'iluminación y fachada; incluye trabajos nocturnos y retiro de ripio';

/// KPIs con la forma real de `GET /reportes/kpis` (capturada del backend).
Map<String, Object?> kpisFalsos() => {
  'pendientes': 23,
  'aprobadasHoy': 17,
  'rechazadasHoy': 0,
  'eventosProximos7d': 12,
  'contratosPorVencer30d': 1234,
  'tasaAprobacion': 0.87,
  'tiempoMedioRespuestaHoras': 12.5,
  'solicitudesConSubsanacion': 19,
  'top5Antiguedad': [
    {
      'id': 's-1',
      'codigo': 'SOL-carga-qa-1234',
      'titulo': tituloLargoDashboard,
      'enviadaAt': '2026-08-11T18:58:48.224Z',
    },
    {
      'id': 's-2',
      'codigo': 'SOL-DEMO-3',
      'titulo': 'Fuga &amp; goteo',
      'enviadaAt': '2026-08-11T19:00:09.956Z',
    },
  ],
};

/// Gráficas con la forma real de `GET /reportes/dashboard`.
Map<String, Object?> graficasFalsas() => {
  'tendenciaMensual': [
    {'mes': '2026-08', 'asignado': 2, 'cerrada': 1},
    {
      'mes': '2026-09',
      'aprobada': 18,
      'asignado': 11,
      'borrador': 32,
      'cancelada': 8,
      'cerrada': 16,
      'en_revision': 5,
      'rechazada': 8,
      'requerida_subsanacion': 4,
    },
    {'mes': '2026-10', 'aprobada': 7, 'borrador': 5, 'pausada': 1},
  ],
  'porTipo': [
    {'tipo': 'evento', 'total': 50},
    {'tipo': 'mantenimiento', 'total': 25},
    {'tipo': 'remodelacion', 'total': 24},
    {'tipo': 'otro', 'total': 43},
  ],
  'porPrioridad': [
    {'prioridad': 'A', 'total': 3},
    {'prioridad': 'B', 'total': 139},
    {'prioridad': 'F', 'total': 1},
  ],
  'actividadReciente': [
    {
      'id': 'h1',
      'solicitudId': 's-1',
      'solicitudCodigo': 'SOL-carga-qa-1234',
      'evento': 'requerida_subsanacion',
      'usuario': 'María José de los Ángeles Pérez Hernández',
      'createdAt': '2026-10-27T19:49:16.930Z',
    },
    {
      'id': 'h2',
      'solicitudId': 's-2',
      'solicitudCodigo': 'SOL-DEMO-3',
      'evento': 'creada',
      'usuario': null,
      'createdAt': '2026-10-27T19:49:16.914Z',
    },
  ],
};

Map<String, ManejadorFalso> rutasDashboard() => {
  'GET /reportes/kpis': (_) => kpisFalsos(),
  'GET /reportes/dashboard': (_) => graficasFalsas(),
};

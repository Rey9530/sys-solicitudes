import '../superadmin/plazas_modelos.dart';

/// Configuración de la plaza (`Configuracion` de `GET /configuracion`).
class ConfiguracionPlaza {
  const ConfiguracionPlaza({
    required this.tamanioMaxArchivoMb,
    required this.mimeTypesPermitidos,
    required this.slaDiasPorTipo,
    required this.slaMultiplicadorPorPrioridad,
    required this.calendarMostrarHitosContrato,
  });

  factory ConfiguracionPlaza.fromJson(Map<String, dynamic> j) {
    Map<String, double> numeros(String k) => {
      for (final e in (j[k] as Map<String, dynamic>? ?? const {}).entries)
        e.key: (e.value as num?)?.toDouble() ?? 0,
    };
    return ConfiguracionPlaza(
      tamanioMaxArchivoMb: (j['tamanioMaxArchivoMb'] as num?)?.toInt() ?? 50,
      mimeTypesPermitidos: (j['mimeTypesPermitidos'] as List<dynamic>? ?? [])
          .cast<String>(),
      slaDiasPorTipo: numeros('slaDiasPorTipo'),
      slaMultiplicadorPorPrioridad: numeros('slaMultiplicadorPorPrioridad'),
      calendarMostrarHitosContrato:
          j['calendarMostrarHitosContrato'] as bool? ?? true,
    );
  }

  final int tamanioMaxArchivoMb;
  final List<String> mimeTypesPermitidos;
  final Map<String, double> slaDiasPorTipo;
  final Map<String, double> slaMultiplicadorPorPrioridad;
  final bool calendarMostrarHitosContrato;
}

/// Plaza + su configuración (se piden en paralelo).
class DatosConfiguracion {
  const DatosConfiguracion({required this.plaza, required this.configuracion});

  final Plaza plaza;
  final ConfiguracionPlaza configuracion;
}

/// Tipos de archivo configurables (`MIME_PERMITIDOS_DEFAULT` con la etiqueta
/// de `MIME_INFO`). El alias legacy `application/acad` no es seleccionable.
const mimesConfigurables = <(String, String)>[
  ('application/pdf', 'PDF'),
  ('image/jpeg', 'JPG'),
  ('image/png', 'PNG'),
  ('image/webp', 'WebP'),
  ('application/vnd.ms-excel', 'XLS'),
  ('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'XLSX'),
  (
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'DOCX',
  ),
  ('application/dwg', 'DWG'),
  ('video/mp4', 'MP4'),
  ('video/quicktime', 'MOV'),
  ('video/webm', 'WebM'),
];

/// Tipos base de solicitud con SLA propio.
const tiposSla = ['mantenimiento', 'evento', 'remodelacion', 'otro'];

/// Prioridades (enum real `A | B | C | D | F`).
const prioridadesSla = ['A', 'B', 'C', 'D', 'F'];

import '../contratos/contratos_modelos.dart';

/// Estados de local (`LocalEstadoSchema`), en el orden del filtro del web.
const estadosLocal = [
  'disponible',
  'alquilado',
  'en_mantenimiento',
  'fuera_de_servicio',
];

/// Estados que se pueden elegir a mano sin contrato vigente: `alquilado` solo
/// lo pone el flujo de contratos.
const estadosLocalSinContrato = [
  'disponible',
  'en_mantenimiento',
  'fuera_de_servicio',
];

/// El web muestra el estado crudo en los selects: `en_mantenimiento` →
/// `en mantenimiento`.
String estadoLocalCrudo(String estado) => estado.replaceAll('_', ' ');

/// Filtros del listado de locales (`/admin/locales`).
typedef FiltroLocales = ({
  int pagina,
  String? estado,
  String? modulo,
  String? nivel,
});

/// Local (`LocalOutput`).
class Local {
  const Local({
    required this.id,
    required this.codigo,
    required this.estado,
    required this.createdAt,
    required this.updatedAt,
    this.modulo,
    this.nivel,
    this.areaM2,
    this.medidorEnergia,
    this.medidorAgua,
  });

  factory Local.fromJson(Map<String, dynamic> j) => Local(
    id: j['id'] as String,
    codigo: j['codigo'] as String? ?? '',
    modulo: j['modulo'] as String?,
    nivel: j['nivel'] as String?,
    areaM2: (j['areaM2'] as num?)?.toDouble(),
    medidorEnergia: j['medidorEnergia'] as String?,
    medidorAgua: j['medidorAgua'] as String?,
    estado: j['estado'] as String? ?? 'disponible',
    createdAt: j['createdAt'] as String? ?? '',
    updatedAt: j['updatedAt'] as String? ?? '',
  );

  final String id;

  /// Código inmutable (`K-29`, `L-101`).
  final String codigo;
  final String? modulo;
  final String? nivel;
  final double? areaM2;
  final String? medidorEnergia;
  final String? medidorAgua;

  /// `disponible | alquilado | en_mantenimiento | fuera_de_servicio`
  final String estado;
  final String createdAt;
  final String updatedAt;
}

/// Detalle de local (`LocalDetailOutput`): contrato vigente e histórico
/// (vigente → finalizado → cancelado).
class LocalDetalle {
  const LocalDetalle({
    required this.local,
    required this.contratoVigente,
    required this.historicoContratos,
  });

  factory LocalDetalle.fromJson(Map<String, dynamic> j) => LocalDetalle(
    local: Local.fromJson(j),
    contratoVigente: j['contratoVigente'] is Map<String, dynamic>
        ? Contrato.fromJson(j['contratoVigente'] as Map<String, dynamic>)
        : null,
    historicoContratos: [
      for (final c in j['historicoContratos'] as List? ?? const [])
        Contrato.fromJson(c as Map<String, dynamic>),
    ],
  );

  final Local local;
  final Contrato? contratoVigente;
  final List<Contrato> historicoContratos;
}

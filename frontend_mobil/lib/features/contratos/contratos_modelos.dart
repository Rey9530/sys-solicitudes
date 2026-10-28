import '../../core/format/texto.dart';

/// Estados de contrato, en el orden del filtro del web (que muestra el valor
/// crudo).
const estadosContrato = ['vigente', 'finalizado', 'cancelado'];

/// Filtros del listado de contratos (`/admin/contratos`). Un record tiene
/// igualdad por valor, así que sirve de clave del provider.
typedef FiltroContratos = ({
  int pagina,
  String? localId,
  String? inquilinoId,
  String? estado,
});

/// Contrato (`ContratoOutput`, `ContratoListItem` o `ContratoDetailOutput`).
/// Las fechas civiles son `YYYY-MM-DD`; `createdAt` es un instante ISO.
class Contrato {
  const Contrato({
    required this.id,
    required this.localId,
    required this.inquilinoId,
    required this.fechaInicio,
    required this.moneda,
    required this.estado,
    required this.createdAt,
    this.fechaFin,
    this.montoMensual,
    this.condiciones,
    this.fechaFinEfectiva,
    this.motivoFin,
    this.plazoMeses,
    this.areaMt2MedicionReal,
    this.cuotaArrendamiento,
    this.cuotaCam,
    this.depositoGarantia,
    this.fechaPagoDeposito,
    this.fechaEntregaLocal,
    this.periodoGraciaDias,
    this.inicioOperaciones,
    this.avisoTerminacion,
    this.condicionesIncrementoCanon,
    this.localCodigo,
    this.inquilinoRazonSocial,
    this.enVentanaT30 = false,
    this.enVentanaT7 = false,
  });

  factory Contrato.fromJson(Map<String, dynamic> j) => Contrato(
    id: j['id'] as String,
    localId: j['localId'] as String? ?? '',
    inquilinoId: j['inquilinoId'] as String? ?? '',
    fechaInicio: j['fechaInicio'] as String? ?? '',
    fechaFin: j['fechaFin'] as String?,
    montoMensual: _numero(j['montoMensual']),
    moneda: j['moneda'] as String? ?? 'USD',
    condiciones: _texto(j['condiciones']),
    estado: j['estado'] as String? ?? 'vigente',
    fechaFinEfectiva: j['fechaFinEfectiva'] as String?,
    motivoFin: _texto(j['motivoFin']),
    plazoMeses: _numero(j['plazoMeses'])?.toInt(),
    areaMt2MedicionReal: _numero(j['areaMt2MedicionReal']),
    cuotaArrendamiento: _numero(j['cuotaArrendamiento']),
    cuotaCam: _numero(j['cuotaCam']),
    depositoGarantia: _numero(j['depositoGarantia']),
    fechaPagoDeposito: j['fechaPagoDeposito'] as String?,
    fechaEntregaLocal: j['fechaEntregaLocal'] as String?,
    periodoGraciaDias: _numero(j['periodoGraciaDias'])?.toInt(),
    inicioOperaciones: j['inicioOperaciones'] as String?,
    avisoTerminacion: j['avisoTerminacion'] as String?,
    condicionesIncrementoCanon: _texto(j['condicionesIncrementoCanon']),
    createdAt: j['createdAt'] as String? ?? '',
    localCodigo: j['localCodigo'] as String?,
    inquilinoRazonSocial: _texto(j['inquilinoRazonSocial']),
    enVentanaT30: j['enVentanaT30'] as bool? ?? false,
    enVentanaT7: j['enVentanaT7'] as bool? ?? false,
  );

  final String id;
  final String localId;
  final String inquilinoId;
  final String fechaInicio;

  /// `null` = indefinido.
  final String? fechaFin;
  final double? montoMensual;

  /// ISO 4217 (`USD`).
  final String moneda;
  final String? condiciones;

  /// `vigente | finalizado | cancelado`
  final String estado;
  final String? fechaFinEfectiva;
  final String? motivoFin;

  // Términos de la plantilla Excel (todos opcionales).
  final int? plazoMeses;
  final double? areaMt2MedicionReal;
  final double? cuotaArrendamiento;
  final double? cuotaCam;
  final double? depositoGarantia;
  final String? fechaPagoDeposito;
  final String? fechaEntregaLocal;
  final int? periodoGraciaDias;
  final String? inicioOperaciones;
  final String? avisoTerminacion;
  final String? condicionesIncrementoCanon;
  final String createdAt;

  // Solo en listados y detalle.
  final String? localCodigo;
  final String? inquilinoRazonSocial;

  // Solo en el detalle: vence en 8..30 días / 0..7 días.
  final bool enVentanaT30;
  final bool enVentanaT7;

  bool get vigente => estado == 'vigente';

  /// Totales derivados del web (no se guardan): área × canon, área × CAM y
  /// su suma.
  double get totalCanon =>
      (areaMt2MedicionReal ?? 0) * (cuotaArrendamiento ?? 0);
  double get totalCam => (areaMt2MedicionReal ?? 0) * (cuotaCam ?? 0);
  double get total => totalCanon + totalCam;
}

/// Monto mensual de un contrato nuevo: `área × canon + área × CAM`,
/// redondeado a 2 decimales (igual que `NuevoContratoForm` del web).
double montoCalculado({
  required double area,
  required double canon,
  required double cam,
}) => ((area * canon + area * cam) * 100).round() / 100;

// ─────────────────────────────────────────────────────────────────────────────
// Carga inicial desde Excel (`CargaInicialResultado`)

/// Resultado de analizar (`modo: analisis`) o ejecutar (`modo: ejecucion`) la
/// carga inicial. El análisis no guarda nada.
class ResultadoAnalisisCarga {
  const ResultadoAnalisisCarga({
    required this.modo,
    required this.archivo,
    required this.hoja,
    required this.columnasFaltantes,
    required this.filasEjemplo,
    required this.totales,
    required this.filas,
  });

  factory ResultadoAnalisisCarga.fromJson(Map<String, dynamic> j) =>
      ResultadoAnalisisCarga(
        modo: j['modo'] as String? ?? 'analisis',
        archivo: j['archivo'] as String? ?? '',
        hoja: j['hoja'] as String? ?? '',
        columnasFaltantes: [
          for (final c in j['columnasFaltantes'] as List? ?? const []) '$c',
        ],
        filasEjemplo: [
          for (final f in j['filasEjemplo'] as List? ?? const [])
            (f as num).toInt(),
        ],
        totales: TotalesCarga.fromJson(
          j['totales'] as Map<String, dynamic>? ?? const {},
        ),
        filas: [
          for (final f in j['filas'] as List? ?? const [])
            FilaCarga.fromJson(f as Map<String, dynamic>),
        ],
      );

  final String modo;
  final String archivo;
  final String hoja;
  final List<String> columnasFaltantes;
  final List<int> filasEjemplo;
  final TotalesCarga totales;
  final List<FilaCarga> filas;

  bool get ejecutado => modo == 'ejecucion';

  /// "Importar" se deshabilita si no hay nada que crear.
  bool get nadaQueCrear =>
      totales.localesCrear + totales.inquilinosCrear + totales.contratosCrear ==
      0;
}

class TotalesCarga {
  const TotalesCarga({
    required this.filas,
    required this.filasConAdvertencia,
    required this.filasConError,
    required this.localesCrear,
    required this.localesExistentes,
    required this.inquilinosCrear,
    required this.inquilinosExistentes,
    required this.contratosCrear,
    required this.contratosExistentes,
    required this.contratosOmitidos,
  });

  factory TotalesCarga.fromJson(Map<String, dynamic> j) {
    int n(Object? v) => (v as num?)?.toInt() ?? 0;
    Map<String, dynamic> m(String k) =>
        j[k] as Map<String, dynamic>? ?? const {};
    return TotalesCarga(
      filas: n(j['filas']),
      filasConAdvertencia: n(j['filasConAdvertencia']),
      filasConError: n(j['filasConError']),
      localesCrear: n(m('locales')['crear']),
      localesExistentes: n(m('locales')['existentes']),
      inquilinosCrear: n(m('inquilinos')['crear']),
      inquilinosExistentes: n(m('inquilinos')['existentes']),
      contratosCrear: n(m('contratos')['crear']),
      contratosExistentes: n(m('contratos')['existentes']),
      contratosOmitidos: n(m('contratos')['omitidos']),
    );
  }

  final int filas;
  final int filasConAdvertencia;
  final int filasConError;
  final int localesCrear;
  final int localesExistentes;
  final int inquilinosCrear;
  final int inquilinosExistentes;
  final int contratosCrear;
  final int contratosExistentes;
  final int contratosOmitidos;
}

/// Local o inquilino de una fila: qué se hará con él y su nombre.
class EntidadCarga {
  const EntidadCarga({
    required this.accion,
    required this.nombre,
    this.filaOrigen,
  });

  /// `crear | existente | repetido | omitido`
  final String accion;

  /// Código del local o razón social del inquilino.
  final String nombre;

  /// Fila que ya lo introdujo (acción `repetido`).
  final int? filaOrigen;
}

class ContratoCarga {
  const ContratoCarga({
    required this.accion,
    this.fechaInicio,
    this.montoMensual,
  });

  final String accion;
  final String? fechaInicio;
  final double? montoMensual;
}

class MensajeCarga {
  const MensajeCarga(this.nivel, this.texto);

  /// `advertencia | info`
  final String nivel;
  final String texto;
}

/// Una fila del Excel (número 1-based como en Excel).
class FilaCarga {
  const FilaCarga({
    required this.fila,
    required this.estado,
    required this.mensajes,
    this.local,
    this.inquilino,
    this.contrato,
  });

  factory FilaCarga.fromJson(Map<String, dynamic> j) {
    EntidadCarga? entidad(Object? v, String clave) {
      if (v is! Map<String, dynamic>) return null;
      return EntidadCarga(
        accion: v['accion'] as String? ?? 'omitido',
        nombre: decodificarHtml(v[clave] as String?),
        filaOrigen: (v['filaOrigen'] as num?)?.toInt(),
      );
    }

    final c = j['contrato'];
    return FilaCarga(
      fila: (j['fila'] as num?)?.toInt() ?? 0,
      local: entidad(j['local'], 'codigo'),
      inquilino: entidad(j['inquilino'], 'razonSocial'),
      contrato: c is Map<String, dynamic>
          ? ContratoCarga(
              accion: c['accion'] as String? ?? 'omitido',
              fechaInicio: c['fechaInicio'] as String?,
              montoMensual: _numero(c['montoMensual']),
            )
          : null,
      estado: j['estado'] as String? ?? 'ok',
      mensajes: [
        for (final m in j['mensajes'] as List? ?? const [])
          MensajeCarga(
            (m as Map<String, dynamic>)['nivel'] as String? ?? 'info',
            decodificarHtml(m['texto'] as String?),
          ),
      ],
    );
  }

  final int fila;
  final EntidadCarga? local;
  final EntidadCarga? inquilino;
  final ContratoCarga? contrato;

  /// `ok | advertencia | error`
  final String estado;
  final List<MensajeCarga> mensajes;
}

double? _numero(Object? v) => switch (v) {
  final num n => n.toDouble(),
  final String s => double.tryParse(s),
  _ => null,
};

String? _texto(Object? v) => v is String ? decodificarHtml(v) : null;

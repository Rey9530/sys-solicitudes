import '../../core/adjuntos/adjuntos.dart';
import '../../core/format/texto.dart';

/// Estados que ya no admiten transiciones. `aprobada` NO es terminal: queda
/// pendiente de cierre por el admin asignado.
const estadosTerminales = {'cerrada', 'rechazada', 'cancelada'};

/// Etiquetas de los tipos base (la plaza puede renombrarlos en su catálogo).
const etiquetaTipoSolicitud = <String, String>{
  'mantenimiento': 'Mantenimiento',
  'evento': 'Evento',
  'remodelacion': 'Remodelación',
  'otro': 'Otro',
};

/// Referencia mínima a un usuario (creador, asignado, comentarista).
class UsuarioRef {
  const UsuarioRef({
    required this.id,
    required this.nombre,
    required this.email,
  });

  static UsuarioRef? fromJson(Object? j) {
    if (j is! Map<String, dynamic>) return null;
    return UsuarioRef(
      id: j['id'] as String,
      nombre: decodificarHtml(j['nombre'] as String?),
      email: j['email'] as String? ?? '',
    );
  }

  final String id;
  final String nombre;
  final String email;
}

/// Solicitud en listados (`SolicitudListItem`). También es la respuesta de las
/// transiciones (`SolicitudOutput`), con los campos de listado en null.
class SolicitudItem {
  const SolicitudItem({
    required this.id,
    required this.plazaId,
    required this.localId,
    required this.inquilinoId,
    required this.usuarioCreadorId,
    required this.codigo,
    required this.tipo,
    required this.prioridad,
    required this.titulo,
    required this.descripcion,
    required this.estado,
    required this.camposExtra,
    required this.empresaNombre,
    required this.empresaResponsable,
    required this.empresaTelefono,
    required this.empresaEmail,
    required this.emergenciaContacto,
    required this.emergenciaTelefono,
    required this.esEmergencia,
    required this.createdAt,
    required this.updatedAt,
    this.adminAsignadoId,
    this.categoriaId,
    this.subcategoriaId,
    this.fechaEventoInicio,
    this.fechaEventoFin,
    this.horaInicio,
    this.horaFin,
    this.enviadaAt,
    this.asignadaAt,
    this.decisionAt,
    this.resultadoCierre,
    this.cierreComentario,
    this.cerradaAt,
    this.localCodigo,
    this.categoriaNombre,
    this.subcategoriaNombre,
    this.adminAsignado,
    this.slaStatus,
    this.plazaNombre,
  });

  factory SolicitudItem.fromJson(Map<String, dynamic> j) => SolicitudItem(
    id: j['id'] as String,
    plazaId: j['plazaId'] as String? ?? '',
    localId: j['localId'] as String? ?? '',
    inquilinoId: j['inquilinoId'] as String? ?? '',
    usuarioCreadorId: j['usuarioCreadorId'] as String? ?? '',
    adminAsignadoId: j['adminAsignadoId'] as String?,
    categoriaId: j['categoriaId'] as String?,
    subcategoriaId: j['subcategoriaId'] as String?,
    codigo: j['codigo'] as String? ?? '',
    tipo: j['tipo'] as String? ?? 'otro',
    prioridad: j['prioridad'] as String? ?? 'B',
    titulo: decodificarHtml(j['titulo'] as String?),
    descripcion: decodificarHtml(j['descripcion'] as String?),
    estado: j['estado'] as String? ?? 'borrador',
    camposExtra: (j['camposExtra'] as Map<String, dynamic>?) ?? const {},
    fechaEventoInicio: j['fechaEventoInicio'] as String?,
    fechaEventoFin: j['fechaEventoFin'] as String?,
    horaInicio: j['horaInicio'] as String?,
    horaFin: j['horaFin'] as String?,
    empresaNombre: decodificarHtml(j['empresaNombre'] as String?),
    empresaResponsable: decodificarHtml(j['empresaResponsable'] as String?),
    empresaTelefono: j['empresaTelefono'] as String? ?? '',
    empresaEmail: j['empresaEmail'] as String? ?? '',
    emergenciaContacto: decodificarHtml(j['emergenciaContacto'] as String?),
    emergenciaTelefono: j['emergenciaTelefono'] as String? ?? '',
    esEmergencia: j['esEmergencia'] as bool? ?? false,
    enviadaAt: j['enviadaAt'] as String?,
    asignadaAt: j['asignadaAt'] as String?,
    decisionAt: j['decisionAt'] as String?,
    resultadoCierre: j['resultadoCierre'] as String?,
    cierreComentario: decodificarHtml(j['cierreComentario'] as String?),
    cerradaAt: j['cerradaAt'] as String?,
    createdAt: j['createdAt'] as String? ?? '',
    updatedAt: j['updatedAt'] as String? ?? '',
    localCodigo: j['localCodigo'] as String?,
    categoriaNombre: _textoONull(j['categoriaNombre']),
    subcategoriaNombre: _textoONull(j['subcategoriaNombre']),
    adminAsignado: UsuarioRef.fromJson(j['adminAsignado']),
    slaStatus: j['slaStatus'] as String?,
    plazaNombre: _textoONull(
      (j['plaza'] as Map<String, dynamic>?)?['nombreComercial'],
    ),
  );

  final String id;
  final String plazaId;
  final String localId;
  final String inquilinoId;
  final String usuarioCreadorId;
  final String? adminAsignadoId;
  final String? categoriaId;
  final String? subcategoriaId;

  /// `SOL-…`
  final String codigo;

  /// `mantenimiento | evento | remodelacion | otro`
  final String tipo;

  /// `A | B | C | D | F`
  final String prioridad;
  final String titulo;
  final String descripcion;
  final String estado;
  final Map<String, dynamic> camposExtra;

  /// Fechas civiles `YYYY-MM-DD` y horas `HH:mm` (24 h) en hora de la plaza.
  final String? fechaEventoInicio;
  final String? fechaEventoFin;
  final String? horaInicio;
  final String? horaFin;
  final String empresaNombre;
  final String empresaResponsable;
  final String empresaTelefono;
  final String empresaEmail;
  final String emergenciaContacto;
  final String emergenciaTelefono;
  final bool esEmergencia;

  /// Instantes ISO-8601 UTC.
  final String? enviadaAt;
  final String? asignadaAt;
  final String? decisionAt;

  /// `exitoso | parcial | fallido | no_realizado`
  final String? resultadoCierre;
  final String? cierreComentario;
  final String? cerradaAt;
  final String createdAt;
  final String updatedAt;

  // Solo en listados.
  final String? localCodigo;
  final String? categoriaNombre;
  final String? subcategoriaNombre;
  final UsuarioRef? adminAsignado;

  /// `verde | amarillo | rojo | null` (solo la bandeja del admin lo calcula).
  final String? slaStatus;

  /// Solo en la vista global del superadmin (`plaza.nombreComercial`).
  final String? plazaNombre;

  bool get esTerminal => estadosTerminales.contains(estado);
}

/// Comentario de una solicitud.
class Comentario {
  const Comentario({
    required this.id,
    required this.tipo,
    required this.cuerpo,
    required this.createdAt,
    this.usuario,
  });

  factory Comentario.fromJson(Map<String, dynamic> j) => Comentario(
    id: j['id'] as String,
    usuario: UsuarioRef.fromJson(j['usuario']),
    tipo: j['tipo'] as String? ?? 'general',
    cuerpo: decodificarHtml(j['cuerpo'] as String?),
    createdAt: j['createdAt'] as String? ?? '',
  );

  final String id;
  final UsuarioRef? usuario;

  /// `decision | subsanacion | general`
  final String tipo;
  final String cuerpo;
  final String createdAt;
}

/// Entrada del historial (append-only). `usuario` null = sistema/cron.
class HistorialItem {
  const HistorialItem({
    required this.id,
    required this.evento,
    required this.createdAt,
    this.usuario,
    this.estadoAnterior,
    this.estadoNuevo,
    this.comentario,
  });

  factory HistorialItem.fromJson(Map<String, dynamic> j) => HistorialItem(
    id: j['id'] as String,
    usuario: UsuarioRef.fromJson(j['usuario']),
    evento: j['evento'] as String? ?? '',
    estadoAnterior: j['estadoAnterior'] as String?,
    estadoNuevo: j['estadoNuevo'] as String?,
    comentario: _textoONull(j['comentario']),
    createdAt: j['createdAt'] as String? ?? '',
  );

  final String id;
  final UsuarioRef? usuario;
  final String evento;
  final String? estadoAnterior;
  final String? estadoNuevo;
  final String? comentario;
  final String createdAt;
}

/// Detalle completo (`SolicitudDetailOutput`).
class SolicitudDetalle {
  const SolicitudDetalle({
    required this.solicitud,
    required this.adjuntos,
    required this.comentarios,
    required this.historial,
    this.inquilinoRazonSocial,
    this.usuarioCreador,
  });

  factory SolicitudDetalle.fromJson(Map<String, dynamic> j) => SolicitudDetalle(
    solicitud: SolicitudItem.fromJson(j),
    inquilinoRazonSocial: _textoONull(j['inquilinoRazonSocial']),
    usuarioCreador: UsuarioRef.fromJson(j['usuarioCreador']),
    adjuntos: _lista(j['adjuntos'], Adjunto.fromJson),
    comentarios: _lista(j['comentarios'], Comentario.fromJson),
    historial: _lista(j['historial'], HistorialItem.fromJson),
  );

  final SolicitudItem solicitud;
  final String? inquilinoRazonSocial;
  final UsuarioRef? usuarioCreador;

  /// Más reciente primero.
  final List<Adjunto> adjuntos;

  /// Más antiguo primero.
  final List<Comentario> comentarios;

  /// Más antiguo primero.
  final List<HistorialItem> historial;
}

String? _textoONull(Object? v) => v is String ? decodificarHtml(v) : null;

List<T> _lista<T>(Object? v, T Function(Map<String, dynamic>) item) =>
    (v as List<dynamic>? ?? const [])
        .cast<Map<String, dynamic>>()
        .map(item)
        .toList();

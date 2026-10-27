import '../../core/format/texto.dart';

/// Entrada del log de auditoría (`AuditoriaOutput`).
class RegistroAuditoria {
  const RegistroAuditoria({
    required this.id,
    required this.accion,
    required this.entidadTipo,
    required this.createdAt,
    this.plazaId,
    this.usuarioId,
    this.usuarioNombre,
    this.usuarioEmail,
    this.entidadId,
    this.antes,
    this.despues,
    this.ip,
    this.userAgent,
    this.requestId,
  });

  factory RegistroAuditoria.fromJson(Map<String, dynamic> j) {
    final usuario = j['usuario'] as Map<String, dynamic>?;
    return RegistroAuditoria(
      id: j['id'] as String,
      accion: j['accion'] as String? ?? '',
      entidadTipo: j['entidadTipo'] as String? ?? '',
      createdAt: j['createdAt'] as String? ?? '',
      plazaId: j['plazaId'] as String?,
      usuarioId: j['usuarioId'] as String?,
      usuarioNombre: usuario == null
          ? null
          : decodificarHtml(usuario['nombre'] as String?),
      usuarioEmail: usuario?['email'] as String?,
      entidadId: j['entidadId'] as String?,
      antes: j['antes'],
      despues: j['despues'],
      ip: j['ip'] as String?,
      userAgent: j['userAgent'] as String?,
      requestId: j['requestId'] as String?,
    );
  }

  final String id;
  final String accion;
  final String entidadTipo;
  final String createdAt;
  final String? plazaId;
  final String? usuarioId;

  /// `null` = usuario eliminado o acción del sistema.
  final String? usuarioNombre;
  final String? usuarioEmail;
  final String? entidadId;

  /// Payload persistido (JSON arbitrario) o `null`.
  final Object? antes;
  final Object? despues;
  final String? ip;
  final String? userAgent;
  final String? requestId;
}

/// Filtros de la lista (vacío = sin filtro).
typedef FiltrosAuditoria = ({
  int pagina,
  String? accion,
  String? entidadTipo,
  String? desde,
  String? hasta,
});

/// Tipos de entidad del filtro (los mismos del web).
const tiposEntidadAuditoria = [
  'local',
  'inquilino',
  'contrato',
  'solicitud',
  'categoria',
  'subcategoria',
  'usuario',
  'adjunto',
  'plaza',
  'configuracion',
];

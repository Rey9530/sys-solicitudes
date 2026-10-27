import '../../core/format/texto.dart';

/// Notificación in-app de la campana (`NotificacionOutput`).
class NotificacionInApp {
  const NotificacionInApp({
    required this.id,
    required this.tipo,
    required this.titulo,
    required this.mensaje,
    required this.leida,
    required this.createdAt,
    this.solicitudId,
    this.contratoId,
  });

  factory NotificacionInApp.fromJson(Map<String, dynamic> j) =>
      NotificacionInApp(
        id: j['id'] as String,
        tipo: j['tipo'] as String? ?? '',
        titulo: decodificarHtml(j['titulo'] as String?),
        mensaje: decodificarHtml(j['mensaje'] as String?),
        leida: j['leida'] as bool? ?? false,
        createdAt: j['createdAt'] as String? ?? '',
        solicitudId: j['solicitudId'] as String?,
        contratoId: j['contratoId'] as String?,
      );

  final String id;
  final String tipo;
  final String titulo;
  final String mensaje;
  final bool leida;
  final String createdAt;
  final String? solicitudId;
  final String? contratoId;
}

/// Respuesta de `GET /notificaciones/inbox`: las más recientes + no leídas.
class BandejaNotificaciones {
  const BandejaNotificaciones({required this.items, required this.noLeidas});

  factory BandejaNotificaciones.fromJson(Map<String, dynamic> j) =>
      BandejaNotificaciones(
        items: (j['items'] as List<dynamic>? ?? const [])
            .cast<Map<String, dynamic>>()
            .map(NotificacionInApp.fromJson)
            .toList(),
        noLeidas: (j['noLeidas'] as num?)?.toInt() ?? 0,
      );

  final List<NotificacionInApp> items;
  final int noLeidas;
}

/// Email del log transaccional (`EmailLogOutput`).
class EmailLog {
  const EmailLog({
    required this.id,
    required this.destinatario,
    required this.plantilla,
    required this.estado,
    required this.reintentos,
    required this.createdAt,
    this.solicitudCodigo,
    this.lastError,
    this.sentAt,
  });

  factory EmailLog.fromJson(Map<String, dynamic> j) => EmailLog(
    id: j['id'] as String,
    destinatario: j['destinatario'] as String? ?? '',
    plantilla: j['plantilla'] as String? ?? '',
    estado: j['estado'] as String? ?? '',
    reintentos: (j['reintentos'] as num?)?.toInt() ?? 0,
    createdAt: j['createdAt'] as String? ?? '',
    solicitudCodigo: j['solicitudCodigo'] as String?,
    lastError: j['lastError'] as String?,
    sentAt: j['sentAt'] as String?,
  );

  final String id;
  final String destinatario;
  final String plantilla;
  final String estado;
  final int reintentos;
  final String createdAt;
  final String? solicitudCodigo;
  final String? lastError;
  final String? sentAt;

  /// Igual que el web: solo los fallidos, nunca los de reset de contraseña.
  bool get reintentable => estado == 'fallido' && plantilla != 'reset-password';
}

/// Contenido renderizado de un email (`EmailLogPreview`).
class EmailPreview {
  const EmailPreview({required this.subject, required this.html});

  factory EmailPreview.fromJson(Map<String, dynamic> j) => EmailPreview(
    subject: decodificarHtml(j['subject'] as String?),
    html: j['html'] as String? ?? '',
  );

  final String subject;
  final String html;
}

/// Desuscripción de una plantilla (`UnsubscribeOutput`).
class Desuscripcion {
  const Desuscripcion({
    required this.id,
    required this.email,
    required this.plantilla,
    required this.createdAt,
  });

  factory Desuscripcion.fromJson(Map<String, dynamic> j) => Desuscripcion(
    id: j['id'] as String,
    email: j['email'] as String? ?? '',
    plantilla: j['plantilla'] as String? ?? '',
    createdAt: j['createdAt'] as String? ?? '',
  );

  final String id;
  final String email;
  final String plantilla;
  final String createdAt;
}

/// Filtros del log de emails (vacío = sin filtro).
typedef FiltrosEmailLog = ({
  int pagina,
  String? estado,
  String? plantilla,
  String? destinatario,
  String? desde,
  String? hasta,
});

/// Estados del log (`EmailLogEstadoSchema`).
const estadosEmailLog = ['pendiente', 'enviado', 'fallido'];

/// Plantillas del filtro (`EMAIL_PLANTILLAS` del web). Se agrega
/// `solicitud-cerrada`, que el backend envía pero el web no lista (C-R7).
const plantillasEmail = [
  'solicitud-asignada-responsable',
  'solicitud-nueva-supervisor',
  'solicitud-recibida',
  'solicitud-aprobada',
  'solicitud-rechazada',
  'solicitud-subsanacion',
  'solicitud-reasignada',
  'solicitud-cerrada',
  'reset-password',
  'bienvenida',
  'contrato-por-vencer',
];

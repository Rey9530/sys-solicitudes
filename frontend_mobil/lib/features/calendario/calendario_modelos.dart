import 'package:flutter/material.dart';

import '../../core/config.dart';
import '../../core/format/fechas.dart';
import '../../core/format/texto.dart';

/// Modelos del calendario (`CalendarioEventoOutput` del backend) y opciones
/// de los filtros. Espejo de `frontend/src/components/client/calendario/
/// calendario-view.tsx`.

/// Tipos del feed con su etiqueta y color de leyenda (fijos en el web, iguales
/// en claro y oscuro).
class TipoCalendario {
  const TipoCalendario(this.valor, this.etiqueta, this.color);

  final String valor;
  final String etiqueta;
  final Color color;
}

const tiposCalendario = <TipoCalendario>[
  TipoCalendario('evento', 'Eventos aprobados', Color(0xFF10B981)),
  TipoCalendario('mantenimiento', 'Mantenimientos', Color(0xFFF59E0B)),
  TipoCalendario('hito_contrato', 'Hitos contractuales', Color(0xFF8B5CF6)),
  TipoCalendario('solicitud', 'Solicitudes', Color(0xFFA78BFA)),
];

/// Los cuatro valores de tipo (todos marcados = no se envía `tipo`).
final todosLosTiposCalendario = {for (final t in tiposCalendario) t.valor};

/// Borde de los eventos que se solapan con otro del mismo local (web `#dc2626`).
const colorChoque = Color(0xFFDC2626);

/// Etiqueta del tipo: "Solicitudes" es "Mis solicitudes" para el inquilino.
String etiquetaTipoCalendario(String tipo, {required bool esInquilino}) {
  if (tipo == 'solicitud' && esInquilino) return 'Mis solicitudes';
  for (final t in tiposCalendario) {
    if (t.valor == tipo) return t.etiqueta;
  }
  return tipo;
}

/// Zona en la que se pintan las horas: la de la plaza (UTC−6 fija) o la del
/// dispositivo (selector "Zona horaria" del web).
///
/// Las fechas "de pared" se representan como `DateTime` en UTC cuyos campos
/// (`day`, `hour`…) se leen tal cual, igual que [aHoraPlaza].
enum ZonaCalendario {
  dispositivo('Mi zona horaria'),
  plaza('Zona de la plaza (GMT-6)');

  const ZonaCalendario(this.etiqueta);
  final String etiqueta;

  /// Instante → fecha/hora de pared en esta zona.
  DateTime aPared(DateTime instante) {
    if (this == ZonaCalendario.plaza) return aHoraPlaza(instante);
    final l = instante.toLocal();
    return DateTime.utc(l.year, l.month, l.day, l.hour, l.minute, l.second);
  }

  /// Fecha/hora de pared en esta zona → instante UTC.
  DateTime aInstante(DateTime pared) {
    if (this == ZonaCalendario.plaza) {
      return DateTime.utc(
        pared.year,
        pared.month,
        pared.day,
        pared.hour,
        pared.minute,
      ).subtract(desfasePlaza);
    }
    return DateTime(
      pared.year,
      pared.month,
      pared.day,
      pared.hour,
      pared.minute,
    ).toUtc();
  }
}

/// Un item del feed `GET /calendario`.
///
/// [inicio] y [fin] son instantes UTC. En los de día completo
/// (`allDay`, fechas `YYYY-MM-DD`) son la medianoche de la plaza y [fin] es
/// exclusivo, como en FullCalendar.
class EventoCalendario {
  const EventoCalendario({
    required this.id,
    required this.titulo,
    required this.inicio,
    required this.color,
    required this.tipo,
    this.fin,
    this.todoElDia = false,
    this.solicitudId,
    this.solicitudCodigo,
    this.localId,
    this.localCodigo,
    this.inquilinoId,
    this.contratoId,
    this.estado,
    this.prioridad,
    this.choque = false,
  });

  factory EventoCalendario.fromJson(Map<String, dynamic> j) {
    final props = (j['extendedProps'] as Map<String, dynamic>?) ?? const {};
    final todoElDia = j['allDay'] == true;
    final fin = j['end'] as String?;
    return EventoCalendario(
      id: j['id'] as String,
      titulo: decodificarHtml(j['title'] as String?),
      inicio: _instante(j['start'] as String),
      fin: fin == null ? null : _instante(fin),
      color: j['color'] as String? ?? '',
      todoElDia: todoElDia,
      tipo: props['tipo'] as String? ?? 'evento',
      solicitudId: props['solicitudId'] as String?,
      solicitudCodigo: props['solicitudCodigo'] as String?,
      localId: props['localId'] as String?,
      localCodigo: props['localCodigo'] as String?,
      inquilinoId: props['inquilinoId'] as String?,
      contratoId: props['contratoId'] as String?,
      estado: props['estado'] as String?,
      prioridad: props['prioridad'] as String?,
      choque: props['choque'] == true,
    );
  }

  final String id;
  final String titulo;
  final DateTime inicio;
  final DateTime? fin;
  final String color;
  final bool todoElDia;

  /// `evento`, `mantenimiento`, `hito_contrato` o `solicitud`.
  final String tipo;
  final String? solicitudId;
  final String? solicitudCodigo;
  final String? localId;
  final String? localCodigo;
  final String? inquilinoId;
  final String? contratoId;
  final String? estado;
  final String? prioridad;
  final bool choque;

  /// Id del `evento_calendario` para el PATCH (sin el prefijo `evt-`).
  String get eventoId => id.replaceFirst(RegExp(r'^evt-'), '');

  /// Fin efectivo: sin `end`, 1 h (con hora) o 1 día (día completo), como
  /// FullCalendar.
  DateTime get finEfectivo =>
      fin ?? inicio.add(Duration(hours: todoElDia ? 24 : 1));

  /// Solo se mueven eventos aprobados; los de solicitudes cerradas se ven pero
  /// no se reprograman.
  bool get movible => tipo == 'evento' && estado != 'cerrada';

  /// Título sin el "CODIGO · " inicial (el código se pinta aparte, en negrita).
  String get tituloSinCodigo {
    final codigo = solicitudCodigo;
    if (codigo == null || !titulo.startsWith(codigo)) return titulo;
    return titulo
        .substring(codigo.length)
        .replaceFirst(RegExp(r'^\s*·\s*'), '');
  }

  Color get colorFondo => colorDesdeHexEvento(color);

  static DateTime _instante(String valor) {
    if (RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(valor)) {
      return instanteDePlaza(valor, '00:00');
    }
    return DateTime.parse(valor).toUtc();
  }
}

/// `#RRGGBB` del feed → color (gris neutro si no es válido).
Color colorDesdeHexEvento(String hex) {
  final m = RegExp(r'^#?([0-9a-fA-F]{6})$').firstMatch(hex.trim());
  if (m == null) return const Color(0xFF6B7280);
  return Color(int.parse('FF${m[1]}', radix: 16));
}

/// Opción de un filtro con casillas (local o inquilino).
class OpcionFiltro {
  const OpcionFiltro(this.id, this.etiqueta);

  final String id;
  final String etiqueta;
}

/// Datos de los filtros de la pantalla.
class OpcionesCalendario {
  const OpcionesCalendario({
    this.locales = const [],
    this.inquilinos = const [],
    this.mostrarHitos = true,
  });

  final List<OpcionFiltro> locales;
  final List<OpcionFiltro> inquilinos;

  /// `configuracion.calendarMostrarHitosContrato` (oculta la casilla de hitos).
  final bool mostrarHitos;
}

/// Parámetros del feed (clave del provider: debe tener igualdad por valor).
@immutable
class FiltroCalendario {
  FiltroCalendario({
    required this.desde,
    required this.hasta,
    Iterable<String> locales = const [],
    Iterable<String> inquilinos = const [],
    Iterable<String>? tipos,
  }) : locales = List.unmodifiable(locales.toList()..sort()),
       inquilinos = List.unmodifiable(inquilinos.toList()..sort()),
       tipos = List.unmodifiable(
         (tipos ?? todosLosTiposCalendario).toList()..sort(),
       );

  final DateTime desde;
  final DateTime hasta;
  final List<String> locales;
  final List<String> inquilinos;
  final List<String> tipos;

  String get _clave =>
      '${desde.toIso8601String()}|${hasta.toIso8601String()}|'
      '${locales.join(',')}|${inquilinos.join(',')}|${tipos.join(',')}';

  @override
  bool operator ==(Object other) =>
      other is FiltroCalendario && other._clave == _clave;

  @override
  int get hashCode => _clave.hashCode;
}

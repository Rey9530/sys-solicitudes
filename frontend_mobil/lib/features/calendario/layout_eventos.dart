import 'dart:math' as math;

import '../../core/format/fechas.dart';
import 'calendario_modelos.dart';

/// Lógica pura del calendario (sin widgets): qué eventos caen en un día, cómo
/// se reparten en columnas cuando se solapan y fechas de la cuadrícula.
///
/// Todas las fechas "de pared" son `DateTime` en UTC cuyos campos se leen tal
/// cual (ver [aHoraPlaza]). [aPared] convierte un instante a la zona elegida
/// (por defecto la de la plaza).

const minutosDia = 24 * 60;

/// Alto mínimo (en minutos) con el que se pinta un evento corto; también se
/// usa para decidir si dos eventos se tocan visualmente.
const duracionMinimaVisual = 30;

/// Evento con hora ubicado en la rejilla de un día.
class EventoPosicionado {
  const EventoPosicionado({
    required this.evento,
    required this.inicioMin,
    required this.finMin,
    required this.columna,
    required this.totalColumnas,
    required this.grupo,
  });

  final EventoCalendario evento;

  /// Minutos desde las 00:00 del día (ya recortados al día).
  final int inicioMin;
  final int finMin;

  /// Columna (0..totalColumnas-1) dentro de su grupo de solapes.
  final int columna;
  final int totalColumnas;

  /// Índice del grupo de eventos que se solapan entre sí (transitivamente).
  final int grupo;

  /// Posición vertical en minutos desde las 00:00.
  int get top => inicioMin;

  /// Alto en minutos (mínimo [duracionMinimaVisual], sin pasar de las 24:00).
  int get alto =>
      math.min(minutosDia, math.max(finMin, inicioMin + duracionMinimaVisual)) -
      inicioMin;
}

/// `DateTime` de pared truncado al día.
DateTime soloDia(DateTime d) => DateTime.utc(d.year, d.month, d.day);

/// Lunes de la semana de [d] (el calendario en español empieza en lunes).
DateTime inicioSemana(DateTime d) =>
    soloDia(d).subtract(Duration(days: d.weekday - DateTime.monday));

/// Primer día de la cuadrícula del mes (6 semanas desde el lunes anterior o
/// igual al día 1, como FullCalendar).
DateTime inicioRejillaMes(DateTime mes) =>
    inicioSemana(DateTime.utc(mes.year, mes.month));

/// Rango de pared [inicio, fin) de un evento. Los de día completo son fechas
/// civiles de la plaza y no cambian con la zona.
(DateTime, DateTime) rangoPared(
  EventoCalendario e, {
  DateTime Function(DateTime instante) aPared = aHoraPlaza,
}) {
  final conv = e.todoElDia ? aHoraPlaza : aPared;
  return (conv(e.inicio), conv(e.finEfectivo));
}

/// ¿El evento ocupa algo del día [dia]? (rango semiabierto; un evento de
/// duración cero cuenta en el día donde empieza).
bool eventoEnDia(
  EventoCalendario e,
  DateTime dia, {
  DateTime Function(DateTime instante) aPared = aHoraPlaza,
}) {
  final inicioDia = soloDia(dia);
  final finDia = inicioDia.add(const Duration(days: 1));
  final (ini, fin) = rangoPared(e, aPared: aPared);
  if (!fin.isAfter(ini)) {
    return !ini.isBefore(inicioDia) && ini.isBefore(finDia);
  }
  return ini.isBefore(finDia) && fin.isAfter(inicioDia);
}

/// Eventos del día ordenados: primero los de día completo, luego por hora.
List<EventoCalendario> eventosDelDia(
  List<EventoCalendario> eventos,
  DateTime dia, {
  DateTime Function(DateTime instante) aPared = aHoraPlaza,
}) {
  final lista = eventos
      .where((e) => eventoEnDia(e, dia, aPared: aPared))
      .toList();
  lista.sort((a, b) {
    if (a.todoElDia != b.todoElDia) return a.todoElDia ? -1 : 1;
    final c = a.inicio.compareTo(b.inicio);
    return c != 0 ? c : a.titulo.compareTo(b.titulo);
  });
  return lista;
}

/// Eventos de día completo del día (fila superior de la rejilla).
List<EventoCalendario> eventosTodoElDia(
  List<EventoCalendario> eventos,
  DateTime dia,
) => eventosDelDia(eventos.where((e) => e.todoElDia).toList(), dia);

/// Ubica los eventos con hora de [diaPlaza] en la rejilla: `top/alto` en
/// minutos desde las 00:00 (recortados si cruzan la medianoche) y columnas
/// lado a lado para los que se solapan. Los de día completo se ignoran (van
/// en la fila superior, ver [eventosTodoElDia]).
List<EventoPosicionado> posicionarEventosDia(
  List<EventoCalendario> eventos,
  DateTime diaPlaza, {
  DateTime Function(DateTime instante) aPared = aHoraPlaza,
}) {
  final inicioDia = soloDia(diaPlaza);
  final tramos = <_Tramo>[];
  for (final e in eventos) {
    if (e.todoElDia || !eventoEnDia(e, inicioDia, aPared: aPared)) continue;
    final (ini, fin) = rangoPared(e, aPared: aPared);
    final a = math.max(0, ini.difference(inicioDia).inMinutes);
    final b = math.min(minutosDia, fin.difference(inicioDia).inMinutes);
    tramos.add(_Tramo(e, a, math.max(a, b)));
  }
  // Por inicio; a igual inicio, el más largo primero (queda a la izquierda).
  tramos.sort((x, y) {
    if (x.inicio != y.inicio) return x.inicio.compareTo(y.inicio);
    return (y.fin - y.inicio).compareTo(x.fin - x.inicio);
  });

  final resultado = <EventoPosicionado>[];
  var grupo = <_Tramo>[];
  var finColumnas = <int>[];
  var finGrupo = -1;
  var numeroGrupo = 0;

  void cerrarGrupo() {
    for (final t in grupo) {
      resultado.add(
        EventoPosicionado(
          evento: t.evento,
          inicioMin: t.inicio,
          finMin: t.fin,
          columna: t.columna,
          totalColumnas: finColumnas.length,
          grupo: numeroGrupo,
        ),
      );
    }
    grupo = [];
    finColumnas = [];
    finGrupo = -1;
    numeroGrupo++;
  }

  for (final t in tramos) {
    final finVisual = math.min(
      minutosDia,
      math.max(t.fin, t.inicio + duracionMinimaVisual),
    );
    if (grupo.isNotEmpty && t.inicio >= finGrupo) cerrarGrupo();
    var columna = finColumnas.indexWhere((fin) => fin <= t.inicio);
    if (columna == -1) {
      finColumnas.add(finVisual);
      columna = finColumnas.length - 1;
    } else {
      finColumnas[columna] = finVisual;
    }
    t.columna = columna;
    grupo.add(t);
    finGrupo = math.max(finGrupo, finVisual);
  }
  if (grupo.isNotEmpty) cerrarGrupo();
  return resultado;
}

/// ¿Un hueco [inicio, fin) (instantes) choca con un evento aprobado ya
/// cargado? Misma regla que el web antes de ofrecer "Crear solicitud de
/// evento".
bool huecoOcupado(
  List<EventoCalendario> eventos,
  DateTime inicio,
  DateTime fin,
) {
  return eventos.any((e) {
    if (e.tipo != 'evento') return false;
    final s = e.inicio;
    final f = e.fin ?? s;
    return s.isBefore(fin) && inicio.isBefore(f);
  });
}

class _Tramo {
  _Tramo(this.evento, this.inicio, this.fin);

  final EventoCalendario evento;
  final int inicio;
  final int fin;
  int columna = 0;
}

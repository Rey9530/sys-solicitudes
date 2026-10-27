import 'package:flutter_test/flutter_test.dart';
import 'package:frontend_mobil/features/calendario/calendario_api.dart';
import 'package:frontend_mobil/features/calendario/calendario_modelos.dart';
import 'package:frontend_mobil/features/calendario/layout_eventos.dart';

import 'fixtures_calendario.dart';

EventoCalendario _evento(String id, String inicio, String fin) =>
    EventoCalendario.fromJson(
      eventoJson(id: id, titulo: id, inicio: inicio, fin: fin),
    );

final _dia27 = DateTime.utc(2026, 9, 27);

void main() {
  group('posicionarEventosDia', () {
    test('dos eventos solapados van en columnas 0 y 1 de 2', () {
      // 10:00–11:00 y 10:30–12:00 hora plaza (UTC−6).
      final a = _evento('a', '2026-09-27T16:00:00Z', '2026-09-27T17:00:00Z');
      final b = _evento('b', '2026-09-27T16:30:00Z', '2026-09-27T18:00:00Z');
      final r = posicionarEventosDia([b, a], _dia27);
      expect(r, hasLength(2));
      final pa = r.firstWhere((p) => p.evento.id == 'a');
      final pb = r.firstWhere((p) => p.evento.id == 'b');
      expect((pa.columna, pa.totalColumnas), (0, 2));
      expect((pb.columna, pb.totalColumnas), (1, 2));
      expect(pa.top, 600);
      expect(pb.top, 630);
      expect(pb.alto, 90);
    });

    test('21:42Z se ubica a las 15:42 hora plaza (942 min)', () {
      final e = EventoCalendario.fromJson(realEvento16);
      final r = posicionarEventosDia([e], _dia27);
      expect(r.single.top, 942);
      expect(r.single.alto, 120);
      expect(r.single.totalColumnas, 1);
    });

    test('un evento que cruza la medianoche se recorta a cada día', () {
      // 23:00 del 26 → 02:00 del 27 (hora plaza).
      final e = _evento('m', '2026-09-27T05:00:00Z', '2026-09-27T08:00:00Z');
      final dia26 = posicionarEventosDia([e], DateTime.utc(2026, 9, 26));
      expect((dia26.single.inicioMin, dia26.single.finMin), (1380, 1440));
      final dia27 = posicionarEventosDia([e], _dia27);
      expect((dia27.single.inicioMin, dia27.single.finMin), (0, 120));
      expect(posicionarEventosDia([e], DateTime.utc(2026, 9, 28)), isEmpty);
    });

    test('eventos encadenados no comparten grupo; los de día completo no '
        'entran en la rejilla', () {
      final a = _evento('a', '2026-09-27T16:00:00Z', '2026-09-27T17:00:00Z');
      final b = _evento('b', '2026-09-27T17:00:00Z', '2026-09-27T18:00:00Z');
      final todoDia = EventoCalendario.fromJson(realMantenimiento);
      final r = posicionarEventosDia([a, b, todoDia], _dia27);
      expect(r.map((p) => p.totalColumnas), [1, 1]);
      expect(r[0].grupo, isNot(r[1].grupo));
    });

    test('ocho eventos a la misma hora quedan en 8 columnas', () {
      final eventos = feedSemana()
          .map(EventoCalendario.fromJson)
          .where((e) => e.inicio == DateTime.utc(2026, 9, 27, 21, 42))
          .toList();
      final r = posicionarEventosDia(eventos, _dia27);
      expect(r, hasLength(8));
      expect(r.map((p) => p.columna).toSet(), {0, 1, 2, 3, 4, 5, 6, 7});
      expect(r.every((p) => p.totalColumnas == 8), isTrue);
    });

    test('con la zona del dispositivo usa el conversor recibido', () {
      final e = EventoCalendario.fromJson(realEvento16);
      // Zona ficticia UTC±0: 21:42.
      final r = posicionarEventosDia([e], _dia27, aPared: (i) => i.toUtc());
      expect(r.single.top, 21 * 60 + 42);
    });
  });

  group('días y huecos', () {
    test('mantenimiento de día completo ocupa del 1 al 2 (fin exclusivo)', () {
      final e = EventoCalendario.fromJson(realMantenimiento);
      expect(e.todoElDia, isTrue);
      expect(eventoEnDia(e, DateTime.utc(2026, 9, 30)), isFalse);
      expect(eventoEnDia(e, DateTime.utc(2026, 10, 1)), isTrue);
      expect(eventoEnDia(e, DateTime.utc(2026, 10, 2)), isTrue);
      expect(eventoEnDia(e, DateTime.utc(2026, 10, 3)), isFalse);
      expect(eventosTodoElDia([e], DateTime.utc(2026, 10, 2)), [e]);
    });

    test('hito sin fin dura un día', () {
      final hito = EventoCalendario.fromJson(feedSemana().last);
      expect(eventoEnDia(hito, DateTime.utc(2026, 9, 23)), isTrue);
      expect(eventoEnDia(hito, DateTime.utc(2026, 9, 24)), isFalse);
    });

    test('huecoOcupado solo considera items de tipo evento', () {
      final eventos = [
        EventoCalendario.fromJson(realEvento16),
        EventoCalendario.fromJson(realSolicitud18),
      ];
      // 15:00–16:00 plaza = 21:00Z–22:00Z: choca con el evento de 15:42.
      expect(
        huecoOcupado(
          eventos,
          DateTime.utc(2026, 9, 27, 21),
          DateTime.utc(2026, 9, 27, 22),
        ),
        isTrue,
      );
      // 10:00–11:00 plaza: libre.
      expect(
        huecoOcupado(
          eventos,
          DateTime.utc(2026, 9, 27, 16),
          DateTime.utc(2026, 9, 27, 17),
        ),
        isFalse,
      );
      // Solo la solicitud (no aprobada) en el horario: libre.
      expect(
        huecoOcupado(
          [EventoCalendario.fromJson(realSolicitud18)],
          DateTime.utc(2026, 9, 27, 21),
          DateTime.utc(2026, 9, 27, 22),
        ),
        isFalse,
      );
    });

    test('la semana empieza en lunes y la rejilla del mes también', () {
      expect(
        inicioSemana(DateTime.utc(2026, 9, 27)),
        DateTime.utc(2026, 9, 21),
      );
      expect(
        inicioSemana(DateTime.utc(2026, 9, 21)),
        DateTime.utc(2026, 9, 21),
      );
      expect(
        inicioRejillaMes(DateTime.utc(2026, 10, 15)),
        DateTime.utc(2026, 9, 28),
      );
    });
  });

  group('modelo y API', () {
    test('fromJson separa código y título, y el id del PATCH va sin evt-', () {
      final e = EventoCalendario.fromJson(realEvento16);
      expect(e.solicitudCodigo, 'SOL-DEMO-16');
      expect(e.tituloSinCodigo, 'E2E-CAL-1790278212016');
      expect(e.eventoId, 'a0251907-3bf5-4114-aa20-f540534adcde');
      expect(e.choque, isTrue);
      expect(e.movible, isTrue);
      expect(EventoCalendario.fromJson(realMantenimiento).movible, isFalse);
    });

    test('decodifica entidades HTML del título', () {
      final e = EventoCalendario.fromJson(
        eventoJson(
          id: 'x',
          titulo: 'SOL-1 · Pintura &amp; Acabados',
          inicio: '2026-09-27T21:42:00.000Z',
          codigo: 'SOL-1',
        ),
      );
      expect(e.tituloSinCodigo, 'Pintura & Acabados');
    });

    test('isoPlaza usa el desfase −06:00', () {
      expect(
        isoPlaza(DateTime.utc(2026, 9, 28, 6)),
        '2026-09-28T00:00:00-06:00',
      );
      expect(
        isoPlaza(DateTime.utc(2026, 9, 27, 21, 42)),
        '2026-09-27T15:42:00-06:00',
      );
    });

    test('ZonaCalendario.plaza ida y vuelta', () {
      const z = ZonaCalendario.plaza;
      final pared = DateTime.utc(2026, 9, 27, 15, 42);
      expect(z.aInstante(pared), DateTime.utc(2026, 9, 27, 21, 42));
      expect(z.aPared(z.aInstante(pared)), pared);
    });

    test('FiltroCalendario tiene igualdad por valor', () {
      final a = FiltroCalendario(
        desde: DateTime.utc(2026),
        hasta: DateTime.utc(2026, 2),
        locales: ['b', 'a'],
      );
      final b = FiltroCalendario(
        desde: DateTime.utc(2026),
        hasta: DateTime.utc(2026, 2),
        locales: ['a', 'b'],
      );
      expect(a, b);
      expect(a.hashCode, b.hashCode);
    });
  });
}

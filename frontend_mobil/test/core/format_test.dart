import 'package:flutter_test/flutter_test.dart';
import 'package:frontend_mobil/core/format/fechas.dart';
import 'package:frontend_mobil/core/format/montos.dart';
import 'package:frontend_mobil/core/format/texto.dart';
import 'package:intl/date_symbol_data_local.dart';

void main() {
  setUpAll(() => initializeDateFormatting('es'));

  group('horas en 12 h', () {
    test('tarde y medianoche', () {
      expect(formatHora12('15:27'), '3:27 pm');
      expect(formatHora12('00:05'), '12:05 am');
      expect(formatHora12('12:00:00'), '12:00 pm');
      expect(formatHora12(null), '—');
    });
  });

  group('fechas', () {
    test('fecha civil DD-MM-YYYY', () {
      expect(formatFechaDMY('2026-10-02'), '02-10-2026');
      expect(formatFechaDMY(null), '—');
    });

    test('instante en hora de la plaza (UTC−6)', () {
      expect(formatFechaHora('2026-09-28T18:00:00Z'), '28/09/2026 12:00 pm');
      // 03:00Z del 29 todavía es 28 en El Salvador.
      expect(formatFecha('2026-09-29T03:00:00Z'), '28/09/2026');
      expect(formatHoraInstante('2026-10-01T21:42:00.000Z'), '3:42 pm');
    });

    test('ymd y aHoraPlaza', () {
      final plaza = aHoraPlaza(DateTime.utc(2026, 10, 1, 4, 30));
      expect(ymd(plaza), '2026-09-30');
      expect(plaza.hour, 22);
    });
  });

  group('tiempo relativo', () {
    final ahora = DateTime.utc(2026, 10, 27, 18);
    test('rangos del web', () {
      expect(
        tiempoRelativo(
          ahora.subtract(const Duration(seconds: 30)),
          ahora: ahora,
        ),
        'hace un momento',
      );
      expect(
        tiempoRelativo(
          ahora.subtract(const Duration(minutes: 5)),
          ahora: ahora,
        ),
        'hace 5 minutos',
      );
      expect(
        tiempoRelativo(ahora.subtract(const Duration(hours: 3)), ahora: ahora),
        'hace 3 horas',
      );
      expect(
        tiempoRelativo(ahora.subtract(const Duration(days: 1)), ahora: ahora),
        'ayer',
      );
      expect(
        tiempoRelativo(ahora.subtract(const Duration(days: 3)), ahora: ahora),
        'hace 3 días',
      );
      final viejo = ahora.subtract(const Duration(days: 9));
      expect(
        tiempoRelativo(viejo, ahora: ahora),
        formatFechaHora(viejo.toIso8601String()),
      );
    });
  });

  test('montos', () {
    expect(formatMonto(1250), 'USD 1,250.00');
    expect(formatMonto(4.5, moneda: 'USD'), 'USD 4.50');
    expect(formatMonto(null), '—');
  });

  test('texto', () {
    expect(decodificarHtml('Pintura &amp; Acabados'), 'Pintura & Acabados');
    expect(
      decodificarHtml('&lt;b&gt; &quot;x&quot; &#39;y&#x27;'),
      '<b> "x" \'y\'',
    );
    expect(decodificarHtml(null), '');
    expect(iniciales('María José Pérez'), 'MP');
    expect(iniciales('admin'), 'A');
  });
}

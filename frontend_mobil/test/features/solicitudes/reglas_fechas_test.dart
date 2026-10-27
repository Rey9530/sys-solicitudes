import 'package:flutter_test/flutter_test.dart';
import 'package:frontend_mobil/core/format/fechas.dart';
import 'package:frontend_mobil/features/solicitudes/reglas_fechas.dart';

/// Casos de `frontend/src/lib/solicitud-fechas.ts` (y del superRefine del
/// backend). Fechas y horas son hora de pared de la plaza (UTC−6).
void main() {
  // 27-10-2026 12:00 en la plaza.
  final ahora = DateTime.utc(2026, 10, 27, 18);

  /// (fecha, hora) de pared de la plaza en ahora + [d].
  (String, String) en(Duration d) {
    final p = aHoraPlaza(ahora.add(d));
    final hh = p.hour.toString().padLeft(2, '0');
    final mm = p.minute.toString().padLeft(2, '0');
    return (ymd(p), '$hh:$mm');
  }

  String? validar(Duration inicio, Duration fin, {bool emergencia = false}) {
    final (fi, hi) = en(inicio);
    final (ff, hf) = en(fin);
    return validarFechasSolicitud(
      ahora: ahora,
      inicio: fi,
      fin: ff,
      horaInicio: hi,
      horaFin: hf,
      emergencia: emergencia,
    );
  }

  const h = Duration(hours: 1);
  const d = Duration(days: 1);

  group('estándar', () {
    test('inicio a 24 h → error de 48 horas', () {
      expect(
        validar(h * 24, h * 26),
        'La fecha de inicio debe ser al menos 48 horas después de este '
        'momento.',
      );
    });

    test('inicio a 6 días → error de 5 días', () {
      expect(
        validar(d * 6, d * 6 + h),
        'La fecha de inicio no puede ser más de 5 días después de este '
        'momento.',
      );
    });

    test('fin a 8 días del inicio → error de 7 días', () {
      expect(
        validar(d * 3, d * 11),
        'La fecha fin no puede exceder 7 días desde la fecha de inicio.',
      );
    });

    test('rango válido (inicio a 3 días, 7 días de duración)', () {
      expect(validar(d * 3, d * 10), isNull);
      expect(validar(h * 48, h * 49), isNull);
      expect(validar(d * 5, d * 5 + h), isNull);
    });
  });

  group('emergencia', () {
    test('inicio a 12 h → válido', () {
      expect(validar(h * 12, h * 13, emergencia: true), isNull);
    });

    test('inicio en el pasado', () {
      expect(
        validar(-h, h, emergencia: true),
        'La fecha de inicio no puede ser en el pasado.',
      );
    });

    test('inicio después de 48 h', () {
      expect(
        validar(h * 50, h * 51, emergencia: true),
        'En modo emergencia el inicio debe ser dentro de las próximas 48 '
        'horas. Para fechas posteriores usa un permiso estándar.',
      );
    });

    test('fin a más de 7 días desde hoy', () {
      expect(
        validar(h * 12, d * 7 + h, emergencia: true),
        'En modo emergencia la fecha fin no puede exceder 7 días desde hoy.',
      );
    });
  });

  group('orden inicio/fin', () {
    test('fin antes que inicio (otro día)', () {
      expect(
        validar(d * 3, d * 2),
        'La fecha/hora de fin debe ser posterior al inicio.',
      );
    });

    test('mismo día con hora fin antes que hora inicio', () {
      expect(
        validarFechasSolicitud(
          ahora: ahora,
          inicio: '2026-10-30',
          fin: '2026-10-30',
          horaInicio: '15:00',
          horaFin: '14:59',
          emergencia: false,
        ),
        'La fecha/hora de fin debe ser posterior al inicio.',
      );
    });

    test(
      'misma fecha y hora es válida (el web y el backend usan fin < inicio)',
      () {
        expect(
          validarFechasSolicitud(
            ahora: ahora,
            inicio: '2026-10-30',
            fin: '2026-10-30',
            horaInicio: '15:00',
            horaFin: '15:00',
            emergencia: false,
          ),
          isNull,
        );
      },
    );
  });

  test('faltan datos → null (la obligatoriedad se valida aparte)', () {
    expect(
      validarFechasSolicitud(
        ahora: ahora,
        inicio: '2026-10-30',
        fin: null,
        horaInicio: '09:00',
        horaFin: '10:00',
        emergencia: false,
      ),
      isNull,
    );
  });

  test('formato inválido', () {
    expect(
      validarFechasSolicitud(
        ahora: ahora,
        inicio: '30/10/2026',
        fin: '2026-10-30',
        horaInicio: '09:00',
        horaFin: '10:00',
        emergencia: false,
      ),
      'Fecha u hora inválida.',
    );
  });

  test('las horas se interpretan en hora de la plaza (UTC−6)', () {
    // 29-10-2026 12:00 plaza = ahora + 48 h exactas → válido; 11:59 no.
    String? conHora(String hora) => validarFechasSolicitud(
      ahora: ahora,
      inicio: '2026-10-29',
      fin: '2026-10-29',
      horaInicio: hora,
      horaFin: '23:00',
      emergencia: false,
    );
    expect(conHora('12:00'), isNull);
    expect(conHora('11:59'), isNotNull);
  });

  group('límites de los selectores', () {
    test('estándar: inicio entre ahora+48 h y ahora+5 días', () {
      expect(minInicio(ahora, false), DateTime.utc(2026, 10, 29));
      expect(maxInicio(ahora, false), DateTime.utc(2026, 11, 1));
      expect(maxFin('2026-10-30', ahora, false), DateTime.utc(2026, 11, 6));
      expect(maxFin(null, ahora, false), DateTime.utc(2026, 11, 3));
    });

    test('emergencia: inicio entre hoy y ahora+48 h; fin hasta hoy+7', () {
      expect(minInicio(ahora, true), DateTime.utc(2026, 10, 27));
      expect(maxInicio(ahora, true), DateTime.utc(2026, 10, 29));
      expect(maxFin('2026-10-28', ahora, true), DateTime.utc(2026, 11, 3));
    });

    test('a las 7 pm de la plaza no se adelanta un día (UTC ya es mañana)', () {
      // 27-10 19:00 plaza = 28-10 01:00 UTC.
      final noche = DateTime.utc(2026, 10, 28, 1);
      expect(minInicio(noche, true), DateTime.utc(2026, 10, 27));
      expect(minInicio(noche, false), DateTime.utc(2026, 10, 29));
    });
  });

  test('validaciones de contacto', () {
    expect(emailBasicoValido('a@b.com'), isTrue);
    expect(emailBasicoValido('a@b'), isFalse);
    expect(telefonoBasicoValido('+503 7000 0000'), isTrue);
    expect(telefonoBasicoValido('1234567'), isFalse);
    expect(telefonoBasicoValido('7000-abcd'), isFalse);
  });
}

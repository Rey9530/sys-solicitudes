import 'package:intl/intl.dart';

import '../config.dart';

/// Formateo de fechas y horas igual que el web (`frontend/src/lib/datetime.ts`).
///
/// La plaza vive en America/El_Salvador (UTC−6, sin horario de verano), así
/// que la conversión es un desfase fijo: no hace falta un paquete de zonas
/// horarias. Toda hora visible va en 12 h ("2:00 pm"); las fechas civiles
/// (`YYYY-MM-DD`) se muestran `DD-MM-YYYY` y los instantes `dd/MM/yyyy`.

const _vacio = '—';

/// Instante → fecha/hora "de pared" en la plaza (DateTime sin zona, en UTC
/// para que `hour`, `day`… se lean tal cual).
DateTime aHoraPlaza(DateTime instante) => instante.toUtc().add(desfasePlaza);

/// Fecha y hora actuales en la plaza.
DateTime ahoraEnPlaza() => aHoraPlaza(DateTime.now());

/// `YYYY-MM-DD` de una fecha de pared.
String ymd(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${_dos(d.month)}-${_dos(d.day)}';

/// Fecha civil de la plaza dentro de [dias] días (`YYYY-MM-DD`).
String fechaPlazaHoy({int dias = 0}) =>
    ymd(ahoraEnPlaza().add(Duration(days: dias)));

/// Instante UTC de una fecha civil + hora (`HH:mm`) de la plaza.
DateTime instanteDePlaza(String fechaYmd, String hhmm) {
  final f = DateTime.parse('${fechaYmd}T$hhmm:00Z');
  return f.subtract(desfasePlaza);
}

/// `"2026-10-02"` → `"02-10-2026"`.
String formatFechaDMY(String? fechaYmd) {
  if (fechaYmd == null || fechaYmd.isEmpty) return _vacio;
  final m = RegExp(r'^(\d{4})-(\d{2})-(\d{2})').firstMatch(fechaYmd);
  return m == null ? fechaYmd : '${m[3]}-${m[2]}-${m[1]}';
}

/// Instante ISO → `dd/MM/yyyy` en hora de la plaza.
String formatFecha(String? iso) {
  if (iso == null || iso.isEmpty) return _vacio;
  return DateFormat('dd/MM/yyyy').format(aHoraPlaza(DateTime.parse(iso)));
}

/// Instante ISO → `dd/MM/yyyy h:mm am` en hora de la plaza.
String formatFechaHora(String? iso) {
  if (iso == null || iso.isEmpty) return _vacio;
  final d = aHoraPlaza(DateTime.parse(iso));
  return '${DateFormat('dd/MM/yyyy').format(d)} ${_hora12(d.hour, d.minute)}';
}

/// Instante ISO → `h:mm am` en hora de la plaza.
String formatHoraInstante(String iso) {
  final d = aHoraPlaza(DateTime.parse(iso));
  return _hora12(d.hour, d.minute);
}

/// `"15:27"` o `"15:27:00"` (24 h) → `"3:27 pm"`.
String formatHora12(String? hhmm) {
  if (hhmm == null || hhmm.trim().isEmpty) return _vacio;
  final m = RegExp(r'^(\d{1,2}):(\d{2})').firstMatch(hhmm.trim());
  if (m == null) return hhmm;
  return _hora12(int.parse(m[1]!), int.parse(m[2]!));
}

/// Horas y minutos (24 h) → `"2:00 pm"`.
String hora12(int horas, int minutos) => _hora12(horas, minutos);

/// Tiempo relativo como la campana del web: hasta 7 días en palabras, después
/// la fecha absoluta.
String tiempoRelativo(DateTime instante, {DateTime? ahora}) {
  final ref = (ahora ?? DateTime.now()).toUtc();
  final diff = ref.difference(instante.toUtc());
  if (diff.inSeconds < 45) return 'hace un momento';
  if (diff.inMinutes < 60) {
    final m = diff.inMinutes < 1 ? 1 : diff.inMinutes;
    return m == 1 ? 'hace 1 minuto' : 'hace $m minutos';
  }
  if (diff.inHours < 24) {
    return diff.inHours == 1 ? 'hace 1 hora' : 'hace ${diff.inHours} horas';
  }
  if (diff.inDays <= 7) {
    return diff.inDays == 1 ? 'ayer' : 'hace ${diff.inDays} días';
  }
  return formatFechaHora(instante.toUtc().toIso8601String());
}

String _hora12(int horas, int minutos) {
  final sufijo = horas < 12 ? 'am' : 'pm';
  final h12 = horas % 12 == 0 ? 12 : horas % 12;
  return '$h12:${_dos(minutos)} $sufijo';
}

String _dos(int n) => n.toString().padLeft(2, '0');

import '../../core/format/fechas.dart';

/// Reglas de fechas del permiso. Espejo de `frontend/src/lib/solicitud-fechas.ts`
/// (y de `CreateSolicitudSchema.superRefine` del backend, que es la fuente de
/// verdad).
///
/// Las fechas (`YYYY-MM-DD`) y horas (`HH:mm`) del formulario son hora de pared
/// de la plaza (UTC−6): se convierten a instante con [instanteDePlaza] antes de
/// compararlas con [ahora] (el "momento de elaboración", congelado al abrir el
/// wizard).

/// Anticipación mínima en modo estándar.
const minHorasAnticipacion = 48;

/// Anticipación máxima en modo estándar.
const maxDiasAnticipacion = 5;

/// En emergencia el inicio debe caer dentro de las próximas 48 h.
const maxHorasEmergencia = 48;

/// Duración máxima del permiso (estándar y emergencia).
const maxDiasDuracion = 7;

/// Cupo mensual de permisos de emergencia (lo aplica el backend).
const maxEmergenciasPorMes = 3;

/// Rango de la cantidad de personal (`asistentes_estimados`).
const minPersonal = 1;
const maxPersonal = 20;

const _hora = Duration(hours: 1);
const _dia = Duration(days: 1);

/// Valida el rango inicio..fin según el modo. Devuelve el mensaje de error o
/// `null`. Si falta algún dato devuelve `null`: la obligatoriedad se valida
/// aparte (igual que el web).
String? validarFechasSolicitud({
  required DateTime ahora,
  required String? inicio,
  required String? fin,
  required String? horaInicio,
  required String? horaFin,
  required bool emergencia,
}) {
  if ([inicio, fin, horaInicio, horaFin].any((v) => v == null || v.isEmpty)) {
    return null;
  }
  final DateTime ini;
  final DateTime fn;
  try {
    ini = instanteDePlaza(inicio!, horaInicio!);
    fn = instanteDePlaza(fin!, horaFin!);
  } on FormatException {
    return 'Fecha u hora inválida.';
  }

  if (fn.isBefore(ini)) {
    return 'La fecha/hora de fin debe ser posterior al inicio.';
  }

  if (emergencia) {
    if (ini.isBefore(ahora)) {
      return 'La fecha de inicio no puede ser en el pasado.';
    }
    if (ini.isAfter(ahora.add(_hora * maxHorasEmergencia))) {
      return 'En modo emergencia el inicio debe ser dentro de las próximas 48 '
          'horas. Para fechas posteriores usa un permiso estándar.';
    }
    if (fn.isAfter(ahora.add(_dia * maxDiasDuracion))) {
      return 'En modo emergencia la fecha fin no puede exceder 7 días desde hoy.';
    }
  } else {
    if (ini.isBefore(ahora.add(_hora * minHorasAnticipacion))) {
      return 'La fecha de inicio debe ser al menos 48 horas después de este '
          'momento.';
    }
    if (ini.isAfter(ahora.add(_dia * maxDiasAnticipacion))) {
      return 'La fecha de inicio no puede ser más de 5 días después de este '
          'momento.';
    }
    if (fn.isAfter(ini.add(_dia * maxDiasDuracion))) {
      return 'La fecha fin no puede exceder 7 días desde la fecha de inicio.';
    }
  }
  return null;
}

/// Primer día elegible para la fecha de inicio (fecha de pared de la plaza,
/// en UTC como espera `CampoFecha`). Estándar: ahora + 48 h; emergencia: hoy.
DateTime minInicio(DateTime ahora, bool emergencia) =>
    _diaPlaza(emergencia ? ahora : ahora.add(_hora * minHorasAnticipacion));

/// Último día elegible para la fecha de inicio. Estándar: ahora + 5 días;
/// emergencia: ahora + 48 h.
DateTime maxInicio(DateTime ahora, bool emergencia) => _diaPlaza(
  ahora.add(
    emergencia ? _hora * maxHorasEmergencia : _dia * maxDiasAnticipacion,
  ),
);

/// Último día elegible para la fecha fin. Estándar: inicio + 7 días (sin
/// inicio, ahora + 7 días); emergencia: ahora + 7 días.
DateTime maxFin(String? inicio, DateTime ahora, bool emergencia) {
  if (!emergencia && inicio != null && inicio.isNotEmpty) {
    return DateTime.parse('${inicio}T00:00:00Z').add(_dia * maxDiasDuracion);
  }
  return _diaPlaza(ahora.add(_dia * maxDiasDuracion));
}

/// `YYYY-MM-DD` del día de la plaza en [instante], como `DateTime.utc`.
DateTime _diaPlaza(DateTime instante) {
  final p = aHoraPlaza(instante);
  return DateTime.utc(p.year, p.month, p.day);
}

/// Teléfono de 8 a 20 caracteres: dígitos, espacios, `+`, `-` y paréntesis.
bool telefonoBasicoValido(String telefono) =>
    RegExp(r'^[0-9+\-\s()]{8,20}$').hasMatch(telefono.trim());

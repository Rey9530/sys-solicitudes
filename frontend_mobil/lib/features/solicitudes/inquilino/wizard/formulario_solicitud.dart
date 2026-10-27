import '../../reglas_fechas.dart';
import '../../solicitudes_modelos.dart';

/// Datos de una persona del personal (nombre + documento).
class AsistenteForm {
  AsistenteForm({this.nombre = '', this.documento = ''});

  String nombre;
  String documento;
}

/// Prefill desde el calendario: `?tipo=evento&fecha=YYYY-MM-DD&hora=HH:mm`
/// (y `localId`). Cada valor se valida; uno inválido se ignora.
class PrefillWizard {
  const PrefillWizard({this.tipo, this.fecha, this.hora, this.localId});

  factory PrefillWizard.desdeQuery(Map<String, String> q) {
    final tipo = q['tipo'];
    final fecha = q['fecha'];
    final hora = q['hora'];
    return PrefillWizard(
      tipo: etiquetaTipoSolicitud.containsKey(tipo) ? tipo : null,
      fecha: fecha != null && RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(fecha)
          ? fecha
          : null,
      hora: hora != null && RegExp(r'^([01]\d|2[0-3]):[0-5]\d$').hasMatch(hora)
          ? hora
          : null,
      localId: q['localId'],
    );
  }

  final String? tipo;
  final String? fecha;
  final String? hora;
  final String? localId;
}

/// Estado del wizard de solicitud (`SolicitudWizard` del web): valores de
/// los tres pasos, validación con los mismos mensajes y armado del payload.
class FormularioSolicitud {
  FormularioSolicitud();

  /// Formulario de creación con el prefill del calendario. Tipo por defecto:
  /// el del prefill (si está activo), si no el primer tipo activo.
  factory FormularioSolicitud.nuevo(DatosWizard datos, PrefillWizard prefill) {
    final f = FormularioSolicitud();
    final activos = datos.tipos.map((t) => t.codigo).toSet();
    f.tipo = prefill.tipo != null && activos.contains(prefill.tipo)
        ? prefill.tipo!
        : (datos.tipos.firstOrNull?.codigo ?? 'mantenimiento');
    if (datos.locales.any((l) => l.id == prefill.localId)) {
      f.localId = prefill.localId;
    }
    f.fechaInicio = prefill.fecha;
    f.fechaFin = prefill.fecha;
    f.horaInicio = prefill.hora;
    return f;
  }

  /// Formulario de edición precargado con la solicitud.
  factory FormularioSolicitud.desdeSolicitud(SolicitudItem s) {
    final f = FormularioSolicitud()
      ..tipo = s.tipo
      ..categoriaId = s.categoriaId
      ..subcategoriaId = s.subcategoriaId
      ..localId = s.localId.isEmpty ? null : s.localId
      ..titulo = s.titulo
      ..descripcion = s.descripcion
      ..fechaInicio = s.fechaEventoInicio
      ..fechaFin = s.fechaEventoFin
      ..horaInicio = _hhmm(s.horaInicio)
      ..horaFin = _hhmm(s.horaFin)
      ..empresaNombre = s.empresaNombre
      ..empresaResponsable = s.empresaResponsable
      ..empresaTelefono = s.empresaTelefono
      ..empresaEmail = s.empresaEmail
      ..emergenciaContacto = s.emergenciaContacto
      ..emergenciaTelefono = s.emergenciaTelefono
      ..esEmergencia = s.esEmergencia;
    final extra = s.camposExtra;
    String texto(String k) => extra[k] == null ? '' : _numOTexto(extra[k]);
    f
      ..areaAfectada = texto('area_afectada')
      ..requiereIngresoALocal = extra['requiere_ingreso_a_local'] == true
      ..asistentesEstimados = texto('asistentes_estimados')
      ..fechaInicioEstimada = extra['fecha_inicio_estimada'] as String?
      ..duracionDias = texto('duracion_dias')
      ..empresaConstructora = texto('empresa_constructora')
      ..montoPresupuesto = texto('monto_presupuesto');
    final lista = extra['asistentes'];
    if (lista is List) {
      for (var i = 0; i < lista.length; i++) {
        final a = lista[i];
        if (a is Map<String, dynamic>) {
          f.asistentes[i] = AsistenteForm(
            nombre: a['nombre'] as String? ?? '',
            documento: a['documento'] as String? ?? '',
          );
        }
      }
    }
    return f;
  }

  // Paso 1
  String tipo = 'mantenimiento';
  String? categoriaId;
  String? subcategoriaId;

  // Paso 2
  String? localId;
  String titulo = '';
  String descripcion = '';
  String empresaNombre = '';
  String empresaResponsable = '';
  String empresaTelefono = '';
  String empresaEmail = '';
  String emergenciaContacto = '';
  String emergenciaTelefono = '';
  String? fechaInicio;
  String? fechaFin;
  String? horaInicio;
  String? horaFin;
  bool esEmergencia = false;

  // camposExtra: mantenimiento
  String areaAfectada = '';
  bool requiereIngresoALocal = false;

  // camposExtra: remodelación
  String? fechaInicioEstimada;
  String duracionDias = '';
  String empresaConstructora = '';
  String montoPresupuesto = '';

  // Personal (todos los tipos). Mapa por índice: bajar la cantidad no borra
  // lo ya escrito en las filas siguientes.
  String asistentesEstimados = '';
  final Map<int, AsistenteForm> asistentes = {};

  /// Cantidad de personal efectiva (0..20, como el web).
  int get numAsistentes {
    final n = num.tryParse(asistentesEstimados.trim()) ?? 0;
    if (n.isNaN || n < 0) return 0;
    return n.floor().clamp(0, maxPersonal);
  }

  AsistenteForm asistente(int i) =>
      asistentes.putIfAbsent(i, AsistenteForm.new);

  /// Cambia el tipo y vacía categoría y subcategoría.
  void cambiarTipo(String nuevo) {
    tipo = nuevo;
    categoriaId = null;
    subcategoriaId = null;
  }

  /// Cambia la categoría y vacía la subcategoría.
  void cambiarCategoria(String? nueva) {
    categoriaId = nueva;
    subcategoriaId = null;
  }

  String? validarPaso1() {
    if (categoriaId == null || subcategoriaId == null) {
      return 'Selecciona categoría y subcategoría.';
    }
    return null;
  }

  /// Validación del paso 2 en el orden del web. [momento] = momento de
  /// elaboración (congelado al abrir el wizard).
  String? validarPaso2(DateTime momento) {
    if (localId == null) return 'Selecciona un local.';
    if (titulo.trim().isEmpty) return 'El título es obligatorio.';
    if (descripcion.trim().isEmpty) return 'La descripción es obligatoria.';
    if (fechaInicio == null ||
        fechaFin == null ||
        horaInicio == null ||
        horaFin == null) {
      return 'Indica fecha y hora de inicio y fin del permiso.';
    }
    final errFechas = validarFechasSolicitud(
      ahora: momento,
      inicio: fechaInicio,
      fin: fechaFin,
      horaInicio: horaInicio,
      horaFin: horaFin,
      emergencia: esEmergencia,
    );
    if (errFechas != null) return errFechas;

    if (empresaNombre.trim().isEmpty) {
      return 'Indica el nombre de la empresa ejecutante.';
    }
    if (empresaResponsable.trim().isEmpty) {
      return 'Indica el responsable de la empresa.';
    }
    if (empresaTelefono.trim().isEmpty) {
      return 'Indica el teléfono de la empresa ejecutante.';
    }
    if (!telefonoBasicoValido(empresaTelefono)) {
      return 'Teléfono de empresa inválido (8-20 dígitos).';
    }
    if (empresaEmail.trim().isEmpty) {
      return 'Indica el email de la empresa ejecutante.';
    }
    if (!emailBasicoValido(empresaEmail)) return 'Email de empresa inválido.';
    if (emergenciaContacto.trim().isEmpty) {
      return 'Indica el contacto de emergencia.';
    }
    if (emergenciaTelefono.trim().isEmpty) {
      return 'Indica el teléfono de emergencia.';
    }
    if (!telefonoBasicoValido(emergenciaTelefono)) {
      return 'Teléfono de emergencia inválido (8-20 dígitos).';
    }

    if ((num.tryParse(asistentesEstimados.trim()) ?? 0) == 0 ||
        numAsistentes < minPersonal) {
      return 'Indica al menos $minPersonal persona de personal.';
    }
    if (numAsistentes > maxPersonal) {
      return 'El máximo de personal es $maxPersonal.';
    }

    if (tipo == 'mantenimiento' && areaAfectada.trim().isEmpty) {
      return 'Indica el área afectada.';
    }
    if (tipo == 'remodelacion') {
      if (fechaInicioEstimada == null || fechaInicioEstimada!.isEmpty) {
        return 'Indica la fecha de inicio estimada.';
      }
      if ((num.tryParse(duracionDias.trim()) ?? 0) == 0) {
        return 'Indica la duración en días.';
      }
      if (empresaConstructora.trim().isEmpty) {
        return 'Indica la empresa constructora.';
      }
      if (montoPresupuesto.trim().isEmpty) {
        return 'Indica el monto del presupuesto.';
      }
    }

    for (var i = 0; i < numAsistentes; i++) {
      final a = asistentes[i] ?? AsistenteForm();
      if (a.nombre.trim().isEmpty || a.documento.trim().isEmpty) {
        return 'Completa el nombre y documento del asistente ${i + 1}.';
      }
      final largo = a.documento.trim().length;
      if (largo < 3 || largo > 20) {
        return 'El documento del asistente ${i + 1} debe tener entre 3 y 20 '
            'caracteres.';
      }
    }
    return null;
  }

  /// `camposExtra` con la forma exacta de cada tipo.
  Map<String, Object?> camposExtra() {
    final bloque = <String, Object?>{
      'asistentes_estimados': numAsistentes,
      'asistentes': [
        for (var i = 0; i < numAsistentes; i++)
          {
            'nombre': (asistentes[i]?.nombre ?? '').trim(),
            'documento': (asistentes[i]?.documento ?? '').trim(),
          },
      ],
    };
    return switch (tipo) {
      'mantenimiento' => {
        'area_afectada': areaAfectada.trim(),
        'requiere_ingreso_a_local': requiereIngresoALocal,
        ...bloque,
      },
      'remodelacion' => {
        'fecha_inicio_estimada': fechaInicioEstimada,
        'duracion_dias': _numero(duracionDias),
        'empresa_constructora': empresaConstructora.trim(),
        'monto_presupuesto': _numero(montoPresupuesto),
        ...bloque,
      },
      _ => bloque,
    };
  }

  /// Payload completo de `POST /solicitudes` y `PATCH /solicitudes/:id`.
  /// Siempre incluye `esEmergencia`; los opcionales vacíos se omiten.
  Map<String, Object?> payload() {
    final campos = <String, Object?>{
      'localId': localId,
      'tipo': tipo,
      'titulo': titulo.trim(),
      'descripcion': descripcion.trim(),
      'categoriaId': categoriaId,
      'subcategoriaId': subcategoriaId,
      'fechaEventoInicio': fechaInicio,
      'fechaEventoFin': fechaFin,
      'horaInicio': horaInicio,
      'horaFin': horaFin,
      'empresaNombre': empresaNombre.trim(),
      'empresaResponsable': empresaResponsable.trim(),
      'empresaTelefono': empresaTelefono.trim(),
      'empresaEmail': empresaEmail.trim(),
      'emergenciaContacto': emergenciaContacto.trim(),
      'emergenciaTelefono': emergenciaTelefono.trim(),
    }..removeWhere((_, v) => v == null || v == '');
    return {
      ...campos,
      'esEmergencia': esEmergencia,
      'camposExtra': camposExtra(),
    };
  }
}

/// `"1250"` → 1250, `"99.5"` → 99.5, inválido → null.
num? _numero(String texto) {
  final n = num.tryParse(texto.trim());
  if (n == null) return null;
  return n == n.truncate() ? n.toInt() : n;
}

/// Valor JSON de `camposExtra` como texto editable (sin `.0`).
String _numOTexto(Object? v) {
  if (v is double && v == v.truncateToDouble()) return '${v.toInt()}';
  return '$v';
}

/// `"09:00:00"` → `"09:00"`.
String? _hhmm(String? hora) =>
    hora == null || hora.length < 5 ? hora : hora.substring(0, 5);

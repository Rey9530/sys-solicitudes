import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/api/api_error.dart';
import '../../core/api/api_providers.dart';
import '../../core/auth/sesion_controller.dart';
import '../../core/format/fechas.dart';
import '../../core/theme/colores.dart';
import '../../core/widgets/avisos.dart';
import '../../core/widgets/badges.dart';
import '../../core/widgets/campos.dart';
import 'calendario_api.dart';
import 'calendario_modelos.dart';

/// Hoja de detalle al tocar un evento (modal del web). [alCambiar] se llama
/// cuando el calendario debe recargarse (fechas movidas o evento obsoleto).
Future<void> mostrarDetalleEvento(
  BuildContext context, {
  required EventoCalendario evento,
  required bool esInquilino,
  required ZonaCalendario zona,
  required VoidCallback alCambiar,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    builder: (_) => DetalleEventoSheet(
      evento: evento,
      esInquilino: esInquilino,
      zona: zona,
      alCambiar: alCambiar,
    ),
  );
}

/// Rango legible del evento con horas en 12 h (`dd/MM/yyyy h:mm am — …`);
/// los de día completo dicen "(todo el día)" y su fin es exclusivo.
String rangoEvento(EventoCalendario e, ZonaCalendario zona) {
  final fecha = DateFormat('dd/MM/yyyy');
  if (e.todoElDia) {
    final ini = aHoraPlaza(e.inicio);
    final finIncl = e.fin == null
        ? ini
        : aHoraPlaza(e.fin!).subtract(const Duration(days: 1));
    final a = fecha.format(ini);
    final b = fecha.format(finIncl);
    return a == b ? '$a (todo el día)' : '$a — $b (todo el día)';
  }
  String fechaHora(DateTime instante) {
    final p = zona.aPared(instante);
    return '${fecha.format(p)} ${hora12(p.hour, p.minute)}';
  }

  final ini = fechaHora(e.inicio);
  return e.fin == null ? ini : '$ini — ${fechaHora(e.fin!)}';
}

class DetalleEventoSheet extends ConsumerStatefulWidget {
  const DetalleEventoSheet({
    super.key,
    required this.evento,
    required this.esInquilino,
    required this.zona,
    required this.alCambiar,
  });

  final EventoCalendario evento;
  final bool esInquilino;
  final ZonaCalendario zona;
  final VoidCallback alCambiar;

  @override
  ConsumerState<DetalleEventoSheet> createState() => _DetalleEventoSheetState();
}

class _DetalleEventoSheetState extends ConsumerState<DetalleEventoSheet> {
  bool _editando = false;
  bool _guardando = false;
  String? _error;
  late String? _fechaInicio;
  late String? _horaInicio;
  late String? _fechaFin;
  late String? _horaFin;

  @override
  void initState() {
    super.initState();
    final e = widget.evento;
    final ini = widget.zona.aPared(e.inicio);
    final fin = widget.zona.aPared(e.finEfectivo);
    _fechaInicio = ymd(ini);
    _horaInicio = _hhmm(ini);
    _fechaFin = ymd(fin);
    _horaFin = _hhmm(fin);
  }

  String _hhmm(DateTime d) =>
      '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';

  DateTime? _instante(String? fecha, String? hora) {
    if (fecha == null || hora == null) return null;
    return widget.zona.aInstante(DateTime.parse('${fecha}T$hora:00Z'));
  }

  Future<void> _guardar() async {
    final inicio = _instante(_fechaInicio, _horaInicio);
    final fin = _instante(_fechaFin, _horaFin);
    if (inicio == null || fin == null || !fin.isAfter(inicio)) {
      setState(
        () =>
            _error = 'La fecha y hora de fin deben ser posteriores al inicio.',
      );
      return;
    }
    setState(() {
      _guardando = true;
      _error = null;
    });
    try {
      await moverEvento(
        ref.read(apiClientProvider),
        widget.evento.eventoId,
        inicio,
        fin,
      );
      widget.alCambiar();
      if (!mounted) return;
      mostrarExito(context, 'Fechas del evento actualizadas.');
      Navigator.of(context).pop();
    } on ApiError catch (e) {
      // El evento ya no se puede mover (cerrado) o ya no existe: el
      // calendario está desactualizado, se recarga.
      if (e.code == 'EVENTO_CERRADO' || e.code == 'EVENTO_NO_ENCONTRADO') {
        widget.alCambiar();
      }
      if (!mounted) return;
      setState(() {
        _guardando = false;
        _error = switch (e.code) {
          'EVENTO_CERRADO' =>
            'La solicitud está cerrada; su evento no se puede mover.',
          'EVENTO_NO_ENCONTRADO' =>
            'El evento ya no existe en esta plaza. Se recargó el calendario.',
          _ => e.mensaje,
        };
      });
    }
  }

  void _verSolicitud() {
    final id = widget.evento.solicitudId!;
    final ruta = widget.esInquilino
        ? '/inquilino/solicitudes/$id'
        : '/admin/solicitudes/$id';
    final router = GoRouter.of(context);
    Navigator.of(context).pop();
    router.push(ruta);
  }

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    final e = widget.evento;
    final sesion = ref.watch(sesionProvider).value;
    final puedeMover =
        !widget.esInquilino &&
        e.movible &&
        (sesion?.puede('calendario.mover_evento') ?? false);
    final secundario = TextStyle(color: c.text2);

    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(
        20,
        0,
        20,
        24 + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(e.titulo, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          if (e.choque) ...[
            const AvisoBanner(
              tono: Tono.danger,
              child: Text('Este evento se solapa con otro en el mismo local.'),
            ),
            const SizedBox(height: 10),
          ],
          if (e.solicitudCodigo != null)
            Text.rich(
              TextSpan(
                text: 'N.º solicitud: ',
                children: [
                  TextSpan(
                    text: e.solicitudCodigo,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ],
              ),
              style: secundario,
            ),
          const SizedBox(height: 6),
          Text(rangoEvento(e, widget.zona), style: secundario),
          if (e.localCodigo != null) ...[
            const SizedBox(height: 6),
            Text('Local: ${e.localCodigo}', style: secundario),
          ],
          const SizedBox(height: 6),
          Text(
            'Tipo: ${etiquetaTipoCalendario(e.tipo, esInquilino: widget.esInquilino)}',
            style: TextStyle(color: c.text3),
          ),
          if (e.estado != null) ...[
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Text('Estado:', style: secundario),
                EstadoSolicitudBadge(e.estado!),
              ],
            ),
          ],
          const SizedBox(height: 16),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (e.solicitudId != null)
                FilledButton(
                  onPressed: _verSolicitud,
                  child: Text(
                    'Ver solicitud ${e.solicitudCodigo ?? ''}'.trim(),
                  ),
                ),
              if (puedeMover && !_editando)
                OutlinedButton.icon(
                  onPressed: () => setState(() => _editando = true),
                  icon: const Icon(Icons.edit_calendar_outlined, size: 18),
                  label: const Text('Cambiar fechas'),
                ),
            ],
          ),
          if (puedeMover && _editando) ...[
            const SizedBox(height: 16),
            Text(
              'Nuevas fechas (${widget.zona.etiqueta})',
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 10),
            _ParCampos(
              fecha: CampoFecha(
                label: 'Fecha inicio',
                valorYmd: _fechaInicio,
                onChanged: (v) => setState(() => _fechaInicio = v),
              ),
              hora: CampoHora(
                label: 'Hora inicio',
                valorHhmm: _horaInicio,
                onChanged: (v) => setState(() => _horaInicio = v),
              ),
            ),
            const SizedBox(height: 10),
            _ParCampos(
              fecha: CampoFecha(
                label: 'Fecha fin',
                valorYmd: _fechaFin,
                onChanged: (v) => setState(() => _fechaFin = v),
              ),
              hora: CampoHora(
                label: 'Hora fin',
                valorHhmm: _horaFin,
                onChanged: (v) => setState(() => _horaFin = v),
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              AvisoBanner(tono: Tono.danger, child: Text(_error!)),
            ],
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                TextButton(
                  onPressed: _guardando
                      ? null
                      : () => setState(() {
                          _editando = false;
                          _error = null;
                        }),
                  child: const Text('Cancelar'),
                ),
                FilledButton(
                  onPressed: _guardando ? null : _guardar,
                  child: Text(_guardando ? 'Guardando…' : 'Guardar fechas'),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

/// Fecha y hora lado a lado si hay espacio; una debajo de otra si no.
class _ParCampos extends StatelessWidget {
  const _ParCampos({required this.fecha, required this.hora});

  final Widget fecha;
  final Widget hora;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth < 380) {
          return Column(children: [fecha, const SizedBox(height: 10), hora]);
        }
        return Row(
          children: [
            Expanded(child: fecha),
            const SizedBox(width: 10),
            Expanded(child: hora),
          ],
        );
      },
    );
  }
}

/// Hoja al tocar un hueco libre (solo inquilino): avisa si el horario ya
/// tiene un evento aprobado o abre el wizard con la fecha (y hora) elegidas.
Future<void> mostrarHuecoLibre(
  BuildContext context, {
  required String fechaYmd,
  String? hhmm,
  required bool ocupado,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    builder: (hoja) {
      final c = ColoresPlazapp.of(hoja);
      return SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Nueva solicitud de evento en este horario',
              style: Theme.of(hoja).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            Text(
              '${formatFechaDMY(fechaYmd)}'
              '${hhmm == null ? '' : ' a las ${formatHora12(hhmm)}'}',
              style: TextStyle(color: c.text2),
            ),
            const SizedBox(height: 14),
            if (ocupado)
              const AvisoBanner(
                tono: Tono.warn,
                child: Text(
                  'Ya hay un evento aprobado en este horario. Elige otro slot '
                  'del calendario.',
                ),
              )
            else
              FilledButton(
                onPressed: () {
                  final router = GoRouter.of(hoja);
                  Navigator.of(hoja).pop();
                  router.push(
                    '/inquilino/solicitudes/nueva?tipo=evento&fecha=$fechaYmd'
                    '${hhmm == null ? '' : '&hora=$hhmm'}',
                  );
                },
                child: const Text('Crear solicitud de evento'),
              ),
          ],
        ),
      );
    },
  );
}

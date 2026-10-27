import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/api/api_providers.dart';
import '../../core/descargas/descargar_y_compartir.dart';
import '../../core/format/fechas.dart';
import '../../core/theme/colores.dart';
import '../../core/widgets/can.dart';
import '../../core/widgets/estados.dart';
import '../../core/widgets/pagina.dart';
import 'calendario_api.dart';
import 'calendario_modelos.dart';
import 'calendario_providers.dart';
import 'detalle_evento_sheet.dart';
import 'filtros_calendario.dart';
import 'layout_eventos.dart';
import 'vistas/evento_widgets.dart';
import 'vistas/vista_agenda.dart';
import 'vistas/vista_mes.dart';
import 'vistas/vista_rejilla.dart';

/// Vistas del calendario (las de FullCalendar en el web).
enum VistaCalendario {
  mes('Mes'),
  semana('Semana'),
  dia('Día'),
  agenda('Agenda');

  const VistaCalendario(this.etiqueta);
  final String etiqueta;
}

/// Cada cuánto se recarga el feed mientras la pantalla está visible.
const intervaloRecargaCalendario = Duration(minutes: 5);

/// Calendario del admin (`/admin/calendario`) y del inquilino
/// (`/inquilino/calendario`). Espejo de `calendario-view.tsx` y de las dos
/// páginas del web (Inv §5.5).
class CalendarioPage extends ConsumerStatefulWidget {
  const CalendarioPage({
    super.key,
    required this.esInquilino,
    this.fechaInicial,
    this.vistaInicial,
  });

  final bool esInquilino;

  /// Día inicial (fecha de pared). Por defecto, hoy.
  final DateTime? fechaInicial;

  /// Vista inicial. Por defecto Agenda en teléfono y Mes en tablet.
  final VistaCalendario? vistaInicial;

  @override
  ConsumerState<CalendarioPage> createState() => _CalendarioPageState();
}

class _CalendarioPageState extends ConsumerState<CalendarioPage> {
  VistaCalendario? _vista;
  ZonaCalendario _zona = ZonaCalendario.plaza;
  late DateTime _fecha;
  late DateTime _seleccionado;
  final Set<String> _locales = {};
  final Set<String> _inquilinos = {};
  final Set<String> _tipos = {...todosLosTiposCalendario};
  bool _filtrosAbiertos = false;
  Timer? _recarga;

  @override
  void initState() {
    super.initState();
    _fecha = soloDia(widget.fechaInicial ?? _hoy());
    _seleccionado = _fecha;
    _vista = widget.vistaInicial;
    _recarga = Timer.periodic(intervaloRecargaCalendario, (_) => _recargar());
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // En teléfono arranca en Agenda (el web: `listWeek` bajo 768 px).
    _vista ??= MediaQuery.sizeOf(context).width < 600
        ? VistaCalendario.agenda
        : VistaCalendario.mes;
  }

  @override
  void dispose() {
    _recarga?.cancel();
    super.dispose();
  }

  DateTime _hoy() => soloDia(_zona.aPared(DateTime.now()));

  /// Recarga automática: solo si la app está en primer plano y esta pantalla
  /// es la visible (no hay un detalle encima).
  void _recargar() {
    if (!mounted) return;
    final estado = WidgetsBinding.instance.lifecycleState;
    final enPrimerPlano = estado == null || estado == AppLifecycleState.resumed;
    final visible = ModalRoute.of(context)?.isCurrent ?? true;
    if (enPrimerPlano && visible) ref.invalidate(feedCalendarioProvider);
  }

  /// Rango visible en fechas de pared [desde, hasta).
  (DateTime, DateTime) _rango() {
    switch (_vista!) {
      case VistaCalendario.mes:
        final desde = inicioRejillaMes(_fecha);
        return (desde, desde.add(const Duration(days: 42)));
      case VistaCalendario.semana:
      case VistaCalendario.agenda:
        final desde = inicioSemana(_fecha);
        return (desde, desde.add(const Duration(days: 7)));
      case VistaCalendario.dia:
        return (_fecha, _fecha.add(const Duration(days: 1)));
    }
  }

  FiltroCalendario _filtro() {
    final (desde, hasta) = _rango();
    return FiltroCalendario(
      desde: _zona.aInstante(desde),
      hasta: _zona.aInstante(hasta),
      locales: _locales,
      inquilinos: _inquilinos,
      tipos: _tipos,
    );
  }

  String _titulo() {
    final (desde, hasta) = _rango();
    switch (_vista!) {
      case VistaCalendario.mes:
        return capitalizar(DateFormat("MMMM 'de' y", 'es').format(_fecha));
      case VistaCalendario.dia:
        return tituloDia(_fecha);
      case VistaCalendario.semana:
      case VistaCalendario.agenda:
        final fin = hasta.subtract(const Duration(days: 1));
        final corto = DateFormat('d MMM', 'es');
        final anio = desde.year == fin.year ? '' : ' ${desde.year}';
        return '${corto.format(desde)}$anio – ${corto.format(fin)} ${fin.year}';
    }
  }

  void _mover(int sentido) {
    setState(() {
      switch (_vista!) {
        case VistaCalendario.mes:
          _fecha = DateTime.utc(_fecha.year, _fecha.month + sentido);
          final hoy = _hoy();
          _seleccionado = hoy.year == _fecha.year && hoy.month == _fecha.month
              ? hoy
              : _fecha;
        case VistaCalendario.semana:
        case VistaCalendario.agenda:
          _fecha = _fecha.add(Duration(days: 7 * sentido));
          _seleccionado = _fecha;
        case VistaCalendario.dia:
          _fecha = _fecha.add(Duration(days: sentido));
          _seleccionado = _fecha;
      }
    });
  }

  void _irAHoy() => setState(() => _fecha = _seleccionado = _hoy());

  void _cambiarVista(VistaCalendario vista) {
    setState(() {
      // Desde el mes se abre la semana/día del día seleccionado.
      if (_vista == VistaCalendario.mes) _fecha = _seleccionado;
      _seleccionado = _fecha;
      _vista = vista;
    });
  }

  void _alternar(Set<String> conjunto, String valor) {
    setState(() {
      if (!conjunto.remove(valor)) conjunto.add(valor);
      // Sin tipos marcados = todos (igual que el web al vaciar el filtro).
      if (identical(conjunto, _tipos) && _tipos.isEmpty) {
        _tipos.addAll(todosLosTiposCalendario);
      }
    });
  }

  int get _filtrosActivos =>
      (_tipos.length == todosLosTiposCalendario.length ? 0 : 1) +
      (_locales.isEmpty ? 0 : 1) +
      (_inquilinos.isEmpty ? 0 : 1);

  void _abrirEvento(EventoCalendario e) {
    mostrarDetalleEvento(
      context,
      evento: e,
      esInquilino: widget.esInquilino,
      zona: _zona,
      alCambiar: () => ref.invalidate(feedCalendarioProvider),
    );
  }

  /// Inquilino: toque en un hueco. [hora] null = día completo.
  void _abrirHueco(List<EventoCalendario> eventos, DateTime dia, int? hora) {
    final inicioPared = hora == null
        ? dia
        : DateTime.utc(dia.year, dia.month, dia.day, hora);
    final inicio = _zona.aInstante(inicioPared);
    final fin = inicio.add(Duration(hours: hora == null ? 24 : 1));
    mostrarHuecoLibre(
      context,
      fechaYmd: ymd(dia),
      hhmm: hora == null ? null : '${hora.toString().padLeft(2, '0')}:00',
      ocupado: huecoOcupado(eventos, inicio, fin),
    );
  }

  Future<void> _exportarIcs() {
    final api = ref.read(apiClientProvider);
    final locales = _locales.toList()..sort();
    return descargarYCompartir(
      context,
      descargar: () => exportarIcs(api, locales: locales),
      nombreArchivo: 'plazapp-calendario.ics',
      mimeType: 'text/calendar',
    );
  }

  @override
  Widget build(BuildContext context) {
    final contenido = ContenidoPagina(
      onRefresh: () async {
        ref.invalidate(feedCalendarioProvider);
        await ref.read(feedCalendarioProvider(_filtro()).future);
      },
      children: [
        _encabezado(),
        LayoutBuilder(
          builder: (context, constraints) {
            final calendario = _calendario();
            final panel = _panelFiltros();
            if (constraints.maxWidth >= 900) {
              return Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(width: 250, child: panel),
                  const SizedBox(width: 14),
                  Expanded(child: calendario),
                ],
              );
            }
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Align(
                  alignment: Alignment.centerLeft,
                  child: OutlinedButton.icon(
                    onPressed: () =>
                        setState(() => _filtrosAbiertos = !_filtrosAbiertos),
                    icon: const Icon(Icons.tune, size: 18),
                    label: Text(
                      _filtrosAbiertos
                          ? 'Ocultar filtros'
                          : _filtrosActivos > 0
                          ? 'Filtros ($_filtrosActivos)'
                          : 'Filtros',
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                if (_filtrosAbiertos) ...[panel, const SizedBox(height: 4)],
                calendario,
              ],
            );
          },
        ),
      ],
    );

    final cuerpo = widget.esInquilino
        ? contenido
        : Can(
            permiso: 'calendario.ver',
            otherwise: const ContenidoPagina(
              children: [
                EmptyState(
                  icono: Icons.lock_outline,
                  titulo: 'No tienes permiso para ver el calendario.',
                ),
              ],
            ),
            child: contenido,
          );
    // Material propio para checkboxes, chips y tintas (la pantalla vive en el
    // cuerpo del AppScaffold).
    return Material(type: MaterialType.transparency, child: cuerpo);
  }

  Widget _encabezado() {
    final ical = OutlinedButton.icon(
      onPressed: _exportarIcs,
      icon: const Icon(Icons.download_outlined, size: 18),
      label: const Text('Exportar iCal'),
    );
    return EncabezadoPagina(
      titulo: 'Calendario',
      subtitulo: widget.esInquilino
          ? 'Tus solicitudes en todos sus estados, eventos aprobados, '
                'mantenimientos e hitos de contrato. Toca un día u hora libre '
                'para solicitar un evento.'
          : 'Solicitudes de la plaza en todos sus estados, eventos aprobados, '
                'mantenimientos programados e hitos contractuales.',
      acciones: [
        if (widget.esInquilino) ...[
          FilledButton.icon(
            onPressed: () =>
                context.push('/inquilino/solicitudes/nueva?tipo=evento'),
            icon: const Icon(Icons.add, size: 18),
            label: const Text('Nueva solicitud de evento'),
          ),
          ical,
        ] else
          Can(permiso: 'calendario.exportar_ics', child: ical),
      ],
    );
  }

  Widget _panelFiltros() {
    final opciones =
        ref.watch(opcionesCalendarioProvider(widget.esInquilino)).value ??
        const OpcionesCalendario();
    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 14, 12, 8),
        child: FiltrosCalendario(
          esInquilino: widget.esInquilino,
          opciones: opciones,
          tipos: _tipos,
          locales: _locales,
          inquilinos: _inquilinos,
          zona: _zona,
          onTipo: (v) => _alternar(_tipos, v),
          onLocal: (v) => _alternar(_locales, v),
          onInquilino: (v) => _alternar(_inquilinos, v),
          onZona: (z) => setState(() => _zona = z),
        ),
      ),
    );
  }

  Widget _calendario() {
    final c = ColoresPlazapp.of(context);
    final opciones =
        ref.watch(opcionesCalendarioProvider(widget.esInquilino)).value ??
        const OpcionesCalendario();
    final feed = ref.watch(feedCalendarioProvider(_filtro()));
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                IconButton(
                  tooltip: 'Anterior',
                  onPressed: () => _mover(-1),
                  icon: const Icon(Icons.chevron_left),
                ),
                OutlinedButton(onPressed: _irAHoy, child: const Text('Hoy')),
                IconButton(
                  tooltip: 'Siguiente',
                  onPressed: () => _mover(1),
                  icon: const Icon(Icons.chevron_right),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    _titulo(),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                for (final v in VistaCalendario.values)
                  ChoiceChip(
                    label: Text(v.etiqueta),
                    selected: _vista == v,
                    showCheckmark: false,
                    onSelected: (_) => _cambiarVista(v),
                  ),
              ],
            ),
            const SizedBox(height: 10),
            LeyendaCalendario(
              esInquilino: widget.esInquilino,
              mostrarHitos: opciones.mostrarHitos,
            ),
            const SizedBox(height: 12),
            Divider(height: 1, color: c.border),
            const SizedBox(height: 12),
            AsyncView<List<EventoCalendario>>(
              value: feed,
              onRetry: () => ref.invalidate(feedCalendarioProvider),
              data: _vistaActual,
            ),
          ],
        ),
      ),
    );
  }

  Widget _vistaActual(List<EventoCalendario> eventos) {
    final (desde, hasta) = _rango();
    final dias = [
      for (var d = desde; d.isBefore(hasta); d = d.add(const Duration(days: 1)))
        d,
    ];
    final hueco = widget.esInquilino
        ? (DateTime dia, int? hora) => _abrirHueco(eventos, dia, hora)
        : null;
    switch (_vista!) {
      case VistaCalendario.mes:
        return VistaMes(
          mes: _fecha,
          eventos: eventos,
          zona: _zona,
          seleccionado: _seleccionado,
          hoy: _hoy(),
          onSeleccionarDia: (d) => setState(() => _seleccionado = d),
          onTapEvento: _abrirEvento,
          onSolicitarEvento: hueco == null ? null : (d) => hueco(d, null),
        );
      case VistaCalendario.semana:
      case VistaCalendario.dia:
        return VistaRejilla(
          key: ValueKey('${_vista!.name}-${ymd(desde)}-${_zona.name}'),
          dias: dias,
          eventos: eventos,
          zona: _zona,
          hoy: _hoy(),
          onTapEvento: _abrirEvento,
          onTapHueco: hueco,
        );
      case VistaCalendario.agenda:
        return VistaAgenda(
          dias: dias,
          eventos: eventos,
          zona: _zona,
          onTapEvento: _abrirEvento,
        );
    }
  }
}

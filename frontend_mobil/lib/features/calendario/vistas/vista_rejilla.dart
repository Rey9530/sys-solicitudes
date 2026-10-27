import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../core/format/fechas.dart';
import '../../../core/theme/colores.dart';
import '../calendario_modelos.dart';
import '../layout_eventos.dart';
import 'evento_widgets.dart';

const _altoHora = 48.0;
const _anchoHoras = 54.0;

/// Vistas Semana (7 columnas) y Día (1 columna): rejilla de 24 horas dibujada
/// con widgets propios. Cada evento se ubica por su hora en la zona elegida;
/// los que se solapan van lado a lado (hasta 2 en semana y 4 en día, el resto
/// en un "+N" que abre la lista, como `eventMaxStack` del web). Arriba, la
/// fila de eventos de día completo.
class VistaRejilla extends StatefulWidget {
  const VistaRejilla({
    super.key,
    required this.dias,
    required this.eventos,
    required this.zona,
    required this.hoy,
    required this.onTapEvento,
    this.onTapHueco,
  });

  final List<DateTime> dias;
  final List<EventoCalendario> eventos;
  final ZonaCalendario zona;
  final DateTime hoy;
  final void Function(EventoCalendario) onTapEvento;

  /// Solo inquilino: toque en un hueco (hora `null` = fila de todo el día).
  final void Function(DateTime dia, int? hora)? onTapHueco;

  @override
  State<VistaRejilla> createState() => _VistaRejillaState();
}

class _VistaRejillaState extends State<VistaRejilla> {
  late final ScrollController _scroll;

  @override
  void initState() {
    super.initState();
    // Arranca en la hora del primer evento (o a las 7:00 si no hay).
    var primera = 7 * 60;
    for (final dia in widget.dias) {
      for (final p in _posicionados(dia)) {
        primera = math.min(primera, p.top);
      }
    }
    _scroll = ScrollController(
      initialScrollOffset: math.max(0, primera ~/ 60 - 1) * _altoHora,
    );
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  List<EventoPosicionado> _posicionados(DateTime dia) =>
      posicionarEventosDia(widget.eventos, dia, aPared: widget.zona.aPared);

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    final esSemana = widget.dias.length > 1;
    final alturaVisible = (MediaQuery.sizeOf(context).height * 0.62).clamp(
      320.0,
      760.0,
    );
    return LayoutBuilder(
      builder: (context, constraints) {
        final anchoDia =
            (constraints.maxWidth - _anchoHoras) / widget.dias.length;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                const SizedBox(width: _anchoHoras),
                for (final dia in widget.dias)
                  Expanded(
                    child: _CabeceraDia(
                      dia: dia,
                      esHoy: dia == widget.hoy,
                      compacta: esSemana,
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 4),
            _FilaTodoElDia(
              dias: widget.dias,
              eventos: widget.eventos,
              onTapEvento: widget.onTapEvento,
              onTapHueco: widget.onTapHueco,
            ),
            Container(height: 1, color: c.borderStrong),
            SizedBox(
              height: alturaVisible,
              child: SingleChildScrollView(
                controller: _scroll,
                child: SizedBox(
                  height: 24 * _altoHora,
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const _ColumnaHoras(),
                      for (final dia in widget.dias)
                        Expanded(
                          child: _ColumnaDia(
                            dia: dia,
                            posicionados: _posicionados(dia),
                            anchoDia: anchoDia,
                            maxColumnas: esSemana ? 2 : 4,
                            zona: widget.zona,
                            onTapEvento: widget.onTapEvento,
                            onTapHueco: widget.onTapHueco,
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _CabeceraDia extends StatelessWidget {
  const _CabeceraDia({
    required this.dia,
    required this.esHoy,
    required this.compacta,
  });

  final DateTime dia;
  final bool esHoy;
  final bool compacta;

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    final color = esHoy ? Theme.of(context).colorScheme.primary : c.text2;
    final nombre = DateFormat(compacta ? 'EEE' : 'EEEE', 'es').format(dia);
    return Column(
      children: [
        Text(
          compacta ? nombre.replaceAll('.', '') : capitalizar(nombre),
          maxLines: 1,
          overflow: TextOverflow.clip,
          style: TextStyle(color: c.text3, fontSize: 11),
        ),
        Text(
          '${dia.day}',
          style: TextStyle(
            color: color,
            fontSize: 15,
            fontWeight: esHoy ? FontWeight.w700 : FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

class _FilaTodoElDia extends StatelessWidget {
  const _FilaTodoElDia({
    required this.dias,
    required this.eventos,
    required this.onTapEvento,
    required this.onTapHueco,
  });

  final List<DateTime> dias;
  final List<EventoCalendario> eventos;
  final void Function(EventoCalendario) onTapEvento;
  final void Function(DateTime dia, int? hora)? onTapHueco;

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: _anchoHoras,
          child: Padding(
            padding: const EdgeInsets.only(top: 6, right: 6),
            child: Text(
              'Todo el día',
              textAlign: TextAlign.right,
              style: TextStyle(color: c.text3, fontSize: 10),
            ),
          ),
        ),
        for (final dia in dias)
          Expanded(
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: onTapHueco == null ? null : () => onTapHueco!(dia, null),
              child: Container(
                constraints: const BoxConstraints(minHeight: 30),
                padding: const EdgeInsets.all(2),
                decoration: BoxDecoration(
                  border: Border(left: BorderSide(color: c.border)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (final e in eventosTodoElDia(eventos, dia))
                      Padding(
                        padding: const EdgeInsets.only(bottom: 2),
                        child: SizedBox(
                          height: 22,
                          child: BloqueEvento(
                            evento: e,
                            maxLines: 1,
                            onTap: () => onTapEvento(e),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _ColumnaHoras extends StatelessWidget {
  const _ColumnaHoras();

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    return SizedBox(
      width: _anchoHoras,
      height: 24 * _altoHora,
      child: Stack(
        children: [
          for (var h = 0; h < 24; h++)
            Positioned(
              top: h * _altoHora + 2,
              right: 6,
              child: Text(
                hora12(h, 0),
                style: TextStyle(color: c.text3, fontSize: 10.5),
              ),
            ),
        ],
      ),
    );
  }
}

class _ColumnaDia extends StatelessWidget {
  const _ColumnaDia({
    required this.dia,
    required this.posicionados,
    required this.anchoDia,
    required this.maxColumnas,
    required this.zona,
    required this.onTapEvento,
    required this.onTapHueco,
  });

  final DateTime dia;
  final List<EventoPosicionado> posicionados;
  final double anchoDia;
  final int maxColumnas;
  final ZonaCalendario zona;
  final void Function(EventoCalendario) onTapEvento;
  final void Function(DateTime dia, int? hora)? onTapHueco;

  double _y(int minutos) => minutos / 60 * _altoHora;

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    final bloques = <Widget>[];
    final grupos = <int, List<EventoPosicionado>>{};
    for (final p in posicionados) {
      (grupos[p.grupo] ??= []).add(p);
    }
    for (final grupo in grupos.values) {
      final total = grupo.first.totalColumnas;
      final cabe = total <= maxColumnas;
      final columnas = cabe ? total : maxColumnas;
      final ancho = anchoDia / columnas;
      final ocultos = <EventoPosicionado>[];
      for (final p in grupo) {
        if (!cabe && p.columna >= maxColumnas - 1) {
          ocultos.add(p);
          continue;
        }
        final ini = zona.aPared(p.evento.inicio);
        bloques.add(
          Positioned(
            top: _y(p.top),
            height: math.max(_y(p.alto), 18),
            left: p.columna * ancho + 1,
            width: math.max(ancho - 2, 4),
            child: BloqueEvento(
              evento: p.evento,
              hora: hora12(ini.hour, ini.minute),
              maxLines: math.max(1, (_y(p.alto) - 4) ~/ 14),
              onTap: () => onTapEvento(p.evento),
            ),
          ),
        );
      }
      if (ocultos.isNotEmpty) {
        final top = ocultos.map((p) => p.top).reduce(math.min);
        final fin = ocultos.map((p) => p.top + p.alto).reduce(math.max);
        bloques.add(
          Positioned(
            top: _y(top),
            height: math.max(_y(fin - top), 22),
            left: (maxColumnas - 1) * ancho + 1,
            width: math.max(ancho - 2, 4),
            child: _MasEventos(
              cantidad: ocultos.length,
              onTap: () => mostrarListaEventos(
                context,
                titulo: tituloDia(dia),
                eventos: grupo.map((p) => p.evento).toList(),
                zona: zona,
                onTapEvento: onTapEvento,
              ),
            ),
          ),
        );
      }
    }

    return Stack(
      children: [
        Column(
          children: [
            for (var h = 0; h < 24; h++)
              GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: onTapHueco == null ? null : () => onTapHueco!(dia, h),
                child: Container(
                  height: _altoHora,
                  decoration: BoxDecoration(
                    border: Border(
                      top: BorderSide(color: c.border),
                      left: BorderSide(color: c.border),
                    ),
                  ),
                ),
              ),
          ],
        ),
        ...bloques,
      ],
    );
  }
}

/// "+N": eventos solapados que no caben a lo ancho.
class _MasEventos extends StatelessWidget {
  const _MasEventos({required this.cantidad, required this.onTap});

  final int cantidad;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    return Semantics(
      button: true,
      label: 'Ver $cantidad eventos más',
      excludeSemantics: true,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          alignment: Alignment.topCenter,
          padding: const EdgeInsets.only(top: 3),
          decoration: BoxDecoration(
            color: c.surface3,
            borderRadius: BorderRadius.circular(5),
            border: Border.all(color: c.borderStrong),
          ),
          clipBehavior: Clip.hardEdge,
          child: Text(
            '+$cantidad',
            maxLines: 1,
            overflow: TextOverflow.clip,
            style: TextStyle(
              color: c.text2,
              fontSize: 11.5,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ),
    );
  }
}

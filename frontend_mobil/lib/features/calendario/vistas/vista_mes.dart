import 'package:flutter/material.dart';

import '../../../core/format/fechas.dart';
import '../../../core/theme/colores.dart';
import '../calendario_modelos.dart';
import '../layout_eventos.dart';
import 'evento_widgets.dart';

const _diasSemana = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];

/// Máximo de puntos por día; el resto se cuenta como "+N".
const _maxPuntos = 3;

/// Vista Mes: cuadrícula de 6 semanas con puntos de color (y "+N") en los
/// días con eventos, y debajo la lista del día seleccionado.
class VistaMes extends StatelessWidget {
  const VistaMes({
    super.key,
    required this.mes,
    required this.eventos,
    required this.zona,
    required this.seleccionado,
    required this.hoy,
    required this.onSeleccionarDia,
    required this.onTapEvento,
    this.onSolicitarEvento,
  });

  /// Cualquier día del mes visible (fecha de pared).
  final DateTime mes;
  final List<EventoCalendario> eventos;
  final ZonaCalendario zona;
  final DateTime seleccionado;
  final DateTime hoy;
  final ValueChanged<DateTime> onSeleccionarDia;
  final void Function(EventoCalendario) onTapEvento;

  /// Solo inquilino: pedir un evento en el día seleccionado.
  final ValueChanged<DateTime>? onSolicitarEvento;

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    final inicio = inicioRejillaMes(mes);
    final dias = [for (var i = 0; i < 42; i++) inicio.add(Duration(days: i))];
    final delDia = eventosParaLista(eventos, seleccionado, zona);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            for (final d in _diasSemana)
              Expanded(
                child: Text(
                  d,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: c.text3,
                    fontSize: 11.5,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 4),
        for (var semana = 0; semana < 6; semana++)
          Row(
            children: [
              for (final dia in dias.skip(semana * 7).take(7))
                Expanded(
                  child: _CeldaDia(
                    key: ValueKey('dia-${ymd(dia)}'),
                    dia: dia,
                    eventos: eventosParaLista(eventos, dia, zona),
                    delMes: dia.month == mes.month,
                    esHoy: dia == hoy,
                    seleccionado: dia == seleccionado,
                    onTap: () => onSeleccionarDia(dia),
                  ),
                ),
            ],
          ),
        const SizedBox(height: 14),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          alignment: WrapAlignment.spaceBetween,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Text(
              tituloDia(seleccionado),
              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
            ),
            if (onSolicitarEvento != null)
              OutlinedButton.icon(
                onPressed: () => onSolicitarEvento!(seleccionado),
                icon: const Icon(Icons.add, size: 18),
                label: const Text('Solicitar evento este día'),
              ),
          ],
        ),
        const SizedBox(height: 10),
        if (delDia.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Text(
              'Sin eventos este día.',
              style: TextStyle(color: c.text3),
            ),
          )
        else
          for (final e in delDia)
            FilaEvento(evento: e, zona: zona, onTap: () => onTapEvento(e)),
      ],
    );
  }
}

class _CeldaDia extends StatelessWidget {
  const _CeldaDia({
    super.key,
    required this.dia,
    required this.eventos,
    required this.delMes,
    required this.esHoy,
    required this.seleccionado,
    required this.onTap,
  });

  final DateTime dia;
  final List<EventoCalendario> eventos;
  final bool delMes;
  final bool esHoy;
  final bool seleccionado;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    final primario = Theme.of(context).colorScheme.primary;
    final colorNumero = seleccionado
        ? Theme.of(context).colorScheme.onPrimary
        : esHoy
        ? primario
        : delMes
        ? c.text
        : c.textMuted;
    final extra = eventos.length - _maxPuntos;
    return Semantics(
      button: true,
      selected: seleccionado,
      label:
          '${tituloDia(dia)}, '
          '${eventos.isEmpty ? 'sin eventos' : '${eventos.length} eventos'}',
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: SizedBox(
          height: 58,
          child: Column(
            children: [
              const SizedBox(height: 4),
              Container(
                width: 28,
                height: 28,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: seleccionado ? primario : null,
                  border: esHoy && !seleccionado
                      ? Border.all(color: primario, width: 1.5)
                      : null,
                ),
                child: Text(
                  '${dia.day}',
                  style: TextStyle(
                    color: colorNumero,
                    fontSize: 13,
                    fontWeight: esHoy || seleccionado
                        ? FontWeight.w700
                        : FontWeight.w500,
                  ),
                ),
              ),
              const SizedBox(height: 4),
              SizedBox(
                height: 6,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    for (final e in eventos.take(_maxPuntos))
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 1),
                        child: PuntoEvento(color: e.colorFondo, tamano: 6),
                      ),
                  ],
                ),
              ),
              if (extra > 0)
                Text(
                  '+$extra',
                  style: TextStyle(
                    color: c.text3,
                    fontSize: 9.5,
                    height: 1.3,
                    fontWeight: FontWeight.w600,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

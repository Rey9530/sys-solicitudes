import 'package:flutter/material.dart';

import '../../../core/theme/colores.dart';
import '../../../core/widgets/estados.dart';
import '../calendario_modelos.dart';
import 'evento_widgets.dart';

/// Vista Agenda (`listWeek` del web): los eventos de la semana agrupados por
/// día, con la hora en 12 h y el número de solicitud en negrita.
class VistaAgenda extends StatelessWidget {
  const VistaAgenda({
    super.key,
    required this.dias,
    required this.eventos,
    required this.zona,
    required this.onTapEvento,
  });

  final List<DateTime> dias;
  final List<EventoCalendario> eventos;
  final ZonaCalendario zona;
  final void Function(EventoCalendario) onTapEvento;

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    final grupos = [
      for (final dia in dias) (dia, eventosParaLista(eventos, dia, zona)),
    ].where((g) => g.$2.isNotEmpty).toList();

    if (grupos.isEmpty) {
      return const EmptyState(
        icono: Icons.event_busy_outlined,
        titulo: 'No hay eventos para mostrar',
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final (dia, lista) in grupos) ...[
          Container(
            margin: const EdgeInsets.only(top: 6, bottom: 8),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: c.surface3,
              borderRadius: BorderRadius.circular(7),
            ),
            child: Text(
              tituloDia(dia),
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
          for (final e in lista)
            FilaEvento(evento: e, zona: zona, onTap: () => onTapEvento(e)),
        ],
      ],
    );
  }
}

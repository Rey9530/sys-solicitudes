import 'package:flutter/material.dart';

import '../../../core/format/fechas.dart';
import '../../../core/theme/colores.dart';
import '../../../core/widgets/badges.dart';
import '../solicitudes_modelos.dart';

/// Pestaña "Historial": línea de tiempo (más antiguo primero). `usuario` null
/// = sistema (cron de auto-asignación).
class HistorialTab extends StatelessWidget {
  const HistorialTab({super.key, required this.historial});

  final List<HistorialItem> historial;

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    final primario = Theme.of(context).colorScheme.primary;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: historial.isEmpty
            ? Text('Sin movimientos.', style: TextStyle(color: c.text3))
            : Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (final h in historial)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 14),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: 9,
                            height: 9,
                            margin: const EdgeInsets.only(top: 5, right: 10),
                            decoration: BoxDecoration(
                              color: primario,
                              shape: BoxShape.circle,
                            ),
                          ),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Wrap(
                                  spacing: 8,
                                  runSpacing: 2,
                                  crossAxisAlignment: WrapCrossAlignment.center,
                                  children: [
                                    Text(
                                      etiquetaEventoHistorial[h.evento] ??
                                          h.evento,
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                    if (h.estadoNuevo != null)
                                      Text(
                                        '→ ${etiquetaEstadoSolicitud[h.estadoNuevo] ?? h.estadoNuevo}',
                                        style: TextStyle(
                                          color: c.text3,
                                          fontSize: 12,
                                        ),
                                      ),
                                  ],
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  '${formatFecha(h.createdAt)} · '
                                  '${h.usuario?.nombre ?? 'Sistema'}',
                                  style: TextStyle(
                                    color: c.text3,
                                    fontSize: 12,
                                  ),
                                ),
                                if (h.comentario != null &&
                                    h.comentario!.isNotEmpty)
                                  Padding(
                                    padding: const EdgeInsets.only(top: 4),
                                    child: Text(
                                      h.comentario!,
                                      style: TextStyle(color: c.text2),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
      ),
    );
  }
}

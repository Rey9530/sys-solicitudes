import 'package:flutter/material.dart';

import '../../../core/theme/colores.dart';
import '../../../core/widgets/badges.dart';
import '../solicitudes_modelos.dart';

/// Opciones de estado en el orden canónico del web.
List<(String, String)> opcionesEstado() => [
  for (final e in etiquetaEstadoSolicitud.entries) (e.key, e.value),
];

/// Opciones de tipo (etiquetas base del web).
List<(String, String)> opcionesTipo() => [
  for (final e in etiquetaTipoSolicitud.entries) (e.key, e.value),
];

/// Opciones de prioridad.
List<(String, String)> opcionesPrioridad() => [
  for (final p in prioridadesSolicitud) (p, p),
];

/// Badge "⟳ 60 s" del autorefresco.
class BadgeAutorefresco extends StatelessWidget {
  const BadgeAutorefresco(this.texto, {super.key});

  final String texto;

  @override
  Widget build(BuildContext context) {
    final t = ColoresPlazapp.of(context).tono(Tono.neutral);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(
        color: t.bg,
        border: Border.all(color: t.bd),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.autorenew, size: 12, color: t.fg),
          const SizedBox(width: 4),
          Text(
            texto,
            style: TextStyle(
              color: t.fg,
              fontSize: 11.5,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

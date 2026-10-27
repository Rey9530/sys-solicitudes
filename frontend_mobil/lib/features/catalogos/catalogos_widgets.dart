import 'package:flutter/material.dart';

import '../../core/theme/colores.dart';
import '../../core/widgets/badges.dart';

/// Tarjeta de filtros de un listado (`<form className="filters">` del web):
/// en teléfono cada campo ocupa el ancho completo; en tablet van en fila.
class BarraFiltros extends StatelessWidget {
  const BarraFiltros({super.key, required this.campos, required this.botones});

  final List<Widget> campos;
  final List<Widget> botones;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: LayoutBuilder(
            builder: (context, constraints) {
              final ancho = constraints.maxWidth < 560
                  ? constraints.maxWidth
                  : 260.0;
              return Wrap(
                spacing: 12,
                runSpacing: 12,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  for (final campo in campos)
                    SizedBox(width: ancho, child: campo),
                  ...botones,
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}

/// Badge de estado activo/inactivo. [femenino] para "Activa"/"Inactiva".
class BadgeActivo extends StatelessWidget {
  const BadgeActivo(this.activo, {super.key, this.femenino = false});

  final bool activo;
  final bool femenino;

  @override
  Widget build(BuildContext context) {
    final texto = femenino
        ? (activo ? 'Activa' : 'Inactiva')
        : (activo ? 'Activo' : 'Inactivo');
    return BadgePlazapp(texto, activo ? Tono.ok : Tono.neutral);
  }
}

/// Texto secundario de una celda (`—` si no hay valor).
class TextoCelda extends StatelessWidget {
  const TextoCelda(this.texto, {super.key, this.mono = false});

  final String? texto;
  final bool mono;

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    final vacio = texto == null || texto!.isEmpty;
    return Text(
      vacio ? '—' : texto!,
      maxLines: 2,
      overflow: TextOverflow.ellipsis,
      style: TextStyle(
        color: c.text3,
        fontFamily: mono ? 'monospace' : null,
        fontSize: mono ? 12.5 : null,
      ),
    );
  }
}

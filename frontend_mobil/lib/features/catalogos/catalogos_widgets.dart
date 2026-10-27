import 'package:flutter/material.dart';

import '../../core/theme/colores.dart';
import '../../core/widgets/badges.dart';

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

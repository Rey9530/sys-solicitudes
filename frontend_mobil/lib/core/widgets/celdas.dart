import 'package:flutter/material.dart';

import '../theme/colores.dart';

/// Texto secundario de una celda de `ListaResponsive` (`—` si no hay valor).
/// Máximo 2 líneas: en tabla la fila mide como máximo 72 px. [mono] para
/// códigos, emails e identificaciones.
class TextoCelda extends StatelessWidget {
  const TextoCelda(this.texto, {super.key, this.mono = false});

  final String? texto;
  final bool mono;

  @override
  Widget build(BuildContext context) {
    final vacio = texto == null || texto!.isEmpty;
    return Text(
      vacio ? '—' : texto!,
      maxLines: 2,
      overflow: TextOverflow.ellipsis,
      style: TextStyle(
        color: ColoresPlazapp.of(context).text2,
        fontFamily: mono ? 'monospace' : null,
      ),
    );
  }
}

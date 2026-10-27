import 'package:flutter/material.dart';

/// Campos de filtro o de formulario en columnas según el ancho disponible
/// (`.filters` del web): 1 columna en teléfono, 2 en tablet vertical, 3 en
/// tablet horizontal. Lo usan reportes, auditoría, log de emails,
/// configuración y "Nueva plaza".
class RejillaCampos extends StatelessWidget {
  const RejillaCampos({
    super.key,
    required this.children,
    this.maxColumnas = 3,
  });

  final List<Widget> children;
  final int maxColumnas;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final ancho = constraints.maxWidth;
        final columnas = ancho >= 860
            ? maxColumnas
            : ancho >= 520
            ? (maxColumnas < 2 ? maxColumnas : 2)
            : 1;
        const gap = 12.0;
        final anchoCampo = (ancho - gap * (columnas - 1)) / columnas;
        return Wrap(
          spacing: gap,
          runSpacing: 12,
          children: [
            for (final c in children) SizedBox(width: anchoCampo, child: c),
          ],
        );
      },
    );
  }
}

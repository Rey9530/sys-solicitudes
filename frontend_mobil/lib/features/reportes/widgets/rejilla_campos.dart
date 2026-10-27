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

/// Selector (`<select>` del web) con opción "Todos"/"Todas" para `null`.
/// Los textos largos se recortan con "…".
class SelectorFiltro<T> extends StatelessWidget {
  const SelectorFiltro({
    super.key,
    required this.etiqueta,
    required this.valor,
    required this.opciones,
    required this.onChanged,
    this.textoTodos = 'Todos',
  });

  final String etiqueta;
  final T? valor;
  final List<(T, String)> opciones;
  final ValueChanged<T?> onChanged;

  /// Texto de la opción vacía; `null` = sin opción vacía.
  final String? textoTodos;

  @override
  Widget build(BuildContext context) {
    final existe = opciones.any((o) => o.$1 == valor);
    return DropdownButtonFormField<T?>(
      // La clave recrea el campo si el valor cambia desde fuera ("Limpiar").
      key: ValueKey('$etiqueta·$valor'),
      initialValue: existe ? valor : null,
      isExpanded: true,
      decoration: InputDecoration(labelText: etiqueta),
      items: [
        if (textoTodos != null) DropdownMenuItem<T?>(child: Text(textoTodos!)),
        for (final (v, texto) in opciones)
          DropdownMenuItem<T?>(
            value: v,
            child: Text(texto, overflow: TextOverflow.ellipsis),
          ),
      ],
      onChanged: onChanged,
    );
  }
}

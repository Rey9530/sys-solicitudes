import 'package:flutter/material.dart';

/// Lista desplegable (`<select>` del web). Es la única para elegir un valor de
/// una lista, en filtros y en formularios.
///
/// - [opciones]: pares (valor, texto visible). Los textos largos se recortan
///   con «…».
/// - [opcionVacia]: texto de la opción `null` («Todos», «Selecciona…»). Si es
///   `null` no hay opción vacía y, mientras no se elija nada, se ve [hint].
/// - Si [valor] no está entre las opciones, el campo se muestra vacío.
/// - Es controlado: si [valor] cambia desde fuera (p. ej. «Limpiar») el campo
///   lo refleja.
/// - Dentro de un `Form`, [validator] se evalúa con `validate()`.
class CampoSelect<T> extends StatelessWidget {
  const CampoSelect({
    super.key,
    required this.label,
    required this.valor,
    required this.opciones,
    required this.onChanged,
    this.opcionVacia,
    this.hint,
    this.ayuda,
    this.validator,
    this.enabled = true,
  });

  final String label;
  final T? valor;
  final List<(T, String)> opciones;
  final ValueChanged<T?> onChanged;
  final String? opcionVacia;
  final String? hint;

  /// Texto de ayuda bajo el campo.
  final String? ayuda;
  final FormFieldValidator<T?>? validator;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final existe = valor != null && opciones.any((o) => o.$1 == valor);
    return DropdownButtonFormField<T?>(
      initialValue: existe ? valor : null,
      isExpanded: true,
      hint: hint == null ? null : Text(hint!, overflow: TextOverflow.ellipsis),
      decoration: InputDecoration(
        labelText: label,
        helperText: ayuda,
        enabled: enabled,
      ),
      validator: validator,
      items: [
        if (opcionVacia != null)
          DropdownMenuItem<T?>(child: _texto(opcionVacia!)),
        for (final (v, texto) in opciones)
          DropdownMenuItem<T?>(value: v, child: _texto(texto)),
      ],
      onChanged: enabled ? onChanged : null,
    );
  }

  Widget _texto(String texto) =>
      Text(texto, maxLines: 1, overflow: TextOverflow.ellipsis);
}

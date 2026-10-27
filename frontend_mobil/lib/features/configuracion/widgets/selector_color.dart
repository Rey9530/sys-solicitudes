import 'package:flutter/material.dart';

import '../../../core/theme/colores.dart';

/// Paleta predefinida (Flutter no trae selector de color y no se agrega un
/// paquete, decisión del spec §4.7). El primero es el color por defecto de
/// una plaza nueva.
const paletaColores = [
  '#2563eb',
  '#2f62e6',
  '#0ea5e9',
  '#0891b2',
  '#059669',
  '#16a34a',
  '#ca8a04',
  '#ea580c',
  '#dc2626',
  '#db2777',
  '#7c3aed',
  '#475569',
];

/// `HexColorSchema`: `#RRGGBB`.
bool esHexValido(String valor) =>
    RegExp(r'^#[0-9a-fA-F]{6}$').hasMatch(valor.trim());

/// Color de marca: paleta de 12 colores + campo HEX `#RRGGBB` (equivalente al
/// `<input type="color">` + campo HEX del web). Un HEX inválido muestra el
/// error bajo el campo; quien lo usa bloquea "Guardar" con [esHexValido].
class SelectorColor extends StatefulWidget {
  const SelectorColor({
    super.key,
    required this.valor,
    required this.onChanged,
    this.etiqueta = 'Color primario',
    this.enabled = true,
  });

  final String valor;
  final ValueChanged<String> onChanged;
  final String etiqueta;
  final bool enabled;

  @override
  State<SelectorColor> createState() => _SelectorColorState();
}

class _SelectorColorState extends State<SelectorColor> {
  late final _hex = TextEditingController(text: widget.valor);

  @override
  void didUpdateWidget(SelectorColor old) {
    super.didUpdateWidget(old);
    if (widget.valor != _hex.text) _hex.text = widget.valor;
  }

  @override
  void dispose() {
    _hex.dispose();
    super.dispose();
  }

  void _elegir(String hex) {
    _hex.text = hex;
    widget.onChanged(hex);
  }

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    final actual = widget.valor.trim().toLowerCase();
    final valido = esHexValido(widget.valor);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(widget.etiqueta, style: TextStyle(color: c.text3, fontSize: 12.5)),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final hex in paletaColores)
              Semantics(
                button: true,
                selected: hex == actual,
                label: 'Color $hex',
                child: InkWell(
                  key: Key('color-$hex'),
                  customBorder: const CircleBorder(),
                  onTap: widget.enabled ? () => _elegir(hex) : null,
                  child: Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: colorDesdeHex(hex),
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: hex == actual ? c.text : c.border,
                        width: hex == actual ? 3 : 1,
                      ),
                    ),
                    child: hex == actual
                        ? const Icon(Icons.check, color: Colors.white, size: 20)
                        : null,
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 12),
        TextField(
          key: const Key('color-hex'),
          controller: _hex,
          enabled: widget.enabled,
          maxLength: 7,
          autocorrect: false,
          decoration: InputDecoration(
            labelText: 'HEX',
            hintText: '#RRGGBB',
            counterText: '',
            errorText: valido ? null : 'Color debe ser HEX (#RRGGBB)',
            prefixIcon: Padding(
              padding: const EdgeInsets.all(10),
              child: Container(
                width: 20,
                height: 20,
                decoration: BoxDecoration(
                  color: valido ? colorDesdeHex(widget.valor) : c.surface3,
                  borderRadius: BorderRadius.circular(5),
                  border: Border.all(color: c.borderStrong),
                ),
              ),
            ),
          ),
          onChanged: (v) => widget.onChanged(v.trim()),
        ),
      ],
    );
  }
}

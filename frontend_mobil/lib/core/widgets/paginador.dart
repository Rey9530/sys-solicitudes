import 'package:flutter/material.dart';

import '../theme/colores.dart';

/// Páginas visibles: primera, última, la actual y sus vecinas; `null` = "…".
/// Mismo algoritmo que el paginador del web.
List<int?> paginasVisibles(int pagina, int total) {
  final candidatas = {
    1,
    total,
    pagina - 1,
    pagina,
    pagina + 1,
  }.where((p) => p >= 1 && p <= total).toList()..sort();
  final out = <int?>[];
  var anterior = 0;
  for (final p in candidatas) {
    if (p - anterior == 2) {
      out.add(anterior + 1);
    } else if (p - anterior > 2) {
      out.add(null);
    }
    out.add(p);
    anterior = p;
  }
  return out;
}

/// "Página X de Y" + ‹ › (con números si hay espacio). Oculto con 1 página.
class Paginador extends StatelessWidget {
  const Paginador({
    super.key,
    required this.pagina,
    required this.totalPaginas,
    required this.onCambiar,
  });

  final int pagina;
  final int totalPaginas;
  final ValueChanged<int> onCambiar;

  @override
  Widget build(BuildContext context) {
    if (totalPaginas <= 1) return const SizedBox.shrink();
    final c = ColoresPlazapp.of(context);
    final primario = Theme.of(context).colorScheme.primary;
    return LayoutBuilder(
      builder: (context, constraints) {
        final conNumeros = constraints.maxWidth >= 480;
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: 12,
            runSpacing: 8,
            children: [
              Text(
                'Página $pagina de $totalPaginas',
                style: TextStyle(color: c.text3, fontSize: 12.5),
              ),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(
                    tooltip: 'Página anterior',
                    onPressed: pagina > 1 ? () => onCambiar(pagina - 1) : null,
                    icon: const Icon(Icons.chevron_left),
                  ),
                  if (conNumeros)
                    for (final p in paginasVisibles(pagina, totalPaginas))
                      p == null
                          ? Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 4,
                              ),
                              child: Text(
                                '…',
                                style: TextStyle(color: c.text3),
                              ),
                            )
                          : SizedBox(
                              width: 40,
                              height: 40,
                              child: TextButton(
                                style: TextButton.styleFrom(
                                  padding: EdgeInsets.zero,
                                  minimumSize: const Size(40, 40),
                                  backgroundColor: p == pagina
                                      ? primario
                                      : null,
                                  foregroundColor: p == pagina
                                      ? Colors.white
                                      : c.text2,
                                ),
                                onPressed: p == pagina
                                    ? null
                                    : () => onCambiar(p),
                                child: Text('$p'),
                              ),
                            )
                  else
                    Container(
                      width: 40,
                      height: 40,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: primario,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        '$pagina',
                        style: const TextStyle(color: Colors.white),
                      ),
                    ),
                  IconButton(
                    tooltip: 'Página siguiente',
                    onPressed: pagina < totalPaginas
                        ? () => onCambiar(pagina + 1)
                        : null,
                    icon: const Icon(Icons.chevron_right),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }
}

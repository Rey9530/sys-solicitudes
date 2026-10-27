import 'package:flutter/material.dart';

import '../theme/colores.dart';
import 'estados.dart';

/// Columna de [ListaResponsive]. La columna [principal] es el título de la
/// tarjeta; las demás se muestran como pares etiqueta/valor.
class ColumnaLista<T> {
  const ColumnaLista({
    required this.titulo,
    required this.celda,
    this.principal = false,
    this.ocultarEnTarjeta = false,
  });

  final String titulo;
  final Widget Function(T item) celda;
  final bool principal;
  final bool ocultarEnTarjeta;
}

/// Ancho desde el que se muestra tabla en lugar de tarjetas.
const anchoTabla = 900.0;

/// Equivalente a `ResponsiveDataView` del web: tarjetas en teléfono y tablet
/// vertical; tabla (con scroll horizontal si no cabe) cuando hay espacio.
///
/// No hace scroll vertical propio: va dentro de la página.
class ListaResponsive<T> extends StatelessWidget {
  const ListaResponsive({
    super.key,
    required this.items,
    required this.columnas,
    this.acciones,
    this.onTap,
    this.vacio,
  });

  final List<T> items;
  final List<ColumnaLista<T>> columnas;
  final Widget Function(T item)? acciones;
  final void Function(T item)? onTap;
  final Widget? vacio;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return Card(
        child:
            vacio ??
            const EmptyState(
              icono: Icons.inbox_outlined,
              titulo: 'Sin resultados',
            ),
      );
    }
    return LayoutBuilder(
      builder: (context, constraints) => constraints.maxWidth >= anchoTabla
          ? _tabla(context, constraints.maxWidth)
          : _tarjetas(context),
    );
  }

  Widget _tabla(BuildContext context, double ancho) {
    final c = ColoresPlazapp.of(context);
    return Card(
      clipBehavior: Clip.antiAlias,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: ConstrainedBox(
          constraints: BoxConstraints(minWidth: ancho),
          child: DataTable(
            showCheckboxColumn: false,
            headingRowHeight: 40,
            dataRowMinHeight: 52,
            dataRowMaxHeight: 72,
            headingTextStyle: TextStyle(
              color: c.text3,
              fontSize: 11.5,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.4,
            ),
            columns: [
              for (final col in columnas)
                DataColumn(label: Text(col.titulo.toUpperCase())),
              if (acciones != null) const DataColumn(label: Text('')),
            ],
            rows: [
              for (final item in items)
                DataRow(
                  onSelectChanged: onTap == null ? null : (_) => onTap!(item),
                  cells: [
                    for (final col in columnas)
                      DataCell(
                        ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 280),
                          child: col.celda(item),
                        ),
                      ),
                    if (acciones != null) DataCell(acciones!(item)),
                  ],
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _tarjetas(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    final principal =
        columnas.where((col) => col.principal).firstOrNull ?? columnas.first;
    final resto = columnas.where(
      (col) => col != principal && !col.ocultarEnTarjeta,
    );
    return Column(
      children: [
        for (final item in items)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Card(
              clipBehavior: Clip.antiAlias,
              child: InkWell(
                onTap: onTap == null ? null : () => onTap!(item),
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      DefaultTextStyle.merge(
                        style: const TextStyle(fontWeight: FontWeight.w600),
                        child: principal.celda(item),
                      ),
                      const SizedBox(height: 8),
                      for (final col in resto)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 3),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.center,
                            children: [
                              SizedBox(
                                width: 110,
                                child: Text(
                                  col.titulo.toUpperCase(),
                                  style: TextStyle(
                                    color: c.textMuted,
                                    fontSize: 10.5,
                                    letterSpacing: 0.4,
                                  ),
                                ),
                              ),
                              Expanded(
                                child: Align(
                                  alignment: Alignment.centerLeft,
                                  child: col.celda(item),
                                ),
                              ),
                            ],
                          ),
                        ),
                      if (acciones != null) ...[
                        const Divider(height: 20),
                        acciones!(item),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

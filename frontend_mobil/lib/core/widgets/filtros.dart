import 'package:flutter/material.dart';

/// Campos de formulario o de filtro en columnas según el ancho disponible
/// (`.filters` del web): 1 columna en teléfono (< 520 px), 2 en tablet
/// vertical y [maxColumnas] desde 860 px. Separación de 12 px entre campos
/// y entre filas; sin margen exterior.
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

/// Tarjeta de filtros de un listado (`<form className="filters">` del web).
///
/// - Por defecto los [campos] van en una [RejillaCampos] de hasta 4 columnas
///   y debajo, a la derecha, «Filtrar» ([onFiltrar]) y las [acciones].
/// - [enLinea]: cada campo con ancho fijo en tablet (ancho completo en
///   teléfono; para otro ancho, envolverlo en [CampoFiltro]) y «Filtrar» y
///   las [acciones] a continuación, en la misma línea.
/// - [plegable]: en teléfono (< 600 px) va plegada bajo «Filtros» para no
///   tapar la lista.
class TarjetaFiltros extends StatelessWidget {
  const TarjetaFiltros({
    super.key,
    required this.campos,
    this.onFiltrar,
    this.acciones = const [],
    this.enLinea = false,
    this.plegable = false,
  });

  final List<Widget> campos;

  /// Si no es null, muestra el botón «Filtrar» (el web aplica al enviar).
  final VoidCallback? onFiltrar;

  /// Otros botones («Limpiar», «Nuevo …»), después de «Filtrar».
  final List<Widget> acciones;
  final bool enLinea;
  final bool plegable;

  @override
  Widget build(BuildContext context) {
    final botones = [
      if (onFiltrar != null)
        OutlinedButton(
          key: const Key('filtros-aplicar'),
          onPressed: onFiltrar,
          child: const Text('Filtrar'),
        ),
      ...acciones,
    ];
    final Widget cuerpo = enLinea
        ? Wrap(
            spacing: 12,
            runSpacing: 12,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              for (final campo in campos)
                campo is CampoFiltro ? campo : CampoFiltro(child: campo),
              ...botones,
            ],
          )
        : Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              RejillaCampos(maxColumnas: 4, children: campos),
              if (botones.isNotEmpty) ...[
                const SizedBox(height: 12),
                Align(
                  alignment: Alignment.centerRight,
                  child: Wrap(spacing: 8, runSpacing: 8, children: botones),
                ),
              ],
            ],
          );
    final plegada = plegable && MediaQuery.sizeOf(context).width < 600;
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Card(
        clipBehavior: Clip.antiAlias,
        child: plegada
            ? ExpansionTile(
                key: const Key('filtros-plegables'),
                title: const Text('Filtros'),
                shape: const Border(),
                collapsedShape: const Border(),
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
                    child: cuerpo,
                  ),
                ],
              )
            : Padding(padding: const EdgeInsets.all(16), child: cuerpo),
      ),
    );
  }
}

/// Campo de una [TarjetaFiltros] `enLinea` con un [ancho] distinto del de por
/// defecto (260 px). En teléfono (< 520 px) ocupa el ancho completo.
class CampoFiltro extends StatelessWidget {
  const CampoFiltro({super.key, required this.child, this.ancho = 260});

  final Widget child;
  final double ancho;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) => SizedBox(
        width: constraints.maxWidth < 520 ? constraints.maxWidth : ancho,
        child: child,
      ),
    );
  }
}

import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../theme/colores.dart';

/// Ancho máximo del contenido en tablets grandes.
const anchoMaximoContenido = 1100.0;

/// Contenido scrolleable de una pantalla: padding de 16 px y ancho máximo
/// centrado. Con [onRefresh], "tirar para actualizar".
class ContenidoPagina extends StatelessWidget {
  const ContenidoPagina({super.key, required this.children, this.onRefresh});

  final List<Widget> children;
  final Future<void> Function()? onRefresh;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final lateral = math.max(
          16.0,
          (constraints.maxWidth - anchoMaximoContenido) / 2,
        );
        final lista = ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: EdgeInsets.fromLTRB(lateral, 16, lateral, 32),
          children: children,
        );
        return onRefresh == null
            ? lista
            : RefreshIndicator(onRefresh: onRefresh!, child: lista);
      },
    );
  }
}

/// Encabezado de pantalla (`PageHeader` del web): volver, título con badges,
/// subtítulo y acciones (que bajan de línea si no caben).
class EncabezadoPagina extends StatelessWidget {
  const EncabezadoPagina({
    super.key,
    required this.titulo,
    this.subtitulo,
    this.badges = const [],
    this.acciones = const [],
    this.rutaVolver,
  });

  final String titulo;
  final String? subtitulo;
  final List<Widget> badges;
  final List<Widget> acciones;

  /// Si no es null, muestra "volver": hace `pop` si se llegó con `push`, si no
  /// navega a esta ruta.
  final String? rutaVolver;

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (rutaVolver != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: TextButton.icon(
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  foregroundColor: c.text3,
                ),
                onPressed: () =>
                    context.canPop() ? context.pop() : context.go(rutaVolver!),
                icon: const Icon(Icons.arrow_back, size: 18),
                label: const Text('Volver'),
              ),
            ),
          Wrap(
            spacing: 10,
            runSpacing: 6,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Text(
                titulo,
                style: Theme.of(context).textTheme.headlineSmall
                    ?.copyWith(fontWeight: FontWeight.w600, fontSize: 22),
              ),
              ...badges,
            ],
          ),
          if (subtitulo != null) ...[
            const SizedBox(height: 4),
            Text(subtitulo!, style: TextStyle(color: c.text3, fontSize: 13.5)),
          ],
          if (acciones.isNotEmpty) ...[
            const SizedBox(height: 12),
            Wrap(spacing: 8, runSpacing: 8, children: acciones),
          ],
        ],
      ),
    );
  }
}

/// Tarjeta con título de sección.
class Seccion extends StatelessWidget {
  const Seccion({super.key, this.titulo, required this.child, this.acciones});

  final String? titulo;
  final Widget child;
  final List<Widget>? acciones;

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (titulo != null || acciones != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Wrap(
                    alignment: WrapAlignment.spaceBetween,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      if (titulo != null)
                        Text(
                          titulo!.toUpperCase(),
                          style: TextStyle(
                            color: c.text3,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 0.6,
                          ),
                        ),
                      ...?acciones,
                    ],
                  ),
                ),
              child,
            ],
          ),
        ),
      ),
    );
  }
}

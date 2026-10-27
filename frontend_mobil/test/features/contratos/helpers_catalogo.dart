import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// Recorre la página de arriba abajo (300 px por paso) y falla si algo
/// desborda. `probarEnTamanos` solo ve lo que está en pantalla: el `ListView`
/// de `ContenidoPagina` no construye lo que queda debajo.
Future<void> recorrerPagina(WidgetTester tester) async {
  final estado = tester.state<ScrollableState>(find.byType(Scrollable).first);
  final pos = estado.position;
  while (pos.pixels < pos.maxScrollExtent) {
    pos.jumpTo(min(pos.pixels + 300, pos.maxScrollExtent));
    await tester.pump();
    expect(tester.takeException(), isNull, reason: 'scroll ${pos.pixels}');
  }
  pos.jumpTo(0);
  await tester.pumpAndSettle();
}

/// Lleva [f] a la vista dentro de la página (aunque aún no esté construido).
Future<void> verEnPagina(WidgetTester tester, Finder f) async {
  await tester.scrollUntilVisible(
    f,
    250,
    scrollable: find.byType(Scrollable).first,
  );
  await tester.pumpAndSettle();
}

/// Toca cada pestaña, recorre su contenido y falla si algo desborda.
Future<void> recorrerPestanas(
  WidgetTester tester,
  List<String> etiquetas,
) async {
  for (final etiqueta in etiquetas) {
    final pestana = find.widgetWithText(Tab, etiqueta);
    await tester.ensureVisible(pestana);
    await tester.pumpAndSettle();
    await tester.tap(pestana);
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull, reason: 'pestaña $etiqueta');
    await recorrerPagina(tester);
  }
}

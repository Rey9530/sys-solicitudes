import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend_mobil/app.dart';
import 'package:frontend_mobil/core/auth/sesion_controller.dart';
import 'package:frontend_mobil/core/navegacion/menu.dart';
import 'package:frontend_mobil/core/navegacion/router.dart';
import 'package:frontend_mobil/core/plaza/plaza_seleccionada.dart';
import 'package:frontend_mobil/core/widgets/estados.dart';
import 'package:integration_test/integration_test.dart';

import 'helpers.dart';

/// Recorre, para cada rol, todas las pantallas de su menú contra el backend
/// real: ninguna debe terminar en error ni desbordarse. Guarda una captura
/// por pantalla (revisión visual por dispositivo).
void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  Future<void> recorrer(WidgetTester tester, String prefijo) async {
    final container = ProviderScope.containerOf(
      tester.element(find.byType(PlazappApp)),
    );
    final sesion = container.read(sesionProvider).value!;
    final conPlaza = container.read(plazaSeleccionadaProvider) != null;
    final router = container.read(routerProvider);
    for (final item in menuPara(sesion, conPlaza: conPlaza)) {
      router.go(item.ruta);
      await esperarCarga(tester);
      expect(
        find.byType(ErrorView),
        findsNothing,
        reason: '${item.ruta} terminó en error',
      );
      final nombre = item.ruta.replaceAll('/', '_').replaceFirst('_', '');
      await captura(binding, tester, '$prefijo-$nombre');
    }
  }

  testWidgets('admin de plaza: todas las pantallas', (tester) async {
    await arrancarApp(tester);
    await iniciarSesion(tester, 'admin@demo.com');
    await recorrer(tester, 'admin');
    await cerrarSesion(tester);
  });

  testWidgets('inquilino: todas las pantallas', (tester) async {
    await arrancarApp(tester);
    await iniciarSesion(tester, 'inquilino@demo.com');
    await recorrer(tester, 'inquilino');
    await cerrarSesion(tester);
  });

  testWidgets('superadmin: global y con plaza seleccionada', (tester) async {
    await arrancarApp(tester);
    await iniciarSesion(tester, 'superadmin@plazapp.com');
    await recorrer(tester, 'superadmin');
    // Impersonar la plaza demo y recorrer las pantallas de plaza.
    final container = ProviderScope.containerOf(
      tester.element(find.byType(PlazappApp)),
    );
    final plazas = await container.read(plazasProvider.future);
    final demo = plazas.firstWhere((p) => p.slug == 'demo');
    await container
        .read(plazaSeleccionadaProvider.notifier)
        .seleccionar(demo.id);
    await tester.pump();
    await recorrer(tester, 'superadmin-plaza');
    await container.read(plazaSeleccionadaProvider.notifier).seleccionar(null);
    await cerrarSesion(tester);
  });
}

/// Espera a que no quede ningún indicador de carga (datos reales del backend).
Future<void> esperarCarga(WidgetTester tester) async {
  final inicio = DateTime.now();
  await tester.pump(const Duration(milliseconds: 300));
  while (DateTime.now().difference(inicio) < const Duration(seconds: 20)) {
    await tester.pump(const Duration(milliseconds: 200));
    if (find.byType(CircularProgressIndicator).evaluate().isEmpty) break;
  }
  await tester.pump(const Duration(milliseconds: 500));
}

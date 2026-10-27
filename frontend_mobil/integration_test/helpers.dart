import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend_mobil/core/api/api_providers.dart';
import 'package:frontend_mobil/app.dart';
import 'package:frontend_mobil/core/auth/token_storage.dart';
import 'package:frontend_mobil/core/navegacion/router.dart';
import 'package:integration_test/integration_test.dart';
import 'package:intl/date_symbol_data_local.dart';

/// Contraseña de las cuentas seed de desarrollo.
const passwordDemo = 'Plazapp2026!';

/// Arranca la app real (backend de `API_BASE_URL`) sin sesión guardada.
Future<void> arrancarApp(WidgetTester tester) async {
  await initializeDateFormatting('es');
  await SecureTokenStorage().borrar();
  await tester.pumpWidget(
    const ProviderScope(retry: politicaReintentos, child: PlazappApp()),
  );
  await esperar(tester, find.text('Inicia sesión'));
}

/// Inicia sesión por la UI. Si el backend limita el login (5/min por IP),
/// espera los segundos que indique el mensaje y reintenta.
Future<void> iniciarSesion(WidgetTester tester, String email) async {
  for (var intento = 0; intento < 3; intento++) {
    await tester.enterText(find.byKey(const Key('login-email')), email);
    await tester.enterText(
      find.byKey(const Key('login-password')),
      passwordDemo,
    );
    await tester.tap(find.byKey(const Key('login-enviar')));
    await tester.pump(const Duration(milliseconds: 300));
    final limite = find.textContaining('Demasiados intentos');
    final inicio = DateTime.now();
    while (DateTime.now().difference(inicio) < const Duration(seconds: 20)) {
      await tester.pump(const Duration(milliseconds: 250));
      if (find.text('Inicia sesión').evaluate().isEmpty) return;
      if (limite.evaluate().isNotEmpty) break;
    }
    if (limite.evaluate().isEmpty) break;
    final texto = (tester.widget<Text>(limite.first).data ?? '');
    final segundos =
        int.tryParse(RegExp(r'(\d+) s').firstMatch(texto)?[1] ?? '') ?? 60;
    await Future<void>.delayed(Duration(seconds: segundos + 1));
  }
  expect(
    find.text('Inicia sesión'),
    findsNothing,
    reason: 'No se pudo iniciar sesión como $email',
  );
}

/// Espera hasta que [finder] aparezca (las llamadas al backend son reales).
Future<void> esperar(
  WidgetTester tester,
  Finder finder, {
  Duration maximo = const Duration(seconds: 20),
}) async {
  final inicio = DateTime.now();
  while (DateTime.now().difference(inicio) < maximo) {
    await tester.pump(const Duration(milliseconds: 200));
    if (finder.evaluate().isNotEmpty) return;
  }
  expect(finder, findsWidgets, reason: 'No apareció a tiempo');
}

bool _superficieConvertida = false;

/// Captura de pantalla con nombre (la guarda el driver). Deja pintar unos
/// cuadros antes: la captura toma el último frame ya rasterizado.
Future<void> captura(
  IntegrationTestWidgetsFlutterBinding binding,
  WidgetTester tester,
  String nombre,
) async {
  // En Android la superficie se convierte una sola vez por ejecución.
  if (Platform.isAndroid && !_superficieConvertida) {
    await binding.convertFlutterSurfaceToImage();
    _superficieConvertida = true;
  }
  for (var i = 0; i < 5; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
  await binding.takeScreenshot(nombre);
}

/// Cierra sesión desde el menú de usuario.
Future<void> cerrarSesion(WidgetTester tester) async {
  await tester.tap(find.byKey(const Key('menu-usuario')));
  await tester.pumpAndSettle();
  await tester.tap(find.byKey(const Key('cerrar-sesion')));
  await esperar(tester, find.text('Inicia sesión'));
}

/// Ruta actual del router (incluye las abiertas con push/pushReplacement).
String rutaActual(WidgetTester tester) {
  final container = ProviderScope.containerOf(
    tester.element(find.byType(PlazappApp)),
  );
  return container.read(routerProvider).state.uri.path;
}

/// Navega a [ruta] como un enlace profundo.
Future<void> irA(WidgetTester tester, String ruta) async {
  final container = ProviderScope.containerOf(
    tester.element(find.byType(PlazappApp)),
  );
  container.read(routerProvider).go(ruta);
  await tester.pump(const Duration(milliseconds: 500));
}

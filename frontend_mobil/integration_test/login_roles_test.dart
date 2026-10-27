import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend_mobil/app.dart';
import 'package:frontend_mobil/core/auth/sesion.dart';
import 'package:frontend_mobil/core/navegacion/menu.dart';
import 'package:frontend_mobil/core/plaza/plaza_seleccionada.dart';
import 'package:integration_test/integration_test.dart';

import 'helpers.dart';

/// Acceso por rol contra el backend real (espejo de `frontend/e2e/acceso.spec.ts`):
/// credenciales inválidas, pantalla de inicio de cada rol, rutas de otro rol
/// que redirigen al inicio propio, puerta de plaza del superadmin y rutas
/// protegidas sin sesión.
void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('acceso y redirecciones por rol', (tester) async {
    await arrancarApp(tester);

    // Credenciales inválidas (cuenta inexistente: no bloquea cuentas seed).
    await tester.enterText(
      find.byKey(const Key('login-email')),
      'no-existe@demo.com',
    );
    await tester.enterText(
      find.byKey(const Key('login-password')),
      'ClaveIncorrecta1!',
    );
    await tester.tap(find.byKey(const Key('login-enviar')));
    await esperar(
      tester,
      find.textContaining(RegExp('incorrectos|Demasiados intentos')),
    );
    expect(find.text('Inicia sesión'), findsWidgets);
    await captura(binding, tester, 'acceso-01-credenciales-invalidas');

    // Inquilino: su inicio y nada de /admin ni /superadmin.
    await iniciarSesion(tester, 'inquilino@demo.com');
    await esperarRuta(tester, homePara(Rol.inquilino));
    await irA(tester, '/admin/dashboard');
    await esperarRuta(tester, homePara(Rol.inquilino));
    await irA(tester, '/superadmin/plazas');
    await esperarRuta(tester, homePara(Rol.inquilino));
    await cerrarSesion(tester);

    // Admin de plaza: su inicio y nada de /inquilino ni /superadmin.
    await iniciarSesion(tester, 'admin@demo.com');
    await esperarRuta(tester, homePara(Rol.adminPlaza));
    await irA(tester, '/inquilino/solicitudes');
    await esperarRuta(tester, homePara(Rol.adminPlaza));
    await irA(tester, '/superadmin/plazas');
    await esperarRuta(tester, homePara(Rol.adminPlaza));
    await cerrarSesion(tester);

    // Superadmin: inicio en Plazas (como el web); una pantalla de plaza sin plaza elegida
    // muestra la puerta, nunca un error del backend.
    await iniciarSesion(tester, 'superadmin@plazapp.com');
    await esperarRuta(tester, homePara(Rol.superadmin));
    final container = ProviderScope.containerOf(
      tester.element(find.byType(PlazappApp)),
    );
    await container.read(plazaSeleccionadaProvider.notifier).seleccionar(null);
    await irA(tester, '/admin/locales');
    await esperar(tester, find.text('Selecciona una plaza para operar'));
    await captura(binding, tester, 'acceso-02-superadmin-sin-plaza');
    await irA(tester, '/inquilino/solicitudes');
    await esperarRuta(tester, homePara(Rol.superadmin));
    await cerrarSesion(tester);

    // Sin sesión: cualquier ruta protegida lleva al login.
    await irA(tester, '/admin/solicitudes');
    await esperar(tester, find.text('Inicia sesión'));
    expect(rutaActual(tester), '/login');
  });
}

/// Espera a que el router quede en [ruta] (las redirecciones son asíncronas
/// mientras carga la sesión).
Future<void> esperarRuta(WidgetTester tester, String ruta) async {
  final inicio = DateTime.now();
  while (DateTime.now().difference(inicio) < const Duration(seconds: 20)) {
    await tester.pump(const Duration(milliseconds: 200));
    if (rutaActual(tester) == ruta) return;
  }
  expect(rutaActual(tester), ruta);
}

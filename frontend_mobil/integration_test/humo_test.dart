import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'helpers.dart';

/// Humo contra el backend real: login de admin e inquilino, shell del rol y
/// cierre de sesión.
void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('login de admin e inquilino contra el backend real', (
    tester,
  ) async {
    await arrancarApp(tester);
    await captura(binding, tester, '01-login');

    await iniciarSesion(tester, 'admin@demo.com');
    await esperar(tester, find.textContaining('Dashboard'));
    await tester.pump(const Duration(seconds: 1));
    await captura(binding, tester, '02-admin-home');
    await cerrarSesion(tester);

    await iniciarSesion(tester, 'inquilino@demo.com');
    await esperar(tester, find.textContaining('Mis solicitudes'));
    await tester.pump(const Duration(seconds: 1));
    await captura(binding, tester, '03-inquilino-home');
    await cerrarSesion(tester);
  });
}

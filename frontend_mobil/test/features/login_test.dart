import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend_mobil/app.dart';
import 'package:frontend_mobil/core/api/api_providers.dart';
import 'package:frontend_mobil/features/auth/login_page.dart';

import '../helpers/api_falsa.dart';
import '../helpers/pantallas.dart';

Map<String, Object> _loginOk() => {
  'accessToken': 'A',
  'refreshToken': 'R',
  'expiresIn': 3600,
  'user': {
    'id': 'u1',
    'email': 'admin@demo.com',
    'nombre': 'Admin Demo',
    'rol': 'admin_plaza',
    'plazaId': 'plaza-demo',
    'rolStaffId': 'r1',
    'inquilinoId': null,
    'permisos': ['locales.listar'],
  },
};

Future<void> _montar(
  WidgetTester tester,
  Map<String, ManejadorFalso> rutas,
) async {
  final api = apiFalsa(rutas, conSesion: false);
  await tester.pumpWidget(
    ProviderScope(
      retry: politicaReintentos,
      overrides: [apiClientProvider.overrideWithValue(api)],
      child: const PlazappApp(),
    ),
  );
  await tester.pumpAndSettle();
}

Future<void> _ingresar(
  WidgetTester tester,
  String email,
  String password,
) async {
  await tester.enterText(find.byKey(const Key('login-email')), email);
  await tester.enterText(find.byKey(const Key('login-password')), password);
  await tester.tap(find.byKey(const Key('login-enviar')));
  await tester.pumpAndSettle();
}

void main() {
  setUp(prepararPruebas);

  testWidgets('login correcto lleva a la home del rol', (tester) async {
    await _montar(tester, {
      'POST /auth/login': (_) => _loginOk(),
      'GET /plazas/:id': (_) => {
        'id': 'plaza-demo',
        'slug': 'demo',
        'nombreComercial': 'Plaza Demo',
      },
    });
    expect(find.text('Inicia sesión'), findsOneWidget);
    await _ingresar(tester, 'Admin@Demo.com ', 'Plazapp2026!');
    expect(find.textContaining('Dashboard'), findsWidgets);
    expect(cuerpoDe(peticionesFalsas.first)['email'], 'admin@demo.com');
  });

  final casos = <String, (RespuestaFalsa, String)>{
    'credenciales inválidas': (
      const RespuestaFalsa(401, {'code': 'INVALID_CREDENTIALS', 'detail': 'x'}),
      'Email o contraseña incorrectos',
    ),
    'cuenta bloqueada': (
      const RespuestaFalsa(429, {
        'code': 'ACCOUNT_LOCKED',
        'meta': {'retryAfter': 900},
      }),
      'Cuenta bloqueada temporalmente por varios intentos fallidos. Intenta más tarde.',
    ),
    'límite de intentos': (
      const RespuestaFalsa(
        429,
        {'code': 'TOO_MANY_REQUESTS'},
        {'retry-after': '42'},
      ),
      'Demasiados intentos. Espera 42 s e intenta de nuevo.',
    ),
    'plaza desactivada': (
      const RespuestaFalsa(403, {'code': 'PLAZA_INACTIVA'}),
      'La plaza de este usuario está desactivada. Contacta al administrador de la plataforma.',
    ),
  };
  casos.forEach((nombre, caso) {
    testWidgets('error de login: $nombre', (tester) async {
      await _montar(tester, {'POST /auth/login': (_) => caso.$1});
      await _ingresar(tester, 'admin@demo.com', 'mala');
      expect(find.text(caso.$2), findsOneWidget);
      expect(find.text('Inicia sesión'), findsOneWidget);
    });
  });

  testWidgets('email inválido se valida sin llamar a la API', (tester) async {
    await _montar(tester, {});
    await _ingresar(tester, 'no-es-correo', 'x');
    expect(find.text('Correo electrónico inválido.'), findsOneWidget);
    expect(peticionesFalsas, isEmpty);
  });

  testWidgets('login responsive (teléfono y tablet, claro y oscuro)', (
    tester,
  ) async {
    await probarEnTamanos(
      tester,
      () => const LoginPage(expirada: true),
      overrides: overridesBase(apiFalsa({}, conSesion: false)),
    );
  });
}

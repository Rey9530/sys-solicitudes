import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend_mobil/app.dart';
import 'package:frontend_mobil/core/auth/sesion.dart';
import 'package:frontend_mobil/core/navegacion/router.dart';
import 'package:frontend_mobil/core/plaza/plaza_seleccionada.dart';

import '../helpers/api_falsa.dart';
import '../helpers/pantallas.dart';

AsyncValue<Sesion?> _con(Rol? rol) =>
    AsyncData(rol == null ? null : sesionDe(rol));

void main() {
  setUp(prepararPruebas);

  group('redirigir', () {
    test('sin sesión → login (con aviso si expiró)', () {
      expect(
        redirigir(sesion: _con(null), expiro: false, ruta: '/admin/locales'),
        '/login',
      );
      expect(
        redirigir(sesion: _con(null), expiro: true, ruta: '/admin/locales'),
        '/login?expired=1',
      );
      expect(
        redirigir(sesion: _con(null), expiro: false, ruta: '/login'),
        isNull,
      );
      expect(
        redirigir(sesion: _con(null), expiro: false, ruta: '/reset-password'),
        isNull,
      );
    });

    test('cada rol queda en su prefijo', () {
      expect(
        redirigir(
          sesion: _con(Rol.inquilino),
          expiro: false,
          ruta: '/admin/dashboard',
        ),
        '/inquilino/solicitudes',
      );
      expect(
        redirigir(
          sesion: _con(Rol.adminPlaza),
          expiro: false,
          ruta: '/superadmin/plazas',
        ),
        '/admin/dashboard',
      );
      expect(
        redirigir(
          sesion: _con(Rol.adminPlaza),
          expiro: false,
          ruta: '/inquilino/solicitudes',
        ),
        '/admin/dashboard',
      );
      expect(
        redirigir(
          sesion: _con(Rol.superadmin),
          expiro: false,
          ruta: '/admin/locales',
        ),
        isNull,
      );
      expect(
        redirigir(sesion: _con(Rol.superadmin), expiro: false, ruta: '/login'),
        '/superadmin/plazas',
      );
    });

    test('mientras carga la sesión se queda en la pantalla de carga', () {
      expect(
        redirigir(
          sesion: const AsyncLoading(),
          expiro: false,
          ruta: '/admin/locales',
        ),
        '/',
      );
    });
  });

  testWidgets('superadmin sin plaza ve el aviso; con plaza, la pantalla', (
    tester,
  ) async {
    final api = apiFalsa({
      'GET /plazas': (_) => {'items': [], 'total': 0},
      'GET /plazas/:id': (_) => {
        'id': 'p1',
        'slug': 'demo',
        'nombreComercial': 'Plaza Demo',
      },
    });
    await tester.pumpWidget(
      ProviderScope(
        overrides: overridesBase(api, sesion: sesionDe(Rol.superadmin)),
        child: const PlazappApp(),
      ),
    );
    await tester.pumpAndSettle();
    final container = ProviderScope.containerOf(
      tester.element(find.byType(PlazappApp)),
    );
    container.read(routerProvider).go('/admin/locales');
    await tester.pumpAndSettle();
    expect(find.text('Selecciona una plaza para operar'), findsOneWidget);

    await container.read(plazaSeleccionadaProvider.notifier).seleccionar('p1');
    await tester.pumpAndSettle();
    expect(find.textContaining('Locales'), findsWidgets);
    expect(find.text('Selecciona una plaza para operar'), findsNothing);
  });

  testWidgets('admin entra a su home y ve su menú en tablet', (tester) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(1024, 768);
    addTearDown(tester.view.reset);
    final api = apiFalsa({
      'GET /plazas/:id': (_) => {
        'id': 'plaza-demo',
        'slug': 'demo',
        'nombreComercial': 'Plaza Demo',
      },
    });
    await tester.pumpWidget(
      ProviderScope(
        overrides: overridesBase(api, sesion: sesionDe(Rol.adminPlaza)),
        child: const PlazappApp(),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.textContaining('Dashboard'), findsWidgets);
    expect(find.byKey(const Key('menu-/admin/locales')), findsOneWidget);
    expect(find.text('Plaza Demo'), findsOneWidget);
  });
}

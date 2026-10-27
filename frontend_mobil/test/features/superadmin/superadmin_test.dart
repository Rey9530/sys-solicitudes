import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend_mobil/core/api/api_client.dart';
import 'package:frontend_mobil/core/auth/sesion.dart';
import 'package:frontend_mobil/core/auth/token_storage.dart';
import 'package:frontend_mobil/core/plaza/plaza_seleccionada.dart';
import 'package:frontend_mobil/features/superadmin/dashboard_global_page.dart';
import 'package:frontend_mobil/features/superadmin/nueva_plaza_sheet.dart';
import 'package:frontend_mobil/features/superadmin/plazas_api.dart';
import 'package:frontend_mobil/features/superadmin/plazas_page.dart';
import 'package:frontend_mobil/features/superadmin/plazas_providers.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../helpers/api_falsa.dart';
import '../../helpers/pantallas.dart';
import '../dashboard/dashboard_fixtures.dart';

const _nombreLargo =
    'Centro Comercial Inversiones y Desarrollos del Pacífico Centroamericano';

Map<String, Object?> _plaza(String id, String nombre, {String? email}) => {
  'id': id,
  'slug': 'carga-qa-$id',
  'nombreComercial': nombre,
  'emailContacto': email,
  'telefonoContacto': null,
  'logoUrl': null,
  'colorPrimario': '#7c3aed',
  'timezone': 'America/El_Salvador',
  'createdAt': '2026-10-22T20:26:13.155Z',
  'updatedAt': '2026-10-22T20:26:13.155Z',
  'deletedAt': null,
};

Map<String, ManejadorFalso> _rutas() => {
  'GET /plazas': (_) => {
    'items': [
      _plaza(
        'p-1',
        _nombreLargo,
        email: 'administracion.general@inversiones-pacifico.com.sv',
      ),
      _plaza('p-2', 'Plaza Demo'),
    ],
    'total': 2,
    'page': 1,
    'pageSize': 50,
    'totalPages': 1,
  },
  'POST /plazas': (_) => _plaza('p-3', 'Plaza Nueva'),
  'DELETE /plazas/:id': (_) => const RespuestaFalsa(204),
};

Widget _plazas() => const Scaffold(body: PlazasPage());

Future<void> _montar(WidgetTester tester, Widget Function() pantalla) async {
  await tester.pumpWidget(
    envolver(
      pantalla,
      overrides: overridesBase(
        apiFalsa(_rutas()),
        sesion: sesionDe(Rol.superadmin),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

Future<void> _tocar(WidgetTester tester, Finder f) async {
  await tester.ensureVisible(f);
  await tester.pumpAndSettle();
  await tester.tap(f);
  await tester.pumpAndSettle();
}

void main() {
  setUp(prepararPruebas);

  testWidgets('plazas responsive con textos largos', (tester) async {
    await probarEnTamanos(
      tester,
      _plazas,
      overrides: overridesBase(
        apiFalsa(_rutas()),
        sesion: sesionDe(Rol.superadmin),
      ),
      alPintar: (_, _) async {
        expect(find.text('Nueva plaza'), findsOneWidget);
        expect(find.text(_nombreLargo), findsOneWidget);
        expect(find.text('Entrar'), findsNWidgets(2));
      },
    );
  });

  testWidgets('"Entrar" guarda sa_plaza y abre el dashboard de la plaza', (
    tester,
  ) async {
    await _montar(tester, _plazas);
    await _tocar(tester, find.byKey(const Key('entrar-p-2')));
    expect(find.text('Ruta: /admin/dashboard'), findsOneWidget);
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getString('sa_plaza'), 'p-2');
  });

  testWidgets('"Desactivar" pide confirmación destructiva', (tester) async {
    await _montar(tester, _plazas);
    await _tocar(tester, find.byKey(const Key('desactivar-p-2')));
    expect(find.text('¿Desactivar la plaza "Plaza Demo"?'), findsOneWidget);
    expect(
      find.text(
        'Ningún usuario de la plaza podrá iniciar sesión. Los datos y el '
        'historial se conservan.',
      ),
      findsOneWidget,
    );
    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();
    expect(peticionesFalsas.where((r) => r.method == 'DELETE'), isEmpty);

    await _tocar(tester, find.byKey(const Key('desactivar-p-2')));
    await tester.tap(find.text('Sí, desactivar'));
    await tester.pumpAndSettle();
    final borrado = peticionesFalsas.singleWhere((r) => r.method == 'DELETE');
    expect(borrado.url.path, '/api/v1/plazas/p-2');
    expect(find.text('Plaza desactivada'), findsOneWidget);
  });

  testWidgets('desactivar la plaza elegida la deselecciona aunque se salga '
      'de la pantalla durante el DELETE', (tester) async {
    final borrado = Completer<http.Response>();
    final almacen = MemoryTokenStorage();
    await almacen.guardar(
      Tokens('A', 'R', DateTime.now().add(const Duration(hours: 1))),
    );
    final api = ApiClient(
      baseUrl: 'http://api.test/api/v1',
      tokens: almacen,
      cliente: MockClient((req) async {
        if (req.method == 'DELETE') return borrado.future;
        return http.Response(
          jsonEncode(_rutas()['GET /plazas']!(req)),
          200,
          headers: {'content-type': 'application/json; charset=utf-8'},
        );
      }),
    );
    final visible = ValueNotifier(true);
    addTearDown(visible.dispose);
    await tester.pumpWidget(
      envolver(
        () => ValueListenableBuilder<bool>(
          valueListenable: visible,
          builder: (_, ver, _) => ver ? _plazas() : const Text('Otra'),
        ),
        overrides: overridesBase(api, sesion: sesionDe(Rol.superadmin)),
      ),
    );
    await tester.pumpAndSettle();
    final contenedor = ProviderScope.containerOf(
      tester.element(find.byType(PlazasPage)),
    );
    await contenedor
        .read(plazaSeleccionadaProvider.notifier)
        .seleccionar('p-2');

    await _tocar(tester, find.byKey(const Key('desactivar-p-2')));
    await tester.tap(find.text('Sí, desactivar'));
    await tester.pump();
    // Se sale de la pantalla con el DELETE en vuelo.
    visible.value = false;
    await tester.pumpAndSettle();
    borrado.complete(http.Response('', 204));
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    expect(contenedor.read(plazaSeleccionadaProvider), isNull);
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getString('sa_plaza'), isNull);
  });

  testWidgets('tirar para recargar termina con la lista nueva', (tester) async {
    var nombre = 'Plaza antes';
    await tester.pumpWidget(
      envolver(
        _plazas,
        overrides: overridesBase(
          apiFalsa({
            'GET /plazas': (_) => {
              'items': [_plaza('p-1', nombre)],
              'total': 1,
              'page': 1,
              'pageSize': 50,
              'totalPages': 1,
            },
          }),
          sesion: sesionDe(Rol.superadmin),
        ),
      ),
    );
    await tester.pumpAndSettle();
    final contenedor = ProviderScope.containerOf(
      tester.element(find.byType(PlazasPage)),
    );

    nombre = 'Plaza después';
    await tester
        .widget<RefreshIndicator>(find.byType(RefreshIndicator))
        .onRefresh();
    final lista = contenedor.read(listaPlazasProvider);
    expect(lista.isLoading, isFalse);
    expect(lista.value!.single.nombreComercial, 'Plaza después');
  });

  testWidgets('vacío muestra el texto del web', (tester) async {
    await tester.pumpWidget(
      envolver(
        _plazas,
        overrides: overridesBase(
          apiFalsa({
            'GET /plazas': (_) => {'items': <Object>[], 'total': 0},
          }),
          sesion: sesionDe(Rol.superadmin),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Sin plazas'), findsOneWidget);
    expect(find.text('Aún no hay plazas registradas.'), findsOneWidget);
  });

  testWidgets('"Nueva plaza" responsive', (tester) async {
    await probarEnTamanos(
      tester,
      () => const Scaffold(body: NuevaPlazaSheet()),
      overrides: overridesBase(
        apiFalsa(_rutas()),
        sesion: sesionDe(Rol.superadmin),
      ),
      alPintar: (_, _) async {
        await tester.enterText(
          find.byKey(const Key('plaza-nombre')),
          _nombreLargo,
        );
        await tester.pumpAndSettle();
        await _tocar(tester, find.byKey(const Key('crear-plaza')));
        expect(tester.takeException(), isNull);
        expect(find.text('Administrador inicial'), findsOneWidget);
      },
    );
  });

  testWidgets('"Nueva plaza": slug automático, política de contraseña y '
      'payload', (tester) async {
    await _montar(tester, _plazas);
    await _tocar(tester, find.byKey(const Key('nueva-plaza')));
    await tester.enterText(
      find.byKey(const Key('plaza-nombre')),
      'Plaza Árbol Ñandú',
    );
    await tester.pumpAndSettle();
    expect(find.text('plaza-arbol-nandu'), findsOneWidget);

    await tester.enterText(find.byKey(const Key('admin-nombre')), 'Ana Pérez');
    await tester.enterText(
      find.byKey(const Key('admin-email')),
      'Ana@Plaza.com ',
    );
    // Solo 8 caracteres en minúscula: el web lo aceptaba (C-R12).
    await tester.enterText(find.byKey(const Key('admin-password')), 'temporal');
    await _tocar(tester, find.byKey(const Key('crear-plaza')));
    expect(
      find.text('La contraseña debe incluir mayúscula, minúscula y dígito'),
      findsOneWidget,
    );
    expect(peticionesFalsas.where((r) => r.method == 'POST'), isEmpty);

    await tester.enterText(
      find.byKey(const Key('admin-password')),
      'Temporal2026',
    );
    await _tocar(tester, find.byKey(const Key('crear-plaza')));
    final alta = peticionesFalsas.singleWhere((r) => r.method == 'POST');
    expect(alta.url.path, '/api/v1/plazas');
    expect(cuerpoDe(alta), {
      'slug': 'plaza-arbol-nandu',
      'nombreComercial': 'Plaza Árbol Ñandú',
      'colorPrimario': '#2563eb',
      'adminPlazaInicial': {
        'email': 'ana@plaza.com',
        'nombre': 'Ana Pérez',
        'password': 'Temporal2026',
        'rolStaffCodigo': 'admin',
      },
    });
    // Se cierra el formulario y se recarga la lista.
    expect(find.text('Plaza creada'), findsOneWidget);
    expect(find.byKey(const Key('crear-plaza')), findsNothing);
    expect(
      peticionesFalsas.where(
        (r) => r.method == 'GET' && r.url.path.endsWith('/plazas'),
      ),
      hasLength(2),
    );
  });

  test('slug desde el nombre como el web', () {
    expect(slugDesdeNombre('  Plaza Árbol & Ñandú!! '), 'plaza-arbol-nandu');
    expect(slugDesdeNombre('x' * 50), 'x' * 32);
  });

  testWidgets('dashboard global responsive', (tester) async {
    await probarEnTamanos(
      tester,
      () => const Scaffold(body: DashboardGlobalPage()),
      overrides: overridesBase(
        apiFalsa({
          'GET /reportes/kpis': (_) => kpisFalsos(),
          'GET /reportes/dashboard': (_) => graficasFalsas(),
        }),
        sesion: sesionDe(Rol.superadmin),
      ),
      alPintar: (_, _) async {
        expect(find.text('Dashboard global'), findsOneWidget);
        expect(
          find.text('Métricas agregadas de todas las plazas.'),
          findsOneWidget,
        );
      },
    );
  });

  testWidgets('dashboard global nunca envía x-plaza-id (aunque haya plaza '
      'elegida)', (tester) async {
    SharedPreferences.setMockInitialValues({'sa_plaza': 'plaza-elegida'});
    final cabeceras = <String, String?>{};
    final almacen = MemoryTokenStorage();
    await almacen.guardar(
      Tokens('A', 'R', DateTime.now().add(const Duration(hours: 1))),
    );
    final api = ApiClient(
      baseUrl: 'http://api.test/api/v1',
      tokens: almacen,
      // Así arma el núcleo el cliente del superadmin con plaza elegida.
      plazaSeleccionada: () => 'plaza-elegida',
      cliente: MockClient((req) async {
        cabeceras[req.url.path] = req.headers['x-plaza-id'];
        final body = req.url.path.endsWith('/kpis')
            ? kpisFalsos()
            : graficasFalsas();
        return http.Response(
          jsonEncode(body),
          200,
          headers: {'content-type': 'application/json; charset=utf-8'},
        );
      }),
    );
    await tester.pumpWidget(
      envolver(
        () => const Scaffold(body: DashboardGlobalPage()),
        overrides: overridesBase(api, sesion: sesionDe(Rol.superadmin)),
      ),
    );
    await tester.pumpAndSettle();
    expect(cabeceras.keys, {
      '/api/v1/reportes/kpis',
      '/api/v1/reportes/dashboard',
    });
    expect(cabeceras.values, everyElement(isNull));
    expect(find.text('Pendientes'), findsOneWidget);
    // Sin enlaces de detalle en el global.
    await tester.tap(find.text('SOL-DEMO-3').first, warnIfMissed: false);
    await tester.pumpAndSettle();
    expect(find.textContaining('Ruta:'), findsNothing);
  });
}

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend_mobil/core/auth/sesion.dart';
import 'package:frontend_mobil/features/notificaciones/campana_api.dart';
import 'package:frontend_mobil/features/notificaciones/notificaciones_modelos.dart';
import 'package:frontend_mobil/features/notificaciones/widgets/hoja_notificaciones.dart';
import 'package:frontend_mobil/features/shell/campana.dart';

import '../../helpers/api_falsa.dart';
import '../../helpers/pantallas.dart';

const _tituloLargo =
    'Remodelación integral del local L-SOL-1 con cambio de piso, cielo falso, '
    'iluminación y fachada; incluye trabajos nocturnos y retiro de ripio';

Map<String, Object?> _notif(
  String id, {
  String tipo = 'solicitud_aprobada',
  bool leida = false,
  String? solicitudId,
  String? contratoId,
  String? createdAt,
}) => {
  'id': id,
  'tipo': tipo,
  'titulo': 'Solicitud aprobada',
  'mensaje': 'SOL-carga-qa-1234 · $_tituloLargo — fue aprobada.',
  'solicitudId': solicitudId,
  'contratoId': contratoId,
  'leida': leida,
  'createdAt':
      createdAt ??
      DateTime.now()
          .toUtc()
          .subtract(const Duration(minutes: 5))
          .toIso8601String(),
};

Map<String, Object?> _bandeja() => {
  'items': [
    _notif('n1', solicitudId: 's-1'),
    _notif('n2', tipo: 'contrato_por_vencer', contratoId: 'c-9'),
    _notif('n3', tipo: 'comentario_nuevo', leida: true, solicitudId: 's-2'),
    _notif(
      'n4',
      tipo: 'tipo_desconocido',
      leida: true,
      createdAt: '2026-01-05T20:00:00.000Z',
    ),
  ],
  'noLeidas': 2,
};

/// Barra superior mínima con la campana (como en `AppScaffold`).
Widget _barra() => Scaffold(
  appBar: AppBar(title: const Text('Plazapp'), actions: const [Campana()]),
  body: const SizedBox.shrink(),
);

Future<void> _montar(
  WidgetTester tester,
  Map<String, ManejadorFalso> rutas, {
  Rol rol = Rol.adminPlaza,
}) async {
  await tester.pumpWidget(
    envolver(
      _barra,
      overrides: overridesBase(apiFalsa(rutas), sesion: sesionDe(rol)),
    ),
  );
  await tester.pumpAndSettle();
}

int _llamadas(String path) =>
    peticionesFalsas.where((r) => r.url.path.endsWith(path)).length;

void main() {
  setUp(prepararPruebas);

  testWidgets('badge "9+" con 12 sin leer', (tester) async {
    await _montar(tester, {
      'GET /notificaciones/inbox/conteo': (_) => {'noLeidas': 12},
    });
    expect(find.text('9+'), findsOneWidget);
    expect(find.byTooltip('Notificaciones: 12 sin leer'), findsOneWidget);
  });

  testWidgets('sin badge con 0 sin leer', (tester) async {
    await _montar(tester, {
      'GET /notificaciones/inbox/conteo': (_) => {'noLeidas': 0},
    });
    expect(find.text('0'), findsNothing);
    expect(find.text('9+'), findsNothing);
    expect(find.byTooltip('Notificaciones'), findsOneWidget);
  });

  testWidgets('el superadmin no ve la campana', (tester) async {
    await _montar(tester, {
      'GET /notificaciones/inbox/conteo': (_) => {'noLeidas': 3},
    }, rol: Rol.superadmin);
    expect(find.byKey(const Key('campana')), findsNothing);
    expect(peticionesFalsas, isEmpty);
  });

  testWidgets('polling: vuelve a pedir el conteo a los 45 s', (tester) async {
    var conteo = 1;
    await _montar(tester, {
      'GET /notificaciones/inbox/conteo': (_) => {'noLeidas': conteo},
    });
    expect(find.text('1'), findsOneWidget);
    expect(_llamadas('/inbox/conteo'), 1);

    conteo = 4;
    await tester.pump(const Duration(seconds: 45));
    await tester.pumpAndSettle();
    expect(_llamadas('/inbox/conteo'), 2);
    expect(find.text('4'), findsOneWidget);
  });

  testWidgets('admin: tocar una notificación la marca y abre la solicitud', (
    tester,
  ) async {
    await _montar(tester, {
      'GET /notificaciones/inbox/conteo': (_) => {'noLeidas': 2},
      'GET /notificaciones/inbox': (_) => _bandeja(),
      'POST /notificaciones/inbox/:id/leer': (_) => _notif('n1', leida: true),
    });
    await tester.tap(find.byKey(const Key('campana')));
    await tester.pumpAndSettle();
    expect(find.text('2 sin leer'), findsOneWidget);
    expect(find.text('hace 5 minutos'), findsNWidgets(3));

    await tester.tap(find.text('Solicitud aprobada').first);
    await tester.pumpAndSettle();
    expect(find.text('Ruta: /admin/solicitudes/s-1'), findsOneWidget);
    expect(_llamadas('/inbox/n1/leer'), 1);
    expect(
      peticionesFalsas
          .firstWhere((r) => r.url.path.endsWith('/inbox'))
          .url
          .queryParameters['limit'],
      '20',
    );
  });

  testWidgets('inquilino: la solicitud abre su ruta de inquilino', (
    tester,
  ) async {
    await _montar(tester, {
      'GET /notificaciones/inbox/conteo': (_) => {'noLeidas': 2},
      'GET /notificaciones/inbox': (_) => _bandeja(),
      'POST /notificaciones/inbox/:id/leer': (_) => _notif('n1', leida: true),
    }, rol: Rol.inquilino);
    await tester.tap(find.byKey(const Key('campana')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Solicitud aprobada').first);
    await tester.pumpAndSettle();
    expect(find.text('Ruta: /inquilino/solicitudes/s-1'), findsOneWidget);
  });

  test('ruta de una notificación según rol y entidad', () {
    final solicitud = NotificacionInApp.fromJson(_notif('a', solicitudId: 's'));
    final contrato = NotificacionInApp.fromJson(_notif('b', contratoId: 'c'));
    final ninguna = NotificacionInApp.fromJson(_notif('c'));
    expect(
      rutaDeNotificacion(solicitud, Rol.adminPlaza),
      '/admin/solicitudes/s',
    );
    expect(
      rutaDeNotificacion(solicitud, Rol.inquilino),
      '/inquilino/solicitudes/s',
    );
    expect(rutaDeNotificacion(contrato, Rol.adminPlaza), '/admin/contratos/c');
    expect(rutaDeNotificacion(ninguna, Rol.adminPlaza), isNull);
  });

  testWidgets('"Marcar todas como leídas" deja la bandeja al día', (
    tester,
  ) async {
    await _montar(tester, {
      'GET /notificaciones/inbox/conteo': (_) => {'noLeidas': 2},
      'GET /notificaciones/inbox': (_) => _bandeja(),
      'POST /notificaciones/inbox/leer-todas': (_) => {'actualizadas': 2},
    });
    await tester.tap(find.byKey(const Key('campana')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('marcar-todas')));
    await tester.pumpAndSettle();
    expect(find.text('Estás al día'), findsOneWidget);
    expect(find.byKey(const Key('marcar-todas')), findsNothing);
    expect(_llamadas('/inbox/leer-todas'), 1);
  });

  testWidgets('hoja: vacía y con error muestran los textos del web', (
    tester,
  ) async {
    await tester.pumpWidget(
      envolver(
        () => const Scaffold(body: HojaNotificaciones()),
        overrides: overridesBase(
          apiFalsa({
            'GET /notificaciones/inbox': (_) => {'items': [], 'noLeidas': 0},
          }),
          sesion: sesionDe(Rol.adminPlaza),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('No tienes notificaciones'), findsOneWidget);
    expect(find.text('Estás al día'), findsOneWidget);

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpWidget(
      envolver(
        () => const Scaffold(body: HojaNotificaciones()),
        overrides: overridesBase(
          apiFalsa({
            'GET /notificaciones/inbox': (_) => const RespuestaFalsa(500, {
              'code': 'INTERNAL_ERROR',
              'detail': 'Error del servidor.',
            }),
          }),
          sesion: sesionDe(Rol.adminPlaza),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Error del servidor.'), findsOneWidget);
  });

  testWidgets('hoja responsive con textos largos', (tester) async {
    await probarEnTamanos(
      tester,
      () => const Scaffold(body: HojaNotificaciones()),
      overrides: overridesBase(
        apiFalsa({'GET /notificaciones/inbox': (_) => _bandeja()}),
        sesion: sesionDe(Rol.adminPlaza),
      ),
      alPintar: (_, _) async {
        expect(find.text('Marcar todas como leídas'), findsOneWidget);
        expect(find.textContaining('SOL-carga-qa-1234'), findsWidgets);
      },
    );
  });

  testWidgets('campana responsive en la barra', (tester) async {
    await probarEnTamanos(
      tester,
      _barra,
      overrides: overridesBase(
        apiFalsa({
          'GET /notificaciones/inbox/conteo': (_) => {'noLeidas': 120},
        }),
        sesion: sesionDe(Rol.inquilino),
      ),
      alPintar: (_, _) async => expect(find.text('9+'), findsOneWidget),
    );
  });
}

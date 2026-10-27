import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend_mobil/core/auth/sesion.dart';
import 'package:frontend_mobil/features/auditoria/auditoria_modelos.dart';
import 'package:frontend_mobil/features/auditoria/auditoria_page.dart';

import '../../helpers/api_falsa.dart';
import '../../helpers/pantallas.dart';

const _nombreLargo = 'María José de los Ángeles Pérez Hernández de la Cruz';

/// Entradas con la forma real de `GET /auditoria` (capturada del backend).
Map<String, Object?> _update() => {
  'id': 'a1',
  'plazaId': '1531e155-8ab5-466c-aff9-70e96d2135a5',
  'usuarioId': 'u1',
  'usuario': {'id': 'u1', 'nombre': _nombreLargo, 'email': 'admin@demo.com'},
  'accion': 'local.update',
  'entidadTipo': 'local',
  'entidadId': '9c73dd6c-5181-49d8-a6ea-accffe376b57',
  'antes': {
    'nivel': '1',
    'codigo': 'SOL-carga-qa-1234',
    'estado': 'alquilado',
    'medidorAgua': null,
  },
  'despues': {
    'nivel': '2',
    'codigo': 'SOL-carga-qa-1234',
    'estado': 'alquilado',
    'medidorAgua': null,
    'nuevo': true,
  },
  'ip': '::ffff:127.0.0.1',
  'userAgent':
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) '
      'AppleWebKit/605.1.15 (KHTML, like Gecko) PlazappMovil/1.0',
  'requestId': 'b5ce5156-714c-47d5-8901-f8fb1b29b5f5',
  'createdAt': '2026-10-27T20:27:05.838Z',
};

Map<String, Object?> _logout() => {
  'id': 'a2',
  'plazaId': null,
  'usuarioId': null,
  'usuario': null,
  'accion': 'auth.logout',
  'entidadTipo': 'usuario',
  'entidadId': null,
  'antes': null,
  'despues': null,
  'ip': null,
  'userAgent': null,
  'requestId': null,
  'createdAt': '2026-10-27T20:25:39.869Z',
};

Map<String, Object?> _pagina(List<Map<String, Object?>> items) => {
  'items': items,
  'total': 632,
  'page': 1,
  'pageSize': 20,
  'totalPages': 32,
};

void main() {
  setUp(prepararPruebas);

  testWidgets('auditoría responsive con textos largos', (tester) async {
    await probarEnTamanos(
      tester,
      () => const Scaffold(body: AuditoriaPage()),
      overrides: overridesBase(
        apiFalsa({
          'GET /auditoria': (_) => _pagina([_update(), _logout()]),
        }),
        sesion: sesionDe(Rol.adminPlaza),
      ),
      alPintar: (_, _) async {
        expect(
          find.text('632 eventos · quién hizo qué y cuándo en la plaza.'),
          findsOneWidget,
        );
        expect(find.text('local.update'), findsOneWidget);
        expect(find.text('sistema'), findsOneWidget);
        expect(
          find.text('Página 1 de 32', skipOffstage: false),
          findsOneWidget,
        );
      },
    );
  });

  testWidgets('detalle responsive (antes/después y metadatos)', (tester) async {
    await probarEnTamanos(
      tester,
      () => Scaffold(
        body: DetalleAuditoria(registro: RegistroAuditoria.fromJson(_update())),
      ),
      overrides: overridesBase(apiFalsa({}), sesion: sesionDe(Rol.adminPlaza)),
      alPintar: (_, _) async {
        expect(find.text('Cambios'), findsOneWidget);
        expect(find.text('"1"'), findsOneWidget);
        expect(find.text('"2"'), findsOneWidget);
        // Campo que solo existe después: "—" antes.
        expect(find.text('—'), findsOneWidget);
        expect(find.textContaining('$_nombreLargo <admin@demo.com>'), findsOne);
        expect(find.text('Ver detalle'), findsOneWidget);
      },
    );
  });

  testWidgets('detalle sin payload ni usuario', (tester) async {
    await tester.pumpWidget(
      envolver(
        () => Scaffold(
          body: DetalleAuditoria(
            registro: RegistroAuditoria.fromJson(_logout()),
          ),
        ),
        overrides: overridesBase(
          apiFalsa({}),
          sesion: sesionDe(Rol.adminPlaza),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(
      find.text(
        'Esta entrada no tiene payload persistido (decorador omitirBody).',
      ),
      findsOneWidget,
    );
    expect(find.textContaining('acción del sistema'), findsOneWidget);
    expect(find.text('plataforma'), findsOneWidget);
    expect(find.text('Ver detalle'), findsNothing);
  });

  testWidgets('"Filtrar" envía acción y tipo; "Limpiar" los borra', (
    tester,
  ) async {
    await tester.pumpWidget(
      envolver(
        () => const Scaffold(body: AuditoriaPage()),
        overrides: overridesBase(
          apiFalsa({
            'GET /auditoria': (_) => _pagina([_update()]),
          }),
          sesion: sesionDe(Rol.adminPlaza),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const Key('filtro-accion')),
      'local.update',
    );
    await tester.tap(
      find.widgetWithText(DropdownButtonFormField<String?>, 'Tipo de entidad'),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('local').last);
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('auditoria-filtrar')));
    await tester.pumpAndSettle();

    final ultima = peticionesFalsas.last.url.queryParameters;
    expect(ultima['accion'], 'local.update');
    expect(ultima['entidadTipo'], 'local');
    expect(ultima['page'], '1');
    expect(ultima['pageSize'], '20');

    await tester.tap(find.text('Limpiar'));
    await tester.pumpAndSettle();
    expect(peticionesFalsas.last.url.queryParameters, {
      'page': '1',
      'pageSize': '20',
    });
  });

  testWidgets('tocar "Detalle" abre el detalle y "Ver detalle" la entidad', (
    tester,
  ) async {
    await tester.pumpWidget(
      envolver(
        () => const Scaffold(body: AuditoriaPage()),
        overrides: overridesBase(
          apiFalsa({
            'GET /auditoria': (_) => _pagina([_update()]),
          }),
          sesion: sesionDe(Rol.adminPlaza),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Detalle'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Detalle'));
    await tester.pumpAndSettle();
    expect(find.text('Cambios'), findsOneWidget);
    await tester.tap(find.text('Ver detalle'));
    await tester.pumpAndSettle();
    expect(
      find.text('Ruta: /admin/locales/9c73dd6c-5181-49d8-a6ea-accffe376b57'),
      findsOneWidget,
    );
  });

  testWidgets('vacío muestra el texto del web', (tester) async {
    await tester.pumpWidget(
      envolver(
        () => const Scaffold(body: AuditoriaPage()),
        overrides: overridesBase(
          apiFalsa({
            'GET /auditoria': (_) => {
              'items': <Object>[],
              'total': 0,
              'page': 1,
              'pageSize': 20,
              'totalPages': 0,
            },
          }),
          sesion: sesionDe(Rol.adminPlaza),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Sin eventos'), findsOneWidget);
    expect(
      find.text('No hay eventos de auditoría que coincidan con esos filtros.'),
      findsOneWidget,
    );
  });
}

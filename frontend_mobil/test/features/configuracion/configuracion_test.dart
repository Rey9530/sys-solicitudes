import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend_mobil/core/adjuntos/adjuntos.dart';
import 'package:frontend_mobil/core/auth/sesion.dart';
import 'package:frontend_mobil/features/configuracion/configuracion_page.dart';

import '../../helpers/api_falsa.dart';
import '../../helpers/pantallas.dart';

const _nombreLargo =
    'Centro Comercial Inversiones y Desarrollos del Pacífico Centroamericano '
    '&amp; Asociados';

/// Plaza y configuración con la forma real del backend.
Map<String, ManejadorFalso> _rutas() => {
  'GET /plazas/:id': (_) => {
    'id': 'plaza-demo',
    'slug': 'demo',
    'nombreComercial': _nombreLargo,
    'emailContacto': null,
    'telefonoContacto': null,
    'logoUrl': null,
    'colorPrimario': '#2563eb',
    'timezone': 'America/El_Salvador',
    'createdAt': '2026-08-11T17:44:59.490Z',
    'updatedAt': '2026-09-16T20:52:55.927Z',
    'deletedAt': null,
  },
  'GET /configuracion': (_) => {
    'tamanioMaxArchivoMb': 50,
    'mimeTypesPermitidos': [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'application/acad',
    ],
    'slaDiasPorTipo': {
      'otro': 7,
      'evento': 3,
      'remodelacion': 15,
      'mantenimiento': 5,
    },
    'slaMultiplicadorPorPrioridad': {
      'A': 0.5,
      'B': 1,
      'C': 1.5,
      'D': 2,
      'F': 3,
    },
    'calendarMostrarHitosContrato': true,
    'aprobacionEspecialAsistentesMin': 200,
  },
  'PATCH /plazas/:id': (_) => {'id': 'plaza-demo'},
  'PATCH /configuracion': (_) => {'tamanioMaxArchivoMb': 50},
  'POST /plazas/:id/logo': (_) => {'id': 'plaza-demo'},
};

Widget _pagina() => const Scaffold(body: ConfiguracionPage());

Future<void> _montar(WidgetTester tester, {List<String>? permisos}) async {
  await tester.pumpWidget(
    envolver(
      _pagina,
      overrides: overridesBase(
        apiFalsa(_rutas()),
        sesion: sesionDe(Rol.adminPlaza, permisos: permisos),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

Future<void> _pestana(WidgetTester tester, String nombre) async {
  await tester.tap(find.widgetWithText(Tab, nombre));
  await tester.pumpAndSettle();
}

Future<void> _tocar(WidgetTester tester, Finder f) async {
  await tester.ensureVisible(f);
  await tester.pumpAndSettle();
  await tester.tap(f);
  await tester.pumpAndSettle();
}

Iterable<Map<String, dynamic>> _patches(String path) => peticionesFalsas
    .where((r) => r.method == 'PATCH' && r.url.path.endsWith(path))
    .map(cuerpoDe);

class _SelectorFalso extends SelectorArchivos {
  const _SelectorFalso(this.archivo);
  final ArchivoElegido archivo;

  @override
  Future<List<ArchivoElegido>> elegirArchivos({
    List<String>? extensiones,
  }) async => [archivo];
}

void main() {
  setUp(prepararPruebas);

  testWidgets('configuración responsive: las cinco pestañas', (tester) async {
    await probarEnTamanos(
      tester,
      _pagina,
      overrides: overridesBase(
        apiFalsa(_rutas()),
        sesion: sesionDe(Rol.adminPlaza),
      ),
      alPintar: (_, _) async {
        expect(
          find.textContaining('Centro Comercial Inversiones'),
          findsWidgets,
        );
        for (final p in ['Branding', 'SLA', 'Adjuntos', 'Calendario']) {
          await _pestana(tester, p);
          await tester.scrollUntilVisible(
            find.byType(FilledButton).last,
            300,
            scrollable: find.byType(Scrollable).first,
          );
          expect(tester.takeException(), isNull, reason: 'pestaña $p');
          await tester.drag(
            find.byType(Scrollable).first,
            const Offset(0, 4000),
          );
          await tester.pumpAndSettle();
        }
      },
    );
  });

  testWidgets('HEX inválido bloquea "Guardar color"', (tester) async {
    await _montar(tester);
    await _pestana(tester, 'Branding');
    FilledButton guardar() => tester.widget<FilledButton>(
      find.widgetWithText(FilledButton, 'Guardar color'),
    );
    expect(guardar().onPressed, isNotNull);

    await tester.enterText(find.byKey(const Key('color-hex')), '#12zz45');
    await tester.pumpAndSettle();
    expect(find.text('Color debe ser HEX (#RRGGBB)'), findsOneWidget);
    expect(guardar().onPressed, isNull);

    // Elegir un color de la paleta lo corrige y guarda ese HEX.
    await tester.tap(find.byKey(const Key('color-#7c3aed')));
    await tester.pumpAndSettle();
    expect(guardar().onPressed, isNotNull);
    await _tocar(tester, find.widgetWithText(FilledButton, 'Guardar color'));
    expect(_patches('/plazas/plaza-demo').single, {'colorPrimario': '#7c3aed'});
    expect(find.text('Branding guardado.'), findsOneWidget);
  });

  testWidgets('General envía null en los campos vacíos', (tester) async {
    await _montar(tester);
    await _tocar(tester, find.widgetWithText(FilledButton, 'Guardar'));
    expect(_patches('/plazas/plaza-demo').single, {
      'nombreComercial':
          'Centro Comercial Inversiones y Desarrollos del '
          'Pacífico Centroamericano & Asociados',
      'emailContacto': null,
      'telefonoContacto': null,
    });
    expect(find.text('Datos generales guardados.'), findsOneWidget);
  });

  testWidgets('SLA guarda días y multiplicadores; valida números', (
    tester,
  ) async {
    await _montar(tester);
    await _pestana(tester, 'SLA');
    expect(find.text('45d'), findsOneWidget); // remodelación × F
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Mantenimiento'),
      '-1',
    );
    await _tocar(tester, find.widgetWithText(FilledButton, 'Guardar SLA'));
    expect(find.text('Debe ser un número ≥ 0.'), findsOneWidget);
    expect(_patches('/configuracion'), isEmpty);

    await tester.enterText(
      find.widgetWithText(TextFormField, 'Mantenimiento'),
      '2,5',
    );
    await _tocar(tester, find.widgetWithText(FilledButton, 'Guardar SLA'));
    final cuerpo = _patches('/configuracion').single;
    expect(cuerpo['slaDiasPorTipo'], {
      'mantenimiento': 2.5,
      'evento': 3,
      'remodelacion': 15,
      'otro': 7,
    });
    expect(cuerpo['slaMultiplicadorPorPrioridad'], {
      'A': 0.5,
      'B': 1,
      'C': 1.5,
      'D': 2,
      'F': 3,
    });
  });

  testWidgets('Adjuntos: valida tamaño y no reenvía el alias legacy', (
    tester,
  ) async {
    await _montar(tester);
    await _pestana(tester, 'Adjuntos');
    await tester.enterText(find.byKey(const Key('tamanio-max')), '0');
    await _tocar(tester, find.widgetWithText(FilledButton, 'Guardar adjuntos'));
    expect(
      find.text('El tamaño máximo debe ser un entero ≥ 1 MB.'),
      findsOneWidget,
    );
    expect(_patches('/configuracion'), isEmpty);

    await tester.enterText(find.byKey(const Key('tamanio-max')), '25');
    await _tocar(tester, find.widgetWithText(FilledButton, 'Guardar adjuntos'));
    expect(_patches('/configuracion').single, {
      'mimeTypesPermitidos': ['application/pdf', 'image/jpeg', 'image/png'],
      'tamanioMaxArchivoMb': 25,
    });
  });

  testWidgets('Calendario guarda el check', (tester) async {
    await _montar(tester);
    await _pestana(tester, 'Calendario');
    await tester.tap(find.text('Mostrar hitos contractuales en el calendario'));
    await tester.pumpAndSettle();
    await _tocar(
      tester,
      find.widgetWithText(FilledButton, 'Guardar calendario'),
    );
    expect(_patches('/configuracion').single, {
      'calendarMostrarHitosContrato': false,
    });
    expect(find.text('Calendario guardado.'), findsOneWidget);
  });

  testWidgets('el logo se sube como PNG en el campo file', (tester) async {
    await tester.pumpWidget(
      envolver(
        _pagina,
        overrides: [
          ...overridesBase(
            apiFalsa(_rutas()),
            sesion: sesionDe(Rol.adminPlaza),
          ),
          selectorArchivosProvider.overrideWithValue(
            _SelectorFalso(ArchivoElegido('logo.PNG', Uint8List(10))),
          ),
        ],
      ),
    );
    await tester.pumpAndSettle();
    await _pestana(tester, 'Branding');
    await _tocar(tester, find.byKey(const Key('elegir-logo')));
    final subida = peticionesFalsas.singleWhere((r) => r.method == 'POST');
    expect(subida.url.path, '/api/v1/plazas/plaza-demo/logo');
    expect(subida.headers['content-type'], startsWith('multipart/form-data'));
    expect(find.text('Logo actualizado.'), findsOneWidget);
  });

  testWidgets('cada botón exige su permiso', (tester) async {
    await _montar(
      tester,
      permisos: ['configuracion.ver', 'configuracion.editar_calendario'],
    );
    expect(find.widgetWithText(FilledButton, 'Guardar'), findsNothing);
    await _pestana(tester, 'Branding');
    expect(find.text('Guardar color'), findsNothing);
    expect(find.byKey(const Key('elegir-logo')), findsNothing);
    await _pestana(tester, 'Calendario');
    expect(find.text('Guardar calendario'), findsOneWidget);
  });

  testWidgets('superadmin: requiere una plaza asignada', (tester) async {
    await tester.pumpWidget(
      envolver(
        _pagina,
        overrides: overridesBase(
          apiFalsa(_rutas()),
          sesion: sesionDe(Rol.superadmin),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(
      find.text('Esta pantalla requiere una plaza asignada.'),
      findsOneWidget,
    );
    expect(peticionesFalsas, isEmpty);
  });

  testWidgets('error al cargar muestra el aviso del web', (tester) async {
    await tester.pumpWidget(
      envolver(
        _pagina,
        overrides: overridesBase(
          apiFalsa({
            ..._rutas(),
            'GET /configuracion': (_) =>
                const RespuestaFalsa(500, {'code': 'INTERNAL_ERROR'}),
          }),
          sesion: sesionDe(Rol.adminPlaza),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('No se pudo cargar la configuración.'), findsOneWidget);
  });
}

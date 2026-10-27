import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend_mobil/core/auth/sesion.dart';
import 'package:frontend_mobil/features/reportes/reportes_page.dart';

import '../../helpers/api_falsa.dart';
import '../../helpers/pantallas.dart';

const _razonLarga =
    'Inversiones y Desarrollos Comerciales del Pacífico Centroamericano, '
    'Sociedad Anónima de Capital Variable';

Map<String, ManejadorFalso> _rutas() => {
  'GET /locales': (_) => {
    'items': [
      {'id': 'l-1', 'codigo': 'L-SOL-1'},
      {'id': 'l-2', 'codigo': 'E2E-096543'},
    ],
    'total': 2,
  },
  'GET /inquilinos': (_) => {
    'items': [
      {'id': 'i-1', 'razonSocial': _razonLarga},
    ],
    'total': 1,
  },
  'GET /solicitudes/tipos': (_) => [
    {'codigo': 'mantenimiento', 'etiqueta': 'Mantenimiento'},
    {'codigo': 'remodelacion', 'etiqueta': 'Remodelación'},
  ],
  'GET /reportes/solicitudes/preview': (_) => {
    'items': [
      {
        'codigo': 'SOL-carga-qa-1234',
        'tipo': 'remodelacion',
        'titulo':
            'Remodelación integral del local L-SOL-1 con cambio de piso, '
            'cielo falso, iluminación y fachada',
        'local': 'L-SOL-1',
        'estado': 'aprobada',
        'prioridad': 'B',
        'enviadaAt': '2026-10-05 2:00 pm',
        'decisionAt': '',
        'asignadoA': 'Admin Demo',
      },
    ],
    'total': 142,
  },
  'GET /reportes/:entidad/export.csv': (_) => 'codigo,titulo',
};

Finder _selector(String etiqueta) =>
    find.widgetWithText(DropdownButtonFormField<String?>, etiqueta);

void main() {
  setUp(prepararPruebas);

  testWidgets('reportes responsive (con previsualización)', (tester) async {
    await probarEnTamanos(
      tester,
      () => const Scaffold(body: ReportesPage()),
      overrides: overridesBase(
        apiFalsa(_rutas()),
        sesion: sesionDe(Rol.adminPlaza),
      ),
      alPintar: (_, _) async {
        expect(find.text('Previsualizar'), findsOneWidget);
        expect(find.text('Generar'), findsOneWidget);
        final boton = find.byKey(const Key('reporte-previsualizar'));
        await tester.ensureVisible(boton);
        await tester.pumpAndSettle();
        await tester.tap(boton);
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        expect(
          find.text(
            'Previsualización — primeros 1 de 142 registros',
            skipOffstage: false,
          ),
          findsOneWidget,
        );
        await tester.scrollUntilVisible(
          find.text('Historial de reportes'),
          300,
          scrollable: find.byType(Scrollable).first,
        );
        expect(tester.takeException(), isNull);
      },
    );
  });

  testWidgets('"Generar" CSV pide el export con los filtros', (tester) async {
    await tester.pumpWidget(
      envolver(
        () => const Scaffold(body: ReportesPage()),
        overrides: overridesBase(
          apiFalsa(_rutas()),
          sesion: sesionDe(Rol.adminPlaza),
        ),
      ),
    );
    await tester.pumpAndSettle();

    // Estado = Aprobada
    await tester.tap(_selector('Estado'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Aprobada').last);
    await tester.pumpAndSettle();
    // Tipo = Remodelación (de la configuración de la plaza)
    await tester.tap(_selector('Tipo'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Remodelación').last);
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('reporte-generar')));
    await tester.pumpAndSettle();

    final export = peticionesFalsas.singleWhere(
      (r) => r.url.path.contains('/export.'),
    );
    expect(export.method, 'GET');
    expect(export.url.path, '/api/v1/reportes/solicitudes/export.csv');
    expect(export.url.queryParameters, {
      'estado': 'aprobada',
      'tipo': 'remodelacion',
    });
  });

  testWidgets('cambiar de entidad limpia filtros y muestra los suyos', (
    tester,
  ) async {
    await tester.pumpWidget(
      envolver(
        () => const Scaffold(body: ReportesPage()),
        overrides: overridesBase(
          apiFalsa(_rutas()),
          sesion: sesionDe(Rol.adminPlaza),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(_selector('Entidad'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Inquilinos').last);
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('reporte-buscar')), findsOneWidget);
    expect(find.text('Local'), findsNothing);
    await tester.enterText(find.byKey(const Key('reporte-buscar')), 'Sol');
    await tester.tap(find.byKey(const Key('reporte-generar')));
    await tester.pumpAndSettle();
    final export = peticionesFalsas.singleWhere(
      (r) => r.url.path.contains('/export.'),
    );
    expect(export.url.path, '/api/v1/reportes/inquilinos/export.csv');
    expect(export.url.queryParameters, {'search': 'Sol'});
  });

  testWidgets('sin permisos no muestra Previsualizar ni Generar', (
    tester,
  ) async {
    await tester.pumpWidget(
      envolver(
        () => const Scaffold(body: ReportesPage()),
        overrides: overridesBase(
          apiFalsa(_rutas()),
          sesion: sesionDe(
            Rol.adminPlaza,
            permisos: ['reportes.dashboard.ver', 'reportes.exportar_pdf'],
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Previsualizar'), findsNothing);
    expect(find.text('Generar'), findsNothing);
  });

  testWidgets('error de previsualización muestra el detail del backend', (
    tester,
  ) async {
    await tester.pumpWidget(
      envolver(
        () => const Scaffold(body: ReportesPage()),
        overrides: overridesBase(
          apiFalsa({
            ..._rutas(),
            'GET /reportes/solicitudes/preview': (_) =>
                const RespuestaFalsa(413, {
                  'code': 'RANGO_EXCEDIDO',
                  'detail': 'El rango de fechas no puede superar 12 meses.',
                }),
          }),
          sesion: sesionDe(Rol.adminPlaza),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('reporte-previsualizar')));
    await tester.pumpAndSettle();
    expect(
      find.text('El rango de fechas no puede superar 12 meses.'),
      findsOneWidget,
    );
  });
}

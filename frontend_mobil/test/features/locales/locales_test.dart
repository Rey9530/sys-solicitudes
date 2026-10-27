import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend_mobil/core/auth/sesion.dart';
import 'package:frontend_mobil/features/locales/local_detalle_page.dart';
import 'package:frontend_mobil/features/locales/local_form_page.dart';
import 'package:frontend_mobil/features/locales/locales_api.dart';
import 'package:frontend_mobil/features/locales/locales_page.dart';

import '../../helpers/api_falsa.dart';
import '../../helpers/pantallas.dart';
import '../contratos/fixtures_catalogo.dart';
import '../contratos/helpers_catalogo.dart';

Map<String, Object?> _adjunto() => {
  'id': 'adj-1',
  'nombreOriginal':
      'fachada-del-local-vista-frontal-con-rotulo-nuevo-y-vitrina.jpg',
  'mimeType': 'image/jpeg',
  'tamanoBytes': 123456,
  'usuarioSubioId': 'usr-1',
  'createdAt': '2026-10-01T10:00:00Z',
};

Map<String, ManejadorFalso> _rutas({bool conVigente = true}) => {
  'GET /locales': (_) => paginado(
    [
      localJson(),
      localJson(
        id: 'loc-2',
        codigo: 'L-101',
        modulo: null,
        estado: 'en_mantenimiento',
      ),
    ],
    total: 41,
    totalPages: 3,
  ),
  'GET /locales/:id': (_) => localDetalleJson(conVigente: conVigente),
  'GET /locales/:id/adjuntos': (_) => [_adjunto()],
  'GET /solicitudes': (_) => paginado([solicitudJson()]),
  'DELETE /locales/:id': (_) => const RespuestaFalsa(204),
  'POST /locales': (req) => localJson(),
  'PATCH /locales/:id': (req) => localJson(),
};

Widget _en(Widget pagina) => Scaffold(body: pagina);

void main() {
  setUp(prepararPruebas);

  group('Listado', () {
    testWidgets('responsive con códigos largos', (tester) async {
      await probarEnTamanos(
        tester,
        () => _en(const LocalesPage()),
        overrides: overridesBase(
          apiFalsa(_rutas()),
          sesion: sesionDe(Rol.adminPlaza),
        ),
        alPintar: (_, _) async {
          expect(find.text(codigoLargo), findsOneWidget);
          expect(
            find.text('41 locales · gestiona las unidades de la plaza.'),
            findsOneWidget,
          );
          await verEnPagina(tester, find.text('Página 1 de 3'));
          await recorrerPagina(tester);
        },
      );
    });

    testWidgets('sin permisos oculta "Nuevo local" y "Desactivar"', (
      tester,
    ) async {
      await tester.pumpWidget(
        envolver(
          () => _en(const LocalesPage()),
          overrides: overridesBase(
            apiFalsa(_rutas()),
            sesion: sesionDe(Rol.adminPlaza, permisos: ['locales.listar']),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text(codigoLargo), findsOneWidget);
      expect(find.text('Nuevo local'), findsNothing);
      expect(find.text('Desactivar'), findsNothing);
    });

    testWidgets('filtros por estado y módulo van en la query', (tester) async {
      await tester.pumpWidget(
        envolver(
          () => _en(const LocalesPage()),
          overrides: overridesBase(
            apiFalsa(_rutas()),
            sesion: sesionDe(Rol.adminPlaza),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('locales-filtro-estado')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('en mantenimiento').last);
      await tester.pumpAndSettle();
      expect(
        peticionesFalsas.last.url.queryParameters['estado'],
        'en_mantenimiento',
      );

      await tester.enterText(
        find.byKey(const Key('locales-filtro-modulo')),
        'K',
      );
      await tester.testTextInput.receiveAction(TextInputAction.search);
      await tester.pumpAndSettle();
      final q = peticionesFalsas.last.url.queryParameters;
      expect(q['modulo'], 'K');
      expect(q['estado'], 'en_mantenimiento');
      expect(q['page'], '1');

      await tester.tap(find.text('Limpiar filtros'));
      await tester.pumpAndSettle();
      expect(peticionesFalsas.last.url.queryParameters.keys, [
        'page',
        'pageSize',
      ]);
    });

    testWidgets('desactivar pide confirmación; cancelar no llama a la API', (
      tester,
    ) async {
      await tester.pumpWidget(
        envolver(
          () => _en(const LocalesPage()),
          overrides: overridesBase(
            apiFalsa(_rutas()),
            sesion: sesionDe(Rol.adminPlaza),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Desactivar').first);
      await tester.pumpAndSettle();
      expect(find.text('¿Desactivar el local "$codigoLargo"?'), findsOneWidget);
      await tester.tap(find.text('Cancelar'));
      await tester.pumpAndSettle();
      expect(peticionesFalsas.where((r) => r.method == 'DELETE'), isEmpty);

      await tester.tap(find.text('Desactivar').first);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Sí, desactivar'));
      await tester.pumpAndSettle();
      final borrado = peticionesFalsas.singleWhere((r) => r.method == 'DELETE');
      expect(borrado.url.path, endsWith('/locales/loc-1'));
      expect(find.text('Local desactivado'), findsOneWidget);
    });
  });

  group('Nuevo local', () {
    testWidgets('responsive', (tester) async {
      await probarEnTamanos(
        tester,
        () => _en(const LocalFormPage()),
        overrides: overridesBase(
          apiFalsa(_rutas()),
          sesion: sesionDe(Rol.adminPlaza),
        ),
        alPintar: (_, _) => recorrerPagina(tester),
      );
    });

    testWidgets('solo con el código manda un body sin claves vacías', (
      tester,
    ) async {
      await tester.pumpWidget(
        envolver(
          () => _en(const LocalFormPage()),
          overrides: overridesBase(
            apiFalsa(_rutas()),
            sesion: sesionDe(Rol.adminPlaza),
          ),
        ),
      );
      await tester.enterText(find.byKey(const Key('local-codigo')), ' l-101 ');
      await tester.tap(find.byKey(const Key('local-crear')));
      await tester.pumpAndSettle();
      final post = peticionesFalsas.singleWhere((r) => r.method == 'POST');
      expect(cuerpoDe(post), {'codigo': 'L-101'});
      // Sin historial vuelve al listado.
      expect(find.text('Ruta: /admin/locales'), findsOneWidget);
    });

    testWidgets('valida el código y los medidores sin llamar a la API', (
      tester,
    ) async {
      await tester.pumpWidget(
        envolver(
          () => _en(const LocalFormPage()),
          overrides: overridesBase(
            apiFalsa(_rutas()),
            sesion: sesionDe(Rol.adminPlaza),
          ),
        ),
      );
      await tester.enterText(find.byKey(const Key('local-codigo')), 'L 101!');
      await tester.enterText(find.byKey(const Key('local-energia')), '12a');
      await tester.enterText(find.byKey(const Key('local-area')), '-5');
      await tester.tap(find.byKey(const Key('local-crear')));
      await tester.pumpAndSettle();
      expect(
        find.text('El local solo puede contener mayúsculas, dígitos y guiones'),
        findsOneWidget,
      );
      expect(find.text('Solo dígitos y guiones'), findsOneWidget);
      expect(find.text('Debe ser mayor que 0'), findsOneWidget);
      expect(peticionesFalsas, isEmpty);
    });

    testWidgets('código duplicado se muestra bajo el campo', (tester) async {
      final rutas = _rutas()
        ..['POST /locales'] = (_) => const RespuestaFalsa(409, {
          'code': 'LOCAL_CODIGO_DUPLICADO',
          'detail': 'Ya existe un local con ese código en la plaza.',
        });
      await tester.pumpWidget(
        envolver(
          () => _en(const LocalFormPage()),
          overrides: overridesBase(
            apiFalsa(rutas),
            sesion: sesionDe(Rol.adminPlaza),
          ),
        ),
      );
      await tester.enterText(find.byKey(const Key('local-codigo')), 'K-1');
      await tester.tap(find.byKey(const Key('local-crear')));
      await tester.pumpAndSettle();
      expect(
        find.text('Ya existe un local con ese código en la plaza.'),
        findsOneWidget,
      );
    });

    testWidgets('sin "locales.crear" no muestra "Crear local"', (tester) async {
      await tester.pumpWidget(
        envolver(
          () => _en(const LocalFormPage()),
          overrides: overridesBase(
            apiFalsa(_rutas()),
            sesion: sesionDe(Rol.adminPlaza, permisos: ['locales.listar']),
          ),
        ),
      );
      expect(find.byKey(const Key('local-crear')), findsNothing);
    });
  });

  group('Detalle', () {
    testWidgets('responsive en todas las pestañas', (tester) async {
      await probarEnTamanos(
        tester,
        () => _en(const LocalDetallePage(id: 'loc-1')),
        overrides: overridesBase(
          apiFalsa(_rutas()),
          sesion: sesionDe(Rol.adminPlaza),
        ),
        alPintar: (_, _) async {
          expect(
            find.text('$codigoLargo · Módulo NORTE-PONIENTE'),
            findsOneWidget,
          );
          await recorrerPestanas(tester, [
            'Contratos',
            'Adjuntos',
            'Solicitudes',
            'Datos',
          ]);
        },
      );
    });

    testWidgets('pestañas muestran contratos, fotos y solicitudes', (
      tester,
    ) async {
      await tester.pumpWidget(
        envolver(
          () => _en(const LocalDetallePage(id: 'loc-1')),
          overrides: overridesBase(
            apiFalsa(_rutas()),
            sesion: sesionDe(Rol.adminPlaza),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(Tab, 'Contratos'));
      await tester.pumpAndSettle();
      expect(find.text('01-07-2026 → 28-07-2027'), findsOneWidget);
      expect(find.text('01-07-2026 → indefinido'), findsOneWidget);
      expect(find.text('USD 1,250.00 / mes'), findsNWidgets(2));

      await tester.tap(find.widgetWithText(Tab, 'Adjuntos'));
      await tester.pumpAndSettle();
      expect(find.textContaining('fachada-del-local'), findsOneWidget);

      await tester.tap(find.widgetWithText(Tab, 'Solicitudes'));
      await tester.pumpAndSettle();
      expect(find.text('SOL-carga-qa-1234'), findsOneWidget);
      final get = peticionesFalsas.lastWhere(
        (r) => r.url.path.endsWith('/solicitudes'),
      );
      expect(get.url.queryParameters['localId'], 'loc-1');
    });

    testWidgets(
      'con contrato vigente: estado bloqueado, no se envía y vacío → null',
      (tester) async {
        await tester.pumpWidget(
          envolver(
            () => _en(const LocalDetallePage(id: 'loc-1')),
            overrides: overridesBase(
              apiFalsa(_rutas()),
              sesion: sesionDe(Rol.adminPlaza),
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(
          find.text(
            'Con contrato vigente el estado se gestiona desde contratos.',
          ),
          findsOneWidget,
        );
        await tester.enterText(
          find.byKey(const Key('editar-local-modulo')),
          '',
        );
        await tester.enterText(find.byKey(const Key('editar-local-area')), '');
        await tester.ensureVisible(
          find.byKey(const Key('editar-local-guardar')),
        );
        await tester.tap(find.byKey(const Key('editar-local-guardar')));
        await tester.pumpAndSettle();
        final patch = peticionesFalsas.singleWhere((r) => r.method == 'PATCH');
        expect(cuerpoDe(patch), {
          'modulo': null,
          'nivel': '2',
          'medidorEnergia': '96700456-12345',
          'medidorAgua': '18-622259-1',
          'areaM2': null,
        });
        expect(find.text('Local actualizado'), findsOneWidget);
      },
    );

    testWidgets('sin contrato vigente se puede cambiar el estado', (
      tester,
    ) async {
      await tester.pumpWidget(
        envolver(
          () => _en(const LocalDetallePage(id: 'loc-1')),
          overrides: overridesBase(
            apiFalsa(_rutas(conVigente: false)),
            sesion: sesionDe(Rol.adminPlaza),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('editar-local-estado')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('fuera de servicio').last);
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.byKey(const Key('editar-local-guardar')));
      await tester.tap(find.byKey(const Key('editar-local-guardar')));
      await tester.pumpAndSettle();
      final patch = peticionesFalsas.singleWhere((r) => r.method == 'PATCH');
      expect(cuerpoDe(patch)['estado'], 'fuera_de_servicio');
    });

    testWidgets('sin permisos oculta guardar, subir y la pestaña Solicitudes', (
      tester,
    ) async {
      await tester.pumpWidget(
        envolver(
          () => _en(const LocalDetallePage(id: 'loc-1')),
          overrides: overridesBase(
            apiFalsa(_rutas()),
            sesion: sesionDe(
              Rol.adminPlaza,
              permisos: ['locales.listar', 'locales.adjuntos.descargar'],
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('editar-local-guardar')), findsNothing);
      expect(find.widgetWithText(Tab, 'Solicitudes'), findsNothing);
      await tester.tap(find.widgetWithText(Tab, 'Adjuntos'));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('adjuntos-subir')), findsNothing);
    });
  });

  test('cuerpos de alta y edición', () {
    expect(cuerpoNuevoLocal(codigo: 'k-1', modulo: ' norte ', area: '42,5'), {
      'codigo': 'K-1',
      'modulo': 'NORTE',
      'areaM2': 42.5,
    });
    expect(
      cuerpoEditarLocal(
        modulo: '',
        nivel: ' 1 ',
        area: '10',
        medidorEnergia: '',
        medidorAgua: '9-9',
        estado: 'disponible',
      ),
      {
        'modulo': null,
        'nivel': '1',
        'medidorEnergia': null,
        'medidorAgua': '9-9',
        'areaM2': 10.0,
        'estado': 'disponible',
      },
    );
  });
}

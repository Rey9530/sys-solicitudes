import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend_mobil/core/adjuntos/adjuntos.dart';
import 'package:frontend_mobil/core/auth/sesion.dart';
import 'package:frontend_mobil/core/format/fechas.dart';
import 'package:frontend_mobil/features/contratos/carga_inicial_page.dart';
import 'package:frontend_mobil/features/contratos/contrato_detalle_page.dart';
import 'package:frontend_mobil/features/contratos/contrato_form_page.dart';
import 'package:frontend_mobil/features/contratos/contratos_api.dart';
import 'package:frontend_mobil/features/contratos/contratos_modelos.dart';
import 'package:frontend_mobil/features/contratos/contratos_page.dart';
import 'package:frontend_mobil/features/contratos/mi_contrato_page.dart';
import 'package:frontend_mobil/features/contratos/mis_contratos_page.dart';
import 'package:frontend_mobil/features/inquilinos/inquilinos_providers.dart';
import 'package:frontend_mobil/features/locales/locales_providers.dart';

import '../../helpers/api_falsa.dart';
import '../../helpers/pantallas.dart';
import 'fixtures_catalogo.dart';
import 'helpers_catalogo.dart';

Map<String, ManejadorFalso> _rutas({
  String estado = 'vigente',
  bool t7 = false,
}) => {
  'GET /contratos': (_) => paginado(
    [
      contratoJson(),
      {
        ...contratoJson(id: 'con-2', estado: 'finalizado'),
        'cuotaArrendamiento': null,
        'localCodigo': null,
      },
    ],
    total: 17,
    totalPages: 2,
  ),
  'GET /contratos/:id': (_) => contratoJson(estado: estado, t7: t7),
  'GET /contratos/:id/adjuntos': (_) => [
    {
      'id': 'adj-1',
      'nombreOriginal': 'contrato-firmado-local-$codigoLargo-2026-2027.pdf',
      'mimeType': 'application/pdf',
      'tamanoBytes': 2048000,
      'usuarioSubioId': 'u-admin_plaza',
      'createdAt': '2026-10-01T10:00:00Z',
    },
  ],
  'GET /locales': (_) => paginado([
    localJson(),
    localJson(id: 'loc-2', codigo: 'L-101', modulo: null),
  ]),
  'GET /inquilinos': (_) => paginado([
    inquilinoJson(),
    inquilinoJson(id: 'inq-2', razonSocial: 'Tienda Sol S.A. de C.V.'),
  ]),
  'POST /contratos': (_) => contratoJson(),
  'POST /contratos/:id/cerrar': (_) => contratoJson(estado: 'finalizado'),
  'POST /contratos/:id/renovar': (_) => {
    'cerrado': contratoJson(estado: 'finalizado'),
    'nuevo': contratoJson(id: 'con-3'),
  },
  'POST /importacion/carga-inicial/analizar': (_) => resultadoCargaJson(),
  'POST /importacion/carga-inicial/ejecutar': (_) =>
      resultadoCargaJson(modo: 'ejecucion'),
};

Widget _en(Widget pagina) => Scaffold(body: pagina);

Future<void> _montar(
  WidgetTester tester,
  Widget pagina, {
  Map<String, ManejadorFalso>? rutas,
  Sesion? sesion,
  SelectorArchivos? selector,
}) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = const Size(390, 844);
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    envolver(
      () => _en(pagina),
      overrides: [
        ...overridesBase(
          apiFalsa(rutas ?? _rutas()),
          sesion: sesion ?? sesionDe(Rol.adminPlaza),
        ),
        if (selector != null)
          selectorArchivosProvider.overrideWithValue(selector),
      ],
    ),
  );
  await tester.pumpAndSettle();
}

/// Quita el foco, lleva [f] a la vista y lo toca.
Future<void> _tocar(WidgetTester tester, Finder f) async {
  FocusManager.instance.primaryFocus?.unfocus();
  await tester.pumpAndSettle();
  await tester.ensureVisible(f);
  await tester.pumpAndSettle();
  await tester.tap(f);
  await tester.pumpAndSettle();
}

/// Elige el día [dia] del mes actual en un `CampoFecha`.
Future<String> _elegirDia(WidgetTester tester, Finder campo, int dia) async {
  await _tocar(tester, campo);
  await tester.tap(
    find.descendant(of: find.byType(Dialog), matching: find.text('$dia')),
  );
  await tester.pumpAndSettle();
  // "ACEPTAR" (es) o "Aceptar" (es-XX) según la variante de la localización.
  await tester.tap(
    find.byWidgetPredicate(
      (w) => w is Text && (w.data ?? '').toLowerCase() == 'aceptar',
    ),
  );
  await tester.pumpAndSettle();
  final hoy = ahoraEnPlaza();
  return ymd(DateTime.utc(hoy.year, hoy.month, dia));
}

/// Año de la última fecha que permite el selector de fecha abierto.
int _ultimoAnioDelSelector(WidgetTester tester) => tester
    .widget<DatePickerDialog>(find.byType(DatePickerDialog))
    .lastDate
    .year;

Future<void> _elegirOpcion(
  WidgetTester tester,
  Finder campo,
  String texto,
) async {
  await _tocar(tester, campo);
  await tester.tap(find.text(texto).last);
  await tester.pumpAndSettle();
}

class _SelectorFalso extends SelectorArchivos {
  const _SelectorFalso(this.archivo);
  final ArchivoElegido archivo;

  @override
  Future<List<ArchivoElegido>> elegirArchivos({
    List<String>? extensiones,
  }) async => [archivo];
}

final _xlsx = _SelectorFalso(
  ArchivoElegido('carga-plaza-norte.xlsx', Uint8List.fromList([80, 75, 3, 4])),
);

void main() {
  setUp(prepararPruebas);

  group('Listado', () {
    testWidgets('responsive con razones sociales y códigos largos', (
      tester,
    ) async {
      await probarEnTamanos(
        tester,
        () => _en(const ContratosPage()),
        overrides: overridesBase(
          apiFalsa(_rutas()),
          sesion: sesionDe(Rol.adminPlaza),
        ),
        alPintar: (_, _) async {
          expect(find.text('17 contratos.'), findsOneWidget);
          expect(find.text(codigoLargo), findsOneWidget);
          expect(find.text(razonLargaDecodificada), findsNWidgets(2));
          // Canon si existe; si no, el monto mensual.
          expect(find.text('USD 20.00'), findsOneWidget);
          expect(find.text('USD 1,250.00'), findsOneWidget);
          expect(find.text('Indefinido'), findsNothing);
          expect(find.text('Importar Excel'), findsOneWidget);
          expect(find.text('Nuevo contrato'), findsOneWidget);
          await recorrerPagina(tester);
        },
      );
    });

    testWidgets('sin permisos oculta "Importar Excel" y "Nuevo contrato"', (
      tester,
    ) async {
      await _montar(
        tester,
        const ContratosPage(),
        sesion: sesionDe(Rol.adminPlaza, permisos: ['contratos.listar']),
      );
      expect(find.text(codigoLargo), findsOneWidget);
      expect(find.text('Importar Excel'), findsNothing);
      expect(find.text('Nuevo contrato'), findsNothing);
    });

    testWidgets('filtros por local y estado', (tester) async {
      await _montar(tester, const ContratosPage());
      await _elegirOpcion(
        tester,
        find.byKey(const Key('contratos-filtro-local')),
        'L-101',
      );
      expect(peticionesFalsas.last.url.queryParameters['localId'], 'loc-2');
      await _elegirOpcion(
        tester,
        find.byKey(const Key('contratos-filtro-estado')),
        'finalizado',
      );
      final q = peticionesFalsas.last.url.queryParameters;
      expect(q['estado'], 'finalizado');
      expect(q['localId'], 'loc-2');
      await _tocar(tester, find.text('Limpiar filtros'));
      expect(
        peticionesFalsas.last.url.queryParameters.containsKey('localId'),
        isFalse,
      );
    });
  });

  group('Nuevo contrato', () {
    testWidgets('responsive', (tester) async {
      await probarEnTamanos(
        tester,
        () => _en(const ContratoFormPage()),
        overrides: overridesBase(
          apiFalsa(_rutas()),
          sesion: sesionDe(Rol.adminPlaza),
        ),
        alPintar: (_, _) => recorrerPagina(tester),
      );
    });

    testWidgets('monto = área × (canon + CAM), de solo lectura, y body', (
      tester,
    ) async {
      await _montar(tester, const ContratoFormPage());
      // Solo pide locales disponibles.
      expect(
        peticionesFalsas
            .firstWhere((r) => r.url.path.endsWith('/locales'))
            .url
            .queryParameters['estado'],
        'disponible',
      );
      await tester.enterText(
        find.byKey(const Key('contrato-areaMt2MedicionReal')),
        '50',
      );
      await tester.enterText(
        find.byKey(const Key('contrato-cuotaArrendamiento')),
        '20',
      );
      await tester.enterText(find.byKey(const Key('contrato-cuotaCam')), '4.5');
      await tester.pumpAndSettle();
      final monto = tester.widget<TextField>(
        find.descendant(
          of: find.byKey(const Key('contrato-montoMensual')),
          matching: find.byType(TextField),
        ),
      );
      expect(monto.controller!.text, '1225.00');
      expect(monto.readOnly, isTrue);
      expect(find.textContaining('Total: USD 1,225.00'), findsOneWidget);

      // Sin local, inquilino ni inicio no se envía nada.
      await _tocar(tester, find.byKey(const Key('contrato-crear')));
      expect(find.text('Selecciona un local'), findsOneWidget);
      expect(find.text('Selecciona un inquilino'), findsOneWidget);
      expect(find.text('Requerida'), findsOneWidget);
      expect(peticionesFalsas.where((r) => r.method == 'POST'), isEmpty);

      await _elegirOpcion(
        tester,
        find.byKey(const Key('contrato-localId')),
        'L-101',
      );
      await _elegirOpcion(
        tester,
        find.byKey(const Key('contrato-inquilinoId')),
        'Tienda Sol S.A. de C.V.',
      );
      final inicio = await _elegirDia(
        tester,
        find.byKey(const Key('contrato-fechaInicio')),
        15,
      );
      await _tocar(tester, find.byKey(const Key('contrato-crear')));
      final post = peticionesFalsas.singleWhere((r) => r.method == 'POST');
      expect(cuerpoDe(post), {
        'localId': 'loc-2',
        'inquilinoId': 'inq-2',
        'fechaInicio': inicio,
        'fechaFin': null,
        'montoMensual': 1225.0,
        'moneda': 'USD',
        'areaMt2MedicionReal': 50,
        'cuotaArrendamiento': 20,
        'cuotaCam': 4.5,
      });
      expect(find.text('Ruta: /admin/contratos'), findsOneWidget);
    });

    testWidgets('las fechas admiten años lejanos (sin el tope de +5 años)', (
      tester,
    ) async {
      await _montar(tester, const ContratoFormPage());
      for (final campo in [
        'contrato-fechaInicio',
        'contrato-fechaFin',
        'contrato-avisoTerminacion',
      ]) {
        await _tocar(tester, find.byKey(Key(campo)));
        expect(_ultimoAnioDelSelector(tester), 2100, reason: campo);
        await tester.tap(find.text('Cancelar').last);
        await tester.pumpAndSettle();
      }
    });

    testWidgets('CONTRATO_OVERLAP se muestra en un aviso', (tester) async {
      final rutas = _rutas()
        ..['POST /contratos'] = (_) => const RespuestaFalsa(409, {
          'code': 'CONTRATO_OVERLAP',
          'detail':
              'El rango del contrato se solapa con otro vigente del mismo '
              'local.',
        });
      await _montar(tester, const ContratoFormPage(), rutas: rutas);
      await _elegirOpcion(
        tester,
        find.byKey(const Key('contrato-localId')),
        'L-101',
      );
      await _elegirOpcion(
        tester,
        find.byKey(const Key('contrato-inquilinoId')),
        'Tienda Sol S.A. de C.V.',
      );
      await _elegirDia(
        tester,
        find.byKey(const Key('contrato-fechaInicio')),
        3,
      );
      await _tocar(tester, find.byKey(const Key('contrato-crear')));
      expect(
        find.text(
          'El rango del contrato se solapa con otro vigente del mismo local.',
        ),
        findsOneWidget,
      );
    });
  });

  group('Detalle', () {
    testWidgets('responsive con aviso de vencimiento', (tester) async {
      await probarEnTamanos(
        tester,
        () => _en(const ContratoDetallePage(id: 'con-1')),
        overrides: overridesBase(
          apiFalsa(_rutas(t7: true)),
          sesion: sesionDe(Rol.adminPlaza),
        ),
        alPintar: (_, _) async {
          expect(
            find.text(
              'Este contrato vence en 7 días o menos (28-07-2027). '
              'Renueva o cierra.',
            ),
            findsOneWidget,
          );
          expect(
            find.text('$codigoLargo · $razonLargaDecodificada'),
            findsOneWidget,
          );
          expect(find.text('30 días'), findsOneWidget);
          expect(find.text('50 m²'), findsOneWidget);
          await verEnPagina(
            tester,
            find.textContaining('Total (AA): USD 1,225.00'),
          );
          await recorrerPagina(tester);
        },
      );
    });

    testWidgets('renovar y cerrar se ocultan sin permiso o si no es vigente', (
      tester,
    ) async {
      await _montar(
        tester,
        const ContratoDetallePage(id: 'con-1'),
        sesion: sesionDe(
          Rol.adminPlaza,
          permisos: ['contratos.listar', 'contratos.renovar'],
        ),
      );
      expect(find.text('Renovar contrato'), findsOneWidget);
      expect(find.text('Cerrar contrato'), findsNothing);
      // Sin `contratos.adjuntos.descargar` no se carga el PDF.
      expect(find.text('Contrato firmado (PDF)'.toUpperCase()), findsNothing);
      expect(
        peticionesFalsas.where((r) => r.url.path.endsWith('/adjuntos')),
        isEmpty,
      );
    });

    testWidgets('un contrato cerrado no ofrece renovar ni cerrar', (
      tester,
    ) async {
      await _montar(
        tester,
        const ContratoDetallePage(id: 'con-1'),
        rutas: _rutas(estado: 'finalizado'),
      );
      expect(find.text('Renovar contrato'), findsNothing);
      expect(find.text('Cerrar contrato'), findsNothing);
      await verEnPagina(tester, find.text('renovado'));
      expect(find.text('renovado'), findsOneWidget);
      expect(find.text('01-10-2026'), findsOneWidget);
    });

    testWidgets('cerrar exige motivo y omite la fecha vacía', (tester) async {
      await _montar(tester, const ContratoDetallePage(id: 'con-1'));
      await _tocar(tester, find.byKey(const Key('contrato-cerrar')));
      expect(
        find.text('01-07-2026 → 28-07-2027. Esta acción no se puede deshacer.'),
        findsOneWidget,
      );
      await _tocar(tester, find.byKey(const Key('cerrar-confirmar')));
      expect(find.text('Motivo requerido'), findsOneWidget);

      await _elegirOpcion(
        tester,
        find.byKey(const Key('cerrar-estado')),
        'Cancelado (terminación anticipada)',
      );
      await tester.enterText(
        find.byKey(const Key('cerrar-motivo')),
        'Rescisión anticipada',
      );
      await _tocar(tester, find.byKey(const Key('cerrar-confirmar')));
      final post = peticionesFalsas.singleWhere((r) => r.method == 'POST');
      expect(post.url.path, endsWith('/contratos/con-1/cerrar'));
      expect(cuerpoDe(post), {
        'motivoFin': 'Rescisión anticipada',
        'estado': 'cancelado',
      });
      expect(
        find.text(
          'Contrato cerrado; el local quedó disponible si no hay otros vigentes',
        ),
        findsOneWidget,
      );
      expect(find.byKey(const Key('cerrar-confirmar')), findsNothing);
    });

    testWidgets('renovar: vista previa, body y CONTRATO_OVERLAP', (
      tester,
    ) async {
      final rutas = _rutas()
        ..['POST /contratos/:id/renovar'] = (_) => const RespuestaFalsa(409, {
          'code': 'CONTRATO_OVERLAP',
          'detail':
              'El rango del contrato se solapa con otro vigente del mismo '
              'local.',
        });
      await _montar(
        tester,
        const ContratoDetallePage(id: 'con-1'),
        rutas: rutas,
      );
      await _tocar(tester, find.byKey(const Key('contrato-renovar')));
      await _tocar(tester, find.byKey(const Key('renovar-confirmar')));
      expect(find.text('Requerida'), findsOneWidget);
      expect(peticionesFalsas.where((r) => r.method == 'POST'), isEmpty);

      final inicio = await _elegirDia(
        tester,
        find.byKey(const Key('renovar-inicio')),
        20,
      );
      await tester.enterText(find.byKey(const Key('renovar-monto')), '1300');
      await tester.pumpAndSettle();
      expect(
        find.text(
          '${formatFechaDMY(inicio)} → indefinido · USD 1,300.00 / mes',
        ),
        findsOneWidget,
      );
      await _tocar(tester, find.byKey(const Key('renovar-confirmar')));
      final post = peticionesFalsas.singleWhere((r) => r.method == 'POST');
      expect(cuerpoDe(post), {
        'nuevaFechaInicio': inicio,
        'nuevaFechaFin': null,
        'nuevoMontoMensual': 1300,
      });
      expect(
        find.text(
          'El rango del contrato se solapa con otro vigente del mismo local.',
        ),
        findsOneWidget,
      );
    });
  });

  testWidgets('renovar admite fechas en años lejanos', (tester) async {
    await _montar(tester, const ContratoDetallePage(id: 'con-1'));
    await _tocar(tester, find.byKey(const Key('contrato-renovar')));
    for (final campo in ['renovar-inicio', 'renovar-fin']) {
      await _tocar(tester, find.byKey(Key(campo)));
      expect(_ultimoAnioDelSelector(tester), 2100, reason: campo);
      await tester.tap(find.text('Cancelar').last);
      await tester.pumpAndSettle();
    }
  });

  group('Carga inicial', () {
    testWidgets('responsive, también con la vista previa', (tester) async {
      await probarEnTamanos(
        tester,
        () => _en(const CargaInicialPage()),
        overrides: [
          ...overridesBase(
            apiFalsa(_rutas()),
            sesion: sesionDe(Rol.adminPlaza),
          ),
          selectorArchivosProvider.overrideWithValue(_xlsx),
        ],
        alPintar: (_, _) async {
          await _tocar(tester, find.byKey(const Key('carga-elegir')));
          expect(tester.takeException(), isNull);
          expect(find.byKey(const Key('carga-resumen')), findsOneWidget);
          await recorrerPestanas(tester, [
            'Con advertencia',
            'Con error',
            'Todas',
          ]);
        },
      );
    });

    testWidgets('analiza, muestra el resumen y solo importa al confirmar', (
      tester,
    ) async {
      await _montar(tester, const CargaInicialPage(), selector: _xlsx);
      await _tocar(tester, find.byKey(const Key('carga-elegir')));

      final analisis = peticionesFalsas.single;
      expect(
        analisis.url.path,
        endsWith('/importacion/carga-inicial/analizar'),
      );
      expect(
        analisis.headers['content-type'],
        startsWith('multipart/form-data'),
      );
      expect(analisis.body, contains('filename="carga-plaza-norte.xlsx"'));
      expect(
        analisis.body,
        contains(
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ),
      );

      // Resumen ANTES de ejecutar: nada guardado todavía.
      expect(
        find.textContaining('todavía no se ha guardado nada'),
        findsOneWidget,
      );
      expect(find.text('Locales a crear'), findsOneWidget);
      expect(find.text('Inquilinos a crear'), findsOneWidget);
      expect(find.text('Contratos a crear'), findsOneWidget);
      expect(find.text('Filas con advertencia'), findsOneWidget);
      expect(find.text('Filas con error'), findsOneWidget);
      expect(
        find.textContaining(
          'Ya existían en la plaza y se reutilizan: 1 locales',
        ),
        findsOneWidget,
      );
      expect(find.textContaining('(3, 4, 5)'), findsOneWidget);
      expect(find.textContaining('MEDIDOR AGUA, TOTAL CAM'), findsOneWidget);
      expect(find.text('Fila 7'), findsOneWidget);
      expect(find.text('Igual a fila 6'), findsOneWidget);
      expect(find.text('No se crea'), findsWidgets);
      expect(find.text('Desde 01-07-2026 · USD 1,225.00'), findsOneWidget);

      // Cancelar la confirmación no ejecuta.
      await _tocar(tester, find.byKey(const Key('carga-importar')));
      expect(
        find.textContaining(
          'Se crearán 2 locales, 1 inquilinos y 1 contratos.',
        ),
        findsOneWidget,
      );
      expect(
        find.textContaining(
          'No se importan: 1 fila(s) con error y 1 contrato(s) omitido(s).',
        ),
        findsOneWidget,
      );
      await tester.tap(find.text('Cancelar').last);
      await tester.pumpAndSettle();
      expect(peticionesFalsas, hasLength(1));

      await _tocar(tester, find.byKey(const Key('carga-importar')));
      await tester.tap(find.text('Sí, importar'));
      await tester.pumpAndSettle();
      expect(
        peticionesFalsas.last.url.path,
        endsWith('/importacion/carga-inicial/ejecutar'),
      );
      expect(
        find.text(
          'Importación completada. Los datos ya están disponibles en la plaza.',
        ),
        findsOneWidget,
      );
      expect(find.text('Locales creados'), findsOneWidget);
      expect(find.text('Creado'), findsWidgets);
      expect(find.text('Ver contratos'), findsOneWidget);
    });

    testWidgets('importar recarga las opciones de los filtros de Contratos', (
      tester,
    ) async {
      // La lista de Contratos queda montada debajo con sus filtros vivos.
      await _montar(
        tester,
        Column(
          children: [
            Consumer(
              builder: (_, ref, _) {
                ref.watch(opcionesLocalesProvider(false));
                ref.watch(opcionesInquilinosProvider);
                return const SizedBox.shrink();
              },
            ),
            const Expanded(child: CargaInicialPage()),
          ],
        ),
        selector: _xlsx,
      );
      int gets(String ruta) => peticionesFalsas
          .where((r) => r.method == 'GET' && r.url.path.endsWith(ruta))
          .length;
      expect((gets('/locales'), gets('/inquilinos')), (1, 1));

      await _tocar(tester, find.byKey(const Key('carga-elegir')));
      await _tocar(tester, find.byKey(const Key('carga-importar')));
      await tester.tap(find.text('Sí, importar'));
      await tester.pumpAndSettle();
      expect((gets('/locales'), gets('/inquilinos')), (2, 2));
    });

    testWidgets('fila con varios mensajes: tocarla los muestra todos', (
      tester,
    ) async {
      await _montar(tester, const CargaInicialPage(), selector: _xlsx);
      await _tocar(tester, find.byKey(const Key('carga-elegir')));
      await _tocar(tester, find.text('Fila 7'));
      expect(
        find.text('• CORREO CONTACTO inválido: se descarta.'),
        findsOneWidget,
      );
    });

    testWidgets('rechaza archivos que no son .xlsx sin llamar a la API', (
      tester,
    ) async {
      await _montar(
        tester,
        const CargaInicialPage(),
        selector: _SelectorFalso(ArchivoElegido('datos.csv', Uint8List(3))),
      );
      await _tocar(tester, find.byKey(const Key('carga-elegir')));
      expect(
        find.text('datos.csv: solo se aceptan archivos Excel .xlsx.'),
        findsOneWidget,
      );
      expect(peticionesFalsas, isEmpty);
    });

    testWidgets('sin "contratos.importar" muestra "Sin permiso"', (
      tester,
    ) async {
      await _montar(
        tester,
        const CargaInicialPage(),
        sesion: sesionDe(Rol.adminPlaza, permisos: ['contratos.listar']),
      );
      expect(find.text('Sin permiso'), findsOneWidget);
      expect(find.byKey(const Key('carga-elegir')), findsNothing);
    });

    test('la plantilla con ejemplos está empaquetada', () async {
      TestWidgetsFlutterBinding.ensureInitialized();
      final datos = await rootBundle.load(plantillaCargaInicial);
      expect(datos.lengthInBytes, greaterThan(1000));
    });
  });

  group('Inquilino', () {
    testWidgets('mis contratos responsive, sin columna Inquilino', (
      tester,
    ) async {
      await probarEnTamanos(
        tester,
        () => _en(const MisContratosPage()),
        overrides: overridesBase(
          apiFalsa({
            'GET /contratos': (req) {
              expect(req.url.queryParameters['pageSize'], '50');
              return paginado([contratoJson()]);
            },
          }),
          sesion: sesionDe(Rol.inquilino),
        ),
        alPintar: (_, _) async {
          expect(
            find.text('1 contratos asociados a tu cuenta.'),
            findsOneWidget,
          );
          expect(find.text(codigoLargo), findsOneWidget);
          expect(find.text(razonLargaDecodificada), findsNothing);
          await recorrerPagina(tester);
        },
      );
    });

    testWidgets('mi contrato responsive con PDF que el inquilino puede subir', (
      tester,
    ) async {
      await probarEnTamanos(
        tester,
        () => _en(const MiContratoPage(id: 'con-1')),
        overrides: overridesBase(
          apiFalsa(_rutas()),
          sesion: sesionDe(Rol.inquilino),
        ),
        alPintar: (_, _) async {
          expect(find.text('Local $codigoLargo'), findsOneWidget);
          expect(find.text('USD 1,250.00'), findsOneWidget);
          await verEnPagina(
            tester,
            find.textContaining('contrato-firmado-local'),
          );
          expect(find.byKey(const Key('adjuntos-subir')), findsOneWidget);
          await recorrerPagina(tester);
        },
      );
    });
  });

  test('modelos y cuerpos', () {
    expect(montoCalculado(area: 50, canon: 20, cam: 4.5), 1225.0);
    expect(montoCalculado(area: 33.33, canon: 1.1, cam: 0), 36.66);
    final c = Contrato.fromJson(contratoJson());
    expect(c.totalCanon, 1000);
    expect(c.totalCam, 225);
    expect(c.inquilinoRazonSocial, razonLargaDecodificada);
    expect(cuerpoCerrarContrato(motivo: ' x ', estado: 'finalizado'), {
      'motivoFin': 'x',
      'estado': 'finalizado',
    });
    expect(cuerpoRenovarContrato(nuevaFechaInicio: '2027-01-01'), {
      'nuevaFechaInicio': '2027-01-01',
      'nuevaFechaFin': null,
    });
    final cuerpo = cuerpoNuevoContrato(
      localId: 'l',
      inquilinoId: 'i',
      fechaInicio: '2026-01-01',
      fechaFin: null,
      montoMensual: 0,
      moneda: 'usd',
      textos: {'plazoMeses': '', 'condiciones': '  '},
      fechas: {'avisoTerminacion': null, 'fechaEntregaLocal': '2025-12-01'},
    );
    expect(cuerpo, {
      'localId': 'l',
      'inquilinoId': 'i',
      'fechaInicio': '2026-01-01',
      'fechaFin': null,
      'montoMensual': 0.0,
      'moneda': 'USD',
      'fechaEntregaLocal': '2025-12-01',
    });
    final r = ResultadoAnalisisCarga.fromJson(resultadoCargaJson());
    expect(r.nadaQueCrear, isFalse);
    expect(r.filas[1].inquilino!.filaOrigen, 6);
  });
}

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend_mobil/core/auth/sesion.dart';
import 'package:frontend_mobil/features/calendario/calendario_page.dart';
import 'package:frontend_mobil/features/calendario/vistas/evento_widgets.dart';
import 'package:http/http.dart' as http;

import '../../helpers/api_falsa.dart';
import '../../helpers/pantallas.dart';
import 'fixtures_calendario.dart';

final _dia27 = DateTime.utc(2026, 9, 27);

Map<String, dynamic> _pagina(List<Map<String, dynamic>> items) => {
  'items': items,
  'total': items.length,
  'page': 1,
  'pageSize': 100,
  'totalPages': 1,
};

/// Rutas falsas comunes. [feed] por defecto: semana del 21 al 27-09-2026.
Map<String, ManejadorFalso> _rutas({
  List<Map<String, dynamic>>? feed,
  bool hitos = true,
  ManejadorFalso? patch,
}) => {
  'GET /calendario': (_) => feed ?? feedSemana(),
  'GET /locales': (_) => _pagina([
    {'id': localSol, 'codigo': 'L-SOL-1'},
    {'id': 'local-2', 'codigo': 'L-ANEXO-PLANTA-ALTA-PASILLO-NORTE-042'},
  ]),
  'GET /inquilinos': (_) => _pagina([
    {
      'id': 'inq-1',
      'razonSocial':
          'Inversiones y Comercializadora del Pacífico Centroamericano '
          'S.A. de C.V.',
    },
    {'id': 'inq-2', 'razonSocial': 'Tienda Sol S.A. de C.V.'},
  ]),
  'GET /configuracion': (_) => {'calendarMostrarHitosContrato': hitos},
  'GET /contratos': (_) => _pagina([
    {'id': 'c1', 'localId': localSol, 'localCodigo': 'L-SOL-1'},
    {'id': 'c2', 'localId': localSol, 'localCodigo': 'L-SOL-1'},
    {'id': 'c3', 'localId': 'local-9', 'localCodigo': 'L-9'},
  ]),
  'PATCH /calendario/eventos/:id/fechas': patch ?? (_) => realEvento16,
  'GET /calendario/export.ics': (_) => 'BEGIN:VCALENDAR',
};

Widget Function() _pantalla({
  bool inquilino = false,
  VistaCalendario? vista = VistaCalendario.agenda,
}) =>
    // Scaffold como el del AppScaffold (para ver los SnackBar).
    () => Scaffold(
      body: CalendarioPage(
        esInquilino: inquilino,
        fechaInicial: _dia27,
        vistaInicial: vista,
      ),
    );

Future<void> _montar(
  WidgetTester tester, {
  bool inquilino = false,
  VistaCalendario? vista = VistaCalendario.agenda,
  List<String>? permisos,
  Map<String, ManejadorFalso>? rutas,
  Size tamano = const Size(390, 844),
}) async {
  addTearDown(tester.view.reset);
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = tamano;
  final api = apiFalsa(rutas ?? _rutas());
  await tester.pumpWidget(
    envolver(
      _pantalla(inquilino: inquilino, vista: vista),
      overrides: overridesBase(
        api,
        sesion: sesionDe(
          inquilino ? Rol.inquilino : Rol.adminPlaza,
          permisos: permisos,
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

List<http.Request> _feeds() =>
    peticionesFalsas.where((r) => r.url.path.endsWith('/calendario')).toList();

/// ¿Hay un texto con [codigo] en negrita (span propio) antes del título?
bool _codigoEnNegrita(WidgetTester tester, String codigo) {
  return tester.widgetList<Text>(find.byType(Text)).any((w) {
    final span = w.textSpan;
    if (span is! TextSpan) return false;
    return span.children?.any(
          (s) =>
              s is TextSpan &&
              s.text == '$codigo ' &&
              s.style?.fontWeight == FontWeight.w700,
        ) ??
        false;
  });
}

Future<void> _tocar(WidgetTester tester, Finder f) async {
  await tester.ensureVisible(f);
  await tester.pumpAndSettle();
  await tester.tap(f);
  await tester.pumpAndSettle();
}

/// Busca solo dentro de la hoja inferior abierta.
Finder _enHoja(Finder f) =>
    find.descendant(of: find.byType(BottomSheet), matching: f);

Finder _filaDe(String codigo) => find.ancestor(
  of: find.textContaining(codigo),
  matching: find.byType(FilaEvento),
);

void main() {
  setUp(prepararPruebas);

  group('agenda', () {
    testWidgets('agrupa por día, horas en 12 h y código en negrita', (
      tester,
    ) async {
      await _montar(tester);

      expect(find.text('Domingo, 27 de septiembre de 2026'), findsOneWidget);
      expect(find.text('Jueves, 24 de septiembre de 2026'), findsOneWidget);
      expect(find.text('Miércoles, 23 de septiembre de 2026'), findsOneWidget);
      // Los 8 items del domingo (7 eventos + 1 solicitud) a las 15:42 plaza.
      expect(find.text('3:42 pm – 5:42 pm'), findsNWidgets(8));
      expect(find.text('10:00 am – 11:00 am'), findsOneWidget);
      expect(find.text('Todo el día'), findsOneWidget);
      expect(find.textContaining('15:42'), findsNothing);
      expect(_codigoEnNegrita(tester, 'SOL-DEMO-16'), isTrue);
      expect(_codigoEnNegrita(tester, 'SOL-carga-qa-1234'), isTrue);

      // Rango de la semana (lunes a lunes) con el desfase de la plaza.
      final q = _feeds().single.url.queryParameters;
      expect(q['from'], '2026-09-21T00:00:00-06:00');
      expect(q['to'], '2026-09-28T00:00:00-06:00');
      expect(q.containsKey('tipo'), isFalse);
      expect(find.text('21 sept – 27 sept 2026'), findsOneWidget);
    });

    testWidgets('sin eventos muestra el vacío', (tester) async {
      await _montar(tester, rutas: _rutas(feed: []));
      expect(find.text('No hay eventos para mostrar'), findsOneWidget);
    });

    testWidgets('anterior/siguiente mueven la semana y piden otro rango', (
      tester,
    ) async {
      await _montar(tester);
      await _tocar(tester, find.byTooltip('Siguiente'));
      expect(
        _feeds().last.url.queryParameters['from'],
        '2026-09-28T00:00:00-06:00',
      );
      await _tocar(tester, find.byTooltip('Anterior'));
      await _tocar(tester, find.byTooltip('Anterior'));
      expect(
        _feeds().last.url.queryParameters['from'],
        '2026-09-14T00:00:00-06:00',
      );
    });

    testWidgets('recarga sola cada 5 minutos', (tester) async {
      await _montar(tester);
      final antes = _feeds().length;
      await tester.pump(const Duration(minutes: 5));
      await tester.pumpAndSettle();
      expect(_feeds().length, antes + 1);
    });
  });

  group('vista inicial por ancho', () {
    testWidgets('teléfono arranca en Agenda', (tester) async {
      await _montar(tester, vista: null);
      final chip = tester.widget<ChoiceChip>(
        find.widgetWithText(ChoiceChip, 'Agenda'),
      );
      expect(chip.selected, isTrue);
    });

    testWidgets('tablet arranca en Mes', (tester) async {
      await _montar(tester, vista: null, tamano: const Size(1024, 768));
      final chip = tester.widget<ChoiceChip>(
        find.widgetWithText(ChoiceChip, 'Mes'),
      );
      expect(chip.selected, isTrue);
      expect(find.text('Septiembre de 2026'), findsOneWidget);
    });
  });

  group('mes', () {
    testWidgets('marca puntos y "+N" en los días con eventos', (tester) async {
      await _montar(tester, vista: VistaCalendario.mes);

      Finder puntos(String dia) => find.descendant(
        of: find.byKey(ValueKey('dia-$dia')),
        matching: find.byType(PuntoEvento),
      );
      expect(puntos('2026-09-27'), findsNWidgets(3));
      expect(
        find.descendant(
          of: find.byKey(const ValueKey('dia-2026-09-27')),
          matching: find.text('+5'),
        ),
        findsOneWidget,
      );
      expect(puntos('2026-09-24'), findsOneWidget);
      expect(puntos('2026-10-01'), findsOneWidget); // mantenimiento
      expect(puntos('2026-10-02'), findsOneWidget);
      expect(puntos('2026-10-03'), findsNothing); // fin exclusivo
      expect(puntos('2026-09-22'), findsNothing);

      // Rejilla de 6 semanas desde el lunes 31-08.
      final q = _feeds().single.url.queryParameters;
      expect(q['from'], '2026-08-31T00:00:00-06:00');
      expect(q['to'], '2026-10-12T00:00:00-06:00');

      // Lista del día seleccionado (27) y cambio de día.
      expect(find.byType(FilaEvento), findsNWidgets(8));
      await _tocar(tester, find.byKey(const ValueKey('dia-2026-09-24')));
      expect(find.text('Jueves, 24 de septiembre de 2026'), findsOneWidget);
      expect(find.byType(FilaEvento), findsOneWidget);
      await _tocar(tester, find.byKey(const ValueKey('dia-2026-09-22')));
      expect(find.text('Sin eventos este día.'), findsOneWidget);
    });
  });

  group('rejilla', () {
    testWidgets('semana: etiquetas en 12 h y solapes con "+N"', (tester) async {
      await _montar(tester, vista: VistaCalendario.semana);
      expect(find.text('3:00 pm'), findsOneWidget);
      expect(find.text('15:00'), findsNothing);
      // 8 items solapados el domingo: 1 visible + "+7" en semana.
      expect(find.text('+7'), findsOneWidget);
      expect(find.textContaining('3:42 pm SOL-DEMO-'), findsOneWidget);
    });

    testWidgets('día: evento a su hora, hasta 4 columnas y lista del "+N"', (
      tester,
    ) async {
      await _montar(tester, vista: VistaCalendario.dia);
      final bloques = find.textContaining('3:42 pm SOL-DEMO-');
      expect(bloques, findsNWidgets(3));
      expect(find.text('+5'), findsOneWidget);

      // 15:42 queda a 42 min (33.6 px) de la línea de las 3:00 pm.
      final etiqueta = tester.getTopLeft(find.text('3:00 pm')).dy - 2;
      final bloque = tester.getTopLeft(
        find.ancestor(of: bloques.first, matching: find.byType(BloqueEvento)),
      );
      expect(bloque.dy - etiqueta, closeTo(33.6, 0.5));

      await _tocar(tester, find.text('+5'));
      expect(
        find.descendant(
          of: find.byType(BottomSheet),
          matching: find.byType(FilaEvento),
        ),
        findsNWidgets(8),
      );
    });
  });

  group('detalle del evento', () {
    testWidgets('admin con permiso cambia fechas (PATCH con −06:00)', (
      tester,
    ) async {
      await _montar(tester);
      await _tocar(tester, _filaDe('SOL-DEMO-16'));

      expect(
        _enHoja(find.text('Este evento se solapa con otro en el mismo local.')),
        findsOneWidget,
      );
      expect(_enHoja(find.text('N.º solicitud: SOL-DEMO-16')), findsOneWidget);
      expect(
        _enHoja(find.text('27/09/2026 3:42 pm — 27/09/2026 5:42 pm')),
        findsOneWidget,
      );
      expect(_enHoja(find.text('Local: L-SOL-1')), findsOneWidget);
      expect(_enHoja(find.text('Tipo: Eventos aprobados')), findsOneWidget);
      expect(_enHoja(find.text('Aprobada')), findsOneWidget);
      expect(_enHoja(find.text('Ver solicitud SOL-DEMO-16')), findsOneWidget);

      final feedsAntes = _feeds().length;
      await _tocar(tester, find.text('Cambiar fechas'));
      expect(_enHoja(find.text('3:42 pm')), findsOneWidget); // 12 h
      await _tocar(tester, find.text('Guardar fechas'));

      final patch = peticionesFalsas.singleWhere((r) => r.method == 'PATCH');
      expect(
        patch.url.path,
        '/api/v1/calendario/eventos/a0251907-3bf5-4114-aa20-f540534adcde/fechas',
      );
      expect(cuerpoDe(patch), {
        'inicio': '2026-09-27T15:42:00-06:00',
        'fin': '2026-09-27T17:42:00-06:00',
      });
      expect(find.text('Fechas del evento actualizadas.'), findsOneWidget);
      expect(find.byType(BottomSheet), findsNothing);
      expect(_feeds().length, feedsAntes + 1);
    });

    testWidgets('EVENTO_CERRADO muestra el aviso y recarga', (tester) async {
      await _montar(
        tester,
        rutas: _rutas(
          patch: (_) => const RespuestaFalsa(409, {
            'code': 'EVENTO_CERRADO',
            'detail': 'La solicitud está cerrada; su evento no se puede mover.',
          }),
        ),
      );
      await _tocar(tester, _filaDe('SOL-DEMO-16'));
      await _tocar(tester, find.text('Cambiar fechas'));
      await _tocar(tester, find.text('Guardar fechas'));
      expect(
        find.text('La solicitud está cerrada; su evento no se puede mover.'),
        findsOneWidget,
      );
      expect(find.byType(BottomSheet), findsOneWidget);
    });

    testWidgets('sin calendario.mover_evento no aparece "Cambiar fechas"', (
      tester,
    ) async {
      await _montar(tester, permisos: ['calendario.ver']);
      await _tocar(tester, _filaDe('SOL-DEMO-16'));
      expect(_enHoja(find.text('Ver solicitud SOL-DEMO-16')), findsOneWidget);
      expect(find.text('Cambiar fechas'), findsNothing);
      // Tampoco "Exportar iCal" sin calendario.exportar_ics.
      expect(find.text('Exportar iCal'), findsNothing);
    });

    testWidgets('evento de solicitud cerrada: se ve pero no se mueve', (
      tester,
    ) async {
      await _montar(tester);
      await _tocar(tester, _filaDe('SOL-carga-qa-1234'));
      expect(_enHoja(find.text('Cerrada')), findsOneWidget);
      expect(find.text('Cambiar fechas'), findsNothing);
    });

    testWidgets('día completo dice "(todo el día)" con fin exclusivo', (
      tester,
    ) async {
      await _montar(
        tester,
        rutas: _rutas(feed: [realMantenimiento]),
        vista: VistaCalendario.dia,
      );
      await _tocar(tester, find.byTooltip('Siguiente'));
      await _tocar(tester, find.byTooltip('Siguiente'));
      await _tocar(tester, find.byTooltip('Siguiente'));
      await _tocar(tester, find.byTooltip('Siguiente'));
      await _tocar(tester, find.textContaining('SOL-DEMO-89'));
      expect(
        find.text('01/10/2026 — 02/10/2026 (todo el día)'),
        findsOneWidget,
      );
      expect(_enHoja(find.text('Tipo: Mantenimientos')), findsOneWidget);
    });

    testWidgets('"Ver solicitud" abre el detalle del rol', (tester) async {
      await _montar(tester);
      await _tocar(tester, _filaDe('SOL-DEMO-16'));
      await _tocar(tester, _enHoja(find.text('Ver solicitud SOL-DEMO-16')));
      expect(
        find.text(
          'Ruta: /admin/solicitudes/c409cfdf-b1b6-48fa-bb59-62157643f417',
        ),
        findsOneWidget,
      );
    });

    testWidgets('inquilino: sin "Cambiar fechas" y ruta del inquilino', (
      tester,
    ) async {
      await _montar(tester, inquilino: true);
      await _tocar(tester, _filaDe('SOL-DEMO-18'));
      expect(_enHoja(find.text('Tipo: Mis solicitudes')), findsOneWidget);
      expect(_enHoja(find.text('Asignada')), findsOneWidget);
      Navigator.of(tester.element(find.byType(BottomSheet))).pop();
      await tester.pumpAndSettle();
      await _tocar(tester, _filaDe('SOL-DEMO-16'));
      expect(find.text('Cambiar fechas'), findsNothing);
      await _tocar(tester, _enHoja(find.text('Ver solicitud SOL-DEMO-16')));
      expect(
        find.text(
          'Ruta: /inquilino/solicitudes/c409cfdf-b1b6-48fa-bb59-62157643f417',
        ),
        findsOneWidget,
      );
    });
  });

  group('inquilino: crear desde un hueco', () {
    testWidgets('día ocupado avisa; día libre abre el wizard', (tester) async {
      await _montar(tester, inquilino: true, vista: VistaCalendario.mes);
      await _tocar(tester, find.text('Solicitar evento este día'));
      expect(
        find.text(
          'Ya hay un evento aprobado en este horario. Elige otro slot del '
          'calendario.',
        ),
        findsOneWidget,
      );
      expect(find.text('Crear solicitud de evento'), findsNothing);
      Navigator.of(tester.element(find.byType(BottomSheet))).pop();
      await tester.pumpAndSettle();

      await _tocar(tester, find.byKey(const ValueKey('dia-2026-09-22')));
      await _tocar(tester, find.text('Solicitar evento este día'));
      expect(find.text('22-09-2026'), findsOneWidget);
      await _tocar(tester, find.text('Crear solicitud de evento'));
      expect(
        find.text(
          'Ruta: /inquilino/solicitudes/nueva?tipo=evento&fecha=2026-09-22',
        ),
        findsOneWidget,
      );
    });

    testWidgets('hora libre y hora ocupada en la vista día', (tester) async {
      await _montar(tester, inquilino: true, vista: VistaCalendario.dia);

      Future<void> tocarHora(String etiqueta) async {
        await tester.ensureVisible(find.text(etiqueta));
        await tester.pumpAndSettle();
        final p = tester.getCenter(find.text(etiqueta));
        await tester.tapAt(p.translate(150, 12));
        await tester.pumpAndSettle();
      }

      await tocarHora('3:00 pm'); // 15:00–16:00 choca con el de 15:42
      expect(
        find.text(
          'Ya hay un evento aprobado en este horario. Elige otro slot del '
          'calendario.',
        ),
        findsOneWidget,
      );
      Navigator.of(tester.element(find.byType(BottomSheet))).pop();
      await tester.pumpAndSettle();

      await tocarHora('2:00 pm');
      expect(find.text('27-09-2026 a las 2:00 pm'), findsOneWidget);
      await _tocar(tester, find.text('Crear solicitud de evento'));
      expect(
        find.text(
          'Ruta: /inquilino/solicitudes/nueva?tipo=evento&fecha=2026-09-27'
          '&hora=14:00',
        ),
        findsOneWidget,
      );
    });

    testWidgets('botón fijo "Nueva solicitud de evento"', (tester) async {
      await _montar(tester, inquilino: true);
      await _tocar(tester, find.text('Nueva solicitud de evento'));
      expect(
        find.text('Ruta: /inquilino/solicitudes/nueva?tipo=evento'),
        findsOneWidget,
      );
    });
  });

  group('filtros', () {
    testWidgets('admin: local, inquilino y tipos recargan el feed', (
      tester,
    ) async {
      await _montar(tester);
      await _tocar(tester, find.text('Filtros'));
      expect(find.text('Inquilino'), findsOneWidget);
      expect(find.text('Zona de la plaza (GMT-6)'), findsOneWidget);
      expect(find.text('Mi zona horaria'), findsOneWidget);
      // Hitos visibles en la leyenda y en los filtros.
      expect(find.text('Hitos contractuales'), findsNWidgets(2));

      await _tocar(tester, find.text('L-SOL-1').first);
      expect(_feeds().last.url.queryParameters['localId'], localSol);
      await _tocar(tester, find.text('Tienda Sol S.A. de C.V.'));
      expect(_feeds().last.url.queryParameters['inquilinoId'], 'inq-2');
      await _tocar(tester, find.text('Mantenimientos').first);
      expect(
        _feeds().last.url.queryParameters['tipo'],
        'evento,hito_contrato,solicitud',
      );
      expect(find.text('Ocultar filtros'), findsOneWidget);
      await _tocar(tester, find.text('Ocultar filtros'));
      expect(find.text('Filtros (3)'), findsOneWidget);
    });

    testWidgets('admin: sin hitos en configuración se oculta la casilla', (
      tester,
    ) async {
      await _montar(tester, rutas: _rutas(hitos: false));
      await _tocar(tester, find.text('Filtros'));
      expect(find.text('Hitos contractuales'), findsNothing);
    });

    testWidgets('inquilino: locales de sus contratos sin repetir', (
      tester,
    ) async {
      await _montar(tester, inquilino: true);
      await _tocar(tester, find.text('Filtros'));
      expect(find.text('Inquilino'), findsNothing);
      expect(find.text('Mis solicitudes'), findsNWidgets(2));
      expect(find.text('L-9'), findsOneWidget);
      expect(
        find.descendant(
          of: find.byType(Card).first,
          matching: find.text('L-SOL-1'),
        ),
        findsOneWidget,
      );
      final contratos = peticionesFalsas.singleWhere(
        (r) => r.url.path.endsWith('/contratos'),
      );
      expect(contratos.url.queryParameters['estado'], 'vigente');
    });

    testWidgets('Exportar iCal pide el .ics con los locales filtrados', (
      tester,
    ) async {
      // Tablet: el panel de filtros va al costado (sin botón "Filtros").
      await _montar(tester, tamano: const Size(1024, 1400));
      expect(find.text('Filtros'), findsNothing);
      await _tocar(tester, find.text('L-SOL-1').first);
      await _tocar(tester, find.text('Exportar iCal'));
      final ics = peticionesFalsas.singleWhere(
        (r) => r.url.path.endsWith('/calendario/export.ics'),
      );
      expect(ics.url.queryParameters, {'localId': localSol});
    });

    testWidgets('admin sin calendario.ver no ve el calendario', (tester) async {
      await _montar(tester, permisos: ['solicitudes.bandeja.ver']);
      expect(
        find.text('No tienes permiso para ver el calendario.'),
        findsOneWidget,
      );
      expect(_feeds(), isEmpty);
    });
  });

  group('responsive (360–1024 px, claro y oscuro)', () {
    final eventosMuchos = [
      ...feedSemana(),
      for (var i = 0; i < 12; i++)
        eventoJson(
          id: 'evt-largo-$i',
          titulo: 'SOL-carga-qa-12$i · $tituloLargo',
          inicio:
              '2026-09-25T${(14 + i % 6).toString().padLeft(2, '0')}:00:00Z',
          fin: '2026-09-25T${(16 + i % 6).toString().padLeft(2, '0')}:30:00Z',
          codigo: 'SOL-carga-qa-12$i',
          solicitudId: 'sol-largo-$i',
          localCodigo: 'L-ANEXO-PLANTA-ALTA-PASILLO-NORTE-042',
          choque: i.isEven,
        ),
    ];

    for (final vista in VistaCalendario.values) {
      for (final inquilino in [false, true]) {
        testWidgets(
          '${vista.etiqueta} (${inquilino ? 'inquilino' : 'admin'})',
          (tester) async {
            await probarEnTamanos(
              tester,
              () => CalendarioPage(
                esInquilino: inquilino,
                fechaInicial: DateTime.utc(2026, 9, 25),
                vistaInicial: vista,
              ),
              overrides: overridesBase(
                apiFalsa(_rutas(feed: eventosMuchos)),
                sesion: sesionDe(inquilino ? Rol.inquilino : Rol.adminPlaza),
              ),
              alPintar: (tamano, brillo) async {
                // Con los filtros abiertos (o en el panel lateral) tampoco
                // desborda.
                final boton = find.text('Filtros');
                if (boton.evaluate().isNotEmpty) {
                  await _tocar(tester, boton);
                  expect(tester.takeException(), isNull);
                }
              },
            );
          },
        );
      }
    }

    testWidgets('hoja de detalle con título largo y "Cambiar fechas"', (
      tester,
    ) async {
      await probarEnTamanos(
        tester,
        () => CalendarioPage(
          esInquilino: false,
          fechaInicial: DateTime.utc(2026, 9, 25),
          vistaInicial: VistaCalendario.agenda,
        ),
        overrides: overridesBase(
          apiFalsa(_rutas(feed: eventosMuchos)),
          sesion: sesionDe(Rol.adminPlaza),
        ),
        alPintar: (tamano, brillo) async {
          await _tocar(tester, _filaDe('SOL-carga-qa-120'));
          expect(find.textContaining(tituloLargo), findsWidgets);
          await _tocar(tester, find.text('Cambiar fechas'));
          expect(find.text('Guardar fechas'), findsOneWidget);
          expect(tester.takeException(), isNull);
        },
      );
    });

    testWidgets('hoja de hueco del inquilino', (tester) async {
      await probarEnTamanos(
        tester,
        () => CalendarioPage(
          esInquilino: true,
          fechaInicial: _dia27,
          vistaInicial: VistaCalendario.mes,
        ),
        overrides: overridesBase(
          apiFalsa(_rutas()),
          sesion: sesionDe(Rol.inquilino),
        ),
        alPintar: (tamano, brillo) async {
          await _tocar(tester, find.text('Solicitar evento este día'));
          expect(find.byType(BottomSheet), findsOneWidget);
          expect(tester.takeException(), isNull);
        },
      );
    });
  });
}

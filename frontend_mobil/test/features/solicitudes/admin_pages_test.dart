import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend_mobil/core/auth/sesion.dart';
import 'package:frontend_mobil/features/solicitudes/admin/bandeja_page.dart';
import 'package:frontend_mobil/features/solicitudes/admin/detalle_admin_page.dart';
import 'package:frontend_mobil/features/solicitudes/global/solicitud_global_page.dart';
import 'package:frontend_mobil/features/solicitudes/global/solicitudes_globales_page.dart';

import '../../helpers/api_falsa.dart';
import '../../helpers/pantallas.dart';
import 'datos_prueba.dart';

const _yo = 'u-admin_plaza';
final _admin = sesionDe(Rol.adminPlaza, nombre: nombreLargo);

final _volverDialogo = find.descendant(
  of: find.byType(AlertDialog),
  matching: find.text('Volver'),
);

Finder _boton(String id) => find.byKey(Key('accion-$id'));

Future<void> _elegir(WidgetTester tester, String key, String opcion) async {
  await tester.tap(find.byKey(Key(key)));
  await tester.pumpAndSettle();
  await tester.tap(find.text(opcion).last);
  await tester.pumpAndSettle();
}

Future<void> _pestana(WidgetTester tester, String texto) async {
  await tester.ensureVisible(find.text(texto));
  await tester.pumpAndSettle();
  await tester.tap(find.text(texto));
  await tester.pumpAndSettle();
}

Map<String, String> _query(String metodo, String ruta) =>
    peticiones(metodo, ruta).last.url.queryParameters;

/// Detalle en [estado]; [asignado] = id del admin asignado.
Map<String, dynamic> _sol(
  String estado, {
  String? asignado = _yo,
  String creador = idCreador,
  bool largos = false,
}) => detalle(
  estado: estado,
  largos: largos,
  cambios: {
    'adminAsignadoId': asignado,
    'adminAsignado': asignado == null
        ? null
        : {
            'id': asignado,
            'nombre': asignado == _yo ? 'Admin Demo' : 'Otra Admin',
            'email': 'x@demo.com',
          },
    'usuarioCreadorId': creador,
  },
);

void main() {
  setUp(prepararPruebas);

  // ── Bandeja ───────────────────────────────────────────────────────────────

  group('Bandeja', () {
    Map<String, ManejadorFalso> rutas() => {
      'GET /solicitudes/bandeja': (_) => listado('bandeja'),
    };

    testWidgets('sin desbordes con textos largos; SLA visible', (tester) async {
      await probarEnTamanos(
        tester,
        () => const BandejaPage(),
        overrides: overridesBase(apiFalsa(rutas()), sesion: _admin),
        alPintar: (_, _) async {
          expect(find.text('Bandeja de solicitudes'), findsOneWidget);
          expect(
            find.text(
              '142 resultados · ordenadas por fecha, más reciente primero · '
              'semáforo SLA.',
            ),
            findsOneWidget,
          );
          expect(find.text('Amarillo'), findsOneWidget);
          expect(find.text('60 s'), findsOneWidget);
        },
      );
    });

    testWidgets('Todas / Asignadas a mí, filtros y orden', (tester) async {
      await montar(
        tester,
        () => const BandejaPage(),
        overridesBase(apiFalsa(rutas()), sesion: _admin),
      );
      expect(_query('GET', '/solicitudes/bandeja'), {
        'page': '1',
        'pageSize': '20',
        'orden': 'fecha',
        'asignadasAMi': 'true',
      });

      await tester.tap(find.text('Todas'));
      await tester.pumpAndSettle();
      expect(_query('GET', '/solicitudes/bandeja')['asignadasAMi'], 'false');

      await _elegir(tester, 'filtro-estado', 'En revisión');
      await _elegir(tester, 'filtro-tipo', 'Remodelación');
      await _elegir(tester, 'filtro-prioridad', 'A');
      await _elegir(tester, 'filtro-orden', 'Prioridad (A→F)');
      await tester.tap(find.byKey(const Key('filtros-aplicar')));
      await tester.pumpAndSettle();
      expect(_query('GET', '/solicitudes/bandeja'), {
        'page': '1',
        'pageSize': '20',
        'estado': 'en_revision',
        'tipo': 'remodelacion',
        'prioridad': 'A',
        'orden': 'prioridad',
        'asignadasAMi': 'false',
      });
      expect(
        find.textContaining('ordenadas por prioridad (A→F)'),
        findsOneWidget,
      );

      await tester.tap(find.text(codigoLargo));
      await tester.pumpAndSettle();
      expect(
        find.text(
          'Ruta: /admin/solicitudes/11be0400-48f8-4531-9a88-01a86239e576',
        ),
        findsOneWidget,
      );
    });

    testWidgets('se recarga sola cada 60 s', (tester) async {
      await montar(
        tester,
        () => const BandejaPage(),
        overridesBase(apiFalsa(rutas()), sesion: _admin),
      );
      expect(peticiones('GET', '/solicitudes/bandeja'), hasLength(1));
      await tester.pump(const Duration(seconds: 59));
      await tester.pumpAndSettle();
      expect(peticiones('GET', '/solicitudes/bandeja'), hasLength(1));
      await tester.pump(const Duration(seconds: 1));
      await tester.pumpAndSettle();
      expect(peticiones('GET', '/solicitudes/bandeja'), hasLength(2));
    });
  });

  // ── Detalle del admin ─────────────────────────────────────────────────────

  group('Detalle del admin', () {
    Map<String, ManejadorFalso> rutas(Map<String, dynamic> json) => {
      'GET /solicitudes/:id': (_) => json,
      'GET /usuarios': (_) => fixture('usuarios_admin'),
      'PATCH /solicitudes/:id/prioridad': (_) => json,
      'POST /solicitudes/:id/:accion': (_) => json,
      'GET /reportes/solicitudes/:id/permiso.pdf': (_) => 'PDF',
    };

    Future<void> abrir(
      WidgetTester tester,
      Map<String, dynamic> json, {
      Size tamano = const Size(1024, 2400),
      Sesion? sesion,
    }) => montar(
      tester,
      () => const DetalleAdminPage(id: idSolicitud),
      overridesBase(apiFalsa(rutas(json)), sesion: sesion ?? _admin),
      tamano: tamano,
    );

    List<Map<String, dynamic>> cuerpos(String accion) => [
      for (final r in peticiones('POST', '/solicitudes/$idSolicitud/$accion'))
        r.body.isEmpty ? <String, dynamic>{} : cuerpoDe(r),
    ];

    for (final estado in ['en_revision', 'aprobada', 'cerrada']) {
      testWidgets('sin desbordes con textos largos ($estado)', (tester) async {
        final json = _sol(estado, largos: true)
          ..['resultadoCierre'] = 'no_realizado'
          ..['cierreComentario'] = tituloLargo
          ..['cerradaAt'] = ahoraPrueba
          ..['slaStatus'] = 'rojo';
        await probarEnTamanos(
          tester,
          () => const DetalleAdminPage(id: idSolicitud),
          overrides: overridesBase(apiFalsa(rutas(json)), sesion: _admin),
          alPintar: (tamano, _) async {
            expect(find.text(codigoLargo), findsOneWidget);
            final telefono = tamano.width < 600;
            expect(
              find.text('Panel de decisión'),
              telefono ? findsNothing : findsOneWidget,
            );
            expect(
              find.byKey(const Key('barra-mas-acciones')),
              telefono ? findsOneWidget : findsNothing,
            );
            for (final p in [
              'Comentarios (2)',
              'Historial (4)',
              'Adjuntos (1)',
            ]) {
              await _pestana(tester, p);
              expect(tester.takeException(), isNull, reason: p);
            }
            if (telefono) {
              await tester.tap(find.byKey(const Key('barra-mas-acciones')));
              await tester.pumpAndSettle();
              expect(tester.takeException(), isNull);
              expect(find.text('Panel de decisión'), findsOneWidget);
            }
          },
        );
      });
    }

    testWidgets('en revisión y asignado a mí: decidir, pausar, reasignar, '
        'liberar, cancelar y prioridad', (tester) async {
      await abrir(tester, _sol('en_revision'));
      for (final id in [
        'aprobar',
        'rechazar',
        'subsanacion',
        'pausar',
        'reasignar',
        'liberar',
        'cancelar',
      ]) {
        expect(_boton(id), findsOneWidget, reason: id);
      }
      expect(_boton('tomar'), findsNothing);
      expect(find.byKey(const Key('selector-prioridad')), findsOneWidget);
      expect(find.byKey(const Key('descargar-permiso')), findsOneWidget);
    });

    testWidgets('botones según estado y asignación', (tester) async {
      await abrir(tester, _sol('enviada', asignado: null));
      expect(find.text('Tomar'), findsOneWidget);
      expect(_boton('pausar'), findsNothing);
      expect(find.text('Sin asignar'), findsOneWidget);

      await abrir(tester, _sol('asignado', asignado: 'otra'));
      expect(_boton('tomar'), findsNothing);
      expect(_boton('liberar'), findsNothing);
      expect(_boton('reasignar'), findsOneWidget);

      await abrir(tester, _sol('asignado'));
      expect(find.text('Tomar (revisar)'), findsOneWidget);
      expect(_boton('liberar'), findsOneWidget);

      // Borrador: el backend rechaza el cambio de prioridad (F14).
      await abrir(tester, _sol('borrador', asignado: null));
      expect(_boton('cancelar'), findsOneWidget);
      expect(find.byKey(const Key('selector-prioridad')), findsNothing);

      await abrir(tester, _sol('pausada', asignado: 'otra'));
      expect(_boton('reanudar'), findsOneWidget);
      expect(
        find.text(
          'Solicitud pausada por Otra Admin. Cualquier admin de la plaza '
          'puede reanudarla.',
        ),
        findsOneWidget,
      );

      await abrir(tester, _sol('aprobada', asignado: 'otra'));
      expect(_boton('cerrar'), findsNothing);
      expect(_boton('cancelar'), findsNothing);
      expect(find.byKey(const Key('selector-prioridad')), findsNothing);
      expect(
        find.text(
          'Aprobada, pendiente de cierre por Otra Admin. Solo el '
          'administrador asignado puede cerrarla.',
        ),
        findsOneWidget,
      );

      await abrir(tester, _sol('rechazada'));
      expect(
        find.text('Solicitud rechazada. No hay acciones pendientes.'),
        findsOneWidget,
      );
      expect(find.byKey(const Key('selector-prioridad')), findsNothing);

      // SC-4: el creador no decide.
      await abrir(tester, _sol('en_revision', creador: _yo));
      expect(_boton('aprobar'), findsNothing);
      expect(find.textContaining('creaste esta solicitud'), findsOneWidget);
    });

    testWidgets('sin permisos los botones no aparecen (Can)', (tester) async {
      await abrir(
        tester,
        _sol('en_revision'),
        sesion: sesionDe(Rol.adminPlaza, permisos: ['solicitudes.tomar']),
      );
      for (final id in ['aprobar', 'rechazar', 'pausar', 'cancelar']) {
        expect(_boton(id), findsNothing, reason: id);
      }
      expect(find.byKey(const Key('selector-prioridad')), findsNothing);
      await _pestana(tester, 'Comentarios (1)');
      expect(find.byKey(const Key('comentar')), findsNothing);
    });

    testWidgets('rechazar y pedir subsanación exigen comentario', (
      tester,
    ) async {
      await abrir(tester, _sol('en_revision'));
      final confirmar = find.byKey(const Key('dialogo-confirmar'));

      await tester.tap(_boton('rechazar'));
      await tester.pumpAndSettle();
      expect(
        find.text('El comentario es obligatorio y se notifica al inquilino.'),
        findsOneWidget,
      );
      expect(tester.widget<FilledButton>(confirmar).onPressed, isNull);
      await tester.enterText(
        find.byKey(const Key('dialogo-texto')),
        ' Falta el plano ',
      );
      await tester.pump();
      await tester.tap(confirmar);
      await tester.pumpAndSettle();
      expect(cuerpos('rechazar'), [
        {'comentario': 'Falta el plano'},
      ]);
      expect(find.text('Rechazada'), findsOneWidget);

      await tester.tap(_boton('subsanacion'));
      await tester.pumpAndSettle();
      expect(tester.widget<FilledButton>(confirmar).onPressed, isNull);
      await tester.tap(_volverDialogo);
      await tester.pumpAndSettle();
      expect(cuerpos('pedir-subsanacion'), isEmpty);

      await tester.tap(_boton('subsanacion'));
      await tester.pumpAndSettle();
      await tester.enterText(
        find.byKey(const Key('dialogo-texto')),
        'Adjunta una foto',
      );
      await tester.pump();
      await tester.tap(confirmar);
      await tester.pumpAndSettle();
      expect(cuerpos('pedir-subsanacion'), [
        {'comentario': 'Adjunta una foto'},
      ]);
      expect(find.text('Subsanación solicitada'), findsOneWidget);
    });

    testWidgets('aprobar con comentario opcional (vacío no se envía)', (
      tester,
    ) async {
      await abrir(tester, _sol('en_revision'));
      await tester.tap(_boton('aprobar'));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('dialogo-confirmar')));
      await tester.pumpAndSettle();
      expect(cuerpos('aprobar'), [<String, dynamic>{}]);
      expect(find.text('Aprobada'), findsOneWidget);
    });

    testWidgets('cerrar: resultado obligatorio y comentario si no es exitoso; '
        'con exitoso el comentario también se envía', (tester) async {
      await abrir(tester, _sol('aprobada'));
      final confirmar = find.byKey(const Key('cierre-confirmar'));
      await tester.tap(_boton('cerrar'));
      await tester.pumpAndSettle();
      expect(tester.widget<FilledButton>(confirmar).onPressed, isNull);
      await tester.tap(find.text('Cancelar'));
      await tester.pumpAndSettle();
      expect(cuerpos('cerrar'), isEmpty);

      await tester.tap(_boton('cerrar'));
      await tester.pumpAndSettle();
      await _elegir(tester, 'cierre-resultado', 'Cerrada parcialmente');
      expect(tester.widget<FilledButton>(confirmar).onPressed, isNull);
      expect(
        find.text(
          'El comentario es obligatorio cuando el cierre no es exitoso.',
        ),
        findsOneWidget,
      );
      await tester.enterText(
        find.byKey(const Key('cierre-comentario')),
        'Evento terminado sin incidentes',
      );
      await tester.pump();
      await _elegir(tester, 'cierre-resultado', 'Cerrada con éxito');
      await tester.tap(confirmar);
      await tester.pumpAndSettle();
      expect(cuerpos('cerrar'), [
        {
          'resultado': 'exitoso',
          'comentario': 'Evento terminado sin incidentes',
        },
      ]);
      expect(find.text('Solicitud cerrada'), findsOneWidget);
    });

    testWidgets('liberar: "Volver" no llama a la API', (tester) async {
      await abrir(tester, _sol('asignado'));
      await tester.tap(_boton('liberar'));
      await tester.pumpAndSettle();
      expect(find.text('Liberar solicitud'), findsOneWidget);
      await tester.tap(_volverDialogo);
      await tester.pumpAndSettle();
      expect(cuerpos('liberar'), isEmpty);

      await tester.tap(_boton('liberar'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Sí, liberar'));
      await tester.pumpAndSettle();
      expect(cuerpos('liberar'), [<String, dynamic>{}]);
      expect(find.text('Liberada: volvió a la cola'), findsOneWidget);
    });

    testWidgets('cancelar exige motivo', (tester) async {
      await abrir(tester, _sol('en_revision'));
      await tester.tap(_boton('cancelar'));
      await tester.pumpAndSettle();
      final confirmar = find.byKey(const Key('dialogo-confirmar'));
      expect(tester.widget<FilledButton>(confirmar).onPressed, isNull);
      await tester.enterText(
        find.byKey(const Key('dialogo-texto')),
        'Duplicada por error',
      );
      await tester.pump();
      await tester.tap(confirmar);
      await tester.pumpAndSettle();
      expect(cuerpos('cancelar'), [
        {'motivo': 'Duplicada por error'},
      ]);
    });

    testWidgets('reasignar a otro admin con staff activo', (tester) async {
      const adminDemo = '37279721-ef7e-4e5e-a8dc-585eef1e3d4b';
      await abrir(tester, _sol('asignado', asignado: adminDemo));
      await tester.tap(_boton('reasignar'));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('reasignar-admin')));
      await tester.pumpAndSettle();
      // El asignado actual no se ofrece.
      expect(find.textContaining('Admin Demo ('), findsNothing);
      await tester.tap(find.textContaining('E2E Staff 124813').last);
      await tester.pumpAndSettle();
      await tester.enterText(
        find.byKey(const Key('reasignar-motivo')),
        'Vacaciones',
      );
      await tester.tap(find.byKey(const Key('reasignar-confirmar')));
      await tester.pumpAndSettle();
      final body = cuerpos('reasignar').single;
      expect(body['comentario'], 'Vacaciones');
      expect(body['nuevoResponsableId'], isNot(adminDemo));
      expect(find.text('Reasignada'), findsOneWidget);
    });

    testWidgets('cambiar prioridad y comentar', (tester) async {
      await abrir(tester, _sol('en_revision'));
      await tester.tap(find.byKey(const Key('selector-prioridad')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('A').last);
      await tester.pumpAndSettle();
      expect(
        cuerpoDe(
          peticiones('PATCH', '/solicitudes/$idSolicitud/prioridad').single,
        ),
        {'prioridad': 'A'},
      );
      expect(find.text('Prioridad A'), findsOneWidget);

      await _pestana(tester, 'Comentarios (1)');
      await tester.enterText(
        find.byKey(const Key('comentario-texto')),
        'Revisado',
      );
      await tester.pump();
      await tester.tap(find.byKey(const Key('comentar')));
      await tester.pumpAndSettle();
      expect(cuerpos('comentarios'), [
        {'cuerpo': 'Revisado'},
      ]);
    });

    testWidgets('teléfono: barra fija con la acción principal y "Más '
        'acciones"', (tester) async {
      await abrir(tester, _sol('en_revision'), tamano: const Size(390, 844));
      expect(find.text('Panel de decisión'), findsNothing);
      expect(
        find.descendant(
          of: find.byKey(const Key('barra-principal')),
          matching: find.text('Aprobar'),
        ),
        findsOneWidget,
      );

      await tester.tap(find.byKey(const Key('barra-mas-acciones')));
      await tester.pumpAndSettle();
      expect(find.text('Panel de decisión'), findsOneWidget);
      for (final id in [
        'rechazar',
        'subsanacion',
        'pausar',
        'reasignar',
        'liberar',
        'cancelar',
      ]) {
        expect(_boton(id), findsOneWidget, reason: id);
      }
      // "Aprobar" sigue solo en la barra.
      expect(_boton('aprobar'), findsOneWidget);

      await tester.tap(_boton('pausar'));
      await tester.pumpAndSettle();
      expect(find.text('Panel de decisión'), findsNothing);
      expect(find.text('Pausar solicitud'), findsOneWidget);
      await tester.tap(_volverDialogo);
      await tester.pumpAndSettle();
      expect(cuerpos('pausar'), isEmpty);

      // Con "enviada" la principal es "Tomar".
      await abrir(
        tester,
        _sol('enviada', asignado: null),
        tamano: const Size(390, 844),
      );
      expect(
        find.descendant(
          of: find.byKey(const Key('barra-principal')),
          matching: find.text('Tomar'),
        ),
        findsOneWidget,
      );
      await tester.tap(find.byKey(const Key('barra-principal')));
      await tester.pumpAndSettle();
      expect(
        peticiones('POST', '/solicitudes/$idSolicitud/tomar'),
        hasLength(1),
      );
      expect(find.text('Tomada: en revisión'), findsOneWidget);
    });
  });

  // ── Superadmin: vista global ──────────────────────────────────────────────

  group('Solicitudes globales (superadmin)', () {
    final superadmin = sesionDe(Rol.superadmin);
    Map<String, ManejadorFalso> rutas() => {
      'GET /admin/solicitudes/export.csv': (_) => 'codigo,plaza',
      'GET /admin/solicitudes/:id': (_) => fixtureMapa('detalle_global')
        ..['titulo'] = tituloLargo
        ..['codigo'] = codigoLargo
        ..['inquilinoRazonSocial'] = razonLarga
        ..['plaza'] = {
          'id': 'p1',
          'slug': 'plaza-centro-comercial-del-pacifico',
          'nombreComercial': razonLarga,
        },
      'GET /admin/solicitudes': (_) => listado('lista_global'),
      'GET /plazas': (_) => {
        'items': [
          {'id': 'p1', 'slug': 'demo', 'nombreComercial': 'Plaza Demo'},
          {'id': 'p2', 'slug': 'larga', 'nombreComercial': razonLarga},
        ],
        'total': 2,
        'page': 1,
        'pageSize': 100,
        'totalPages': 1,
      },
    };

    testWidgets('lista sin desbordes con textos largos', (tester) async {
      await probarEnTamanos(
        tester,
        () => const SolicitudesGlobalesPage(),
        overrides: overridesBase(apiFalsa(rutas()), sesion: superadmin),
        alPintar: (_, _) async {
          expect(find.text('Solicitudes globales'), findsOneWidget);
          expect(
            find.text(
              '142 resultados en todas las plazas · solo lectura · sin '
              'acciones de workflow.',
            ),
            findsOneWidget,
          );
          expect(find.text(razonLarga), findsOneWidget);
        },
      );
    });

    testWidgets('filtros (plaza y búsqueda), exportar CSV y detalle', (
      tester,
    ) async {
      await montar(
        tester,
        () => const SolicitudesGlobalesPage(),
        overridesBase(apiFalsa(rutas()), sesion: superadmin),
      );
      await tester.enterText(
        find.byKey(const Key('filtro-buscar')),
        'SOL-DEMO',
      );
      await _elegir(tester, 'filtro-plaza', 'Plaza Demo');
      await _elegir(tester, 'filtro-estado', 'Aprobada');
      await tester.tap(find.byKey(const Key('filtros-aplicar')));
      await tester.pumpAndSettle();
      expect(_query('GET', '/admin/solicitudes'), {
        'page': '1',
        'pageSize': '20',
        'plazaId': 'p1',
        'search': 'SOL-DEMO',
        'estado': 'aprobada',
      });

      await tester.tap(find.byKey(const Key('exportar-csv')));
      await tester.pump();
      await tester.pump();
      expect(_query('GET', '/admin/solicitudes/export.csv'), {
        'plazaId': 'p1',
        'search': 'SOL-DEMO',
        'estado': 'aprobada',
      });
      await tester.pumpAndSettle();

      await tester.tap(find.text(codigoLargo));
      await tester.pumpAndSettle();
      expect(
        find.text(
          'Ruta: /superadmin/solicitudes/18240a13-6b38-4f9d-82a1-1b38331a5d7c',
        ),
        findsOneWidget,
      );
    });

    testWidgets('detalle de solo lectura sin desbordes', (tester) async {
      await probarEnTamanos(
        tester,
        () => const SolicitudGlobalPage(id: idSolicitud),
        overrides: overridesBase(apiFalsa(rutas()), sesion: superadmin),
        alPintar: (_, _) async {
          expect(find.text(codigoLargo), findsOneWidget);
          expect(
            find.textContaining('Vista de plataforma (superadmin):'),
            findsOneWidget,
          );
          for (final seccion in [
            'IDENTIFICACIÓN',
            'DESCRIPCIÓN',
            'EMPRESA EJECUTANTE',
          ]) {
            await tester.scrollUntilVisible(
              find.text(seccion),
              300,
              scrollable: find.byType(Scrollable).first,
            );
            expect(tester.takeException(), isNull, reason: seccion);
          }
          // Solo lectura: sin acciones, pestañas ni PDF.
          expect(find.byKey(const Key('descargar-permiso')), findsNothing);
          expect(find.textContaining('Comentarios'), findsNothing);
          expect(find.byType(FilledButton), findsNothing);
        },
      );
    });
  });
}

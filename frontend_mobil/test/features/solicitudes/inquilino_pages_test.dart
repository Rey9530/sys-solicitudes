import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend_mobil/core/adjuntos/adjuntos.dart';
import 'package:frontend_mobil/core/auth/sesion.dart';
import 'package:frontend_mobil/core/format/fechas.dart';
import 'package:frontend_mobil/features/solicitudes/inquilino/detalle_inquilino_page.dart';
import 'package:frontend_mobil/features/solicitudes/inquilino/mis_solicitudes_page.dart';
import 'package:frontend_mobil/features/solicitudes/inquilino/wizard/formulario_solicitud.dart';
import 'package:frontend_mobil/features/solicitudes/inquilino/wizard_page.dart';

import '../../helpers/api_falsa.dart';
import '../../helpers/pantallas.dart';
import 'datos_prueba.dart';

final _sesion = sesionDe(Rol.inquilino, nombre: nombreLargo);

const _idEventos = 'bd1f6dc6-7324-42cc-bec2-ca546ebdb3b9';
const _idSubEvento = 'e8aeb93e-1a25-4584-9566-070829418899';
const _idLocal = '238f1630-89bc-4cd1-be8a-0a0066ac7dac';

/// Selector de archivos falso (los pickers nativos no existen en pruebas).
class _SelectorFalso extends SelectorArchivos {
  const _SelectorFalso(this.archivos);
  final List<ArchivoElegido> archivos;

  @override
  Future<List<ArchivoElegido>> elegirArchivos({
    List<String>? extensiones,
  }) async => archivos;
}

Future<void> _elegir(WidgetTester tester, String key, String opcion) async {
  await tester.tap(find.byKey(Key(key)));
  await tester.pumpAndSettle();
  await tester.tap(find.text(opcion).last);
  await tester.pumpAndSettle();
}

/// "Volver" del diálogo (el encabezado también tiene un "Volver").
final _volverDialogo = find.descendant(
  of: find.byType(AlertDialog),
  matching: find.text('Volver'),
);

/// Abre una pestaña del detalle (la barra de pestañas se desplaza).
Future<void> _pestana(WidgetTester tester, String texto) async {
  await tester.ensureVisible(find.text(texto));
  await tester.pumpAndSettle();
  await tester.tap(find.text(texto));
  await tester.pumpAndSettle();
}

Map<String, String> _query(String metodo, String ruta) =>
    peticiones(metodo, ruta).last.url.queryParameters;

// ── Mis solicitudes ─────────────────────────────────────────────────────────

void main() {
  setUp(prepararPruebas);

  group('Mis solicitudes', () {
    Map<String, ManejadorFalso> rutas() => {
      'GET /solicitudes': (_) => listado('lista_inquilino'),
    };

    testWidgets('sin desbordes con textos largos', (tester) async {
      await probarEnTamanos(
        tester,
        () => const MisSolicitudesPage(),
        overrides: overridesBase(apiFalsa(rutas()), sesion: _sesion),
        alPintar: (_, _) async {
          expect(find.text('Mis solicitudes'), findsOneWidget);
          expect(find.text('142 solicitudes.'), findsOneWidget);
          expect(find.text(codigoLargo), findsOneWidget);
        },
      );
    });

    testWidgets('filtros estado/tipo, paginador y navegación', (tester) async {
      await montar(
        tester,
        () => const MisSolicitudesPage(),
        overridesBase(apiFalsa(rutas()), sesion: _sesion),
      );
      expect(_query('GET', '/solicitudes'), {'page': '1', 'pageSize': '20'});

      await _elegir(tester, 'filtro-estado', 'Borrador');
      await _elegir(tester, 'filtro-tipo', 'Evento');
      // Elegir no consulta: se aplica con "Filtrar" (igual que el web).
      expect(peticiones('GET', '/solicitudes'), hasLength(1));
      await tester.tap(find.byKey(const Key('filtros-aplicar')));
      await tester.pumpAndSettle();
      expect(_query('GET', '/solicitudes'), {
        'page': '1',
        'pageSize': '20',
        'estado': 'borrador',
        'tipo': 'evento',
      });

      await tester.tap(find.byTooltip('Página siguiente'));
      await tester.pumpAndSettle();
      expect(_query('GET', '/solicitudes')['page'], '2');
      expect(_query('GET', '/solicitudes')['estado'], 'borrador');

      await tester.tap(find.text(codigoLargo));
      await tester.pumpAndSettle();
      expect(
        find.text(
          'Ruta: /inquilino/solicitudes/18240a13-6b38-4f9d-82a1-1b38331a5d7c',
        ),
        findsOneWidget,
      );
    });

    testWidgets('"Nueva solicitud" abre el wizard', (tester) async {
      await montar(
        tester,
        () => const MisSolicitudesPage(),
        overridesBase(apiFalsa(rutas()), sesion: _sesion),
        tamano: const Size(390, 844),
      );
      await tester.tap(find.byKey(const Key('nueva-solicitud')));
      await tester.pumpAndSettle();
      expect(find.text('Ruta: /inquilino/solicitudes/nueva'), findsOneWidget);
    });
  });

  // ── Detalle ───────────────────────────────────────────────────────────────

  group('Detalle del inquilino', () {
    Map<String, ManejadorFalso> rutas(Map<String, dynamic> json) => {
      'GET /solicitudes/:id': (_) => json,
      'POST /solicitudes/:id/enviar': (_) => json,
      'POST /solicitudes/:id/subsanar': (_) => json,
      'POST /solicitudes/:id/cancelar': (_) => json,
      'POST /solicitudes/:id/duplicar': (_) => {
        ...json,
        'id': 'copia-1',
        'codigo': 'SOL-DEMO-200',
      },
      'POST /solicitudes/:id/comentarios': (_) => {
        'id': 'c-nuevo',
        'tipo': 'general',
        'cuerpo': 'Listo',
        'createdAt': ahoraPrueba,
      },
      'GET /reportes/solicitudes/:id/permiso.pdf': (_) => 'PDF',
    };

    Future<void> abrir(
      WidgetTester tester,
      Map<String, dynamic> json, {
      Size tamano = const Size(1024, 2400),
    }) => montar(
      tester,
      () => const DetalleInquilinoPage(id: idSolicitud),
      overridesBase(apiFalsa(rutas(json)), sesion: _sesion),
      tamano: tamano,
    );

    Finder boton(String id) => find.byKey(Key('accion-$id'));

    for (final estado in ['requerida_subsanacion', 'borrador', 'cerrada']) {
      testWidgets('sin desbordes con textos largos ($estado)', (tester) async {
        final json = detalle(
          estado: estado,
          largos: true,
          cambios: {
            'resultadoCierre': 'parcial',
            'cierreComentario': tituloLargo,
            'cerradaAt': ahoraPrueba,
          },
        );
        await probarEnTamanos(
          tester,
          () => const DetalleInquilinoPage(id: idSolicitud),
          overrides: overridesBase(apiFalsa(rutas(json)), sesion: _sesion),
          alPintar: (tamano, _) async {
            expect(find.text(codigoLargo), findsOneWidget);
            // Teléfono: barra fija inferior; tablet: panel en la página.
            expect(
              find.byKey(const Key('barra-mas-acciones')),
              tamano.width < 600 ? findsOneWidget : findsNothing,
            );
            for (final pestana in [
              'Comentarios (2)',
              'Historial (4)',
              'Adjuntos (1)',
            ]) {
              await tester.ensureVisible(find.text(pestana));
              await tester.pumpAndSettle();
              await tester.tap(find.text(pestana));
              await tester.pumpAndSettle();
              expect(tester.takeException(), isNull, reason: pestana);
            }
          },
        );
      });
    }

    testWidgets('requerida_subsanacion: aviso con el motivo y acciones', (
      tester,
    ) async {
      await abrir(tester, detalle());
      expect(
        find.text('La administración pidió correcciones.'),
        findsOneWidget,
      );
      expect(
        find.text('«Adjunta una foto del daño, por favor.»'),
        findsOneWidget,
      );
      expect(boton('editar'), findsOneWidget);
      expect(boton('reenviar'), findsOneWidget);
      expect(boton('duplicar'), findsOneWidget);
      expect(boton('cancelar'), findsOneWidget);
      expect(boton('enviar'), findsNothing);

      await tester.tap(boton('reenviar'));
      await tester.pumpAndSettle();
      expect(
        peticiones('POST', '/solicitudes/$idSolicitud/subsanar'),
        hasLength(1),
      );
      expect(
        find.text('Reenviada: volvió a la cola de asignación'),
        findsOneWidget,
      );
    });

    testWidgets('botones por estado (matriz del inventario §4.3.2.1)', (
      tester,
    ) async {
      final casos = <String, Set<String>>{
        'borrador': {'editar', 'enviar', 'duplicar', 'cancelar'},
        'enviada': {'duplicar', 'cancelar'},
        'asignado': {'duplicar', 'cancelar'},
        'en_revision': {'duplicar', 'cancelar'},
        'pausada': {'duplicar'},
        'aprobada': {'duplicar'},
        'cerrada': {'duplicar'},
        'rechazada': {'duplicar'},
        'cancelada': {'duplicar'},
      };
      const todos = ['editar', 'enviar', 'reenviar', 'duplicar', 'cancelar'];
      for (final MapEntry(key: estado, value: visibles) in casos.entries) {
        await abrir(
          tester,
          detalle(
            estado: estado,
            cambios: {
              'resultadoCierre': 'exitoso',
              'cerradaAt': '2026-10-27T19:49:10.344Z',
            },
          ),
        );
        for (final id in todos) {
          expect(
            boton(id),
            visibles.contains(id) ? findsOneWidget : findsNothing,
            reason: '$estado/$id',
          );
        }
        if (estado == 'pausada') {
          expect(
            find.textContaining('Esta solicitud está pausada'),
            findsOneWidget,
          );
        }
        if (estado == 'aprobada') {
          expect(
            find.textContaining('pendiente de cierre por la administración'),
            findsOneWidget,
          );
        }
        if (estado == 'cerrada') {
          expect(find.text('Solicitud cerrada el 27/10/2026.'), findsOneWidget);
          expect(find.text('Exitoso'), findsOneWidget);
        }
      }
    });

    testWidgets('cancelar: "Volver" no llama a la API; confirmar sí', (
      tester,
    ) async {
      await abrir(tester, detalle(estado: 'enviada'));
      await tester.tap(boton('cancelar'));
      await tester.pumpAndSettle();
      expect(find.text('Cancelar solicitud'), findsOneWidget);
      await tester.tap(_volverDialogo);
      await tester.pumpAndSettle();
      expect(peticiones('POST', '/solicitudes/$idSolicitud/cancelar'), isEmpty);

      // Sin motivo: el cuerpo va vacío (nunca `motivo: ''`).
      await tester.tap(boton('cancelar'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Sí, cancelar'));
      await tester.pumpAndSettle();
      final sinMotivo = peticiones(
        'POST',
        '/solicitudes/$idSolicitud/cancelar',
      );
      expect(sinMotivo, hasLength(1));
      expect(cuerpoDe(sinMotivo.single), isEmpty);
      expect(find.text('Cancelada'), findsOneWidget);

      await tester.tap(boton('cancelar'));
      await tester.pumpAndSettle();
      await tester.enterText(
        find.byKey(const Key('dialogo-texto')),
        'Ya no se necesita',
      );
      await tester.tap(find.text('Sí, cancelar'));
      await tester.pumpAndSettle();
      expect(
        cuerpoDe(peticiones('POST', '/solicitudes/$idSolicitud/cancelar').last),
        {'motivo': 'Ya no se necesita'},
      );
    });

    testWidgets('enviar, duplicar, editar y PDF', (tester) async {
      await abrir(tester, detalle(estado: 'borrador'));
      await tester.tap(boton('enviar'));
      await tester.pumpAndSettle();
      expect(
        peticiones('POST', '/solicitudes/$idSolicitud/enviar'),
        hasLength(1),
      );
      expect(find.text('Enviada: quedó en cola de asignación'), findsOneWidget);

      await tester.tap(find.byKey(const Key('descargar-permiso')));
      await tester.pump();
      await tester.pump();
      expect(
        peticiones('GET', '/reportes/solicitudes/$idSolicitud/permiso.pdf'),
        hasLength(1),
      );
      await tester.pumpAndSettle();

      await tester.tap(boton('editar'));
      await tester.pumpAndSettle();
      expect(
        find.text('Ruta: /inquilino/solicitudes/$idSolicitud/editar'),
        findsOneWidget,
      );
    });

    testWidgets('duplicar navega a la copia', (tester) async {
      await abrir(tester, detalle(estado: 'cerrada'));
      await tester.tap(boton('duplicar'));
      await tester.pumpAndSettle();
      expect(
        peticiones('POST', '/solicitudes/$idSolicitud/duplicar'),
        hasLength(1),
      );
      expect(find.text('Ruta: /inquilino/solicitudes/copia-1'), findsOneWidget);
    });

    testWidgets('comentar envía el cuerpo', (tester) async {
      await abrir(tester, detalle(estado: 'aprobada'));
      await _pestana(tester, 'Comentarios (1)');
      await tester.pumpAndSettle();
      expect(
        find.text('Adjunta una foto del daño, por favor.'),
        findsOneWidget,
      );
      final comentar = find.byKey(const Key('comentar'));
      expect(tester.widget<FilledButton>(comentar).onPressed, isNull);
      await tester.enterText(
        find.byKey(const Key('comentario-texto')),
        '  Ya subí la foto  ',
      );
      await tester.pump();
      await tester.tap(comentar);
      await tester.pumpAndSettle();
      expect(
        cuerpoDe(
          peticiones('POST', '/solicitudes/$idSolicitud/comentarios').single,
        ),
        {'cuerpo': 'Ya subí la foto'},
      );
      expect(find.text('Comentario agregado'), findsOneWidget);
    });

    testWidgets('adjuntos: solo se suben en borrador o subsanación', (
      tester,
    ) async {
      await abrir(tester, detalle(estado: 'requerida_subsanacion'));
      await _pestana(tester, 'Adjuntos (0)');
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('adjuntos-subir')), findsOneWidget);

      await abrir(tester, detalle(estado: 'enviada'));
      await _pestana(tester, 'Adjuntos (0)');
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('adjuntos-subir')), findsNothing);
      expect(find.text('Sin adjuntos todavía.'), findsOneWidget);
    });

    testWidgets('teléfono: barra inferior con la acción principal y "Más '
        'acciones"', (tester) async {
      await abrir(tester, detalle(), tamano: const Size(390, 844));
      expect(find.text('Estado de la solicitud'), findsNothing);
      final barra = find.byKey(const Key('barra-principal'));
      expect(
        find.descendant(of: barra, matching: find.text('Reenviar subsanada')),
        findsOneWidget,
      );

      await tester.tap(find.byKey(const Key('barra-mas-acciones')));
      await tester.pumpAndSettle();
      expect(find.text('Estado de la solicitud'), findsOneWidget);
      expect(boton('editar'), findsOneWidget);
      expect(boton('duplicar'), findsOneWidget);
      // La principal no se repite en la hoja.
      expect(boton('reenviar'), findsOneWidget);

      // Elegir en la hoja la cierra y abre el diálogo; "Volver" no cancela.
      await tester.tap(boton('cancelar'));
      await tester.pumpAndSettle();
      expect(find.text('Estado de la solicitud'), findsNothing);
      await tester.tap(_volverDialogo);
      await tester.pumpAndSettle();
      expect(peticiones('POST', '/solicitudes/$idSolicitud/cancelar'), isEmpty);
    });
  });

  // ── Wizard ────────────────────────────────────────────────────────────────

  group('Wizard', () {
    Map<String, dynamic> creada() => detalle(
      estado: 'borrador',
      cambios: {'id': 'nueva-1', 'codigo': 'SOL-DEMO-300'},
    );

    Map<String, ManejadorFalso> rutas({
      Map<String, dynamic>? solicitud,
      bool largos = false,
      List<Object?> duplicados = const [],
    }) => {
      'GET /solicitudes/tipos': (_) => fixture('tipos'),
      'GET /solicitudes/duplicados': (_) => duplicados,
      'GET /categorias': (_) => fixture('categorias'),
      'GET /categorias/:id': (req) {
        final id = req.url.pathSegments.last;
        if (id == _idEventos) {
          final c = fixtureMapa('categoria_eventos');
          if (largos) {
            c['nombre'] = 'Eventos, activaciones y ferias en áreas comunes';
            ((c['subcategorias'] as List<dynamic>).first
                    as Map<String, dynamic>)['nombre'] =
                'Evento especial con montaje nocturno y sonido';
          }
          return c;
        }
        final item = (fixtureMapa('categorias')['items'] as List<dynamic>)
            .cast<Map<String, dynamic>>()
            .firstWhere((c) => c['id'] == id);
        return {...item, 'subcategorias': <Object>[]};
      },
      'GET /contratos': (_) {
        final c = fixtureMapa('contratos_vigentes');
        if (largos) {
          ((c['items'] as List<dynamic>).first
                  as Map<String, dynamic>)['localCodigo'] =
              'L-SOL-CARGA-QA-0001-ALA-NORTE';
        }
        return c;
      },
      if (solicitud != null) 'GET /solicitudes/:id': (_) => solicitud,
      'POST /solicitudes': (_) => creada(),
      'POST /solicitudes/:id/enviar': (_) => creada(),
      'POST /solicitudes/:id/adjuntos': (_) => {'adjunto': {}},
      'PATCH /solicitudes/:id': (_) => solicitud,
    };

    /// Fechas válidas en modo estándar (inicio dentro de 3 días).
    Map<String, Object?> fechasValidas() => {
      'fechaEventoInicio': diaPlaza(3),
      'fechaEventoFin': diaPlaza(3),
      'horaInicio': '08:00',
      'horaFin': '09:00',
      'esEmergencia': false,
    };

    Future<void> siguiente(WidgetTester tester) async {
      await tester.tap(find.byKey(const Key('wizard-siguiente')));
      await tester.pumpAndSettle();
    }

    testWidgets('sin desbordes en los 3 pasos (edición, textos largos)', (
      tester,
    ) async {
      final json = detalle(
        estado: 'borrador',
        largos: true,
        cambios: {...fechasValidas(), 'adminAsignado': null},
      );
      await probarEnTamanos(
        tester,
        () => const WizardSolicitudPage(solicitudId: idSolicitud),
        overrides: overridesBase(
          apiFalsa(rutas(solicitud: json, largos: true)),
          sesion: _sesion,
        ),
        alPintar: (_, _) async {
          expect(find.text('Editar $codigoLargo'), findsOneWidget);
          await siguiente(tester);
          expect(tester.takeException(), isNull);
          expect(find.text('Datos de la empresa ejecutante'), findsOneWidget);
          await tester.scrollUntilVisible(
            find.byKey(const Key('wizard-siguiente')),
            400,
            scrollable: find.byType(Scrollable).first,
          );
          await siguiente(tester);
          expect(tester.takeException(), isNull);
          expect(find.text('Revisión'), findsOneWidget);
          await tester.scrollUntilVisible(
            find.byKey(const Key('wizard-guardar')),
            400,
            scrollable: find.byType(Scrollable).first,
          );
          expect(tester.takeException(), isNull);
        },
      );
    });

    testWidgets('paso 1 sin categoría no avanza', (tester) async {
      await montar(
        tester,
        () => const WizardSolicitudPage(),
        overridesBase(apiFalsa(rutas()), sesion: _sesion),
      );
      expect(find.text('Nueva solicitud'), findsOneWidget);
      await siguiente(tester);
      expect(find.text('Selecciona categoría y subcategoría.'), findsOneWidget);
      expect(find.text('Tipo de solicitud *'), findsOneWidget);
      expect(find.text('Datos de la empresa ejecutante'), findsNothing);
    });

    /// Llena los pasos 1 y 2 (mantenimiento, prefill del calendario).
    Future<void> llenar(WidgetTester tester) async {
      await _elegir(tester, 'wz-categoria', 'Eventos');
      await _elegir(tester, 'wz-subcategoria', 'Evento (prioridad B)');
      await siguiente(tester);
      expect(find.text('Datos de la empresa ejecutante'), findsOneWidget);

      await _elegir(tester, 'wz-local', 'L-SOL-1');
      final campos = {
        'wz-titulo': 'Fuga de agua',
        'wz-descripcion': 'Fuga en el baño del local.',
        'empresa-nombre': 'Fontanería S.A.',
        'empresa-responsable': 'Juan Pérez',
        'empresa-telefono': '+503 7000 0000',
        'empresa-email': 'contacto@fontaneria.com',
        'emergencia-contacto': 'Ana López',
        'emergencia-telefono': '+503 7000 0001',
        'wz-area-afectada': 'Baño',
      };
      for (final MapEntry(:key, :value) in campos.entries) {
        await tester.enterText(find.byKey(Key(key)), value);
      }
      // Hora fin: el selector propone 9:00 am; se acepta.
      await tester.tap(find.byKey(const Key('wz-hora-fin')));
      await tester.pumpAndSettle();
      final loc = MaterialLocalizations.of(tester.element(find.byType(Dialog)));
      await tester.tap(find.text(loc.okButtonLabel));
      await tester.pumpAndSettle();
      expect(find.text('9:00 am'), findsOneWidget);

      // El personal es obligatorio (mínimo 1).
      await siguiente(tester);
      expect(
        find.text('Indica al menos 1 persona de personal.'),
        findsOneWidget,
      );
      expect(find.text('Datos de la empresa ejecutante'), findsOneWidget);
      await tester.enterText(
        find.byKey(const Key('asistentes-estimados')),
        '1',
      );
      await tester.pumpAndSettle();
      await siguiente(tester);
      expect(
        find.text('Completa el nombre y documento del asistente 1.'),
        findsOneWidget,
      );
      await tester.enterText(
        find.byKey(const Key('asistente-0-nombre')),
        'Pedro Ramírez',
      );
      await tester.enterText(
        find.byKey(const Key('asistente-0-documento')),
        '01234567-8',
      );
      await siguiente(tester);
      expect(find.text('Revisión'), findsOneWidget);
    }

    final prefill = PrefillWizard(
      tipo: 'mantenimiento',
      fecha: diaPlaza(3),
      hora: '08:00',
    );

    testWidgets('"Guardar borrador" crea con el payload completo', (
      tester,
    ) async {
      await montar(
        tester,
        () => WizardSolicitudPage(prefill: prefill),
        overridesBase(apiFalsa(rutas()), sesion: _sesion),
      );
      await llenar(tester);
      await tester.tap(find.byKey(const Key('wizard-guardar')));
      await tester.pumpAndSettle();

      final body = cuerpoDe(peticiones('POST', '/solicitudes').single);
      expect(body, {
        'localId': _idLocal,
        'tipo': 'mantenimiento',
        'titulo': 'Fuga de agua',
        'descripcion': 'Fuga en el baño del local.',
        'categoriaId': _idEventos,
        'subcategoriaId': _idSubEvento,
        'fechaEventoInicio': diaPlaza(3),
        'fechaEventoFin': diaPlaza(3),
        'horaInicio': '08:00',
        'horaFin': '09:00',
        'empresaNombre': 'Fontanería S.A.',
        'empresaResponsable': 'Juan Pérez',
        'empresaTelefono': '+503 7000 0000',
        'empresaEmail': 'contacto@fontaneria.com',
        'emergenciaContacto': 'Ana López',
        'emergenciaTelefono': '+503 7000 0001',
        'esEmergencia': false,
        'camposExtra': {
          'area_afectada': 'Baño',
          'requiere_ingreso_a_local': false,
          'asistentes_estimados': 1,
          'asistentes': [
            {'nombre': 'Pedro Ramírez', 'documento': '01234567-8'},
          ],
        },
      });
      expect(peticiones('POST', '/solicitudes/nueva-1/enviar'), isEmpty);
      expect(find.text('Borrador SOL-DEMO-300 guardado'), findsOneWidget);
      expect(find.text('Ruta: /inquilino/solicitudes/nueva-1'), findsOneWidget);
    });

    testWidgets('"Enviar ahora" crea, sube adjuntos y envía', (tester) async {
      await montar(tester, () => WizardSolicitudPage(prefill: prefill), [
        ...overridesBase(apiFalsa(rutas()), sesion: _sesion),
        selectorArchivosProvider.overrideWithValue(
          _SelectorFalso([
            ArchivoElegido('foto.png', Uint8List(10)),
            ArchivoElegido('virus.exe', Uint8List(10)),
          ]),
        ),
      ]);
      await llenar(tester);
      await tester.tap(find.byKey(const Key('wz-adjuntos-subir')));
      await tester.pumpAndSettle();
      expect(find.text('foto.png'), findsOneWidget);
      expect(find.text('1 / 10'), findsOneWidget);
      expect(
        find.text(
          '"virus.exe" no es un tipo permitido (PDF, JPG, PNG, WebP, XLS, '
          'XLSX, DOCX, DWG, MP4, MOV, WebM).',
        ),
        findsOneWidget,
      );

      await tester.tap(find.byKey(const Key('wizard-enviar')));
      await tester.pumpAndSettle();
      expect(peticiones('POST', '/solicitudes'), hasLength(1));
      final subida = peticiones('POST', '/solicitudes/nueva-1/adjuntos');
      expect(subida, hasLength(1));
      expect(
        subida.single.headers['content-type'],
        startsWith('multipart/form-data'),
      );
      expect(peticiones('POST', '/solicitudes/nueva-1/enviar'), hasLength(1));
      expect(
        find.text(
          'Solicitud SOL-DEMO-300 enviada: quedó en cola de asignación',
        ),
        findsOneWidget,
      );
    });

    testWidgets('edición de remodelación manda tipo, camposExtra y '
        'esEmergencia', (tester) async {
      // Emergencia: inicio dentro de 24 h.
      final inicio = aHoraPlaza(DateTime.now().add(const Duration(hours: 24)));
      final fin = inicio.add(const Duration(hours: 2));
      String hhmm(DateTime d) =>
          '${d.hour.toString().padLeft(2, '0')}:'
          '${d.minute.toString().padLeft(2, '0')}';
      final json = detalle(
        estado: 'requerida_subsanacion',
        cambios: {
          'tipo': 'remodelacion',
          'esEmergencia': true,
          'fechaEventoInicio': ymd(inicio),
          'fechaEventoFin': ymd(fin),
          'horaInicio': hhmm(inicio),
          'horaFin': hhmm(fin),
          'camposExtra': {
            'fecha_inicio_estimada': '2026-11-02',
            'duracion_dias': 30,
            'empresa_constructora': 'Constructora Sol',
            'monto_presupuesto': 1250.5,
            'asistentes_estimados': 1,
            'asistentes': [
              {'nombre': 'Técnico E2E', 'documento': '00000000-0'},
            ],
          },
        },
      );
      await montar(
        tester,
        () => const WizardSolicitudPage(solicitudId: idSolicitud),
        overridesBase(
          apiFalsa(
            rutas(
              solicitud: json,
              duplicados: fixture('duplicados')! as List<Object?>,
            ),
          ),
          sesion: _sesion,
        ),
      );
      expect(find.text('Editar SOL-DEMO-112'), findsOneWidget);
      expect(
        find.textContaining('Ya existe una solicitud reciente similar: SOL-'),
        findsOneWidget,
      );
      await siguiente(tester);
      expect(find.text('Monto presupuesto (USD) *'), findsOneWidget);
      await siguiente(tester);
      expect(find.byKey(const Key('wz-adjuntos-subir')), findsNothing);
      expect(find.byKey(const Key('wizard-enviar')), findsNothing);
      expect(find.text('Guardar cambios'), findsOneWidget);
      expect(find.text('Sí · máx. 3/mes'), findsOneWidget);

      await tester.tap(find.byKey(const Key('wizard-guardar')));
      await tester.pumpAndSettle();
      final body = cuerpoDe(
        peticiones('PATCH', '/solicitudes/$idSolicitud').single,
      );
      expect(body['tipo'], 'remodelacion');
      expect(body['esEmergencia'], isTrue);
      expect(body['camposExtra'], {
        'fecha_inicio_estimada': '2026-11-02',
        'duracion_dias': 30,
        'empresa_constructora': 'Constructora Sol',
        'monto_presupuesto': 1250.5,
        'asistentes_estimados': 1,
        'asistentes': [
          {'nombre': 'Técnico E2E', 'documento': '00000000-0'},
        ],
      });
      expect(find.text('Borrador SOL-DEMO-112 guardado'), findsOneWidget);
      expect(
        find.text('Ruta: /inquilino/solicitudes/$idSolicitud'),
        findsOneWidget,
      );
    });

    testWidgets('fuera de borrador/subsanación no se edita: vuelve al '
        'detalle', (tester) async {
      await montar(
        tester,
        () => const WizardSolicitudPage(solicitudId: idSolicitud),
        overridesBase(
          apiFalsa(rutas(solicitud: detalle(estado: 'enviada'))),
          sesion: _sesion,
        ),
      );
      expect(
        find.text('Ruta: /inquilino/solicitudes/$idSolicitud'),
        findsOneWidget,
      );
    });

    testWidgets('modo emergencia pide confirmación; cancelar no lo activa', (
      tester,
    ) async {
      await montar(
        tester,
        () => WizardSolicitudPage(prefill: prefill),
        overridesBase(apiFalsa(rutas()), sesion: _sesion),
      );
      await _elegir(tester, 'wz-categoria', 'Eventos');
      await _elegir(tester, 'wz-subcategoria', 'Evento (prioridad B)');
      await siguiente(tester);
      Checkbox casilla() => tester.widget<Checkbox>(
        find.descendant(
          of: find.byKey(const Key('wz-emergencia')),
          matching: find.byType(Checkbox),
        ),
      );
      await tester.tap(find.byKey(const Key('wz-emergencia')));
      await tester.pumpAndSettle();
      expect(
        find.text(
          'Solamente tiene un máximo de 3 permisos de emergencia al mes.',
        ),
        findsOneWidget,
      );
      await tester.tap(find.text('Cancelar'));
      await tester.pumpAndSettle();
      expect(casilla().value, isFalse);

      await tester.tap(find.byKey(const Key('wz-emergencia')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Entendido'));
      await tester.pumpAndSettle();
      expect(casilla().value, isTrue);
      expect(find.textContaining('Modo emergencia activo'), findsOneWidget);
    });
  });
}

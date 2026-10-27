import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend_mobil/features/solicitudes/admin/panel_decision.dart';
import 'package:frontend_mobil/features/solicitudes/inquilino/detalle_inquilino_page.dart';
import 'package:frontend_mobil/features/solicitudes/inquilino/wizard/formulario_solicitud.dart';
import 'package:frontend_mobil/features/solicitudes/solicitudes_api.dart';
import 'package:frontend_mobil/features/solicitudes/solicitudes_modelos.dart';

import '../../helpers/api_falsa.dart';
import 'datos_prueba.dart';

void _nada() {}

/// IDs de las acciones visibles del panel del admin.
Set<String> _botonesAdmin(
  Map<String, dynamic> json, {
  String? yo = 'yo',
  List<String> permisos = const ['*'],
}) {
  final panel = panelDecisionAdmin(
    s: SolicitudItem.fromJson(json),
    miUsuarioId: yo,
    puede: (p) => permisos.contains('*') || permisos.contains(p),
    colorAtenuado: Colors.grey,
    acciones: AccionesAdmin(
      tomar: _nada,
      aprobar: _nada,
      rechazar: _nada,
      pedirSubsanacion: _nada,
      pausar: _nada,
      reanudar: _nada,
      cerrar: _nada,
      reasignar: _nada,
      liberar: _nada,
      cancelar: _nada,
      cambiarPrioridad: (_) {},
    ),
  );
  return {
    for (final a in [...panel.acciones, ...panel.secundarias]) a.id,
    if (panel.datos?.onCambiarPrioridad != null) 'prioridad',
  };
}

void main() {
  group('modelos', () {
    test(
      'SolicitudDetalle.fromJson con el JSON real de GET /solicitudes/:id',
      () {
        final json = detalle(
          cambios: {'titulo': 'Pintura &amp; Acabados &lt;3'},
        );
        final d = SolicitudDetalle.fromJson(json);
        final s = d.solicitud;
        expect(s.codigo, 'SOL-DEMO-112');
        expect(s.titulo, 'Pintura & Acabados <3');
        expect(s.estado, 'requerida_subsanacion');
        expect(s.camposExtra, isA<Map<String, dynamic>>());
        expect(s.camposExtra['area_afectada'], 'Baño del local');
        expect(s.camposExtra['asistentes'], isA<List<dynamic>>());
        expect(s.horaInicio, '09:00');
        expect(d.inquilinoRazonSocial, 'Tienda Sol S.A. de C.V.');
        expect(d.usuarioCreador?.nombre, 'María Pérez');
        expect(d.historial.map((h) => h.evento), [
          'creada',
          'enviada',
          'tomada',
          'subsanada',
        ]);
        expect(d.comentarios.single.tipo, 'subsanacion');
        expect(d.adjuntos, isEmpty);
      },
    );

    test('motivo de la última subsanación (del historial)', () {
      final d = SolicitudDetalle.fromJson(detalle());
      expect(
        motivoUltimaSubsanacion(d),
        'Adjunta una foto del daño, por favor.',
      );
      final cerrada = SolicitudDetalle.fromJson(
        fixtureMapa('solicitud_detalle_cerrada'),
      );
      expect(cerrada.solicitud.resultadoCierre, 'exitoso');
      expect(cerrada.solicitud.esTerminal, isTrue);
    });

    test('lista global trae la plaza (nombre y slug)', () {
      final l = fixtureMapa('lista_global');
      final s = SolicitudItem.fromJson(
        (l['items'] as List<dynamic>).first as Map<String, dynamic>,
      );
      expect(s.plazaNombre, 'Plaza Demo');
      expect(s.plazaSlug, 'demo');
    });

    test('opciones del wizard y de reasignación', () {
      final cat = CategoriaOpcion.fromJson(fixtureMapa('categoria_eventos'));
      expect(cat.nombre, 'Eventos');
      expect(cat.subcategorias.single.prioridad, 'B');
      final tipos = (fixture('tipos')! as List<dynamic>)
          .cast<Map<String, dynamic>>()
          .map(TipoSolicitudOpcion.fromJson)
          .toList();
      expect(tipos.map((t) => t.codigo), contains('remodelacion'));
      final admin = AdminOpcion.fromJson(
        ((fixtureMapa('usuarios_admin')['items'] as List<dynamic>).first)
            as Map<String, dynamic>,
      );
      expect(admin.rolStaffActivo, isTrue);
    });

    test('los filtros son iguales si generan la misma query', () {
      expect(
        const FiltroSolicitudes(estado: 'borrador'),
        const FiltroSolicitudes(estado: 'borrador'),
      );
      expect(
        const FiltroSolicitudes(estado: 'borrador').hashCode,
        const FiltroSolicitudes(estado: 'borrador').hashCode,
      );
      expect(
        const FiltroSolicitudes(),
        isNot(const FiltroSolicitudes().conPagina(2)),
      );
      expect(const FiltroBandeja().query['asignadasAMi'], isTrue);
      expect(
        const FiltroGlobal(page: 3, plazaId: 'p').queryExportar,
        isNot(contains('page')),
      );
    });
  });

  group('formulario del wizard', () {
    FormularioSolicitud valido() => FormularioSolicitud()
      ..tipo = 'mantenimiento'
      ..categoriaId = 'cat'
      ..subcategoriaId = 'sub'
      ..localId = 'local'
      ..titulo = ' Fuga de agua '
      ..descripcion = 'Baño'
      ..fechaInicio = diaPlaza(3)
      ..fechaFin = diaPlaza(3)
      ..horaInicio = '08:00'
      ..horaFin = '09:00'
      ..empresaNombre = 'Fontanería'
      ..empresaResponsable = 'Juan'
      ..empresaTelefono = '+503 7000 0000'
      ..empresaEmail = 'a@b.com'
      ..emergenciaContacto = 'Ana'
      ..emergenciaTelefono = '+503 7000 0001'
      ..areaAfectada = 'Baño'
      ..asistentesEstimados = '1'
      ..asistentes[0] = AsistenteForm(nombre: 'Pedro', documento: '0123');

    test('paso 1 exige categoría y subcategoría', () {
      expect(
        FormularioSolicitud().validarPaso1(),
        'Selecciona categoría y subcategoría.',
      );
      expect(valido().validarPaso1(), isNull);
    });

    test('paso 2: mensajes en el orden del web', () {
      final ahora = DateTime.now();
      expect(valido().validarPaso2(ahora), isNull);
      expect(
        (valido()..localId = null).validarPaso2(ahora),
        'Selecciona un local.',
      );
      expect(
        (valido()..horaFin = null).validarPaso2(ahora),
        'Indica fecha y hora de inicio y fin del permiso.',
      );
      expect(
        (valido()..empresaTelefono = '12').validarPaso2(ahora),
        'Teléfono de empresa inválido (8-20 dígitos).',
      );
      expect(
        (valido()..asistentesEstimados = '').validarPaso2(ahora),
        'Indica al menos 1 persona de personal.',
      );
      expect(
        (valido()..asistentesEstimados = '0').validarPaso2(ahora),
        'Indica al menos 1 persona de personal.',
      );
      expect(
        (valido()..asistentesEstimados = '2').validarPaso2(ahora),
        'Completa el nombre y documento del asistente 2.',
      );
      expect(
        (valido()..asistentes[0] = AsistenteForm(nombre: 'P', documento: '1'))
            .validarPaso2(ahora),
        'El documento del asistente 1 debe tener entre 3 y 20 caracteres.',
      );
      expect(
        (valido()..areaAfectada = ' ').validarPaso2(ahora),
        'Indica el área afectada.',
      );
      expect(
        (valido()..tipo = 'remodelacion').validarPaso2(ahora),
        'Indica la fecha de inicio estimada.',
      );
    });

    test('la cantidad de personal se limita a 20', () {
      expect(
        (FormularioSolicitud()..asistentesEstimados = '35').numAsistentes,
        20,
      );
      expect(
        (FormularioSolicitud()..asistentesEstimados = 'x').numAsistentes,
        0,
      );
    });

    test('payload de creación: forma exacta, esEmergencia y sin vacíos', () {
      final p = valido().payload();
      expect(p['titulo'], 'Fuga de agua');
      expect(p['esEmergencia'], isFalse);
      expect(p['camposExtra'], {
        'area_afectada': 'Baño',
        'requiere_ingreso_a_local': false,
        'asistentes_estimados': 1,
        'asistentes': [
          {'nombre': 'Pedro', 'documento': '0123'},
        ],
      });
      expect(p.values, isNot(contains('')));
      final sinLocal = (valido()..localId = null).payload();
      expect(sinLocal.containsKey('localId'), isFalse);
      expect(sinLocal.containsKey('esEmergencia'), isTrue);
    });

    test('payload de remodelación y evento', () {
      final remo = valido()
        ..tipo = 'remodelacion'
        ..fechaInicioEstimada = '2026-11-02'
        ..duracionDias = '30'
        ..empresaConstructora = 'Constructora'
        ..montoPresupuesto = '1250.50';
      expect(remo.payload()['camposExtra'], {
        'fecha_inicio_estimada': '2026-11-02',
        'duracion_dias': 30,
        'empresa_constructora': 'Constructora',
        'monto_presupuesto': 1250.5,
        'asistentes_estimados': 1,
        'asistentes': [
          {'nombre': 'Pedro', 'documento': '0123'},
        ],
      });
      final evento = valido()..tipo = 'evento';
      expect((evento.payload()['camposExtra']! as Map<String, Object?>).keys, [
        'asistentes_estimados',
        'asistentes',
      ]);
    });

    test(
      'edición precarga la solicitud (incluidos asistentes y emergencia)',
      () {
        final s = SolicitudItem.fromJson(
          detalle(
            cambios: {
              'esEmergencia': true,
              'tipo': 'remodelacion',
              'camposExtra': {
                'fecha_inicio_estimada': '2026-11-02',
                'duracion_dias': 30,
                'empresa_constructora': 'Constructora',
                'monto_presupuesto': 1250.0,
                'asistentes_estimados': 1,
                'asistentes': [
                  {'nombre': 'Técnico', 'documento': '00000000-0'},
                ],
              },
            },
          ),
        );
        final f = FormularioSolicitud.desdeSolicitud(s);
        expect(f.esEmergencia, isTrue);
        expect(f.duracionDias, '30');
        expect(f.montoPresupuesto, '1250');
        expect(f.numAsistentes, 1);
        expect(f.asistentes[0]?.nombre, 'Técnico');
        expect(f.payload()['esEmergencia'], isTrue);
      },
    );

    test('cambiar tipo vacía categoría y subcategoría', () {
      final f = valido()..cambiarTipo('evento');
      expect(f.categoriaId, isNull);
      expect(f.subcategoriaId, isNull);
      final g = valido()..cambiarCategoria('otra');
      expect(g.subcategoriaId, isNull);
    });

    test('prefill del calendario: valida cada valor', () {
      final p = PrefillWizard.desdeQuery({
        'tipo': 'evento',
        'fecha': '2026-10-30',
        'hora': '14:30',
      });
      expect((p.tipo, p.fecha, p.hora), ('evento', '2026-10-30', '14:30'));
      final malo = PrefillWizard.desdeQuery({
        'tipo': 'fiesta',
        'fecha': '30-10-2026',
        'hora': '25:00',
      });
      expect((malo.tipo, malo.fecha, malo.hora), (null, null, null));
    });
  });

  test('el PATCH de solicitud exige esEmergencia', () async {
    final api = apiFalsa({});
    await expectLater(
      actualizarSolicitud(api, 'x', {'titulo': 'a'}),
      throwsArgumentError,
    );
    expect(peticionesFalsas, isEmpty);
  });

  group('matriz de botones del admin (inventario §4.3.2.1)', () {
    Map<String, dynamic> en(
      String estado, {
      String? asignado,
      String? creador,
    }) => detalle(
      cambios: {
        'estado': estado,
        'adminAsignadoId': asignado,
        'usuarioCreadorId': creador ?? idCreador,
      },
    );

    test('borrador: solo cancelar (sin selector de prioridad, F14)', () {
      expect(_botonesAdmin(en('borrador')), {'cancelar'});
    });

    test('enviada: tomar, cancelar y prioridad', () {
      expect(_botonesAdmin(en('enviada')), {'tomar', 'cancelar', 'prioridad'});
    });

    test('asignado: tomar y liberar solo el asignado', () {
      expect(_botonesAdmin(en('asignado', asignado: 'yo')), {
        'tomar',
        'pausar',
        'reasignar',
        'liberar',
        'cancelar',
        'prioridad',
      });
      expect(_botonesAdmin(en('asignado', asignado: 'otro')), {
        'pausar',
        'reasignar',
        'cancelar',
        'prioridad',
      });
    });

    test('en revisión: decidir solo el asignado que no es el creador', () {
      expect(_botonesAdmin(en('en_revision', asignado: 'yo')), {
        'aprobar',
        'rechazar',
        'subsanacion',
        'pausar',
        'reasignar',
        'liberar',
        'cancelar',
        'prioridad',
      });
      expect(
        _botonesAdmin(en('en_revision', asignado: 'yo', creador: 'yo')),
        isNot(contains('aprobar')),
      );
    });

    test('pausada, subsanación, aprobada y terminales', () {
      expect(_botonesAdmin(en('pausada', asignado: 'otro')), {
        'reanudar',
        'cancelar',
        'prioridad',
      });
      expect(_botonesAdmin(en('requerida_subsanacion')), {
        'cancelar',
        'prioridad',
      });
      expect(_botonesAdmin(en('aprobada', asignado: 'yo')), {'cerrar'});
      expect(_botonesAdmin(en('aprobada', asignado: 'otro')), isEmpty);
      for (final t in ['cerrada', 'rechazada', 'cancelada']) {
        expect(_botonesAdmin(en(t, asignado: 'yo')), isEmpty, reason: t);
      }
    });

    test('sin permiso el botón no aparece', () {
      expect(
        _botonesAdmin(
          en('en_revision', asignado: 'yo'),
          permisos: ['solicitudes.tomar', 'solicitudes.rechazar'],
        ),
        {'rechazar'},
      );
    });
  });
}

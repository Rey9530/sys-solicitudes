import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend_mobil/core/auth/sesion.dart';
import 'package:frontend_mobil/features/inquilinos/inquilino_detalle_page.dart';
import 'package:frontend_mobil/features/inquilinos/inquilino_form_page.dart';
import 'package:frontend_mobil/features/inquilinos/inquilinos_api.dart';
import 'package:frontend_mobil/features/inquilinos/inquilinos_page.dart';

import '../../helpers/api_falsa.dart';
import '../../helpers/pantallas.dart';
import '../contratos/fixtures_catalogo.dart';
import '../contratos/helpers_catalogo.dart';

Map<String, ManejadorFalso> _rutas({bool conVigente = true}) => {
  'GET /inquilinos': (_) => paginado(
    [
      inquilinoJson(),
      inquilinoJson(id: 'inq-2', razonSocial: 'Tienda Sol S.A. de C.V.'),
    ],
    total: 17,
    totalPages: 1,
  ),
  'GET /inquilinos/:id': (_) => inquilinoDetalleJson(conVigente: conVigente),
  'GET /inquilinos/:id/usuarios': (_) => paginado([
    usuarioJson(),
    usuarioJson(id: 'usr-2', emailInvalido: true),
    usuarioJson(id: 'usr-3', activo: false),
  ]),
  'GET /solicitudes': (req) => paginado([
    solicitudJson(id: 'sol-${req.url.queryParameters['localId']}'),
    solicitudJson(id: 'sol-ajena', inquilinoId: 'otro-inquilino'),
  ]),
  'POST /inquilinos': (_) => inquilinoJson(),
  'PATCH /inquilinos/:id': (_) => inquilinoJson(),
  'DELETE /inquilinos/:id': (_) => const RespuestaFalsa(204),
  'POST /usuarios': (_) => usuarioJson(id: 'usr-nuevo'),
  'PATCH /usuarios/:id': (_) => usuarioJson(),
  'DELETE /usuarios/:id': (_) => const RespuestaFalsa(204),
  'POST /usuarios/:id/reactivate': (_) => usuarioJson(),
  'POST /usuarios/:id/reset-password': (_) => {
    'id': 'usr-1',
    'email': 'x@y.com',
    'message': 'ok',
  },
};

Widget _en(Widget pagina) => Scaffold(body: pagina);

Future<void> _montar(
  WidgetTester tester,
  Widget pagina, {
  Map<String, ManejadorFalso>? rutas,
  List<String>? permisos,
}) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = const Size(390, 844);
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    envolver(
      () => _en(pagina),
      overrides: overridesBase(
        apiFalsa(rutas ?? _rutas()),
        sesion: sesionDe(Rol.adminPlaza, permisos: permisos),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

Future<void> _irAPestana(WidgetTester tester, String etiqueta) async {
  final pestana = find.widgetWithText(Tab, etiqueta);
  await tester.ensureVisible(pestana);
  await tester.pumpAndSettle();
  await tester.tap(pestana);
  await tester.pumpAndSettle();
}

/// Toca [f] tras quitar el foco (un campo enfocado devuelve el scroll a su
/// cursor) y llevarlo a la vista.
Future<void> _tocar(WidgetTester tester, Finder f) async {
  FocusManager.instance.primaryFocus?.unfocus();
  await tester.pumpAndSettle();
  await tester.ensureVisible(f);
  await tester.pumpAndSettle();
  await tester.tap(f);
  await tester.pumpAndSettle();
}

void main() {
  setUp(prepararPruebas);

  group('Listado', () {
    testWidgets('responsive con razones sociales largas', (tester) async {
      await probarEnTamanos(
        tester,
        () => _en(const InquilinosPage()),
        overrides: overridesBase(
          apiFalsa(_rutas()),
          sesion: sesionDe(Rol.adminPlaza),
        ),
        alPintar: (_, _) async {
          // Las entidades HTML (&amp;) se decodifican.
          expect(find.text(razonLargaDecodificada), findsOneWidget);
          expect(find.text('17 inquilinos registrados.'), findsOneWidget);
          await recorrerPagina(tester);
        },
      );
    });

    testWidgets('filtrar manda razón social e identificación', (tester) async {
      await _montar(tester, const InquilinosPage());
      await tester.enterText(
        find.byKey(const Key('inquilinos-filtro-razon')),
        'sol',
      );
      await tester.enterText(
        find.byKey(const Key('inquilinos-filtro-identificacion')),
        '0614',
      );
      await tester.tap(find.text('Filtrar'));
      await tester.pumpAndSettle();
      final q = peticionesFalsas.last.url.queryParameters;
      expect(q['razonSocial'], 'sol');
      expect(q['identificacion'], '0614');
    });

    testWidgets('sin permisos oculta "Nuevo inquilino" y "Desactivar"', (
      tester,
    ) async {
      await _montar(
        tester,
        const InquilinosPage(),
        permisos: ['inquilinos.listar'],
      );
      expect(find.text('Nuevo inquilino'), findsNothing);
      expect(find.text('Desactivar'), findsNothing);
      expect(find.text('Tienda Sol S.A. de C.V.'), findsOneWidget);
    });
  });

  group('Nuevo inquilino', () {
    testWidgets('responsive', (tester) async {
      await probarEnTamanos(
        tester,
        () => _en(const InquilinoFormPage()),
        overrides: overridesBase(
          apiFalsa(_rutas()),
          sesion: sesionDe(Rol.adminPlaza),
        ),
        alPintar: (_, _) => recorrerPagina(tester),
      );
    });

    testWidgets('solo con razón social el body no lleva claves vacías', (
      tester,
    ) async {
      await _montar(tester, const InquilinoFormPage());
      await tester.enterText(
        find.byKey(const Key('inquilino-razonSocial')),
        '  Tienda Nueva S.A.  ',
      );
      await _tocar(tester, find.byKey(const Key('inquilino-crear')));
      final post = peticionesFalsas.singleWhere((r) => r.method == 'POST');
      expect(cuerpoDe(post), {'razonSocial': 'Tienda Nueva S.A.'});
      expect(find.text('Ruta: /admin/inquilinos'), findsOneWidget);
    });

    testWidgets('email en minúsculas, tipo de cliente y validaciones', (
      tester,
    ) async {
      await _montar(tester, const InquilinoFormPage());
      await _tocar(tester, find.byKey(const Key('inquilino-crear')));
      expect(find.text('Requerido'), findsOneWidget);

      await tester.enterText(
        find.byKey(const Key('inquilino-razonSocial')),
        'Tienda',
      );
      await tester.enterText(
        find.byKey(const Key('inquilino-contacto1Email')),
        'no-es-correo',
      );
      await _tocar(tester, find.byKey(const Key('inquilino-crear')));
      expect(find.text('Email inválido'), findsOneWidget);
      expect(peticionesFalsas, isEmpty);

      await tester.enterText(
        find.byKey(const Key('inquilino-contacto1Email')),
        'Maria@Tienda.COM',
      );
      await _tocar(tester, find.byKey(const Key('inquilino-tipoCliente')));
      await tester.tap(find.text('Mediano').last);
      await tester.pumpAndSettle();
      await _tocar(tester, find.byKey(const Key('inquilino-crear')));
      final post = peticionesFalsas.singleWhere((r) => r.method == 'POST');
      expect(cuerpoDe(post), {
        'razonSocial': 'Tienda',
        'contacto1Email': 'maria@tienda.com',
        'tipoCliente': 'mediano',
      });
    });

    testWidgets('identificación duplicada se muestra bajo el campo', (
      tester,
    ) async {
      final rutas = _rutas()
        ..['POST /inquilinos'] = (_) => const RespuestaFalsa(409, {
          'code': 'INQUILINO_IDENTIFICACION_DUPLICADA',
          'detail': 'Ya existe un inquilino con esa identificación.',
        });
      await _montar(tester, const InquilinoFormPage(), rutas: rutas);
      await tester.enterText(
        find.byKey(const Key('inquilino-razonSocial')),
        'Tienda',
      );
      await tester.enterText(
        find.byKey(const Key('inquilino-identificacion')),
        '0614',
      );
      await _tocar(tester, find.byKey(const Key('inquilino-crear')));
      expect(
        find.text('Ya existe un inquilino con esa identificación.'),
        findsWidgets,
      );
    });
  });

  group('Detalle', () {
    testWidgets('responsive en todas las pestañas', (tester) async {
      await probarEnTamanos(
        tester,
        () => _en(const InquilinoDetallePage(id: 'inq-1')),
        overrides: overridesBase(
          apiFalsa(_rutas()),
          sesion: sesionDe(Rol.adminPlaza),
        ),
        alPintar: (_, _) async {
          expect(find.text(razonLargaDecodificada), findsWidgets);
          expect(find.text('ID: 0614-050101-001-1'), findsOneWidget);
          await recorrerPestanas(tester, [
            'Contratos',
            'Usuarios',
            'Solicitudes',
            'Datos',
          ]);
        },
      );
    });

    testWidgets('editar: un campo vaciado va null y la identidad no se envía', (
      tester,
    ) async {
      await _montar(tester, const InquilinoDetallePage(id: 'inq-1'));
      await tester.enterText(
        find.byKey(const Key('inquilino-nombreComercial')),
        '',
      );
      await _tocar(tester, find.byKey(const Key('inquilino-guardar')));
      final body = cuerpoDe(
        peticionesFalsas.singleWhere((r) => r.method == 'PATCH'),
      );
      expect(body['nombreComercial'], isNull);
      expect(body.containsKey('nombreComercial'), isTrue);
      expect(body['numeroNrc'], isNull);
      expect(body['contacto1Email'], 'maria@ejemplo.com');
      expect(body['tipoCliente'], 'grande');
      expect(body.containsKey('razonSocial'), isFalse);
      expect(body.containsKey('identificacion'), isFalse);
      expect(body.values.whereType<String>().where((v) => v.isEmpty), isEmpty);
      expect(find.text('Inquilino actualizado'), findsOneWidget);
    });

    testWidgets('con contrato vigente "Desactivar" queda deshabilitado', (
      tester,
    ) async {
      await _montar(tester, const InquilinoDetallePage(id: 'inq-1'));
      final boton = find.byKey(const Key('inquilino-desactivar'));
      await tester.ensureVisible(boton);
      expect(tester.widget<OutlinedButton>(boton).onPressed, isNull);
      expect(
        find.text(
          'El botón «Desactivar» está deshabilitado porque tiene contratos '
          'vigentes.',
        ),
        findsOneWidget,
      );
    });

    testWidgets('sin contrato vigente desactiva tras confirmar', (
      tester,
    ) async {
      await _montar(
        tester,
        const InquilinoDetallePage(id: 'inq-1'),
        rutas: _rutas(conVigente: false),
      );
      await _tocar(tester, find.byKey(const Key('inquilino-desactivar')));
      expect(
        find.text(
          'El inquilino no podrá ser usado en nuevos contratos, pero sus '
          'datos y contratos históricos se conservan.',
        ),
        findsOneWidget,
      );
      await tester.tap(find.text('Sí, desactivar'));
      await tester.pumpAndSettle();
      expect(
        peticionesFalsas.singleWhere((r) => r.method == 'DELETE').url.path,
        endsWith('/inquilinos/inq-1'),
      );
      expect(find.text('Ruta: /admin/inquilinos'), findsOneWidget);
    });

    testWidgets('solicitudes: solo las del inquilino en sus locales', (
      tester,
    ) async {
      await _montar(tester, const InquilinoDetallePage(id: 'inq-1'));
      await _irAPestana(tester, 'Solicitudes');
      final locales = peticionesFalsas
          .where((r) => r.url.path.endsWith('/solicitudes'))
          .map((r) => r.url.queryParameters['localId'])
          .toSet();
      expect(locales, {'loc-1', 'loc-2'});
      // Dos locales con una solicitud propia cada uno; la ajena se descarta.
      expect(find.text('SOL-carga-qa-1234'), findsNWidgets(2));
    });
  });

  group('Usuarios del inquilino', () {
    testWidgets('alta rápida muestra la contraseña temporal una sola vez', (
      tester,
    ) async {
      String? copiado;
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        (call) async {
          if (call.method == 'Clipboard.setData') {
            copiado = (call.arguments as Map)['text'] as String;
          }
          return null;
        },
      );
      addTearDown(
        () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
          SystemChannels.platform,
          null,
        ),
      );
      await _montar(tester, const InquilinoDetallePage(id: 'inq-1'));
      await _tocar(tester, find.byKey(const Key('inquilino-alta-usuario')));
      // Precargado con el contacto 1.
      expect(
        find.descendant(
          of: find.byType(AlertDialog),
          matching: find.text('maria@ejemplo.com'),
        ),
        findsOneWidget,
      );
      await tester.tap(find.byKey(const Key('alta-crear')));
      await tester.pumpAndSettle();

      final body = cuerpoDe(
        peticionesFalsas.singleWhere((r) => r.method == 'POST'),
      );
      final password = body['password'] as String;
      expect(password, matches(RegExp(r'^Tmp[A-Za-z0-9_-]{12}1a$')));
      expect(body, {
        'email': 'maria@ejemplo.com',
        'nombre': 'María Pérez',
        'password': password,
        'rol': 'inquilino',
        'inquilinoId': 'inq-1',
      });
      expect(find.text(password), findsOneWidget);
      expect(find.textContaining('no se volverá a mostrar'), findsOneWidget);

      await tester.tap(find.byKey(const Key('alta-copiar')));
      await tester.pumpAndSettle();
      expect(copiado, password);

      await tester.tap(find.text('Entendido'));
      await tester.pumpAndSettle();
      expect(find.text(password), findsNothing);

      // Al reabrir vuelve el formulario, nunca la contraseña anterior.
      await _tocar(tester, find.byKey(const Key('inquilino-alta-usuario')));
      expect(find.byKey(const Key('alta-crear')), findsOneWidget);
      expect(find.text(password), findsNothing);
    });

    testWidgets('estados y acciones por fila', (tester) async {
      await _montar(tester, const InquilinoDetallePage(id: 'inq-1'));
      await _irAPestana(tester, 'Usuarios');
      expect(find.text('Activo'), findsOneWidget);
      expect(find.text('Email inválido'), findsOneWidget);
      expect(find.text('Inactivo'), findsOneWidget);
      expect(find.text('Nunca'), findsOneWidget);
      expect(find.text('Resetear clave'), findsNWidgets(2));
      expect(find.text('Reactivar'), findsOneWidget);

      // Deshabilitar: cancelar no hace nada; confirmar llama a la API.
      await _tocar(tester, find.text('Deshabilitar').first);
      await tester.tap(find.text('Cancelar'));
      await tester.pumpAndSettle();
      expect(peticionesFalsas.where((r) => r.method == 'DELETE'), isEmpty);
      await _tocar(tester, find.text('Deshabilitar').first);
      await tester.tap(find.text('Sí, deshabilitar'));
      await tester.pumpAndSettle();
      expect(
        peticionesFalsas.singleWhere((r) => r.method == 'DELETE').url.path,
        endsWith('/usuarios/usr-1'),
      );
      expect(find.text('Usuario deshabilitado'), findsOneWidget);

      await _tocar(tester, find.text('Reactivar'));
      await tester.tap(find.text('Sí, reactivar'));
      await tester.pumpAndSettle();
      expect(
        peticionesFalsas.any(
          (r) => r.url.path.endsWith('/usuarios/usr-3/reactivate'),
        ),
        isTrue,
      );

      await _tocar(tester, find.text('Resetear clave').first);
      expect(
        find.textContaining('un enlace válido por 30 minutos'),
        findsOneWidget,
      );
      await tester.tap(find.text('Sí, enviar'));
      await tester.pumpAndSettle();
      expect(find.text('Email de reseteo enviado al usuario'), findsOneWidget);
    });

    testWidgets('editar usuario: teléfono vacío va null y recarga la lista', (
      tester,
    ) async {
      await _montar(tester, const InquilinoDetallePage(id: 'inq-1'));
      await _irAPestana(tester, 'Usuarios');
      final lecturasAntes = peticionesFalsas
          .where((r) => r.url.path.endsWith('/usuarios'))
          .length;
      await _tocar(tester, find.byTooltip(RegExp(r'^Editar ')).first);
      await tester.enterText(
        find.byKey(const Key('editar-usuario-nombre')),
        'María P.',
      );
      await tester.tap(find.byKey(const Key('editar-usuario-guardar')));
      await tester.pumpAndSettle();
      expect(
        cuerpoDe(peticionesFalsas.singleWhere((r) => r.method == 'PATCH')),
        {'nombre': 'María P.', 'telefono': null},
      );
      expect(
        peticionesFalsas.where((r) => r.url.path.endsWith('/usuarios')).length,
        greaterThan(lecturasAntes),
      );
    });

    testWidgets('sin permisos no hay alta ni acciones de usuario', (
      tester,
    ) async {
      await _montar(
        tester,
        const InquilinoDetallePage(id: 'inq-1'),
        permisos: ['inquilinos.listar'],
      );
      expect(find.byKey(const Key('inquilino-alta-usuario')), findsNothing);
      expect(find.byKey(const Key('inquilino-guardar')), findsNothing);
      expect(find.byKey(const Key('inquilino-desactivar')), findsNothing);
      await _irAPestana(tester, 'Usuarios');
      expect(find.text('Activo'), findsOneWidget);
      expect(find.text('Resetear clave'), findsNothing);
      expect(find.text('Deshabilitar'), findsNothing);
      expect(find.text('Reactivar'), findsNothing);
    });
  });

  test('contraseña temporal: Tmp + base64url(9 bytes) + 1a', () {
    final a = generarPasswordTemporal(Random(1));
    final b = generarPasswordTemporal(Random(2));
    expect(a, hasLength(17));
    expect(a, matches(RegExp(r'^Tmp[A-Za-z0-9_-]{12}1a$')));
    expect(a, isNot(b));
    expect(generarPasswordTemporal(), hasLength(17));
  });

  test('cuerpos de alta y edición', () {
    expect(
      cuerpoNuevoInquilino({
        'razonSocial': ' X ',
        'identificacion': '',
        'correoRecepcionDte': ' DTE@X.COM ',
        'comentarios': '   ',
      }),
      {'razonSocial': 'X', 'correoRecepcionDte': 'dte@x.com'},
    );
    final edicion = cuerpoEditarInquilino({'direccion': ''});
    expect(edicion['direccion'], isNull);
    expect(edicion.containsKey('razonSocial'), isFalse);
    expect(edicion.containsKey('tipoCliente'), isTrue);
  });
}

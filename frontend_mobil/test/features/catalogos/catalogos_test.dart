import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend_mobil/core/auth/sesion.dart';
import 'package:frontend_mobil/features/catalogos/categoria_form_page.dart';
import 'package:frontend_mobil/features/catalogos/categorias_page.dart';
import 'package:frontend_mobil/features/catalogos/subcategorias_page.dart';
import 'package:frontend_mobil/features/catalogos/tipo_solicitud_page.dart';
import 'package:frontend_mobil/features/catalogos/tipos_solicitud_page.dart';
import 'package:http/http.dart' as http;

import '../../helpers/api_falsa.dart';
import '../../helpers/pantallas.dart';

// ── Fixtures (forma real de la API, textos largos) ──────────────────────────

const _nombreLargo =
    'Mantenimiento preventivo y correctivo de instalaciones eléctricas, '
    'hidráulicas y de climatización en áreas comunes del centro comercial';
const _descripcionLarga =
    'Reparaciones generales, cambio de luminarias, fugas de agua, aire '
    'acondicionado y cualquier trabajo técnico que requiera un responsable '
    'de la administración de la plaza con disponibilidad nocturna';

Map<String, Object?> _persona(int n) => {
  'id': 'u-$n',
  'nombre': 'Supervisora Número $n con Apellidos Larguísimos de Prueba',
  'email': 'supervisora.numero.$n.con.correo.largo@plaza-demo-larga.com',
};

Map<String, Object?> _usuarioStaff(int n, {bool rolActivo = true}) => {
  ..._persona(n),
  'telefono': null,
  'rol': 'admin_plaza',
  'rolStaffId': 'rol-1',
  'inquilinoId': null,
  'plazaId': 'plaza-demo',
  'emailInvalido': false,
  'lastLoginAt': null,
  'createdAt': '2026-08-11T17:44:59.817Z',
  'deletedAt': null,
  'rolStaffActivo': rolActivo,
  'rolStaffNombre': 'Técnico',
};

Map<String, Object?> _sub({
  String id = 'sub-1',
  int supervisores = 2,
  bool activo = true,
}) => {
  'id': id,
  'plazaId': 'plaza-demo',
  'categoriaId': 'cat-1',
  'responsableId': 'u-1',
  'nombre': 'Subcategoría $id: $_nombreLargo',
  'descripcion': _descripcionLarga,
  'prioridad': 'A',
  'activo': activo,
  'supervisorIds': [for (var i = 1; i <= supervisores; i++) 'u-$i'],
  'createdAt': '2026-08-11T17:46:19.888Z',
  'updatedAt': '2026-08-11T17:46:19.888Z',
  'responsable': _persona(1),
  'supervisores': [for (var i = 1; i <= supervisores; i++) _persona(i)],
};

Map<String, Object?> _categoria({
  String id = 'cat-1',
  bool activo = true,
  List<Object?> subcategorias = const [],
}) => {
  'id': id,
  'plazaId': 'plaza-demo',
  'nombre': '$_nombreLargo &amp; más',
  'descripcion': _descripcionLarga,
  'activo': activo,
  'createdAt': '2026-08-11T17:45:00.059Z',
  'updatedAt': '2026-08-11T17:45:00.059Z',
  'subcategorias': subcategorias,
};

Map<String, Object?> _paginado(List<Object?> items, {int totalPages = 1}) => {
  'items': items,
  'total': items.length,
  'page': 1,
  'pageSize': 20,
  'totalPages': totalPages,
};

Map<String, Object?> _tipo({
  String codigo = 'mantenimiento',
  bool activo = true,
}) => {
  'id': 'tipo-$codigo',
  'plazaId': 'plaza-demo',
  'codigo': codigo,
  'etiqueta': 'Etiqueta muy larga para el tipo $codigo que ven los inquilinos',
  'descripcion': _descripcionLarga,
  'activo': activo,
  'orden': 3,
  'createdAt': '2026-08-11T17:45:00.069Z',
  'updatedAt': '2026-08-11T17:45:00.069Z',
};

// ── Helpers ─────────────────────────────────────────────────────────────────

Future<void> _montar(
  WidgetTester tester,
  Widget Function() pantalla,
  Map<String, ManejadorFalso> rutas, {
  Sesion? sesion,
}) async {
  await tester.pumpWidget(
    envolver(
      () => Scaffold(body: pantalla()),
      overrides: overridesBase(
        apiFalsa(rutas),
        sesion: sesion ?? sesionDe(Rol.adminPlaza),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

Iterable<http.Request> _peticiones(String metodo, String sufijo) =>
    peticionesFalsas.where(
      (r) => r.method == metodo && r.url.path.endsWith(sufijo),
    );

Future<void> _tocar(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

Future<void> _elegir(WidgetTester tester, Finder campo, String opcion) async {
  await tester.ensureVisible(campo);
  await tester.pumpAndSettle();
  await tester.tap(campo);
  await tester.pumpAndSettle();
  await tester.tap(find.text(opcion).last);
  await tester.pumpAndSettle();
}

void main() {
  setUp(prepararPruebas);

  group('Categorías', () {
    final rutas = <String, ManejadorFalso>{
      'GET /categorias': (_) => _paginado([
        _categoria(),
        _categoria(id: 'cat-2', activo: false),
      ], totalPages: 3),
      'DELETE /categorias/:id': (_) => _categoria(activo: false),
    };

    testWidgets('listado responsive con nombres largos', (tester) async {
      await probarEnTamanos(
        tester,
        () => const Scaffold(body: CategoriasPage()),
        overrides: overridesBase(
          apiFalsa(rutas),
          sesion: sesionDe(Rol.adminPlaza),
        ),
        alPintar: (_, _) async {
          expect(find.text('Nueva categoría'), findsOneWidget);
          // Entidad HTML decodificada.
          expect(find.textContaining('&amp;'), findsNothing);
        },
      );
    });

    testWidgets('filtrar envía search y activo=false', (tester) async {
      await _montar(tester, () => const CategoriasPage(), rutas);
      await tester.enterText(
        find.byKey(const Key('categorias-buscar')),
        '  eléctrico  ',
      );
      await _elegir(
        tester,
        find.byType(DropdownButtonFormField<bool?>),
        'Inactivas',
      );
      await _tocar(tester, find.text('Filtrar'));
      final q = _peticiones('GET', '/categorias').last.url.queryParameters;
      expect(q['search'], 'eléctrico');
      expect(q['activo'], 'false');
      expect(q['page'], '1');
    });

    testWidgets('desactivar pide confirmación y llama a DELETE', (
      tester,
    ) async {
      await _montar(tester, () => const CategoriasPage(), rutas);
      // Solo la categoría activa ofrece "Desactivar".
      expect(find.text('Desactivar'), findsOneWidget);
      await _tocar(tester, find.text('Desactivar'));
      await tester.tap(find.text('Cancelar'));
      await tester.pumpAndSettle();
      expect(_peticiones('DELETE', '/categorias/cat-1'), isEmpty);

      await _tocar(tester, find.text('Desactivar'));
      await tester.tap(find.text('Sí, desactivar'));
      await tester.pumpAndSettle();
      expect(_peticiones('DELETE', '/categorias/cat-1'), hasLength(1));
      expect(find.text('Categoría desactivada'), findsOneWidget);
    });

    testWidgets('sin permisos oculta Nueva categoría y Desactivar', (
      tester,
    ) async {
      await _montar(
        tester,
        () => const CategoriasPage(),
        rutas,
        sesion: sesionDe(Rol.adminPlaza, permisos: ['categorias.listar']),
      );
      expect(find.text('Nueva categoría'), findsNothing);
      expect(find.text('Desactivar'), findsNothing);
      expect(find.text('Subcategorías'), findsWidgets);
    });

    testWidgets('nueva categoría sin descripción no envía la clave', (
      tester,
    ) async {
      await _montar(tester, () => const CategoriaFormPage(), {
        'POST /categorias': (_) => _categoria(),
      });
      await tester.tap(find.byKey(const Key('categoria-guardar')));
      await tester.pumpAndSettle();
      expect(find.text('Este campo es obligatorio.'), findsOneWidget);

      await tester.enterText(
        find.byKey(const Key('categoria-nombre')),
        ' Seguridad ',
      );
      await tester.tap(find.byKey(const Key('categoria-guardar')));
      await tester.pumpAndSettle();
      final body = cuerpoDe(_peticiones('POST', '/categorias').single);
      expect(body, {'nombre': 'Seguridad'});
      expect(find.text('Ruta: /admin/categorias'), findsOneWidget);
    });

    testWidgets('formulario nuevo responsive', (tester) async {
      await probarEnTamanos(
        tester,
        () => const Scaffold(body: CategoriaFormPage()),
        overrides: overridesBase(
          apiFalsa({}),
          sesion: sesionDe(Rol.adminPlaza),
        ),
      );
    });

    testWidgets('detalle responsive con subcategorías activas', (tester) async {
      final api = apiFalsa({
        'GET /categorias/:id': (_) => _categoria(
          subcategorias: [
            _sub(),
            _sub(id: 'sub-2', supervisores: 5),
          ],
        ),
      });
      await probarEnTamanos(
        tester,
        () => const Scaffold(body: CategoriaDetallePage(id: 'cat-1')),
        overrides: overridesBase(api, sesion: sesionDe(Rol.adminPlaza)),
        alPintar: (_, _) async {
          expect(find.text('Gestionar subcategorías'), findsOneWidget);
          expect(find.textContaining('Supervisores: 5/5'), findsOneWidget);
        },
      );
    });

    testWidgets('editar descripción vacía envía null', (tester) async {
      await _montar(tester, () => const CategoriaDetallePage(id: 'cat-1'), {
        'GET /categorias/:id': (_) => _categoria(),
        'PATCH /categorias/:id': (_) => _categoria(),
      });
      await tester.enterText(
        find.byKey(const Key('categoria-descripcion')),
        '   ',
      );
      await _tocar(tester, find.byKey(const Key('categoria-guardar')));
      final body = cuerpoDe(_peticiones('PATCH', '/categorias/cat-1').single);
      expect(body['descripcion'], isNull);
      expect(body.containsKey('descripcion'), isTrue);
      expect(find.text('Categoría actualizada'), findsOneWidget);
    });
  });

  group('Subcategorías', () {
    Map<String, ManejadorFalso> rutasSubs({int supervisores = 2}) => {
      'GET /categorias/:id': (_) => _categoria(),
      'GET /categorias/:id/subcategorias': (_) => _paginado([
        _sub(supervisores: supervisores),
        _sub(id: 'sub-2', supervisores: 5, activo: false),
      ]),
      'GET /usuarios': (_) => _paginado([
        for (var i = 1; i <= 6; i++) _usuarioStaff(i),
        _usuarioStaff(9, rolActivo: false),
      ]),
    };

    testWidgets('listado responsive con contador n/5', (tester) async {
      await probarEnTamanos(
        tester,
        () => const Scaffold(body: SubcategoriasPage(categoriaId: 'cat-1')),
        overrides: overridesBase(
          apiFalsa(rutasSubs()),
          sesion: sesionDe(Rol.adminPlaza),
        ),
        alPintar: (_, _) async {
          expect(find.text('2/5'), findsOneWidget);
          expect(find.text('5/5'), findsOneWidget);
          expect(find.text('Nueva subcategoría'), findsOneWidget);
        },
      );
    });

    testWidgets('supervisores: al llegar a 5 bloquea agregar más', (
      tester,
    ) async {
      var actuales = 4;
      await _montar(
        tester,
        () => const SubcategoriasPage(categoriaId: 'cat-1'),
        {
          ...rutasSubs(supervisores: 4),
          'POST /categorias/:id/subcategorias/:subId/supervisores': (_) {
            actuales++;
            return _sub(supervisores: actuales);
          },
        },
      );
      await _tocar(tester, find.text('Supervisores').first);
      final dialogo = find.byType(SupervisoresDialog);
      expect(
        find.descendant(of: dialogo, matching: find.text('4/5')),
        findsOneWidget,
      );
      // El staff con rol de staff inactivo no es elegible (SC-6).
      await _elegir(
        tester,
        find.descendant(
          of: dialogo,
          matching: find.byType(DropdownButtonFormField<String>),
        ),
        'Supervisora Número 5 con Apellidos Larguísimos de Prueba '
        '(supervisora.numero.5.con.correo.largo@plaza-demo-larga.com)',
      );
      await tester.tap(find.byKey(const Key('supervisor-agregar')));
      await tester.pumpAndSettle();

      final post = _peticiones('POST', '/supervisores').single;
      expect(cuerpoDe(post), {'usuarioId': 'u-5'});
      expect(
        find.descendant(of: dialogo, matching: find.text('5/5')),
        findsOneWidget,
      );
      expect(find.text('Límite de 5 alcanzado'), findsOneWidget);
      final agregar = tester.widget<FilledButton>(
        find.byKey(const Key('supervisor-agregar')),
      );
      expect(agregar.onPressed, isNull);
    });

    testWidgets(
      'nueva subcategoría exige responsable y manda supervisores []',
      (tester) async {
        await _montar(
          tester,
          () => const SubcategoriasPage(categoriaId: 'cat-1'),
          {...rutasSubs(), 'POST /categorias/:id/subcategorias': (_) => _sub()},
        );
        await tester.tap(find.text('Nueva subcategoría'));
        await tester.pumpAndSettle();
        await tester.enterText(find.byKey(const Key('sub-nombre')), 'Plomería');
        await tester.tap(find.byKey(const Key('sub-guardar')));
        await tester.pumpAndSettle();
        expect(find.text('Selecciona un responsable.'), findsOneWidget);
        expect(_peticiones('POST', '/subcategorias'), isEmpty);

        await _elegir(
          tester,
          find.widgetWithText(DropdownButtonFormField<String>, 'Selecciona…'),
          'Supervisora Número 2 con Apellidos Larguísimos de Prueba '
          '(supervisora.numero.2.con.correo.largo@plaza-demo-larga.com)',
        );
        await tester.tap(find.byKey(const Key('sub-guardar')));
        await tester.pumpAndSettle();
        final body = cuerpoDe(_peticiones('POST', '/subcategorias').single);
        expect(body, {
          'nombre': 'Plomería',
          'prioridad': 'B',
          'responsableId': 'u-2',
          'supervisorIds': <Object?>[],
        });
        expect(find.text('Subcategoría creada'), findsOneWidget);
      },
    );

    testWidgets('los diálogos caben en teléfono y tablet', (tester) async {
      await probarEnTamanos(
        tester,
        () => const Scaffold(body: SubcategoriasPage(categoriaId: 'cat-1')),
        overrides: overridesBase(
          apiFalsa(rutasSubs(supervisores: 5)),
          sesion: sesionDe(Rol.adminPlaza),
        ),
        alPintar: (_, _) async {
          // El botón del encabezado primero: al bajar a las filas, la lista
          // perezosa descarta el encabezado.
          for (final (abrir, cerrar) in [
            ('Nueva subcategoría', 'Cancelar'),
            ('Supervisores', 'Cerrar'),
            ('Responsable', 'Cancelar'),
            ('Editar', 'Cancelar'),
          ]) {
            await _tocar(tester, find.text(abrir).first);
            if (abrir == 'Nueva subcategoría') {
              // Con los errores de validación visibles.
              await _tocar(tester, find.byKey(const Key('sub-guardar')));
            }
            await _tocar(tester, find.text(cerrar).last);
          }
        },
      );
    });
  });

  group('Tipos de solicitud', () {
    testWidgets('listado responsive', (tester) async {
      await probarEnTamanos(
        tester,
        () => const Scaffold(body: TiposSolicitudPage()),
        overrides: overridesBase(
          apiFalsa({
            'GET /admin/tipos-solicitud': (_) => _paginado([
              _tipo(),
              _tipo(codigo: 'remodelacion', activo: false),
              _tipo(codigo: 'otro'),
            ]),
          }),
          sesion: sesionDe(Rol.adminPlaza),
        ),
        alPintar: (_, _) async {
          expect(find.text('remodelacion'), findsOneWidget);
          expect(find.text('Inactivo'), findsOneWidget);
        },
      );
    });

    testWidgets('detalle responsive; "otro" no se puede desactivar', (
      tester,
    ) async {
      await probarEnTamanos(
        tester,
        () => const Scaffold(body: TipoSolicitudPage(id: 'tipo-otro')),
        overrides: overridesBase(
          apiFalsa({
            'GET /admin/tipos-solicitud/:id': (_) => _tipo(codigo: 'otro'),
          }),
          sesion: sesionDe(Rol.adminPlaza),
        ),
        alPintar: (_, _) async {
          expect(
            find.textContaining('nunca se puede desactivar'),
            findsOneWidget,
          );
          final boton = tester.widget<OutlinedButton>(
            find.byKey(const Key('tipo-estado')),
          );
          expect(boton.onPressed, isNull);
        },
      );
    });

    testWidgets('guardar envía solo los campos cambiados (sin activo)', (
      tester,
    ) async {
      await _montar(tester, () => const TipoSolicitudPage(id: 'tipo-evento'), {
        'GET /admin/tipos-solicitud/:id': (_) => _tipo(codigo: 'evento'),
        'PATCH /admin/tipos-solicitud/:id': (_) => _tipo(codigo: 'evento'),
      });
      final guardar = find.byKey(const Key('tipo-guardar'));
      expect(tester.widget<FilledButton>(guardar).onPressed, isNull);

      await tester.enterText(find.byKey(const Key('tipo-etiqueta')), 'Eventos');
      await tester.pumpAndSettle();
      await _tocar(tester, guardar);
      final patch = _peticiones('PATCH', '/admin/tipos-solicitud/tipo-evento');
      expect(cuerpoDe(patch.single), {'etiqueta': 'Eventos'});
      expect(find.text('Tipo de solicitud actualizado'), findsOneWidget);
    });

    testWidgets('desactivar confirma y envía solo activo=false', (
      tester,
    ) async {
      await _montar(tester, () => const TipoSolicitudPage(id: 'tipo-evento'), {
        'GET /admin/tipos-solicitud/:id': (_) => _tipo(codigo: 'evento'),
        'PATCH /admin/tipos-solicitud/:id': (_) =>
            _tipo(codigo: 'evento', activo: false),
      });
      await _tocar(tester, find.byKey(const Key('tipo-estado')));
      expect(
        find.textContaining('Las solicitudes existentes NO'),
        findsOneWidget,
      );
      await tester.tap(find.text('Sí, desactivar'));
      await tester.pumpAndSettle();
      final patch = _peticiones('PATCH', '/admin/tipos-solicitud/tipo-evento');
      expect(cuerpoDe(patch.single), {'activo': false});
      expect(find.text('Tipo desactivado'), findsOneWidget);
    });
  });
}

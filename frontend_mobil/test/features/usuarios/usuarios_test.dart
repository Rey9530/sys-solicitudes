import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend_mobil/core/auth/sesion.dart';
import 'package:frontend_mobil/features/usuarios/matriz_permisos_page.dart';
import 'package:frontend_mobil/features/usuarios/usuario_plaza_page.dart';
import 'package:frontend_mobil/features/usuarios/usuarios_api.dart';
import 'package:frontend_mobil/features/usuarios/usuarios_plaza_page.dart';
import 'package:http/http.dart' as http;

import '../../helpers/api_falsa.dart';
import '../../helpers/pantallas.dart';

// ── Fixtures (forma real de la API, textos largos) ──────────────────────────

const _apellidos = 'de los Ángeles Hernández Villalobos y Castañeda';

Map<String, Object?> _usuario(
  int n, {
  String rolId = 'rol-tec',
  String rolNombre = 'Técnico de mantenimiento de instalaciones',
  bool rolActivo = true,
  bool deshabilitado = false,
  bool emailInvalido = false,
}) => {
  'id': 'u-$n',
  'email': 'usuario.numero.$n.con.correo.muy.largo@plaza-demo-larga.com',
  'nombre': 'María José $n $_apellidos',
  'telefono': n.isEven ? '+503 7777-000$n' : null,
  'rol': 'admin_plaza',
  'rolStaffId': rolId,
  'inquilinoId': null,
  'plazaId': 'plaza-demo',
  'emailInvalido': emailInvalido,
  'lastLoginAt': n == 1 ? '2026-10-27T20:32:55.178Z' : null,
  'createdAt': '2026-08-11T17:44:59.817Z',
  'deletedAt': deshabilitado ? '2026-10-27T19:49:17.244Z' : null,
  'rolStaffActivo': rolActivo,
  'rolStaffNombre': rolNombre,
};

Map<String, Object?> _rol(
  String id,
  String codigo,
  String nombre, {
  bool activo = true,
  int asignados = 0,
}) => {
  'id': id,
  'plazaId': 'plaza-demo',
  'codigo': codigo,
  'nombre': nombre,
  'descripcion':
      'Rol $nombre con una descripción larga para probar el '
      'ajuste de texto en tarjetas y tablas',
  'activo': activo,
  'createdAt': '2026-08-11T18:24:29.638Z',
  'updatedAt': '2026-08-11T18:24:29.638Z',
  'usuariosAsignados': asignados,
};

final _roles = [
  _rol('rol-admin', 'admin', 'Administrador del sistema', asignados: 1),
  _rol(
    'rol-tec',
    'tecnico',
    'Técnico de mantenimiento de instalaciones',
    asignados: 3,
  ),
  _rol('rol-sup', 'supervisor-nocturno', 'Supervisor nocturno'),
  _rol('rol-old', 'qainactivo', 'QA inactivo', activo: false),
];

Map<String, Object?> _paginado(List<Object?> items, {int pageSize = 20}) => {
  'items': items,
  'total': items.length,
  'page': 1,
  'pageSize': pageSize,
  'totalPages': 1,
};

Map<String, Object?> _permiso(String id, String codigo, String modulo) => {
  'id': id,
  'codigo': codigo,
  'modulo': modulo,
  'accion': codigo.split('.').last,
  'descripcion':
      'Descripción larga del permiso $codigo para comprobar el ajuste de '
      'texto en teléfonos de 360 px',
  'createdAt': '2026-08-11T17:44:59.574Z',
};

final _catalogo = {
  'total': 5,
  'modulos': [
    {
      'modulo': 'categorias',
      'permisos': [
        _permiso('p-cat-listar', 'categorias.listar', 'categorias'),
        _permiso('p-cat-crear', 'categorias.crear', 'categorias'),
        _permiso('p-sub-editar', 'subcategorias.editar', 'categorias'),
      ],
    },
    {
      'modulo': 'usuarios-plaza',
      'permisos': [
        _permiso('p-usr-listar', 'usuarios_plaza.listar', 'usuarios-plaza'),
        _permiso(
          'p-rs-perm',
          'roles_staff.gestionar_permisos',
          'usuarios-plaza',
        ),
      ],
    },
  ],
};

Map<String, Object?> _permisosRol(http.Request req) {
  final id = req.url.pathSegments.last;
  final todos = [
    for (final m in _catalogo['modulos']! as List<Object?>)
      ...((m! as Map<String, Object?>)['permisos']! as List<Object?>),
  ];
  return {
    'rolStaffId': id,
    'esSistema': id == 'rol-admin',
    'permisos': switch (id) {
      'rol-admin' => todos,
      'rol-tec' => [todos[0], todos[3]],
      _ => <Object?>[],
    },
  };
}

Map<String, ManejadorFalso> _rutas({
  Map<String, ManejadorFalso> extra = const {},
}) => {
  'GET /usuarios': (req) => req.url.queryParameters['activo'] == 'false'
      ? _paginado([_usuario(3, deshabilitado: true)])
      : _paginado([
          _usuario(1),
          _usuario(2, rolActivo: false, emailInvalido: true),
        ]),
  'GET /usuarios/:id': (_) => _usuario(1),
  'GET /roles-staff/con-asignaciones': (_) => _roles,
  'GET /roles-staff': (req) => req.url.queryParameters['activo'] == 'true'
      ? _paginado(_roles.where((r) => r['activo'] == true).toList())
      : _paginado(_roles, pageSize: 50),
  'GET /permisos': (_) => _catalogo,
  'GET /permisos/roles/:id': _permisosRol,
  ...extra,
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
  await _tocar(tester, campo);
  await tester.tap(find.text(opcion).last);
  await tester.pumpAndSettle();
}

void main() {
  setUp(prepararPruebas);

  test('contraseña temporal con el formato del web', () {
    for (var i = 0; i < 20; i++) {
      expect(
        generarPasswordTemporal(),
        matches(RegExp(r'^Tmp[A-Za-z0-9_-]{12}1a$')),
      );
    }
  });

  group('Usuarios de plaza', () {
    for (final tab in ['usuarios', 'roles', 'permisos']) {
      testWidgets('pestaña $tab responsive con textos largos', (tester) async {
        await probarEnTamanos(
          tester,
          () => Scaffold(body: UsuariosPlazaPage(tab: tab)),
          overrides: overridesBase(
            apiFalsa(_rutas()),
            sesion: sesionDe(Rol.adminPlaza),
          ),
          alPintar: (_, _) async {
            switch (tab) {
              case 'usuarios':
                expect(find.text('Nuevo usuario'), findsOneWidget);
                expect(
                  find.text(
                    'Técnico de mantenimiento de instalaciones (inactivo)',
                  ),
                  findsOneWidget,
                );
                expect(find.text('Email inválido'), findsOneWidget);
              case 'roles':
                // El rol de sistema no ofrece acciones.
                expect(find.text('Sistema'), findsOneWidget);
                expect(find.text('Nuevo rol'), findsOneWidget);
              default:
                expect(find.text('Abrir matriz de permisos →'), findsOneWidget);
            }
          },
        );
      });
    }

    testWidgets('filtro Deshabilitados pide activo=false y permite reactivar', (
      tester,
    ) async {
      await _montar(
        tester,
        () => const UsuariosPlazaPage(),
        _rutas(extra: {'POST /usuarios/:id/reactivate': (_) => _usuario(3)}),
      );
      expect(find.text('Reactivar'), findsNothing);
      await _elegir(
        tester,
        find.byKey(const Key('usuarios-estado')),
        'Deshabilitados',
      );
      final q = _peticiones('GET', '/usuarios').last.url.queryParameters;
      expect(q['activo'], 'false');
      expect(q['rol'], 'admin_plaza');
      expect(find.text('Inactivo'), findsOneWidget);
      expect(find.text('Deshabilitar'), findsNothing);

      await _tocar(tester, find.text('Reactivar'));
      expect(
        find.textContaining('Volverá a poder iniciar sesión'),
        findsOneWidget,
      );
      await tester.tap(find.text('Sí, reactivar'));
      await tester.pumpAndSettle();
      expect(_peticiones('POST', '/usuarios/u-3/reactivate'), hasLength(1));
      expect(find.text('Usuario reactivado'), findsOneWidget);
    });

    testWidgets('editar cambia el rol de staff (envía rolStaffId)', (
      tester,
    ) async {
      await _montar(
        tester,
        () => const UsuariosPlazaPage(),
        _rutas(extra: {'PATCH /usuarios/:id': (_) => _usuario(1)}),
      );
      await _tocar(tester, find.text('Editar').first);
      expect(find.text('Editar usuario'), findsOneWidget);
      await _elegir(
        tester,
        find.byKey(const Key('usuario-rol')),
        'Supervisor nocturno (supervisor-nocturno)',
      );
      await tester.enterText(find.byKey(const Key('editar-telefono')), '  ');
      await tester.tap(find.byKey(const Key('editar-guardar')));
      await tester.pumpAndSettle();

      final body = cuerpoDe(_peticiones('PATCH', '/usuarios/u-1').single);
      expect(body, {
        'nombre': 'María José 1 $_apellidos',
        'telefono': null,
        'rolStaffId': 'rol-sup',
      });
      expect(find.text('Editar usuario'), findsNothing);
      expect(find.text('Usuario actualizado'), findsOneWidget);
    });

    testWidgets('editar muestra ULTIMO_ADMIN_SISTEMA bajo el rol', (
      tester,
    ) async {
      const mensaje =
          'Es el único usuario con el rol de administrador del sistema; '
          'asigna ese rol a otra persona antes de cambiarlo.';
      await _montar(
        tester,
        () => const UsuariosPlazaPage(),
        _rutas(
          extra: {
            'PATCH /usuarios/:id': (_) => const RespuestaFalsa(409, {
              'code': 'ULTIMO_ADMIN_SISTEMA',
              'detail': mensaje,
            }),
          },
        ),
      );
      await _tocar(tester, find.text('Editar').first);
      await _elegir(
        tester,
        find.byKey(const Key('usuario-rol')),
        'Supervisor nocturno (supervisor-nocturno)',
      );
      await tester.tap(find.byKey(const Key('editar-guardar')));
      await tester.pumpAndSettle();
      // El diálogo sigue abierto con el error junto al selector.
      expect(find.text('Editar usuario'), findsOneWidget);
      expect(find.text(mensaje), findsOneWidget);
    });

    testWidgets('alta muestra la contraseña temporal una sola vez', (
      tester,
    ) async {
      await _montar(
        tester,
        () => const UsuariosPlazaPage(),
        _rutas(extra: {'POST /usuarios': (_) => _usuario(7)}),
      );
      await _tocar(tester, find.text('Nuevo usuario'));
      await tester.tap(find.byKey(const Key('alta-crear')));
      await tester.pumpAndSettle();
      expect(find.text('Email inválido'), findsWidgets);
      expect(find.text('Selecciona un rol de staff'), findsOneWidget);

      await tester.enterText(
        find.byKey(const Key('alta-email')),
        ' Nuevo.Admin@Demo.com ',
      );
      await tester.enterText(find.byKey(const Key('alta-nombre')), 'Ana Ruiz');
      await _elegir(
        tester,
        find.byKey(const Key('usuario-rol')),
        'Técnico de mantenimiento de instalaciones (tecnico)',
      );
      await tester.tap(find.byKey(const Key('alta-crear')));
      await tester.pumpAndSettle();

      final body = cuerpoDe(_peticiones('POST', '/usuarios').single);
      expect(body['email'], 'nuevo.admin@demo.com');
      expect(body['rol'], 'admin_plaza');
      expect(body['rolStaffId'], 'rol-tec');
      expect(body.containsKey('telefono'), isFalse);
      final password = body['password'] as String;
      expect(password, matches(RegExp(r'^Tmp[A-Za-z0-9_-]{12}1a$')));
      expect(find.text(password), findsOneWidget);
      expect(find.textContaining('no se volverá a mostrar'), findsOneWidget);

      await tester.tap(find.text('Entendido'));
      await tester.pumpAndSettle();
      expect(find.text(password), findsNothing);
    });

    testWidgets('deshabilitar: Volver no llama a la API; con motivo sí', (
      tester,
    ) async {
      await _montar(
        tester,
        () => const UsuariosPlazaPage(),
        _rutas(
          extra: {'DELETE /usuarios/:id': (_) => const RespuestaFalsa(204)},
        ),
      );
      await _tocar(tester, find.text('Deshabilitar').first);
      expect(
        find.textContaining('queda registrado en auditoría'),
        findsOneWidget,
      );
      await tester.tap(find.text('Volver'));
      await tester.pumpAndSettle();
      expect(_peticiones('DELETE', '/usuarios/u-1'), isEmpty);

      await _tocar(tester, find.text('Deshabilitar').first);
      await tester.enterText(
        find.byKey(const Key('dialogo-texto')),
        'Renuncia del empleado',
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('dialogo-confirmar')));
      await tester.pumpAndSettle();
      final delete = _peticiones('DELETE', '/usuarios/u-1').single;
      expect(cuerpoDe(delete), {'motivo': 'Renuncia del empleado'});
      expect(find.text('Usuario deshabilitado'), findsOneWidget);
    });

    testWidgets('sin permisos oculta las acciones', (tester) async {
      await _montar(
        tester,
        () => const UsuariosPlazaPage(),
        _rutas(),
        sesion: sesionDe(Rol.adminPlaza, permisos: ['usuarios_plaza.listar']),
      );
      for (final texto in [
        'Nuevo usuario',
        'Editar',
        'Resetear clave',
        'Deshabilitar',
      ]) {
        expect(find.text(texto), findsNothing, reason: texto);
      }
    });

    testWidgets('nuevo rol (código en minúsculas) y editar rol', (
      tester,
    ) async {
      await _montar(
        tester,
        () => const UsuariosPlazaPage(tab: 'roles'),
        _rutas(
          extra: {
            'POST /roles-staff': (_) => _roles[2],
            'PATCH /roles-staff/:id': (_) => _roles[1],
          },
        ),
      );
      await _tocar(tester, find.text('Nuevo rol'));
      await tester.enterText(find.byKey(const Key('rol-codigo')), 'Mal código');
      await tester.enterText(
        find.byKey(const Key('rol-nombre')),
        'Electricista',
      );
      await _tocar(tester, find.byKey(const Key('rol-guardar')));
      expect(
        find.text(
          'El código solo puede contener minúsculas, dígitos y guiones',
        ),
        findsOneWidget,
      );
      await tester.enterText(
        find.byKey(const Key('rol-codigo')),
        'Electricista-1',
      );
      await _tocar(tester, find.byKey(const Key('rol-guardar')));
      expect(cuerpoDe(_peticiones('POST', '/roles-staff').single), {
        'codigo': 'electricista-1',
        'nombre': 'Electricista',
      });
      expect(find.text('Rol creado'), findsOneWidget);

      await _tocar(tester, find.text('Editar').first);
      expect(find.text('Inmutable tras la creación.'), findsOneWidget);
      await tester.enterText(find.byKey(const Key('rol-descripcion')), '');
      await _tocar(tester, find.byKey(const Key('rol-activo')));
      await _tocar(tester, find.byKey(const Key('rol-guardar')));
      expect(cuerpoDe(_peticiones('PATCH', '/roles-staff/rol-tec').single), {
        'nombre': 'Técnico de mantenimiento de instalaciones',
        'descripcion': null,
        'activo': false,
      });
      expect(find.text('Rol actualizado'), findsOneWidget);
    });

    testWidgets('diálogos de usuario y rol caben en teléfono y tablet', (
      tester,
    ) async {
      final overrides = overridesBase(
        apiFalsa(_rutas()),
        sesion: sesionDe(Rol.adminPlaza),
      );
      await probarEnTamanos(
        tester,
        () => const Scaffold(body: UsuariosPlazaPage()),
        overrides: overrides,
        alPintar: (_, _) async {
          await _tocar(tester, find.text('Nuevo usuario'));
          // Con los errores de validación visibles.
          await _tocar(tester, find.byKey(const Key('alta-crear')));
          await _tocar(tester, find.text('Cancelar').last);
          await _tocar(tester, find.text('Editar').first);
          await _tocar(tester, find.text('Cancelar').last);
        },
      );
      await probarEnTamanos(
        tester,
        () => const Scaffold(body: UsuariosPlazaPage(tab: 'roles')),
        overrides: overrides,
        alPintar: (_, _) async {
          await _tocar(tester, find.text('Nuevo rol'));
          await _tocar(tester, find.byKey(const Key('rol-guardar')));
          await _tocar(tester, find.text('Cancelar').last);
          await _tocar(tester, find.text('Editar').first);
          await _tocar(tester, find.text('Cancelar').last);
        },
      );
    });

    testWidgets('detalle de usuario responsive', (tester) async {
      await probarEnTamanos(
        tester,
        () => const Scaffold(body: UsuarioPlazaPage(id: 'u-1')),
        overrides: overridesBase(
          apiFalsa(_rutas()),
          sesion: sesionDe(Rol.adminPlaza),
        ),
        alPintar: (_, _) async {
          expect(find.text('Identidad'.toUpperCase()), findsOneWidget);
          expect(find.text('admin_plaza'), findsOneWidget);
          expect(find.text('Editar'), findsOneWidget);
        },
      );
    });
  });

  group('Matriz de permisos', () {
    testWidgets('responsive con el rol de sistema bloqueado', (tester) async {
      await probarEnTamanos(
        tester,
        () => const Scaffold(body: MatrizPermisosPage()),
        overrides: overridesBase(
          apiFalsa(_rutas()),
          sesion: sesionDe(Rol.adminPlaza),
        ),
        alPintar: (_, _) async {
          expect(
            find.text('5 permisos · 4 rol(es) · 1 de sistema'),
            findsOneWidget,
          );
          // Por defecto se edita el primer rol que no es de sistema.
          expect(
            find.text('Técnico de mantenimiento de instalaciones'),
            findsOneWidget,
          );
          // Las convenciones (plegadas) también caben al abrirlas.
          await tester.tap(find.text('Convenciones del sistema RBAC'));
          await tester.pumpAndSettle();
          expect(find.textContaining('npx prisma db seed'), findsOneWidget);
        },
      );
    });

    testWidgets('marcar "todos" de un módulo y guardar envía el set completo', (
      tester,
    ) async {
      await _montar(
        tester,
        () => const MatrizPermisosPage(),
        _rutas(
          extra: {
            'PUT /permisos/roles/:id': (req) => {
              'rolStaffId': 'rol-tec',
              'esSistema': false,
              'permisos': <Object?>[],
            },
          },
        ),
      );
      expect(find.text('0 rol(es) con cambios pendientes'), findsOneWidget);
      await _tocar(tester, find.byKey(const Key('todos-categorias')));
      expect(find.text('Cambios sin guardar'), findsOneWidget);
      expect(find.text('1 rol(es) con cambios pendientes'), findsOneWidget);

      await _tocar(tester, find.byKey(const Key('matriz-guardar-rol-tec')));
      expect(find.textContaining('Se asignarán 4 permiso(s)'), findsOneWidget);
      await tester.tap(find.text('Sí, guardar'));
      await tester.pumpAndSettle();

      final put = _peticiones('PUT', '/permisos/roles/rol-tec').single;
      expect((cuerpoDe(put)['permisoIds'] as List<Object?>).toSet(), {
        'p-cat-listar',
        'p-cat-crear',
        'p-sub-editar',
        'p-usr-listar',
      });
      expect(
        find.text(
          'Permisos del rol "Técnico de mantenimiento de instalaciones" '
          'actualizados',
        ),
        findsOneWidget,
      );
      expect(find.text('0 rol(es) con cambios pendientes'), findsOneWidget);
    });

    testWidgets('Descartar revierte los cambios sin llamar a la API', (
      tester,
    ) async {
      await _montar(tester, () => const MatrizPermisosPage(), _rutas());
      await _tocar(tester, find.byKey(const Key('permiso-categorias.crear')));
      expect(find.text('1 rol(es) con cambios pendientes'), findsOneWidget);
      await _tocar(tester, find.text('Descartar'));
      expect(find.text('0 rol(es) con cambios pendientes'), findsOneWidget);
      expect(_peticiones('PUT', '/permisos/roles/rol-tec'), isEmpty);
    });

    testWidgets('el rol de sistema no se puede editar', (tester) async {
      await _montar(tester, () => const MatrizPermisosPage(), _rutas());
      await _elegir(
        tester,
        find.byKey(const Key('matriz-rol')),
        'Administrador del sistema (sistema)',
      );
      expect(
        find.textContaining('El rol del sistema es inamovible'),
        findsOneWidget,
      );
      expect(find.byKey(const Key('todos-categorias')), findsNothing);
      final tile = tester.widget<CheckboxListTile>(
        find.byKey(const Key('permiso-categorias.crear')),
      );
      expect(tile.value, isTrue);
      expect(tile.onChanged, isNull);
    });

    testWidgets('sin permiso muestra "Sin acceso" y no llama a la API', (
      tester,
    ) async {
      await _montar(
        tester,
        () => const MatrizPermisosPage(),
        _rutas(),
        sesion: sesionDe(Rol.adminPlaza, permisos: ['usuarios_plaza.listar']),
      );
      expect(find.text('Sin acceso'), findsOneWidget);
      expect(_peticiones('GET', '/permisos'), isEmpty);
    });
  });
}

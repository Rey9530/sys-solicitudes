import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend_mobil/core/api/api_client.dart';
import 'package:frontend_mobil/core/auth/sesion.dart';
import 'package:frontend_mobil/core/auth/sesion_controller.dart';

import '../helpers/api_falsa.dart';
import '../helpers/pantallas.dart';

/// Contenedor con la sesión [sesion] ya cargada y la API falsa [api].
Future<ProviderContainer> _contenedor(ApiClient api, Sesion sesion) async {
  final c = ProviderContainer(overrides: overridesBase(api, sesion: sesion));
  addTearDown(c.dispose);
  await c.read(sesionProvider.future);
  return c;
}

void main() {
  setUp(prepararPruebas);

  final admin = sesionDe(Rol.adminPlaza, permisos: ['locales.listar']);

  test('refrescarPermisos actualiza los permisos', () async {
    final c = await _contenedor(
      apiFalsa({
        'GET /auth/me/permisos': (_) => {
          'permisos': ['locales.listar', 'contratos.listar'],
        },
      }),
      admin,
    );
    await c.read(sesionProvider.notifier).refrescarPermisos();
    expect(c.read(sesionProvider).value!.permisos, [
      'locales.listar',
      'contratos.listar',
    ]);
  });

  test('refrescarPermisos con error no lanza y conserva la sesión', () async {
    final c = await _contenedor(
      apiFalsa({
        'GET /auth/me/permisos': (_) =>
            const RespuestaFalsa(503, {'code': 'SERVICE_UNAVAILABLE'}),
      }),
      admin,
    );
    await c.read(sesionProvider.notifier).refrescarPermisos();
    expect(c.read(sesionProvider).value!.permisos, ['locales.listar']);
  });

  test('refrescarPermisos no revive una sesión cerrada mientras viajaba la '
      'petición', () async {
    final c = await _contenedor(
      apiFalsa({
        'GET /auth/me/permisos': (_) => {
          'permisos': ['*'],
        },
      }),
      admin,
    );
    final notifier = c.read(sesionProvider.notifier);
    final enCurso = notifier.refrescarPermisos();
    // El refresh rechazado cierra la sesión antes de que llegue la respuesta.
    notifier.sesionExpirada();
    await enCurso;
    expect(c.read(sesionProvider).value, isNull);
  });

  test('recargar relee el usuario (rol de staff) y sus permisos', () async {
    final c = await _contenedor(
      apiFalsa({
        'GET /auth/me': (_) => {
          'id': admin.usuario.id,
          'email': admin.usuario.email,
          'nombre': 'Nombre nuevo',
          'rol': 'admin_plaza',
          'plazaId': 'plaza-demo',
          'rolStaffId': 'rol-supervisor',
          'inquilinoId': null,
        },
        'GET /auth/me/permisos': (_) => {
          'permisos': ['solicitudes.listar'],
        },
      }),
      admin,
    );
    await c.read(sesionProvider.notifier).recargar();
    final s = c.read(sesionProvider).value!;
    expect(s.usuario.nombre, 'Nombre nuevo');
    expect(s.usuario.rolStaffId, 'rol-supervisor');
    expect(s.permisos, ['solicitudes.listar']);
  });
}

import 'package:flutter_test/flutter_test.dart';
import 'package:frontend_mobil/core/auth/permisos.dart';
import 'package:frontend_mobil/core/auth/sesion.dart';
import 'package:frontend_mobil/core/navegacion/menu.dart';

import '../helpers/pantallas.dart';

void main() {
  test('reglas de puedeCon', () {
    expect(puedeCon(['*'], 'x'), isTrue);
    expect(puedeCon(['a'], ['b', 'a']), isTrue);
    expect(puedeCon(['a'], 'b'), isFalse);
    expect(puedeCon([], 'a'), isFalse);
    expect(puedeCon(['a'], <String>[]), isFalse);
  });

  test('menú del admin se filtra por permisos', () {
    final s = sesionDe(Rol.adminPlaza, permisos: ['locales.listar']);
    final rutas = menuPara(s, conPlaza: false).map((i) => i.ruta).toList();
    expect(rutas, ['/admin/dashboard', '/admin/locales']);
  });

  test('superadmin sin plaza ve solo lo global; con plaza, sin calendario ni configuración', () {
    final s = sesionDe(Rol.superadmin);
    expect(menuPara(s, conPlaza: false).map((i) => i.ruta), [
      '/superadmin/dashboard',
      '/superadmin/plazas',
      '/superadmin/solicitudes',
    ]);
    final conPlaza = menuPara(s, conPlaza: true).map((i) => i.ruta).toList();
    expect(conPlaza, contains('/admin/solicitudes'));
    expect(conPlaza, isNot(contains('/admin/calendario')));
    expect(conPlaza, isNot(contains('/admin/configuracion')));
  });

  test('inquilino incluye Mis contratos', () {
    final rutas = menuPara(
      sesionDe(Rol.inquilino),
      conPlaza: false,
    ).map((i) => i.ruta);
    expect(rutas, [
      '/inquilino/solicitudes',
      '/inquilino/calendario',
      '/inquilino/contratos',
    ]);
  });
}

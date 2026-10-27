import '../format/texto.dart';
import 'permisos.dart';

/// Rol global del usuario (un usuario = una plaza y un rol, S-MT-C).
enum Rol {
  superadmin('superadmin', 'Superadmin'),
  adminPlaza('admin_plaza', 'Admin de plaza'),
  inquilino('inquilino', 'Inquilino');

  const Rol(this.codigo, this.etiqueta);
  final String codigo;
  final String etiqueta;

  static Rol desdeCodigo(String? codigo) => Rol.values.firstWhere(
    (r) => r.codigo == codigo,
    orElse: () => Rol.inquilino,
  );
}

/// Usuario autenticado (respuesta de `POST /auth/login` o `GET /auth/me`).
class Usuario {
  const Usuario({
    required this.id,
    required this.email,
    required this.nombre,
    required this.rol,
    this.plazaId,
    this.rolStaffId,
    this.inquilinoId,
  });

  factory Usuario.fromJson(Map<String, dynamic> j) => Usuario(
    id: j['id'] as String,
    email: j['email'] as String,
    nombre: decodificarHtml(j['nombre'] as String?),
    rol: Rol.desdeCodigo(j['rol'] as String?),
    plazaId: j['plazaId'] as String?,
    rolStaffId: j['rolStaffId'] as String?,
    inquilinoId: j['inquilinoId'] as String?,
  );

  final String id;
  final String email;
  final String nombre;
  final Rol rol;
  final String? plazaId;
  final String? rolStaffId;
  final String? inquilinoId;
}

/// Sesión activa: usuario + permisos efectivos (`GET /auth/me/permisos`).
class Sesion {
  const Sesion({required this.usuario, required this.permisos});

  final Usuario usuario;
  final List<String> permisos;

  Rol get rol => usuario.rol;

  /// [permiso] es un código (`'solicitudes.aprobar'`) o una lista (OR).
  bool puede(Object permiso) => puedeCon(permisos, permiso);
}

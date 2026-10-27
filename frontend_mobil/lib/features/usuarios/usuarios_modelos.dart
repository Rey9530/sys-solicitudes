import '../../core/format/texto.dart';

/// Código del rol de staff de sistema (creado con la plaza, con todos los
/// permisos). `RolStaffOutput` no expone `esSistema`; el web lo detecta así.
const codigoRolSistema = 'admin';

/// Usuario `admin_plaza` (`UsuarioOutput & { rolStaffActivo, rolStaffNombre }`).
class UsuarioPlaza {
  const UsuarioPlaza({
    required this.id,
    required this.email,
    required this.nombre,
    this.telefono,
    this.rolStaffId,
    this.rolStaffNombre,
    this.rolStaffActivo,
    this.emailInvalido = false,
    this.lastLoginAt,
    this.deletedAt,
  });

  factory UsuarioPlaza.fromJson(Map<String, dynamic> j) {
    final telefono = decodificarHtml(j['telefono'] as String?);
    final rolNombre = decodificarHtml(j['rolStaffNombre'] as String?);
    return UsuarioPlaza(
      id: j['id'] as String,
      email: j['email'] as String? ?? '',
      nombre: decodificarHtml(j['nombre'] as String?),
      telefono: telefono.isEmpty ? null : telefono,
      rolStaffId: j['rolStaffId'] as String?,
      rolStaffNombre: rolNombre.isEmpty ? null : rolNombre,
      rolStaffActivo: j['rolStaffActivo'] as bool?,
      emailInvalido: j['emailInvalido'] as bool? ?? false,
      lastLoginAt: j['lastLoginAt'] as String?,
      deletedAt: j['deletedAt'] as String?,
    );
  }

  final String id;
  final String email;
  final String nombre;
  final String? telefono;
  final String? rolStaffId;
  final String? rolStaffNombre;
  final bool? rolStaffActivo;
  final bool emailInvalido;

  /// Instantes ISO (se formatean en hora de la plaza al mostrarlos).
  final String? lastLoginAt;
  final String? deletedAt;

  bool get deshabilitado => deletedAt != null;
}

/// Rol de staff de la plaza (`RolStaffOutput`; [usuariosAsignados] solo en
/// `GET /roles-staff/con-asignaciones`).
class RolStaff {
  const RolStaff({
    required this.id,
    required this.codigo,
    required this.nombre,
    required this.activo,
    this.descripcion,
    this.usuariosAsignados = 0,
  });

  factory RolStaff.fromJson(Map<String, dynamic> j) {
    final descripcion = decodificarHtml(j['descripcion'] as String?);
    return RolStaff(
      id: j['id'] as String,
      codigo: j['codigo'] as String? ?? '',
      nombre: decodificarHtml(j['nombre'] as String?),
      descripcion: descripcion.isEmpty ? null : descripcion,
      activo: j['activo'] as bool? ?? true,
      usuariosAsignados: (j['usuariosAsignados'] as num?)?.toInt() ?? 0,
    );
  }

  final String id;
  final String codigo;
  final String nombre;
  final String? descripcion;
  final bool activo;
  final int usuariosAsignados;

  bool get esSistema => codigo == codigoRolSistema;
}

/// Permiso del catálogo global (`PermisoOutput`). El código puede tener 3
/// segmentos (`solicitudes.bandeja.ver`): no se valida su forma.
class Permiso {
  const Permiso({
    required this.id,
    required this.codigo,
    required this.accion,
    this.descripcion,
  });

  factory Permiso.fromJson(Map<String, dynamic> j) => Permiso(
    id: j['id'] as String,
    codigo: j['codigo'] as String? ?? '',
    accion: j['accion'] as String? ?? '',
    descripcion: j['descripcion'] as String?,
  );

  final String id;
  final String codigo;
  final String accion;
  final String? descripcion;
}

/// Permisos de un módulo del catálogo.
class ModuloPermisos {
  const ModuloPermisos({required this.modulo, required this.permisos});

  factory ModuloPermisos.fromJson(Map<String, dynamic> j) => ModuloPermisos(
    modulo: j['modulo'] as String? ?? '',
    permisos: (j['permisos'] as List<dynamic>? ?? const [])
        .cast<Map<String, dynamic>>()
        .map(Permiso.fromJson)
        .toList(),
  );

  final String modulo;
  final List<Permiso> permisos;
}

/// Catálogo de permisos agrupado por módulo (`GET /permisos`).
class CatalogoPermisos {
  const CatalogoPermisos({required this.total, required this.modulos});

  factory CatalogoPermisos.fromJson(Map<String, dynamic> j) => CatalogoPermisos(
    total: (j['total'] as num?)?.toInt() ?? 0,
    modulos: (j['modulos'] as List<dynamic>? ?? const [])
        .cast<Map<String, dynamic>>()
        .map(ModuloPermisos.fromJson)
        .toList(),
  );

  final int total;
  final List<ModuloPermisos> modulos;
}

/// Permisos asignados a un rol (`GET /permisos/roles/:id`).
class PermisosDeRol {
  const PermisosDeRol({required this.esSistema, required this.permisoIds});

  factory PermisosDeRol.fromJson(Map<String, dynamic> j) => PermisosDeRol(
    esSistema: j['esSistema'] as bool? ?? false,
    permisoIds: {
      for (final p in (j['permisos'] as List<dynamic>? ?? const []))
        (p as Map<String, dynamic>)['id'] as String,
    },
  );

  final bool esSistema;
  final Set<String> permisoIds;
}

/// Todo lo que pinta la matriz de permisos.
class DatosMatriz {
  const DatosMatriz({
    required this.catalogo,
    required this.roles,
    required this.permisosPorRol,
    required this.rolesSistema,
  });

  final CatalogoPermisos catalogo;
  final List<RolStaff> roles;

  /// Id de rol → ids de permiso asignados.
  final Map<String, Set<String>> permisosPorRol;

  /// Ids de los roles de sistema (no editables).
  final Set<String> rolesSistema;
}

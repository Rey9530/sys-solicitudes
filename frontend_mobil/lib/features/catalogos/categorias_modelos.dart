import '../../core/format/texto.dart';

/// Prioridades de una subcategoría (se heredan a las solicitudes nuevas).
const prioridadesSubcategoria = ['A', 'B', 'C', 'D', 'F'];

/// Tope de supervisores por subcategoría (trigger del backend).
const maxSupervisores = 5;

/// Texto opcional recibido del backend: `null` si viene vacío.
String? _textoOpcional(Object? valor) {
  final texto = decodificarHtml(valor as String?);
  return texto.isEmpty ? null : texto;
}

/// Admin de plaza referenciado como responsable o supervisor
/// (`{ id, nombre, email }` del backend).
class PersonaStaff {
  const PersonaStaff({
    required this.id,
    required this.nombre,
    required this.email,
  });

  factory PersonaStaff.fromJson(Map<String, dynamic> j) => PersonaStaff(
    id: j['id'] as String,
    nombre: decodificarHtml(j['nombre'] as String?),
    email: j['email'] as String? ?? '',
  );

  final String id;
  final String nombre;
  final String email;

  /// Texto de los selectores del web: `Nombre (email)`.
  String get etiqueta => '$nombre ($email)';
}

/// Categoría de solicitudes (`CategoriaOutput` / `CategoriaDetailOutput`).
/// [subcategorias] solo viene en el detalle (y solo las activas).
class Categoria {
  const Categoria({
    required this.id,
    required this.nombre,
    required this.activo,
    this.descripcion,
    this.subcategorias = const [],
  });

  factory Categoria.fromJson(Map<String, dynamic> j) => Categoria(
    id: j['id'] as String,
    nombre: decodificarHtml(j['nombre'] as String?),
    descripcion: _textoOpcional(j['descripcion']),
    activo: j['activo'] as bool? ?? true,
    subcategorias: (j['subcategorias'] as List<dynamic>? ?? const [])
        .cast<Map<String, dynamic>>()
        .map(Subcategoria.fromJson)
        .toList(),
  );

  final String id;
  final String nombre;
  final String? descripcion;
  final bool activo;
  final List<Subcategoria> subcategorias;
}

/// Subcategoría con su responsable y supervisores
/// (`SubcategoriaDetailOutput`).
class Subcategoria {
  const Subcategoria({
    required this.id,
    required this.categoriaId,
    required this.nombre,
    required this.prioridad,
    required this.activo,
    required this.responsableId,
    this.descripcion,
    this.responsable,
    this.supervisores = const [],
  });

  factory Subcategoria.fromJson(Map<String, dynamic> j) => Subcategoria(
    id: j['id'] as String,
    categoriaId: j['categoriaId'] as String? ?? '',
    nombre: decodificarHtml(j['nombre'] as String?),
    descripcion: _textoOpcional(j['descripcion']),
    prioridad: j['prioridad'] as String? ?? 'B',
    activo: j['activo'] as bool? ?? true,
    responsableId: j['responsableId'] as String? ?? '',
    responsable: j['responsable'] == null
        ? null
        : PersonaStaff.fromJson(j['responsable'] as Map<String, dynamic>),
    supervisores: (j['supervisores'] as List<dynamic>? ?? const [])
        .cast<Map<String, dynamic>>()
        .map(PersonaStaff.fromJson)
        .toList(),
  );

  final String id;
  final String categoriaId;
  final String nombre;
  final String? descripcion;
  final String prioridad;
  final bool activo;
  final String responsableId;
  final PersonaStaff? responsable;
  final List<PersonaStaff> supervisores;
}

/// Configuración de un tipo de solicitud por plaza
/// (`SolicitudTipoConfigOutput`). Son 4 fijos: no se crean ni eliminan.
class TipoSolicitudConfig {
  const TipoSolicitudConfig({
    required this.id,
    required this.codigo,
    required this.etiqueta,
    required this.activo,
    required this.orden,
    this.descripcion,
  });

  factory TipoSolicitudConfig.fromJson(Map<String, dynamic> j) =>
      TipoSolicitudConfig(
        id: j['id'] as String,
        codigo: j['codigo'] as String? ?? '',
        etiqueta: decodificarHtml(j['etiqueta'] as String?),
        descripcion: _textoOpcional(j['descripcion']),
        activo: j['activo'] as bool? ?? true,
        orden: (j['orden'] as num?)?.toInt() ?? 0,
      );

  final String id;
  final String codigo;
  final String etiqueta;
  final String? descripcion;
  final bool activo;
  final int orden;
}

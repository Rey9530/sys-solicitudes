import '../../core/format/texto.dart';
import '../contratos/contratos_modelos.dart';

/// Campos de texto opcionales del inquilino (mismos nombres que la API).
/// `razonSocial` e `identificacion` van aparte: son inmutables tras crear.
const camposTextoInquilino = [
  'nombreComercial',
  'representanteLegal',
  'numeroNrc',
  'correoRecepcionDte',
  'numeroTelefono',
  'direccion',
  'contacto1Nombre',
  'contacto1Cargo',
  'contacto1Email',
  'contacto1Telefono',
  'contacto2Nombre',
  'contacto2Cargo',
  'contacto2Email',
  'contacto2Telefono',
  'giroAutorizado',
  'categoria',
  'subcategoria',
  'comentarios',
];

/// Opciones de "Tipo de cliente" (`InquilinoTipoClienteSchema`).
const tiposCliente = [
  ('grande', 'Grande'),
  ('mediano', 'Mediano'),
  ('otro', 'Otro'),
];

/// Filtros del listado (`/admin/inquilinos`): *contains* sin distinguir
/// mayúsculas.
typedef FiltroInquilinos = ({
  int pagina,
  String? razonSocial,
  String? identificacion,
});

/// Inquilino (`InquilinoOutput`). Los textos opcionales viven en [campos],
/// con la misma clave que la API (ver [camposTextoInquilino]).
class Inquilino {
  const Inquilino({
    required this.id,
    required this.razonSocial,
    required this.campos,
    this.identificacion,
    this.tipoCliente,
  });

  factory Inquilino.fromJson(Map<String, dynamic> j) => Inquilino(
    id: j['id'] as String,
    razonSocial: decodificarHtml(j['razonSocial'] as String?),
    identificacion: _texto(j['identificacion']),
    tipoCliente: j['tipoCliente'] as String?,
    campos: {for (final k in camposTextoInquilino) k: _texto(j[k])},
  );

  final String id;
  final String razonSocial;

  /// NIT.
  final String? identificacion;

  /// `grande | mediano | otro | null`
  final String? tipoCliente;
  final Map<String, String?> campos;

  String? get nombreComercial => campos['nombreComercial'];
  String? get contacto1Nombre => campos['contacto1Nombre'];
  String? get contacto1Email => campos['contacto1Email'];

  /// "grande" → "Grande" (como la columna "Tipo" del web).
  String? get tipoClienteEtiqueta => tipoCliente == null || tipoCliente!.isEmpty
      ? null
      : '${tipoCliente![0].toUpperCase()}${tipoCliente!.substring(1)}';
}

/// Detalle (`InquilinoDetailOutput`): contratos vigentes e histórico.
class InquilinoDetalle {
  const InquilinoDetalle({
    required this.inquilino,
    required this.contratosVigentes,
    required this.historicoContratos,
  });

  factory InquilinoDetalle.fromJson(Map<String, dynamic> j) => InquilinoDetalle(
    inquilino: Inquilino.fromJson(j),
    contratosVigentes: _contratos(j['contratosVigentes']),
    historicoContratos: _contratos(j['historicoContratos']),
  );

  final Inquilino inquilino;
  final List<Contrato> contratosVigentes;
  final List<Contrato> historicoContratos;

  bool get tieneVigente => contratosVigentes.isNotEmpty;
}

/// Usuario con acceso al portal del inquilino (`UsuarioOutput`).
class UsuarioInquilino {
  const UsuarioInquilino({
    required this.id,
    required this.email,
    required this.nombre,
    required this.emailInvalido,
    this.telefono,
    this.lastLoginAt,
    this.deletedAt,
    this.rolStaffNombre,
  });

  factory UsuarioInquilino.fromJson(Map<String, dynamic> j) => UsuarioInquilino(
    id: j['id'] as String,
    email: j['email'] as String? ?? '',
    nombre: decodificarHtml(j['nombre'] as String?),
    telefono: j['telefono'] as String?,
    emailInvalido: j['emailInvalido'] as bool? ?? false,
    lastLoginAt: j['lastLoginAt'] as String?,
    deletedAt: j['deletedAt'] as String?,
    rolStaffNombre: _texto(j['rolStaffNombre']),
  );

  final String id;
  final String email;
  final String nombre;
  final String? telefono;
  final bool emailInvalido;
  final String? lastLoginAt;

  /// No nulo = deshabilitado (no puede iniciar sesión).
  final String? deletedAt;

  /// Siempre `null` en inquilinos ("—").
  final String? rolStaffNombre;

  bool get activo => deletedAt == null;
}

String? _texto(Object? v) => v is String ? decodificarHtml(v) : null;

List<Contrato> _contratos(Object? v) => [
  for (final c in v as List? ?? const [])
    Contrato.fromJson(c as Map<String, dynamic>),
];

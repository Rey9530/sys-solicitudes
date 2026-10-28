// Validaciones de formulario compartidas.

// ── Email ───────────────────────────────────────────────────────────────────

/// Email básico (mismo regex que el web): `algo@algo.algo`, sin espacios.
final _regexEmail = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');

/// ¿[email] tiene formato de email? Ignora espacios al inicio y al final.
bool esEmailValido(String email) => _regexEmail.hasMatch(email.trim());

/// Texto de error de los campos de email de los formularios.
const textoEmailInvalido = 'Email inválido';

/// Validador de un email obligatorio (vacío también es inválido).
String? validarEmailObligatorio(String? v) =>
    esEmailValido(v ?? '') ? null : textoEmailInvalido;

/// Validador de un email opcional: vacío es válido.
String? validarEmailOpcional(String? v) =>
    (v ?? '').trim().isEmpty ? null : validarEmailObligatorio(v);

// ── Números de formulario ───────────────────────────────────────────────────

/// `"1.5"` o `"1,5"` → `1.5`; vacío o inválido → `null`.
double? numeroDe(String texto) =>
    double.tryParse(texto.trim().replaceAll(',', '.'));

/// `"12"` → `12`; vacío o inválido → `null`.
int? enteroDe(String texto) => int.tryParse(texto.trim());

/// Texto que llega del backend → texto del campo (`null` → vacío).
String textoDe(Object? valor) => switch (valor) {
  null => '',
  final double d when d == d.roundToDouble() => d.toStringAsFixed(0),
  _ => '$valor',
};

/// Número opcional dentro de un rango. Vacío es válido.
String? validarNumero(
  String? v, {
  double min = 0,
  required double max,
  bool entero = false,
  bool positivo = false,
}) {
  final texto = (v ?? '').trim();
  if (texto.isEmpty) return null;
  final n = numeroDe(texto);
  if (n == null) return 'Número inválido';
  if (entero && n != n.roundToDouble()) return 'Debe ser un número entero';
  if (positivo && n <= 0) return 'Debe ser mayor que 0';
  if (n < min || n > max) {
    return 'Debe estar entre ${textoDe(min)} y ${textoDe(max)}';
  }
  return null;
}

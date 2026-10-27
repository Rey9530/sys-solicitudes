// Validaciones de formulario compartidas.

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

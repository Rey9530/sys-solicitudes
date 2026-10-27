import '../../core/api/api_client.dart';

/// Pide el enlace de restablecimiento (el backend responde igual exista o no
/// el correo). El enlace del email abre el web.
Future<void> solicitarResetPassword(ApiClient api, String email) async {
  await api.publico(
    'POST',
    '/auth/reset-password',
    body: {'email': email.trim().toLowerCase()},
  );
}

/// Cambia la contraseña. El backend revoca todas las sesiones: quien llama
/// debe cerrar la sesión local.
Future<void> cambiarPassword(
  ApiClient api, {
  required String actual,
  required String nueva,
}) async {
  await api.patch(
    '/auth/change-password',
    body: {'currentPassword': actual, 'newPassword': nueva},
  );
}

/// Política de contraseña del backend (`PasswordSchema`): 8–128 caracteres con
/// minúscula, mayúscula y dígito. Devuelve el error o `null`.
String? validarPasswordNueva(String? v) {
  final valor = v ?? '';
  if (valor.isEmpty) return 'Este campo es obligatorio.';
  if (valor.length < 8) return 'Debe tener al menos 8 caracteres.';
  if (valor.length > 128) return 'Máximo 128 caracteres.';
  final ok =
      RegExp('[a-z]').hasMatch(valor) &&
      RegExp('[A-Z]').hasMatch(valor) &&
      RegExp(r'\d').hasMatch(valor);
  return ok ? null : 'La contraseña debe incluir mayúscula, minúscula y dígito';
}

/// Validación de email del formulario.
String? validarEmail(String? v) {
  final valor = (v ?? '').trim();
  if (valor.isEmpty) return 'Este campo es obligatorio.';
  final ok = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(valor);
  return ok ? null : 'Correo electrónico inválido.';
}

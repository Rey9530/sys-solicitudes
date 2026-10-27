import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_error.dart';
import '../api/api_providers.dart';
import '../plaza/plaza_seleccionada.dart';
import 'sesion.dart';

/// Sesión de la app. `null` = sin sesión (pantalla de login).
///
/// Al abrir la app restaura la sesión si hay tokens guardados (`/auth/me` +
/// `/auth/me/permisos`). El login y el logout se llaman desde las pantallas;
/// los errores de login se lanzan como [ApiError] para que la pantalla los
/// muestre (el estado no pasa a error).
class SesionController extends AsyncNotifier<Sesion?> {
  /// La sesión terminó porque el backend rechazó el refresh (vencida,
  /// revocada o plaza desactivada). El login lo muestra como aviso.
  bool expiro = false;

  @override
  Future<Sesion?> build() async {
    final api = ref.read(apiClientProvider);
    if (!await api.tieneSesion()) return null;
    try {
      return await _cargar();
    } on ApiError catch (e) {
      if (e.status == 401 || e.status == 403 || e.status == 404) {
        await api.logout();
        return null;
      }
      rethrow;
    }
  }

  Future<Sesion> _cargar() async {
    final api = ref.read(apiClientProvider);
    final me = await api.get('/auth/me') as Map<String, dynamic>;
    final permisos = await api.get('/auth/me/permisos') as Map<String, dynamic>;
    return Sesion(
      usuario: Usuario.fromJson(me),
      permisos: (permisos['permisos'] as List<dynamic>).cast<String>(),
    );
  }

  /// Lanza [ApiError] si falla (credenciales, bloqueo, límite, plaza inactiva).
  Future<void> iniciarSesion(String email, String password) async {
    final api = ref.read(apiClientProvider);
    final r = await api.login(email.trim().toLowerCase(), password);
    final user = r['user'] as Map<String, dynamic>;
    final permisos = (user['permisos'] as List<dynamic>?)?.cast<String>();
    expiro = false;
    state = AsyncData(
      permisos != null
          ? Sesion(usuario: Usuario.fromJson(user), permisos: permisos)
          : await _cargar(),
    );
  }

  Future<void> cerrarSesion() async {
    await ref.read(apiClientProvider).logout();
    await ref.read(plazaSeleccionadaProvider.notifier).seleccionar(null);
    expiro = false;
    state = const AsyncData(null);
  }

  /// Lo llama el `ApiClient` cuando el refresh es rechazado.
  void sesionExpirada() {
    if (state.value == null) return;
    expiro = true;
    state = const AsyncData(null);
  }

  /// Relee los permisos (p. ej. al volver la app a primer plano).
  Future<void> refrescarPermisos() async {
    final actual = state.value;
    if (actual == null) return;
    final r =
        await ref.read(apiClientProvider).get('/auth/me/permisos')
            as Map<String, dynamic>;
    state = AsyncData(
      Sesion(
        usuario: actual.usuario,
        permisos: (r['permisos'] as List<dynamic>).cast<String>(),
      ),
    );
  }
}

final sesionProvider = AsyncNotifierProvider<SesionController, Sesion?>(
  SesionController.new,
);

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/sesion.dart';
import '../auth/sesion_controller.dart';
import '../auth/token_storage.dart';
import '../config.dart';
import '../plaza/plaza_seleccionada.dart';
import 'api_client.dart';
import 'api_error.dart';

/// Almacenamiento de tokens. En pruebas se sobreescribe con
/// `MemoryTokenStorage`.
final tokenStorageProvider = Provider<TokenStorage>(
  (ref) => SecureTokenStorage(),
);

/// Cliente HTTP único de la app. Lee la sesión y la plaza elegida en cada
/// petición (no al crearse), por eso no se recrea al cambiar de plaza.
final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(
    baseUrl: resolverApiBaseUrl(),
    tokens: ref.watch(tokenStorageProvider),
    // Solo el superadmin envía `x-plaza-id` (el backend lo ignora en otros roles).
    plazaSeleccionada: () {
      final sesion = ref.read(sesionProvider).value;
      return sesion?.rol == Rol.superadmin
          ? ref.read(plazaSeleccionadaProvider)
          : null;
    },
    onSesionExpirada: () => ref.read(sesionProvider.notifier).sesionExpirada(),
  );
});

/// Política de reintentos de los providers (Riverpod 3 reintenta solo por
/// defecto hasta 10 veces cualquier error). Solo tiene sentido reintentar
/// fallos transitorios: sin conexión, tiempo agotado o 5xx; un 4xx (permiso,
/// no encontrado, validación) o un 429 (límite) no mejora repitiéndolo.
Duration? politicaReintentos(int intento, Object error) {
  if (intento >= 2 || error is! ApiError) return null;
  final transitorio = error.status == 0 || error.status >= 500;
  return transitorio ? Duration(seconds: 1 << intento) : null;
}

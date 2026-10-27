import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/sesion.dart';
import '../auth/sesion_controller.dart';
import '../auth/token_storage.dart';
import '../config.dart';
import '../plaza/plaza_seleccionada.dart';
import 'api_client.dart';

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

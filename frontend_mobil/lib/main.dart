// lib/main.dart
//
// Bootstrap de la app:
//   - Inicializa Flutter binding.
//   - Inicializa locale 'es' para intl.
//   - Crea TokenStore + PrefsStore + Dio + ApiClient + AuthRepository + AuthController.
//   - Lee tema persistido.
//   - Carga color de marca inicial desde cache (o fallback Plazapp default).
//   - Lanza PlazappApp.

import 'package:flutter/material.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:logger/logger.dart';

import 'app.dart';
import 'core/network/api_client.dart';
import 'core/storage/prefs_store.dart';
import 'core/storage/token_store.dart';
import 'core/theme/brand_colors.dart';
import 'features/auth/controllers/auth_controller.dart';
import 'features/auth/data/auth_repository.dart';

final _logger = Logger();

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Locale 'es' para intl (DateFormat, NumberFormat)
  await initializeDateFormatting('es');

  // Storage
  final tokenStore = TokenStore();
  final prefsStore = await PrefsStore.create();

  // Tema persistido
  final themeModeStr = prefsStore.readThemeMode();
  final themeMode = switch (themeModeStr) {
    'light' => ThemeMode.light,
    'dark' => ThemeMode.dark,
    _ => ThemeMode.system,
  };

  // Brand inicial (cacheado o fallback).
  // Por ahora siempre fallback; el brand real se setea tras login (Fase 8+).
  const initialBrand = BrandColors(primary: Color(0xFF2F62E6));

  // API client con callback de sesión perdida → forzar logout.
  // El callback se inyecta DESPUÉS de construir el AuthController porque
  // necesitamos llamar a authController.logout() cuando la sesión se pierde.
  late ApiClient apiClient;
  late AuthController authController;

  apiClient = ApiClient(
    tokenStore: tokenStore,
    onSessionLost: () {
      _logger.w('Sesión perdida — forzar re-login');
      authController.logout();
    },
  );

  final authRepo = AuthRepository(dio: apiClient.dio, tokenStore: tokenStore);
  authController = AuthController(repo: authRepo);

  runApp(PlazappApp(
    apiClient: apiClient,
    authRepo: authRepo,
    authController: authController,
    prefsStore: prefsStore,
    initialThemeMode: themeMode,
    initialBrand: initialBrand,
  ));
}
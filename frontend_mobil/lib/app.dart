// lib/app.dart
//
// Root widget. Cablea:
//   - ThemeData (light + dark) + ThemeExtension<PlazappColors>
//   - go_router con AuthController como refreshListenable
//   - Providers globales: AuthController, ApiClient, TokenStore, PrefsStore
//   - ThemeMode reactivo al estado persistido

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'core/network/api_client.dart';
import 'core/router/app_router.dart';
import 'core/storage/prefs_store.dart';
import 'core/theme/brand_colors.dart';
import 'core/theme/plazapp_colors.dart';
import 'core/theme/plazapp_theme.dart';
import 'features/auth/controllers/auth_controller.dart';
import 'features/auth/data/auth_repository.dart';

class PlazappApp extends StatelessWidget {
  const PlazappApp({
    super.key,
    required this.apiClient,
    required this.authRepo,
    required this.authController,
    required this.prefsStore,
    required this.initialThemeMode,
    required this.initialBrand,
  });

  final ApiClient apiClient;
  final AuthRepository authRepo;
  final AuthController authController;
  final PrefsStore prefsStore;
  final ThemeMode initialThemeMode;
  final BrandColors initialBrand;

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider<ApiClient>.value(value: apiClient),
        Provider<AuthRepository>.value(value: authRepo),
        ChangeNotifierProvider<AuthController>.value(value: authController),
      ],
      child: _ThemedApp(
        initialThemeMode: initialThemeMode,
        initialBrand: initialBrand,
      ),
    );
  }
}

class _ThemedApp extends StatefulWidget {
  const _ThemedApp({required this.initialThemeMode, required this.initialBrand});

  final ThemeMode initialThemeMode;
  final BrandColors initialBrand;

  @override
  State<_ThemedApp> createState() => _ThemedAppState();
}

class _ThemedAppState extends State<_ThemedApp> {
  late ThemeMode _themeMode = widget.initialThemeMode;
  late BrandColors _brand = widget.initialBrand;

  // Cuando llegue un nuevo tenant, _brand se actualiza vía AuthController.

  @override
  Widget build(BuildContext context) {
    final router = AppRouter.build(context.read<AuthController>());

    return MaterialApp.router(
      title: 'Plazapp',
      debugShowCheckedModeBanner: false,
      themeMode: _themeMode,
      theme: PlazappTheme.light(brand: _brand),
      darkTheme: PlazappTheme.dark(brand: _brand),
      // Reconstruir con el brand dinámico para que ThemeExtension<PlazappColors>
      // se reinyecte con el color del tenant actual.
      builder: (context, child) {
        return _BrandScope(
          brand: _brand,
          child: child ?? const SizedBox.shrink(),
        );
      },
      routerConfig: router,
    );
  }
}

/// Inyecta el BrandColors actual en un InheritedWidget para que cualquier
/// widget pueda leerlo sin pasar por Theme.of (útil para CustomPaint / gradients
/// fuera del Theme tree).
class _BrandScope extends InheritedWidget {
  const _BrandScope({required this.brand, required super.child});

  final BrandColors brand;

  @override
  bool updateShouldNotify(_BrandScope old) => old.brand != brand;
}

// Re-export para evitar import extra en consumidores.
// ignore: unused_element
const _colorsRef = PlazappColors;
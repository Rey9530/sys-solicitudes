import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend_mobil/core/api/api_client.dart';
import 'package:frontend_mobil/core/api/api_providers.dart';
import 'package:frontend_mobil/core/auth/sesion.dart';
import 'package:frontend_mobil/core/auth/sesion_controller.dart';
import 'package:frontend_mobil/core/theme/colores.dart';
import 'package:frontend_mobil/core/theme/tema.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Tamaños del barrido responsive: teléfonos y tablets (vertical/horizontal).
const tamanosPrueba = <Size>[
  Size(360, 740),
  Size(390, 844),
  Size(768, 1024),
  Size(1024, 768),
];

/// Preparación común de los widget tests (preferencias en memoria, fechas en
/// español).
Future<void> prepararPruebas() async {
  SharedPreferences.setMockInitialValues({});
  await initializeDateFormatting('es');
}

/// Sesión fija para pruebas (sin llamar al backend).
class SesionFalsa extends SesionController {
  SesionFalsa(this._sesion);
  final Sesion? _sesion;

  @override
  Future<Sesion?> build() async => _sesion;
}

/// Sesión de prueba para un rol. Admin con todos los permisos por defecto.
Sesion sesionDe(Rol rol, {List<String>? permisos, String? nombre}) => Sesion(
  usuario: Usuario(
    id: 'u-${rol.codigo}',
    email: '${rol.codigo}@demo.com',
    nombre: nombre ?? 'Usuario ${rol.etiqueta}',
    rol: rol,
    plazaId: rol == Rol.superadmin ? null : 'plaza-demo',
    rolStaffId: rol == Rol.adminPlaza ? 'rol-admin' : null,
    inquilinoId: rol == Rol.inquilino ? 'inq-1' : null,
  ),
  permisos: permisos ?? (rol == Rol.inquilino ? const [] : const ['*']),
);

/// Overrides habituales: API falsa + sesión fija.
List<Override> overridesBase(ApiClient api, {Sesion? sesion}) => [
  apiClientProvider.overrideWithValue(api),
  sesionProvider.overrideWith(() => SesionFalsa(sesion)),
];

/// Monta [pantalla] dentro de una app con tema, español y un router mínimo.
/// Navegar a otra ruta muestra `Ruta: <uri>` (para verificar navegación).
Widget envolver(
  Widget Function() pantalla, {
  required List<Override> overrides,
  Brightness brillo = Brightness.light,
}) {
  final router = GoRouter(
    routes: [GoRoute(path: '/', builder: (_, _) => pantalla())],
    errorBuilder: (_, state) => Scaffold(body: Text('Ruta: ${state.uri}')),
  );
  return ProviderScope(
    overrides: overrides,
    child: MaterialApp.router(
      routerConfig: router,
      theme: temaClaro(ColoresPlazapp.primarioPorDefecto),
      darkTheme: temaOscuro(ColoresPlazapp.primarioPorDefecto),
      themeMode: brillo == Brightness.dark ? ThemeMode.dark : ThemeMode.light,
      locale: const Locale('es'),
      supportedLocales: const [Locale('es')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
    ),
  );
}

/// Pinta [pantalla] en cada tamaño de [tamanosPrueba], en claro y oscuro, y
/// falla si hay cualquier excepción de layout (p. ej. "RenderFlex
/// overflowed"). Es el equivalente al barrido responsive de Playwright.
///
/// [alPintar] permite comprobar algo en cada combinación.
Future<void> probarEnTamanos(
  WidgetTester tester,
  Widget Function() pantalla, {
  required List<Override> overrides,
  Future<void> Function(Size tamano, Brightness brillo)? alPintar,
}) async {
  addTearDown(tester.view.reset);
  for (final tamano in tamanosPrueba) {
    for (final brillo in Brightness.values) {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = tamano;
      await tester.pumpWidget(
        envolver(pantalla, overrides: overrides, brillo: brillo),
      );
      await tester.pumpAndSettle();
      final error = tester.takeException();
      if (error != null) {
        fail(
          'Error de layout a ${tamano.width.toInt()}×${tamano.height.toInt()} '
          '(${brillo.name}): $error',
        );
      }
      await alPintar?.call(tamano, brillo);
      // Desmontar entre tamaños para no arrastrar estado.
      await tester.pumpWidget(const SizedBox.shrink());
    }
  }
}

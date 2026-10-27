import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/auth/sesion_controller.dart';
import 'core/navegacion/router.dart';
import 'core/plaza/plaza_seleccionada.dart';
import 'core/theme/colores.dart';
import 'core/theme/tema.dart';

/// Raíz de la app: router, tema (con el color de la plaza) y español.
class PlazappApp extends ConsumerStatefulWidget {
  const PlazappApp({super.key});

  @override
  ConsumerState<PlazappApp> createState() => _PlazappAppState();
}

class _PlazappAppState extends ConsumerState<PlazappApp> {
  late final AppLifecycleListener _ciclo;

  @override
  void initState() {
    super.initState();
    // Al volver a primer plano se releen los permisos (pueden haber cambiado).
    _ciclo = AppLifecycleListener(
      onResume: () => ref.read(sesionProvider.notifier).refrescarPermisos(),
    );
  }

  @override
  void dispose() {
    _ciclo.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final plaza = ref.watch(plazaActualProvider).value;
    final primario = colorDesdeHex(plaza?.colorPrimario);
    return MaterialApp.router(
      title: 'Plazapp',
      debugShowCheckedModeBanner: false,
      routerConfig: ref.watch(routerProvider),
      theme: temaClaro(primario),
      darkTheme: temaOscuro(primario),
      themeMode: ref.watch(temaModoProvider),
      locale: const Locale('es'),
      supportedLocales: const [Locale('es')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
    );
  }
}

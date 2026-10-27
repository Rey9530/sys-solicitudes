import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Raíz de la app. El router, el tema y la sesión se conectan en las tareas
/// siguientes del plan; aquí solo vive la configuración común.
class PlazappApp extends ConsumerWidget {
  const PlazappApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return const MaterialApp(
      title: 'Plazapp',
      debugShowCheckedModeBanner: false,
      locale: Locale('es'),
      supportedLocales: [Locale('es')],
      localizationsDelegates: [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: Scaffold(body: Center(child: Text('Plazapp'))),
    );
  }
}

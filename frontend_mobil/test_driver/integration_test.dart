import 'dart:io';

import 'package:integration_test/integration_test_driver_extended.dart';

/// Driver de `flutter drive`: guarda cada captura de `binding.takeScreenshot`
/// en `build/capturas/<DISPOSITIVO>/<nombre>.png` (variable de entorno
/// `CAPTURAS_DISPOSITIVO`, por defecto "dispositivo").
Future<void> main() => integrationDriver(
  onScreenshot: (nombre, bytes, [args]) async {
    final dispositivo =
        Platform.environment['CAPTURAS_DISPOSITIVO'] ?? 'dispositivo';
    final archivo = File('build/capturas/$dispositivo/$nombre.png');
    await archivo.create(recursive: true);
    await archivo.writeAsBytes(bytes);
    return true;
  },
);

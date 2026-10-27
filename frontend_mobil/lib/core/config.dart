import 'dart:io' show Platform;

/// URL base del backend (`…/api/v1`).
///
/// Se fija al compilar con `--dart-define=API_BASE_URL=https://…/api/v1`. Sin
/// valor, apunta al backend local: el simulador iOS ve el host como
/// `localhost` y el emulador Android lo ve como `10.0.2.2`.
String resolverApiBaseUrl() {
  const definida = String.fromEnvironment('API_BASE_URL');
  if (definida.isNotEmpty) return definida;
  return Platform.isAndroid
      ? 'http://10.0.2.2:4000/api/v1'
      : 'http://localhost:4000/api/v1';
}

/// Zona horaria fija de todas las plazas (decisión T-V08): America/El_Salvador,
/// UTC−6 sin horario de verano.
const Duration desfasePlaza = Duration(hours: -6);

/// Cada cuánto se consulta el contador de la campana (igual que el web).
const Duration intervaloCampana = Duration(seconds: 45);

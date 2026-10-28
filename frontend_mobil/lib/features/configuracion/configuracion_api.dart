import 'dart:typed_data';

import '../../core/api/api_client.dart';
import '../superadmin/plazas_modelos.dart';
import 'configuracion_modelos.dart';

/// Configuración de plaza: datos generales y branding viven en la plaza
/// (`PATCH /plazas/:id`); SLA, adjuntos y calendario en `/configuracion`.

Future<DatosConfiguracion> cargarConfiguracion(
  ApiClient api,
  String plazaId,
) async {
  final r = await Future.wait([
    api.get('/plazas/$plazaId'),
    api.get('/configuracion'),
  ], eagerError: true);
  return DatosConfiguracion(
    plaza: Plaza.fromJson(r[0] as Map<String, dynamic>),
    configuracion: ConfiguracionPlaza.fromJson(r[1] as Map<String, dynamic>),
  );
}

/// `UpdatePlazaSchema`: `nombreComercial`, `emailContacto`, `telefonoContacto`
/// (vacío → `null`) y/o `colorPrimario`.
Future<void> actualizarPlaza(
  ApiClient api,
  String plazaId,
  Map<String, Object?> cambios,
) => api.patch('/plazas/$plazaId', body: cambios);

/// Logo PNG o SVG (máx 2 MB) en el campo `file`.
Future<void> subirLogo(
  ApiClient api,
  String plazaId, {
  required String nombreArchivo,
  required Uint8List contenido,
  required String mimeType,
}) => api.subir(
  '/plazas/$plazaId/logo',
  nombreArchivo: nombreArchivo,
  contenido: contenido,
  mimeType: mimeType,
);

/// `UpdateConfiguracionSchema` (parcial).
Future<void> actualizarConfiguracion(
  ApiClient api,
  Map<String, Object?> cambios,
) => api.patch('/configuracion', body: cambios);

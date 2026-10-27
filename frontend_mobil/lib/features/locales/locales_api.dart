import 'dart:typed_data';

import '../../core/adjuntos/adjuntos.dart';
import '../../core/api/api_client.dart';
import '../../core/api/paginado.dart';
import '../../core/api/payload.dart';
import '../contratos/catalogo_comun.dart';
import '../solicitudes/solicitudes_modelos.dart';
import 'locales_modelos.dart';

/// Llamadas al backend de locales (`/locales`, Inv §5.1).

Future<Paginado<Local>> listarLocales(ApiClient api, FiltroLocales f) async {
  final json = await api.get(
    '/locales',
    query: {
      'page': f.pagina,
      'pageSize': 20,
      'estado': f.estado,
      'modulo': f.modulo,
      'nivel': f.nivel,
    },
  ) as Map<String, dynamic>;
  return Paginado.fromJson(json, Local.fromJson);
}

/// Locales para los combos (máximo 100, el tope del backend; bug B1-R5).
Future<List<Local>> opcionesLocales(
  ApiClient api, {
  bool soloDisponibles = false,
}) async {
  final json = await api.get(
    '/locales',
    query: {
      'page': 1,
      'pageSize': 100,
      if (soloDisponibles) 'estado': 'disponible',
    },
  ) as Map<String, dynamic>;
  return Paginado.fromJson(json, Local.fromJson).items;
}

Future<LocalDetalle> obtenerLocal(ApiClient api, String id) async {
  final json = await api.get('/locales/$id') as Map<String, dynamic>;
  return LocalDetalle.fromJson(json);
}

/// `POST /locales` (permiso `locales.crear`). El local nace `disponible`.
Future<void> crearLocal(ApiClient api, Map<String, Object?> body) =>
    api.post('/locales', body: body);

/// `PATCH /locales/:id` (permiso `locales.editar`).
Future<void> actualizarLocal(
  ApiClient api,
  String id,
  Map<String, Object?> body,
) => api.patch('/locales/$id', body: body);

/// `DELETE /locales/:id` (permiso `locales.deshabilitar`). 409
/// `LOCAL_HAS_ACTIVE_CONTRACT` si tiene contrato vigente.
Future<void> desactivarLocal(ApiClient api, String id) =>
    api.delete('/locales/$id');

Future<List<Adjunto>> listarAdjuntosLocal(ApiClient api, String id) async {
  final json = await api.get('/locales/$id/adjuntos') as List<dynamic>;
  return [for (final a in json) Adjunto.fromJson(a as Map<String, dynamic>)];
}

/// Solo imágenes (jpeg, png, webp), un archivo por petición.
Future<void> subirAdjuntoLocal(
  ApiClient api,
  String id,
  String nombre,
  Uint8List bytes,
  String mime,
) => api.subir(
  '/locales/$id/adjuntos',
  nombreArchivo: nombre,
  contenido: bytes,
  mimeType: mime,
);

/// Solicitudes del local (`GET /solicitudes?localId=`, permiso
/// `solicitudes.bandeja.ver`).
Future<Paginado<SolicitudItem>> solicitudesDeLocal(
  ApiClient api,
  String localId,
  int pagina,
) async {
  final json = await api.get(
    '/solicitudes',
    query: {'localId': localId, 'page': pagina, 'pageSize': 20},
  ) as Map<String, dynamic>;
  return Paginado.fromJson(json, SolicitudItem.fromJson);
}

/// Body de `POST /locales`: código y módulo en mayúsculas; los campos vacíos
/// se omiten.
Map<String, Object?> cuerpoNuevoLocal({
  required String codigo,
  String modulo = '',
  String nivel = '',
  String area = '',
  String medidorEnergia = '',
  String medidorAgua = '',
}) => omitirVacios({
  'codigo': codigo.trim().toUpperCase(),
  'modulo': modulo.trim().toUpperCase(),
  'nivel': nivel,
  'areaM2': numeroDe(area),
  'medidorEnergia': medidorEnergia,
  'medidorAgua': medidorAgua,
});

/// Body de `PATCH /locales/:id`: un campo vacío va `null` (borra el valor).
/// [estado] `null` = no se envía (con contrato vigente el web no lo manda).
Map<String, Object?> cuerpoEditarLocal({
  required String modulo,
  required String nivel,
  required String area,
  required String medidorEnergia,
  required String medidorAgua,
  String? estado,
}) => {
  ...vaciosANull({
    'modulo': modulo.trim().toUpperCase(),
    'nivel': nivel,
    'medidorEnergia': medidorEnergia,
    'medidorAgua': medidorAgua,
  }),
  'areaM2': numeroDe(area),
  'estado': ?estado,
};

import 'dart:typed_data';

import '../../core/adjuntos/adjuntos.dart';
import '../../core/api/api_client.dart';
import '../../core/api/paginado.dart';
import '../../core/api/payload.dart';
import '../../core/format/validaciones.dart';
import 'contratos_modelos.dart';

/// Llamadas al backend de contratos y de la carga inicial (Inv §5.1).

/// MIME del Excel de la carga inicial.
const mimeXlsx =
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/// Tope del `.xlsx` de la carga inicial (`CARGA_INICIAL_MAX_BYTES`).
const cargaInicialMaxBytes = 5 * 1024 * 1024;

/// Plantilla con ejemplos empaquetada en la app (el web la sirve como
/// archivo estático; no hay endpoint).
const plantillaCargaInicial = 'assets/plantillas/plantilla-carga-inicial.xlsx';

Future<Paginado<Contrato>> listarContratos(
  ApiClient api,
  FiltroContratos f,
) async {
  final json = await api.get(
    '/contratos',
    query: {
      'page': f.pagina,
      'pageSize': 20,
      'localId': f.localId,
      'inquilinoId': f.inquilinoId,
      'estado': f.estado,
    },
  ) as Map<String, dynamic>;
  return Paginado.fromJson(json, Contrato.fromJson);
}

/// Contratos del inquilino de la sesión (el backend filtra por el JWT). Sin
/// paginador: solo los primeros 50, como el web.
Future<Paginado<Contrato>> listarMisContratos(ApiClient api) async {
  final json = await api.get(
    '/contratos',
    query: {'page': 1, 'pageSize': 50},
  ) as Map<String, dynamic>;
  return Paginado.fromJson(json, Contrato.fromJson);
}

Future<Contrato> obtenerContrato(ApiClient api, String id) async {
  final json = await api.get('/contratos/$id') as Map<String, dynamic>;
  return Contrato.fromJson(json);
}

/// `POST /contratos` (permiso `contratos.crear`). El local pasa a
/// `alquilado`. 409 `CONTRATO_OVERLAP` si choca con otro vigente.
Future<void> crearContrato(ApiClient api, Map<String, Object?> body) =>
    api.post('/contratos', body: body);

/// `POST /contratos/:id/cerrar` (permiso `contratos.cerrar`).
Future<void> cerrarContrato(
  ApiClient api,
  String id,
  Map<String, Object?> body,
) => api.post('/contratos/$id/cerrar', body: body);

/// `POST /contratos/:id/renovar` (permiso `contratos.renovar`): cierra el
/// actual («renovado») y crea uno nuevo vigente con los mismos términos.
Future<void> renovarContrato(
  ApiClient api,
  String id,
  Map<String, Object?> body,
) => api.post('/contratos/$id/renovar', body: body);

Future<List<Adjunto>> listarAdjuntosContrato(ApiClient api, String id) async {
  final json = await api.get('/contratos/$id/adjuntos') as List<dynamic>;
  return [for (final a in json) Adjunto.fromJson(a as Map<String, dynamic>)];
}

/// Contrato firmado: solo PDF. El inquilino también puede subir a sus
/// contratos (el backend lo permite; el web lo bloquea por error, B1-R1).
Future<void> subirAdjuntoContrato(
  ApiClient api,
  String id,
  String nombre,
  Uint8List bytes,
  String mime,
) => api.subir(
  '/contratos/$id/adjuntos',
  nombreArchivo: nombre,
  contenido: bytes,
  mimeType: mime,
);

/// Body de `POST /contratos`. Fin vacío = indefinido (`fechaFin: null`); los
/// demás opcionales vacíos se omiten (nunca `''`).
Map<String, Object?> cuerpoNuevoContrato({
  required String localId,
  required String inquilinoId,
  required String fechaInicio,
  required String? fechaFin,
  required double montoMensual,
  required String moneda,
  Map<String, String> textos = const {},
  Map<String, String?> fechas = const {},
}) => {
  'localId': localId,
  'inquilinoId': inquilinoId,
  'fechaInicio': fechaInicio,
  'fechaFin': fechaFin,
  'montoMensual': montoMensual,
  'moneda': moneda.trim().toUpperCase(),
  ...omitirVacios({
    'plazoMeses': enteroDe(textos['plazoMeses'] ?? ''),
    'periodoGraciaDias': enteroDe(textos['periodoGraciaDias'] ?? ''),
    'areaMt2MedicionReal': numeroDe(textos['areaMt2MedicionReal'] ?? ''),
    'cuotaArrendamiento': numeroDe(textos['cuotaArrendamiento'] ?? ''),
    'cuotaCam': numeroDe(textos['cuotaCam'] ?? ''),
    'depositoGarantia': numeroDe(textos['depositoGarantia'] ?? ''),
    'condiciones': textos['condiciones'],
    'condicionesIncrementoCanon': textos['condicionesIncrementoCanon'],
    ...fechas,
  }),
};

/// Body del cierre: la fecha efectiva vacía se omite (el backend usa hoy).
Map<String, Object?> cuerpoCerrarContrato({
  required String motivo,
  required String estado,
  String? fechaFinEfectiva,
}) => omitirVacios({
  'motivoFin': motivo,
  'estado': estado,
  'fechaFinEfectiva': fechaFinEfectiva,
});

/// Body de la renovación: fin vacío = indefinido; monto vacío = el actual.
Map<String, Object?> cuerpoRenovarContrato({
  required String nuevaFechaInicio,
  String? nuevaFechaFin,
  String nuevoMonto = '',
}) => {
  'nuevaFechaInicio': nuevaFechaInicio,
  'nuevaFechaFin': nuevaFechaFin,
  'nuevoMontoMensual': ?numeroDe(nuevoMonto),
};

// ── Carga inicial ───────────────────────────────────────────────────────────

/// Paso 1: analiza el Excel sin guardar nada (vista previa).
Future<ResultadoAnalisisCarga> analizarCargaInicial(
  ApiClient api, {
  required String nombre,
  required Uint8List bytes,
}) => _cargaInicial(api, 'analizar', nombre, bytes);

/// Paso 2: reenvía el MISMO archivo y crea todo en una transacción.
Future<ResultadoAnalisisCarga> ejecutarCargaInicial(
  ApiClient api, {
  required String nombre,
  required Uint8List bytes,
}) => _cargaInicial(api, 'ejecutar', nombre, bytes);

Future<ResultadoAnalisisCarga> _cargaInicial(
  ApiClient api,
  String paso,
  String nombre,
  Uint8List bytes,
) async {
  final json = await api.subir(
    '/importacion/carga-inicial/$paso',
    nombreArchivo: nombre,
    contenido: bytes,
    mimeType: mimeXlsx,
  ) as Map<String, dynamic>;
  return ResultadoAnalisisCarga.fromJson(json);
}

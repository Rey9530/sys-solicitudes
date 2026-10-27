import 'dart:convert';
import 'dart:math';

import '../../core/api/api_client.dart';
import '../../core/api/paginado.dart';
import '../solicitudes/solicitudes_modelos.dart';
import 'inquilinos_modelos.dart';
import '../../core/api/payload.dart';

/// Llamadas al backend de inquilinos y de sus usuarios (Inv §5.1.2, §5.1.4).

Future<Paginado<Inquilino>> listarInquilinos(
  ApiClient api,
  FiltroInquilinos f,
) async {
  final json = await api.get(
    '/inquilinos',
    query: {
      'page': f.pagina,
      'pageSize': 20,
      'razonSocial': f.razonSocial,
      'identificacion': f.identificacion,
    },
  ) as Map<String, dynamic>;
  return Paginado.fromJson(json, Inquilino.fromJson);
}

/// Inquilinos para los combos (máximo 100, el tope del backend; bug B1-R5).
Future<List<Inquilino>> opcionesInquilinos(ApiClient api) async {
  final json = await api.get(
    '/inquilinos',
    query: {'page': 1, 'pageSize': 100},
  ) as Map<String, dynamic>;
  return Paginado.fromJson(json, Inquilino.fromJson).items;
}

Future<InquilinoDetalle> obtenerInquilino(ApiClient api, String id) async {
  final json = await api.get('/inquilinos/$id') as Map<String, dynamic>;
  return InquilinoDetalle.fromJson(json);
}

/// `POST /inquilinos` (permiso `inquilinos.crear`).
Future<void> crearInquilino(ApiClient api, Map<String, Object?> body) =>
    api.post('/inquilinos', body: body);

/// `PATCH /inquilinos/:id` (permiso `inquilinos.editar`).
Future<void> actualizarInquilino(
  ApiClient api,
  String id,
  Map<String, Object?> body,
) => api.patch('/inquilinos/$id', body: body);

/// `DELETE /inquilinos/:id`. 409 `INQUILINO_HAS_ACTIVE_CONTRACT` con
/// contrato vigente.
Future<void> desactivarInquilino(ApiClient api, String id) =>
    api.delete('/inquilinos/$id');

/// Body del alta: solo los campos con valor (bug B1-R3 del web: `''` en un
/// email, enum o fecha opcional hace fallar la validación del backend).
Map<String, Object?> cuerpoNuevoInquilino(
  Map<String, String> valores, {
  String? tipoCliente,
}) => omitirVacios({
  for (final MapEntry(:key, :value) in valores.entries)
    key: key.endsWith('Email') || key == 'correoRecepcionDte'
        ? value.trim().toLowerCase()
        : value,
  'tipoCliente': tipoCliente,
});

/// Body de la edición: todos los campos editables; vacío → `null` (borra).
/// Razón social e identificación no se envían (inmutables).
Map<String, Object?> cuerpoEditarInquilino(
  Map<String, String> valores, {
  String? tipoCliente,
}) => {
  ...vaciosANull({
    for (final k in camposTextoInquilino)
      k: k.endsWith('Email') || k == 'correoRecepcionDte'
          ? (valores[k] ?? '').trim().toLowerCase()
          : valores[k] ?? '',
  }),
  'tipoCliente': tipoCliente,
};

// ── Usuarios del inquilino ──────────────────────────────────────────────────

/// Activos e inactivos (los activos primero).
Future<List<UsuarioInquilino>> listarUsuariosInquilino(
  ApiClient api,
  String inquilinoId,
) async {
  final json = await api.get(
    '/inquilinos/$inquilinoId/usuarios',
    query: {'rol': 'inquilino', 'pageSize': 100},
  ) as Map<String, dynamic>;
  return Paginado.fromJson(json, UsuarioInquilino.fromJson).items;
}

/// Contraseña temporal del alta rápida: `Tmp` + base64url de 9 bytes
/// aleatorios + `1a` (17 caracteres; cumple mayúscula, minúscula y dígito).
/// El backend no genera contraseñas: la genera el cliente, igual que el web.
String generarPasswordTemporal([Random? aleatorio]) {
  final r = aleatorio ?? Random.secure();
  final bytes = [for (var i = 0; i < 9; i++) r.nextInt(256)];
  return 'Tmp${base64Url.encode(bytes)}1a';
}

/// Alta rápida (`POST /usuarios`, rol `inquilino`). Devuelve la contraseña
/// temporal, que se muestra una sola vez. El backend envía un email de
/// bienvenida **sin** la contraseña.
Future<String> altaUsuarioInquilino(
  ApiClient api, {
  required String inquilinoId,
  required String email,
  required String nombre,
}) async {
  final password = generarPasswordTemporal();
  await api.post(
    '/usuarios',
    body: {
      'email': email.trim().toLowerCase(),
      'nombre': nombre.trim(),
      'password': password,
      'rol': 'inquilino',
      'inquilinoId': inquilinoId,
    },
  );
  return password;
}

/// Edita nombre y teléfono (vacío → `null`).
Future<void> editarUsuarioInquilino(
  ApiClient api,
  String usuarioId, {
  required String nombre,
  required String telefono,
}) => api.patch(
  '/usuarios/$usuarioId',
  body: {'nombre': nombre.trim(), 'telefono': textoOpcional(telefono)},
);

/// Envía al usuario un enlace de reseteo (válido 30 min, abre el web).
Future<void> resetearClaveUsuario(ApiClient api, String usuarioId) =>
    api.post('/usuarios/$usuarioId/reset-password');

/// Soft delete: el usuario ya no puede iniciar sesión.
Future<void> deshabilitarUsuario(ApiClient api, String usuarioId) =>
    api.delete('/usuarios/$usuarioId');

Future<void> reactivarUsuario(ApiClient api, String usuarioId) =>
    api.post('/usuarios/$usuarioId/reactivate');

// ── Solicitudes del inquilino ───────────────────────────────────────────────

/// El backend no filtra solicitudes por inquilino, solo por local: se piden
/// las de cada local con contrato del inquilino (hasta 100 por local) y se
/// quedan las suyas, de la más reciente a la más antigua.
Future<List<SolicitudItem>> solicitudesDeInquilino(
  ApiClient api, {
  required String inquilinoId,
  required Iterable<String> localIds,
}) async {
  final paginas = await Future.wait([
    for (final localId in localIds.toSet())
      api.get(
        '/solicitudes',
        query: {'localId': localId, 'page': 1, 'pageSize': 100},
      ),
  ]);
  final porId = <String, SolicitudItem>{
    for (final json in paginas)
      for (final s in Paginado.fromJson(
        json as Map<String, dynamic>,
        SolicitudItem.fromJson,
      ).items)
        if (s.inquilinoId == inquilinoId) s.id: s,
  };
  return porId.values.toList()
    ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
}

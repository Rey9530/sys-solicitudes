import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';

import '../auth/token_storage.dart';
import 'api_error.dart';

/// Único punto de la app que habla HTTP con el backend (`…/api/v1`).
///
/// Se encarga de:
/// - poner `Authorization: Bearer` y, si el superadmin eligió plaza,
///   `x-plaza-id`;
/// - refrescar el access token antes de que venza (< 60 s) o tras un 401, con
///   **un solo refresh a la vez** (*single-flight*): el backend revoca todas
///   las sesiones del usuario si un refresh token se usa dos veces;
/// - convertir cualquier error en [ApiError] (mensaje desde `detail`).
///
/// Las respuestas JSON se devuelven decodificadas (`Map`, `List` o `null`).
class ApiClient {
  ApiClient({
    required this.baseUrl,
    required this._tokens,
    http.Client? cliente,
    this._plazaSeleccionada,
    this._onSesionExpirada,
  }) : _http = cliente ?? http.Client();

  final String baseUrl;
  final TokenStorage _tokens;
  final http.Client _http;
  final String? Function()? _plazaSeleccionada;
  final void Function()? _onSesionExpirada;
  Future<Tokens>? _refrescando;

  static const _timeout = Duration(seconds: 30);
  static const _margenRefresh = Duration(seconds: 60);
  static const _userAgent = 'PlazappMovil/1.0';

  // ── Métodos públicos ──────────────────────────────────────────────────────

  /// [sinPlaza]: no envía `x-plaza-id` aunque el superadmin tenga una plaza
  /// elegida (vistas globales de la plataforma, p. ej. el dashboard global).
  Future<dynamic> get(
    String path, {
    Map<String, Object?>? query,
    bool sinPlaza = false,
  }) => _json('GET', path, query: query, sinPlaza: sinPlaza);

  Future<dynamic> post(String path, {Object? body}) =>
      _json('POST', path, body: body);

  Future<dynamic> patch(String path, {Object? body}) =>
      _json('PATCH', path, body: body);

  Future<dynamic> put(String path, {Object? body}) =>
      _json('PUT', path, body: body);

  Future<dynamic> delete(String path, {Object? body}) =>
      _json('DELETE', path, body: body);

  /// Descarga binaria (PDF, CSV, XLSX, ICS).
  Future<Uint8List> bytes(
    String path, {
    Map<String, Object?>? query,
    bool sinPlaza = false,
  }) async {
    final r = await _enviar(
      () => http.Request('GET', _url(path, query)),
      autenticado: true,
      sinPlaza: sinPlaza,
    );
    return r.bodyBytes;
  }

  /// Sube un archivo como `multipart/form-data` en el campo `file`, con el
  /// MIME **declarado** (el backend valida ese MIME, no el contenido).
  Future<dynamic> subir(
    String path, {
    required String nombreArchivo,
    required Uint8List contenido,
    required String mimeType,
  }) async {
    final r = await _enviar(() {
      final req = http.MultipartRequest('POST', _url(path, null));
      req.files.add(
        http.MultipartFile.fromBytes(
          'file',
          contenido,
          filename: nombreArchivo,
          contentType: MediaType.parse(mimeType),
        ),
      );
      return req;
    }, autenticado: true);
    return _decodificar(r);
  }

  /// Llamada sin token (login, reset de contraseña).
  Future<dynamic> publico(String method, String path, {Object? body}) async {
    final r = await _enviar(
      () => _requestJson(method, _url(path, null), body),
      autenticado: false,
    );
    return _decodificar(r);
  }

  /// Inicia sesión y guarda el par de tokens. Devuelve la respuesta completa
  /// (`accessToken`, `refreshToken`, `expiresIn`, `user`).
  Future<Map<String, dynamic>> login(String email, String password) async {
    final json = await publico(
      'POST',
      '/auth/login',
      body: {'email': email, 'password': password},
    ) as Map<String, dynamic>;
    await _tokens.guardar(_tokensDesde(json));
    return json;
  }

  /// Revoca el refresh token en el backend (si falla, igual se cierra la
  /// sesión local) y borra los tokens guardados.
  Future<void> logout() async {
    final t = await _tokens.leer();
    if (t != null) {
      try {
        await _enviar(
          () => _requestJson('POST', _url('/auth/logout', null), {
            'refreshToken': t.refreshToken,
          }),
          autenticado: true,
          reintentar: false,
        );
      } on ApiError {
        // La sesión local se cierra de todos modos.
      }
    }
    await _tokens.borrar();
  }

  /// ¿Hay tokens guardados? (para restaurar la sesión al abrir la app).
  Future<bool> tieneSesion() async => (await _tokens.leer()) != null;

  // ── Internos ──────────────────────────────────────────────────────────────

  Future<dynamic> _json(
    String method,
    String path, {
    Map<String, Object?>? query,
    Object? body,
    bool sinPlaza = false,
  }) async {
    final r = await _enviar(
      () => _requestJson(method, _url(path, query), body),
      autenticado: true,
      sinPlaza: sinPlaza,
    );
    return _decodificar(r);
  }

  http.Request _requestJson(String method, Uri url, Object? body) {
    final req = http.Request(method, url);
    if (body != null) {
      req.headers['Content-Type'] = 'application/json';
      req.body = jsonEncode(body);
    }
    return req;
  }

  Uri _url(String path, Map<String, Object?>? query) {
    final params = <String, String>{};
    query?.forEach((k, v) {
      if (v == null) return;
      final texto = switch (v) {
        final bool b => b ? 'true' : 'false',
        final Iterable<Object?> l => l.where((e) => e != null).join(','),
        final DateTime d => d.toUtc().toIso8601String(),
        _ => '$v',
      };
      if (texto.isNotEmpty) params[k] = texto;
    });
    final uri = Uri.parse('$baseUrl${path.startsWith('/') ? path : '/$path'}');
    return params.isEmpty ? uri : uri.replace(queryParameters: params);
  }

  /// Envía la petición construida por [construir] (se reconstruye para el
  /// reintento: un multipart no se puede reenviar).
  Future<http.Response> _enviar(
    http.BaseRequest Function() construir, {
    required bool autenticado,
    bool reintentar = true,
    bool sinPlaza = false,
  }) async {
    Tokens? tokens;
    if (autenticado) {
      tokens = await _tokens.leer();
      if (tokens == null) {
        throw ApiError(
          status: 401,
          code: 'SIN_SESION',
          mensaje: 'Inicia sesión para continuar.',
        );
      }
      if (tokens.expiraEn.difference(DateTime.now()) < _margenRefresh) {
        tokens = await _refrescar();
      }
    }

    var respuesta = await _ejecutar(construir(), tokens, sinPlaza: sinPlaza);
    if (autenticado && reintentar && respuesta.statusCode == 401) {
      // Si otra petición ya refrescó mientras esta viajaba con el token viejo,
      // basta con reintentar con el nuevo (no se rota otra vez).
      final guardados = await _tokens.leer();
      tokens = guardados != null && guardados.accessToken != tokens!.accessToken
          ? guardados
          : await _refrescar();
      respuesta = await _ejecutar(construir(), tokens, sinPlaza: sinPlaza);
    }
    if (respuesta.statusCode >= 400) {
      throw ApiError.desdeRespuesta(
        respuesta.statusCode,
        respuesta.body,
        headers: respuesta.headers,
      );
    }
    return respuesta;
  }

  Future<http.Response> _ejecutar(
    http.BaseRequest req,
    Tokens? tokens, {
    bool sinPlaza = false,
  }) async {
    req.headers['Accept'] = 'application/json';
    req.headers['User-Agent'] = _userAgent;
    if (tokens != null) {
      req.headers['Authorization'] = 'Bearer ${tokens.accessToken}';
      final plaza = sinPlaza ? null : _plazaSeleccionada?.call();
      if (plaza != null && plaza.isNotEmpty) req.headers['x-plaza-id'] = plaza;
    }
    try {
      final streamed = await _http.send(req).timeout(_timeout);
      return await http.Response.fromStream(streamed).timeout(_timeout);
    } on TimeoutException {
      throw ApiError.tiempoAgotado();
    } on SocketException {
      throw ApiError.sinConexion();
    } on http.ClientException {
      throw ApiError.sinConexion();
    } on HandshakeException {
      throw ApiError.sinConexion();
    }
  }

  /// Refresh *single-flight*: si ya hay uno en curso, todos esperan el mismo.
  Future<Tokens> _refrescar() {
    return _refrescando ??= _hacerRefresh().whenComplete(
      () => _refrescando = null,
    );
  }

  Future<Tokens> _hacerRefresh() async {
    final actuales = await _tokens.leer();
    if (actuales == null) {
      _onSesionExpirada?.call();
      throw ApiError(
        status: 401,
        code: 'SIN_SESION',
        mensaje: 'Inicia sesión para continuar.',
      );
    }
    final req = _requestJson('POST', _url('/auth/refresh', null), {
      'refreshToken': actuales.refreshToken,
    });
    final r = await _ejecutar(req, null);
    if (r.statusCode >= 400) {
      final error = ApiError.desdeRespuesta(r.statusCode, r.body);
      // Un refresh rechazado (revocado, vencido, plaza desactivada) termina la
      // sesión; un error de red no, para poder reintentar.
      if (r.statusCode == 401 || r.statusCode == 403) {
        await _tokens.borrar();
        _onSesionExpirada?.call();
      }
      throw error;
    }
    final nuevos = _tokensDesde(jsonDecode(r.body) as Map<String, dynamic>);
    await _tokens.guardar(nuevos);
    return nuevos;
  }

  Tokens _tokensDesde(Map<String, dynamic> json) => Tokens(
    json['accessToken'] as String,
    json['refreshToken'] as String,
    DateTime.now().add(
      Duration(seconds: (json['expiresIn'] as num?)?.toInt() ?? 3600),
    ),
  );

  dynamic _decodificar(http.Response r) {
    if (r.statusCode == 204 || r.bodyBytes.isEmpty) return null;
    return jsonDecode(utf8.decode(r.bodyBytes));
  }
}

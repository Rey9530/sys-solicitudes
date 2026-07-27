// lib/core/network/jwt_interceptor.dart
//
// Interceptor de Dio que:
//   1. Inyecta Authorization: Bearer <access_token> en cada request.
//   2. En un 401, llama a POST /auth/refresh UNA sola vez (lock con Completer),
//      guarda el nuevo access_token y replay el request original.
//   3. Si el refresh falla → limpia TokenStore y notifica al router (vía callback).
//
// Usamos `QueuedInterceptor` (dio 5.x) en lugar del viejo `Interceptor` para
// asegurar que requests concurrentes que reciben 401 NO disparen refresh paralelo.

import 'dart:async';

import 'package:dio/dio.dart';

import '../storage/token_store.dart';
import 'api_endpoints.dart';

/// Callback invocado cuando la sesión se invalida (refresh fallido o 401 sin refresh token).
/// Lo usa el router para redirigir a /login.
typedef OnSessionLost = void Function();

class JwtInterceptor extends QueuedInterceptor {
  JwtInterceptor({required this.tokenStore, required this.onSessionLost});

  final TokenStore tokenStore;
  final OnSessionLost onSessionLost;

  Completer<String?>? _refreshing;

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    // No inyectar Authorization en el endpoint de refresh ni en login.
    final isAuthEndpoint =
        options.path == ApiEndpoints.login || options.path == ApiEndpoints.refresh;
    if (!isAuthEndpoint) {
      final token = await tokenStore.readAccessToken();
      if (token != null) {
        options.headers['Authorization'] = 'Bearer $token';
      }
    }
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final status = err.response?.statusCode;
    final isAuthEndpoint =
        err.requestOptions.path == ApiEndpoints.login ||
        err.requestOptions.path == ApiEndpoints.refresh;

    if (status != 401 || isAuthEndpoint) {
      return handler.next(err);
    }

    // 401 → intentar refresh (un solo intento concurrente)
    final newToken = await _refreshOnce();
    if (newToken == null) {
      // Refresh falló → sesión perdida.
      onSessionLost();
      return handler.next(err);
    }

    // Replay del request original con el nuevo token.
    final original = err.requestOptions;
    original.headers['Authorization'] = 'Bearer $newToken';
    try {
      final response = await Dio(BaseOptions(
        baseUrl: original.baseUrl,
        connectTimeout: original.connectTimeout,
        receiveTimeout: original.receiveTimeout,
      )).fetch(original);
      return handler.resolve(response);
    } catch (e) {
      return handler.next(err);
    }
  }

  /// Llama a POST /auth/refresh UNA sola vez. Si ya hay un refresh en curso,
  /// espera al resultado del mismo en lugar de disparar otro.
  Future<String?> _refreshOnce() async {
    if (_refreshing != null) {
      return _refreshing!.future;
    }

    final completer = Completer<String?>();
    _refreshing = completer;

    try {
      final refreshToken = await tokenStore.readRefreshToken();
      if (refreshToken == null) {
        completer.complete(null);
        return null;
      }

      final dio = Dio(BaseOptions(baseUrl: ApiConfig.baseUrl));
      final resp = await dio.post<Map<String, dynamic>>(
        ApiEndpoints.refresh,
        data: {'refreshToken': refreshToken},
      );
      final newAccess = resp.data?['accessToken'] as String?;
      if (newAccess == null) {
        completer.complete(null);
        await tokenStore.clear();
        return null;
      }
      await tokenStore.updateAccessToken(newAccess);
      completer.complete(newAccess);
      return newAccess;
    } catch (_) {
      completer.complete(null);
      await tokenStore.clear();
      return null;
    } finally {
      _refreshing = null;
    }
  }
}
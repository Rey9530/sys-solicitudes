// lib/features/auth/data/auth_repository.dart
//
// Repositorio de autenticación. Llama al backend NestJS, guarda tokens en
// TokenStore (flutter_secure_storage) y devuelve AuthSession.

import 'package:dio/dio.dart';

import '../../../core/network/api_endpoints.dart';
import '../../../core/storage/token_store.dart';
import '../domain/auth_session.dart';

class AuthRepository {
  AuthRepository({required this.dio, required this.tokenStore});

  final Dio dio;
  final TokenStore tokenStore;

  /// Login con email + password.
  /// Backend: POST /api/v1/auth/login → { accessToken, refreshToken, user, plaza }.
  Future<AuthSession> login(LoginRequest req) async {
    final resp = await dio.post<Map<String, dynamic>>(
      ApiEndpoints.login,
      data: req.toJson(),
    );
    final data = resp.data!;
    final user = data['user'] as Map<String, dynamic>? ?? const {};
    final plaza = data['plaza'] as Map<String, dynamic>?;

    final session = AuthSession(
      accessToken: data['accessToken'] as String,
      refreshToken: data['refreshToken'] as String,
      userId: user['id'] as String? ?? '',
      plazaId: (plaza?['id'] as String?) ?? (user['plazaId'] as String? ?? ''),
      email: user['email'] as String? ?? req.email,
      nombre: user['nombre'] as String? ?? '',
      roles: (user['roles'] as List?)?.cast<String>() ?? const [],
    );

    await tokenStore.writeSession(
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      plazaId: session.plazaId,
      userId: session.userId,
    );

    return session;
  }

  /// Logout → invalida tokens localmente y notifica al backend.
  Future<void> logout() async {
    try {
      await dio.post(ApiEndpoints.logout);
    } catch (_) {
      // Ignorar errores: el logout local es lo importante.
    }
    await tokenStore.clear();
  }

  /// Recupera la sesión actual si existe (lee tokens del secure storage).
  Future<AuthSession?> currentSession() async {
    final access = await tokenStore.readAccessToken();
    if (access == null) return null;
    // Llamada al backend para refrescar datos del usuario.
    try {
      final resp = await dio.get<Map<String, dynamic>>(ApiEndpoints.me);
      final user = resp.data!;
      final refresh = await tokenStore.readRefreshToken();
      final plazaId = await tokenStore.readPlazaId() ?? '';
      final userId = await tokenStore.readUserId() ?? '';
      return AuthSession(
        accessToken: access,
        refreshToken: refresh ?? '',
        userId: userId,
        plazaId: plazaId,
        email: user['email'] as String? ?? '',
        nombre: user['nombre'] as String? ?? '',
        roles: (user['roles'] as List?)?.cast<String>() ?? const [],
      );
    } catch (_) {
      await tokenStore.clear();
      return null;
    }
  }
}
// lib/core/storage/token_store.dart
//
// Wrapper sobre flutter_secure_storage para tokens JWT y selección de plaza activa.
// JWT es información sensible → EncryptedSharedPreferences (Android) / Keychain (iOS).

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class TokenStore {
  TokenStore([FlutterSecureStorage? storage])
      : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  static const _kAccessToken = 'plazapp.access_token';
  static const _kRefreshToken = 'plazapp.refresh_token';
  static const _kPlazaId = 'plazapp.plaza_id';
  static const _kUserId = 'plazapp.user_id';

  Future<String?> readAccessToken() => _storage.read(key: _kAccessToken);
  Future<String?> readRefreshToken() => _storage.read(key: _kRefreshToken);
  Future<String?> readPlazaId() => _storage.read(key: _kPlazaId);
  Future<String?> readUserId() => _storage.read(key: _kUserId);

  Future<void> writeSession({
    required String accessToken,
    required String refreshToken,
    required String plazaId,
    required String userId,
  }) async {
    await _storage.write(key: _kAccessToken, value: accessToken);
    await _storage.write(key: _kRefreshToken, value: refreshToken);
    await _storage.write(key: _kPlazaId, value: plazaId);
    await _storage.write(key: _kUserId, value: userId);
  }

  Future<void> updateAccessToken(String accessToken) =>
      _storage.write(key: _kAccessToken, value: accessToken);

  Future<void> clear() async {
    await _storage.delete(key: _kAccessToken);
    await _storage.delete(key: _kRefreshToken);
    await _storage.delete(key: _kPlazaId);
    await _storage.delete(key: _kUserId);
  }

  Future<bool> hasSession() async => (await readAccessToken()) != null;
}
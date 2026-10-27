import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Par de tokens del backend. [expiraEn] es la vida del access token.
class Tokens {
  const Tokens(this.accessToken, this.refreshToken, this.expiraEn);

  final String accessToken;
  final String refreshToken;
  final DateTime expiraEn;

  Map<String, String> toJson() => {
    'accessToken': accessToken,
    'refreshToken': refreshToken,
    'expiraEn': expiraEn.toUtc().toIso8601String(),
  };

  static Tokens fromJson(Map<String, dynamic> j) => Tokens(
    j['accessToken'] as String,
    j['refreshToken'] as String,
    DateTime.parse(j['expiraEn'] as String),
  );
}

/// Dónde se guardan los tokens. La app usa [SecureTokenStorage]; las pruebas,
/// [MemoryTokenStorage].
abstract class TokenStorage {
  Future<Tokens?> leer();
  Future<void> guardar(Tokens tokens);
  Future<void> borrar();
}

/// Keychain (iOS) / almacenamiento cifrado (Android). El par se guarda en una
/// sola clave para que la escritura sea atómica: el backend revoca todas las
/// sesiones si se reutiliza un refresh token ya rotado.
class SecureTokenStorage implements TokenStorage {
  SecureTokenStorage([FlutterSecureStorage? storage])
    : _storage = storage ?? const FlutterSecureStorage();

  static const _clave = 'plazapp.tokens';
  final FlutterSecureStorage _storage;

  @override
  Future<Tokens?> leer() async {
    final raw = await _storage.read(key: _clave);
    if (raw == null) return null;
    try {
      return Tokens.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } on Object {
      await borrar();
      return null;
    }
  }

  @override
  Future<void> guardar(Tokens tokens) =>
      _storage.write(key: _clave, value: jsonEncode(tokens.toJson()));

  @override
  Future<void> borrar() => _storage.delete(key: _clave);
}

class MemoryTokenStorage implements TokenStorage {
  Tokens? _tokens;

  @override
  Future<Tokens?> leer() async => _tokens;

  @override
  Future<void> guardar(Tokens tokens) async => _tokens = tokens;

  @override
  Future<void> borrar() async => _tokens = null;
}

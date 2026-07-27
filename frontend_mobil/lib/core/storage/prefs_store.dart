// lib/core/storage/prefs_store.dart
//
// Wrapper sobre shared_preferences para preferencias no sensibles:
//   - tema (light / dark / system)
//   - último tenant visitado
//   - filtros de la bandeja cacheados
//
// Para tokens y datos sensibles → TokenStore (flutter_secure_storage).

import 'package:shared_preferences/shared_preferences.dart';

class PrefsStore {
  PrefsStore._(this._prefs);

  static Future<PrefsStore> create() async {
    final prefs = await SharedPreferences.getInstance();
    return PrefsStore._(prefs);
  }

  final SharedPreferences _prefs;

  static const _kThemeMode = 'plazapp.theme_mode';
  static const _kLastTenantId = 'plazapp.last_tenant_id';
  static const _kLastFilters = 'plazapp.last_filters';

  // Tema
  String? readThemeMode() => _prefs.getString(_kThemeMode);
  Future<void> writeThemeMode(String mode) => _prefs.setString(_kThemeMode, mode);

  // Tenant
  String? readLastTenantId() => _prefs.getString(_kLastTenantId);
  Future<void> writeLastTenantId(String id) => _prefs.setString(_kLastTenantId, id);

  // Filtros (JSON-encoded map)
  String? readLastFilters() => _prefs.getString(_kLastFilters);
  Future<void> writeLastFilters(String json) => _prefs.setString(_kLastFilters, json);
}
// lib/features/auth/controllers/auth_controller.dart
//
// ChangeNotifier de autenticación. Maneja el estado de sesión (loading / error / success)
// y notifica a la UI cuando el usuario se loguea / desloguea.
//
// Consumido por LoginPage, RoleSelectorPage y los shells (para decidir a dónde enrutar).

import 'package:flutter/foundation.dart';

import '../data/auth_repository.dart';
import '../domain/auth_session.dart';

enum AuthStatus { unknown, unauthenticated, authenticated, loading }

class AuthController extends ChangeNotifier {
  AuthController({required this.repo});

  final AuthRepository repo;

  AuthStatus _status = AuthStatus.unknown;
  AuthSession? _session;
  String? _lastError;

  AuthStatus get status => _status;
  AuthSession? get session => _session;
  String? get lastError => _lastError;
  bool get isAuthenticated => _status == AuthStatus.authenticated && _session != null;

  /// Llamado al arrancar la app: rehidrata la sesión desde storage + me().
  Future<void> bootstrap() async {
    _status = AuthStatus.loading;
    notifyListeners();
    try {
      final s = await repo.currentSession();
      if (s != null) {
        _session = s;
        _status = AuthStatus.authenticated;
      } else {
        _status = AuthStatus.unauthenticated;
      }
    } catch (_) {
      _status = AuthStatus.unauthenticated;
    }
    notifyListeners();
  }

  Future<bool> login(String email, String password) async {
    _status = AuthStatus.loading;
    _lastError = null;
    notifyListeners();
    try {
      final s = await repo.login(LoginRequest(email: email, password: password));
      _session = s;
      _status = AuthStatus.authenticated;
      notifyListeners();
      return true;
    } catch (e) {
      _lastError = _humanError(e);
      _status = AuthStatus.unauthenticated;
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    await repo.logout();
    _session = null;
    _status = AuthStatus.unauthenticated;
    notifyListeners();
  }

  /// Limpia el error cuando la UI lo muestra.
  void clearError() {
    if (_lastError != null) {
      _lastError = null;
      notifyListeners();
    }
  }

  String _humanError(Object e) {
    if (e.toString().contains('401')) return 'Credenciales inválidas';
    if (e.toString().contains('SocketException') ||
        e.toString().contains('Connection')) {
      return 'No se pudo conectar al servidor';
    }
    return 'Error inesperado';
  }
}
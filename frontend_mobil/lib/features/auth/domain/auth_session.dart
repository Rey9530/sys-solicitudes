// lib/features/auth/domain/auth_session.dart
//
// Modelos de dominio para auth. Reflejan el shape del backend NestJS
// (ver packages/contracts/src/auth en el backend).

class AuthSession {
  final String accessToken;
  final String refreshToken;
  final String userId;
  final String plazaId;
  final String email;
  final String nombre;
  final List<String> roles; // 'superadmin' | 'admin_plaza' | 'inquilino'

  const AuthSession({
    required this.accessToken,
    required this.refreshToken,
    required this.userId,
    required this.plazaId,
    required this.email,
    required this.nombre,
    required this.roles,
  });

  factory AuthSession.fromJson(Map<String, dynamic> json) => AuthSession(
        accessToken: json['accessToken'] as String,
        refreshToken: json['refreshToken'] as String,
        userId: json['userId'] as String,
        plazaId: json['plazaId'] as String? ?? '',
        email: json['email'] as String,
        nombre: json['nombre'] as String,
        roles: (json['roles'] as List?)?.cast<String>() ?? const [],
      );

  bool get isInquilino => roles.contains('inquilino');
  bool get isAdminPlaza => roles.contains('admin_plaza');
  bool get isSuperadmin => roles.contains('superadmin');
}

class LoginRequest {
  final String email;
  final String password;
  const LoginRequest({required this.email, required this.password});

  Map<String, dynamic> toJson() => {'email': email, 'password': password};
}
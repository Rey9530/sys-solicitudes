// lib/core/network/api_client.dart
//
// Singleton de Dio con la config base (timeouts, headers, interceptor JWT).
// Se inyecta vía Provider en el árbol de widgets para que sea compartido.
//
// Uso:
//   final dio = context.read<Dio>();
//   final response = await dio.get('/solicitudes');

import 'package:dio/dio.dart';

import '../storage/token_store.dart';
import 'api_endpoints.dart';
import 'jwt_interceptor.dart';

class ApiClient {
  ApiClient({required this.tokenStore, required this.onSessionLost})
      : dio = Dio(BaseOptions(
          baseUrl: ApiConfig.baseUrl,
          connectTimeout: const Duration(seconds: 15),
          receiveTimeout: const Duration(seconds: 30),
          sendTimeout: const Duration(seconds: 60),
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        )) {
    dio.interceptors.add(
      JwtInterceptor(tokenStore: tokenStore, onSessionLost: onSessionLost),
    );
  }

  final Dio dio;
  final TokenStore tokenStore;

  /// Callback para redirigir al router cuando la sesión se pierde.
  final void Function() onSessionLost;

  /// Crea un FormData para multipart upload (adjuntos).
  static FormData multipartFromMap(Map<String, dynamic> fields) {
    final form = FormData();
    fields.forEach((key, value) {
      form.files.add(MapEntry(key, value as MultipartFile));
    });
    return form;
  }
}
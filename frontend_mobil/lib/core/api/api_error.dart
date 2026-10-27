import 'dart:convert';

/// Error de la API en formato RFC 7807 del backend
/// (`{ type, title, status, detail, code, meta, requestId }`).
///
/// La UI muestra [mensaje] y decide por [code], nunca por [status]: varios
/// códigos del backend salen con un status distinto al del catálogo.
class ApiError implements Exception {
  ApiError({
    required this.status,
    required this.code,
    required this.mensaje,
    this.meta,
  });

  /// Construye el error desde la respuesta HTTP. `detail` puede ser texto o
  /// lista (en `VALIDATION_ERROR` es una lista de `"campo: mensaje"`).
  factory ApiError.desdeRespuesta(
    int status,
    String body, {
    Map<String, String> headers = const {},
  }) {
    Map<String, dynamic> json = const {};
    try {
      final decodificado = jsonDecode(body);
      if (decodificado is Map<String, dynamic>) json = decodificado;
    } on FormatException {
      // Cuerpo no JSON (proxy, HTML): se usa el mensaje genérico.
    }
    final detail = json['detail'] ?? json['message'];
    final String mensaje;
    if (detail is List) {
      mensaje = detail.map((e) => '$e').join('; ');
    } else if (detail is String && detail.isNotEmpty) {
      mensaje = detail;
    } else {
      mensaje = (json['title'] as String?) ?? _mensajePorStatus(status);
    }
    final meta = <String, dynamic>{...?(json['meta'] as Map<String, dynamic>?)};
    final retry = int.tryParse(headers['retry-after'] ?? '');
    if (retry != null) meta.putIfAbsent('retryAfter', () => retry);
    return ApiError(
      status: status,
      code: (json['code'] as String?) ?? 'HTTP_$status',
      mensaje: mensaje,
      meta: meta.isEmpty ? null : meta,
    );
  }

  factory ApiError.sinConexion() => ApiError(
    status: 0,
    code: 'SIN_CONEXION',
    mensaje: 'No se pudo conectar con el servidor. Revisa tu conexión.',
  );

  factory ApiError.tiempoAgotado() => ApiError(
    status: 0,
    code: 'TIEMPO_AGOTADO',
    mensaje: 'El servidor tardó demasiado en responder. Intenta de nuevo.',
  );

  final int status;
  final String code;
  final String mensaje;
  final Map<String, dynamic>? meta;

  /// Segundos a esperar en un 429 (`Retry-After` o `meta.retryAfter`).
  int? get retryAfter {
    final v = meta?['retryAfter'];
    return v is int ? v : int.tryParse('${v ?? ''}');
  }

  @override
  String toString() => mensaje;
}

String _mensajePorStatus(int status) => switch (status) {
  401 => 'Tu sesión no es válida. Vuelve a iniciar sesión.',
  403 => 'No tienes permiso para esta acción.',
  404 => 'No se encontró el recurso.',
  409 => 'La operación entra en conflicto con el estado actual.',
  413 => 'El archivo es demasiado grande.',
  429 => 'Demasiadas solicitudes. Espera un momento.',
  >= 500 => 'Error del servidor. Intenta más tarde.',
  _ => 'No se pudo completar la operación.',
};

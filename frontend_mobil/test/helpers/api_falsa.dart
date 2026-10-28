import 'dart:convert';

import 'package:frontend_mobil/core/api/api_client.dart';
import 'package:frontend_mobil/core/auth/token_storage.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

/// Respuesta de error (o con status distinto de 200) para [apiFalsa].
class RespuestaFalsa {
  const RespuestaFalsa(this.status, [this.body, this.headers = const {}]);

  final int status;
  final Object? body;
  final Map<String, String> headers;
}

/// Manejador de una ruta falsa: devuelve el JSON a responder (200) o una
/// [RespuestaFalsa]. Puede devolver un `Future` (p. ej. de un `Completer`)
/// para simular una respuesta que tarda.
typedef ManejadorFalso = Object? Function(http.Request req);

/// Peticiones recibidas por la última [apiFalsa] (para verificar payloads).
final peticionesFalsas = <http.Request>[];

/// `ApiClient` contra un backend falso. Las claves son `'MÉTODO /ruta'`
/// relativas a `/api/v1` (sin query); un segmento `:x` acepta cualquier
/// valor, p. ej. `'GET /solicitudes/:id'`. Ruta no definida → 404.
ApiClient apiFalsa(
  Map<String, ManejadorFalso> rutas, {
  TokenStorage? tokens,
  bool conSesion = true,
}) {
  peticionesFalsas.clear();
  final almacen = tokens ?? MemoryTokenStorage();
  if (tokens == null && conSesion) {
    almacen.guardar(
      Tokens('ACCESS', 'REFRESH', DateTime.now().add(const Duration(hours: 1))),
    );
  }
  final cliente = MockClient((req) async {
    peticionesFalsas.add(req);
    final ruta = req.url.path.replaceFirst('/api/v1', '');
    for (final entrada in rutas.entries) {
      final partes = entrada.key.split(' ');
      if (partes[0] != req.method || !_coincide(partes[1], ruta)) continue;
      var r = entrada.value(req);
      if (r is Future<Object?>) r = await r;
      if (r is RespuestaFalsa) {
        return http.Response(
          r.body == null ? '' : jsonEncode(r.body),
          r.status,
          headers: {'content-type': 'application/json', ...r.headers},
        );
      }
      return http.Response(
        jsonEncode(r),
        req.method == 'POST' ? 201 : 200,
        headers: {'content-type': 'application/json; charset=utf-8'},
      );
    }
    return http.Response(
      jsonEncode({
        'code': 'NOT_FOUND',
        'detail': 'Sin ruta falsa: ${req.method} $ruta',
      }),
      404,
    );
  });
  return ApiClient(
    baseUrl: 'http://api.test/api/v1',
    tokens: almacen,
    cliente: cliente,
  );
}

bool _coincide(String patron, String ruta) {
  final a = patron.split('/');
  final b = ruta.split('/');
  if (a.length != b.length) return false;
  for (var i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) continue;
    if (a[i] != b[i]) return false;
  }
  return true;
}

/// Cuerpo JSON de una petición capturada.
Map<String, dynamic> cuerpoDe(http.Request req) =>
    jsonDecode(req.body) as Map<String, dynamic>;

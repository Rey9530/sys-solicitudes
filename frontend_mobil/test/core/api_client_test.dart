import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:frontend_mobil/core/api/api_client.dart';
import 'package:frontend_mobil/core/api/api_error.dart';
import 'package:frontend_mobil/core/auth/token_storage.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

const _base = 'http://api.test/api/v1';

http.Response _json(int status, Object body, {Map<String, String>? headers}) =>
    http.Response(
      jsonEncode(body),
      status,
      headers: {'content-type': 'application/json', ...?headers},
    );

Map<String, Object> _par(String access, String refresh) => {
  'accessToken': access,
  'refreshToken': refresh,
  'expiresIn': 3600,
  'user': {'id': 'u1'},
};

Future<MemoryTokenStorage> _conTokens({
  Duration vida = const Duration(hours: 1),
}) async {
  final s = MemoryTokenStorage();
  await s.guardar(Tokens('A1', 'R1', DateTime.now().add(vida)));
  return s;
}

void main() {
  test('agrega Bearer y x-plaza-id solo si hay plaza', () async {
    final headers = <Map<String, String>>[];
    final cliente = MockClient((req) async {
      headers.add(req.headers);
      return _json(200, {'ok': true});
    });
    String? plaza;
    final api = ApiClient(
      baseUrl: _base,
      tokens: await _conTokens(),
      cliente: cliente,
      plazaSeleccionada: () => plaza,
    );
    await api.get('/x');
    plaza = 'p-123';
    await api.get('/x');
    expect(headers[0]['Authorization'], 'Bearer A1');
    expect(headers[0].containsKey('x-plaza-id'), isFalse);
    expect(headers[1]['x-plaza-id'], 'p-123');
  });

  test('401 TOKEN_EXPIRED → refresca una vez y reintenta', () async {
    final tokens = await _conTokens();
    var llamadas = 0;
    final cliente = MockClient((req) async {
      if (req.url.path.endsWith('/auth/refresh')) {
        return _json(200, _par('A2', 'R2'));
      }
      llamadas++;
      if (req.headers['Authorization'] == 'Bearer A1') {
        return _json(401, {'code': 'TOKEN_EXPIRED', 'detail': 'expiró'});
      }
      return _json(200, {'dato': 1});
    });
    final api = ApiClient(baseUrl: _base, tokens: tokens, cliente: cliente);
    final r = await api.get('/x');
    expect(r, {'dato': 1});
    expect(llamadas, 2);
    final guardados = await tokens.leer();
    expect(guardados!.accessToken, 'A2');
    expect(guardados.refreshToken, 'R2');
  });

  test('refresh single-flight', () async {
    final tokens = await _conTokens();
    var refreshes = 0;
    final cliente = MockClient((req) async {
      if (req.url.path.endsWith('/auth/refresh')) {
        refreshes++;
        await Future<void>.delayed(const Duration(milliseconds: 30));
        return _json(200, _par('A2', 'R2'));
      }
      if (req.headers['Authorization'] == 'Bearer A1') {
        return _json(401, {'code': 'TOKEN_EXPIRED'});
      }
      return _json(200, {'ok': true});
    });
    final api = ApiClient(baseUrl: _base, tokens: tokens, cliente: cliente);
    final r = await Future.wait([api.get('/a'), api.get('/b'), api.get('/c')]);
    expect(r, everyElement({'ok': true}));
    expect(refreshes, 1);
  });

  test('REFRESH_INVALID cierra sesión', () async {
    final tokens = await _conTokens();
    var expirada = false;
    final cliente = MockClient((req) async {
      if (req.url.path.endsWith('/auth/refresh')) {
        return _json(401, {'code': 'REFRESH_INVALID', 'detail': 'revocado'});
      }
      return _json(401, {'code': 'TOKEN_EXPIRED'});
    });
    final api = ApiClient(
      baseUrl: _base,
      tokens: tokens,
      cliente: cliente,
      onSesionExpirada: () => expirada = true,
    );
    await expectLater(
      api.get('/x'),
      throwsA(isA<ApiError>().having((e) => e.code, 'code', 'REFRESH_INVALID')),
    );
    expect(expirada, isTrue);
    expect(await tokens.leer(), isNull);
  });

  test('refresh proactivo cuando quedan menos de 60 s', () async {
    final tokens = await _conTokens(vida: const Duration(seconds: 30));
    final orden = <String>[];
    final cliente = MockClient((req) async {
      orden.add(req.url.path.split('/').last);
      if (req.url.path.endsWith('/auth/refresh')) {
        return _json(200, _par('A2', 'R2'));
      }
      expect(req.headers['Authorization'], 'Bearer A2');
      return _json(200, {});
    });
    final api = ApiClient(baseUrl: _base, tokens: tokens, cliente: cliente);
    await api.get('/x');
    expect(orden, ['refresh', 'x']);
  });

  test('error 400 con detail lista', () async {
    final cliente = MockClient(
      (req) async => _json(400, {
        'code': 'VALIDATION_ERROR',
        'detail': ['a: x', 'b: y'],
      }),
    );
    final api = ApiClient(
      baseUrl: _base,
      tokens: await _conTokens(),
      cliente: cliente,
    );
    await expectLater(
      api.post('/x', body: {}),
      throwsA(
        isA<ApiError>()
            .having((e) => e.code, 'code', 'VALIDATION_ERROR')
            .having((e) => e.mensaje, 'mensaje', 'a: x; b: y')
            .having((e) => e.status, 'status', 400),
      ),
    );
  });

  test('429 guarda Retry-After en meta', () async {
    final cliente = MockClient(
      (req) async => _json(
        429,
        {'code': 'TOO_MANY_REQUESTS', 'detail': 'Demasiadas solicitudes'},
        headers: {'retry-after': '42'},
      ),
    );
    final api = ApiClient(
      baseUrl: _base,
      tokens: MemoryTokenStorage(),
      cliente: cliente,
    );
    await expectLater(
      api.login('a@b.com', 'x'),
      throwsA(isA<ApiError>().having((e) => e.retryAfter, 'retryAfter', 42)),
    );
  });

  test('query omite vacíos y serializa booleanos y listas', () async {
    late Uri url;
    final cliente = MockClient((req) async {
      url = req.url;
      return _json(200, {});
    });
    final api = ApiClient(
      baseUrl: _base,
      tokens: await _conTokens(),
      cliente: cliente,
    );
    await api.get(
      '/x',
      query: {
        'a': null,
        'b': '',
        'c': true,
        'd': ['1', '2'],
        'e': 5,
      },
    );
    expect(url.query, 'c=true&d=1%2C2&e=5');
  });

  test('subir manda multipart con el MIME declarado', () async {
    late String cuerpo;
    late String tipo;
    final cliente = MockClient((req) async {
      tipo = req.headers['content-type']!;
      cuerpo = latin1.decode(req.bodyBytes);
      return _json(201, {
        'adjunto': {'id': 'a1'},
      });
    });
    final api = ApiClient(
      baseUrl: _base,
      tokens: await _conTokens(),
      cliente: cliente,
    );
    final r = await api.subir(
      '/solicitudes/s1/adjuntos',
      nombreArchivo: 'plano.dwg',
      contenido: Uint8List.fromList([0x41, 0x43, 0x31, 0x30]),
      mimeType: 'application/dwg',
    );
    expect(r, {
      'adjunto': {'id': 'a1'},
    });
    expect(tipo, startsWith('multipart/form-data'));
    expect(cuerpo, contains('name="file"; filename="plano.dwg"'));
    expect(cuerpo, contains('content-type: application/dwg'));
  });

  test('sin conexión → SIN_CONEXION', () async {
    final cliente = MockClient(
      (req) async => throw const SocketException('down'),
    );
    final api = ApiClient(
      baseUrl: _base,
      tokens: await _conTokens(),
      cliente: cliente,
    );
    await expectLater(
      api.get('/x'),
      throwsA(isA<ApiError>().having((e) => e.code, 'code', 'SIN_CONEXION')),
    );
  });

  test('login guarda tokens y logout los borra', () async {
    final tokens = MemoryTokenStorage();
    final cliente = MockClient((req) async {
      if (req.url.path.endsWith('/auth/login')) {
        return _json(200, _par('A9', 'R9'));
      }
      if (req.url.path.endsWith('/auth/logout')) return http.Response('', 204);
      return _json(404, {});
    });
    final api = ApiClient(baseUrl: _base, tokens: tokens, cliente: cliente);
    final r = await api.login('a@b.com', 'x');
    expect((r['user'] as Map)['id'], 'u1');
    expect((await tokens.leer())!.accessToken, 'A9');
    await api.logout();
    expect(await tokens.leer(), isNull);
  });
}

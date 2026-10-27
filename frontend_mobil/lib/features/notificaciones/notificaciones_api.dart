import '../../core/api/api_client.dart';
import '../../core/api/paginado.dart';
import 'notificaciones_modelos.dart';

/// Log de emails transaccionales y desuscripciones (`/admin/notificaciones`).

Future<Paginado<EmailLog>> listarEmails(
  ApiClient api,
  FiltrosEmailLog f,
) async {
  final r = await api.get(
    '/notificaciones',
    query: {
      'page': f.pagina,
      'pageSize': 20,
      'estado': f.estado,
      'plantilla': f.plantilla,
      'destinatario': f.destinatario,
      'fechaDesde': f.desde,
      'fechaHasta': f.hasta,
    },
  ) as Map<String, dynamic>;
  return Paginado.fromJson(r, EmailLog.fromJson);
}

Future<EmailPreview> previewEmail(ApiClient api, String id) async {
  final r =
      await api.get('/notificaciones/$id/preview') as Map<String, dynamic>;
  return EmailPreview.fromJson(r);
}

/// Vuelve a encolar un email fallido (lo procesa el worker).
Future<void> reintentarEmail(ApiClient api, String id) =>
    api.post('/notificaciones/$id/reintentar');

/// Primeras 50 desuscripciones (como el web, sin paginar).
Future<List<Desuscripcion>> listarDesuscripciones(ApiClient api) async {
  final r = await api.get(
    '/notificaciones/unsubscribes',
    query: {'page': 1, 'pageSize': 50},
  ) as Map<String, dynamic>;
  return Paginado.fromJson(r, Desuscripcion.fromJson).items;
}

/// Vuelve a habilitar esa plantilla para ese email.
Future<void> resetearDesuscripcion(ApiClient api, String id) =>
    api.delete('/notificaciones/unsubscribes/$id');

/// HTML de un email → texto legible (la app no incrusta un navegador): quita
/// estilos y etiquetas, respeta párrafos y saltos, y deja los enlaces como
/// "texto (url)".
String htmlATexto(String html) {
  var t = html
      .replaceAll(
        RegExp(
          r'<(head|style|script)[^>]*>[\s\S]*?</\1>',
          caseSensitive: false,
        ),
        '',
      )
      .replaceAll(RegExp(r'<!--[\s\S]*?-->'), '');
  t = t.replaceAllMapped(
    RegExp(
      r'''<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)</a>''',
      caseSensitive: false,
    ),
    (m) {
      final texto = m[2]!.replaceAll(RegExp('<[^>]+>'), '').trim();
      final url = m[1]!;
      return texto.isEmpty || texto == url ? url : '$texto ($url)';
    },
  );
  t = t
      .replaceAll(RegExp(r'<br\s*/?>', caseSensitive: false), '\n')
      .replaceAll(
        RegExp(r'</(p|div|h[1-6]|li|tr|table|ul|ol)>', caseSensitive: false),
        '\n',
      )
      .replaceAll(RegExp(r'<li[^>]*>', caseSensitive: false), '• ')
      .replaceAll(RegExp('<[^>]+>'), '')
      .replaceAll('&nbsp;', ' ')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&quot;', '"')
      .replaceAll('&#39;', "'")
      .replaceAll('&middot;', '·')
      .replaceAll('&amp;', '&');
  final lineas = t
      .split('\n')
      .map((l) => l.replaceAll(RegExp(r'[ \t]+'), ' ').trim())
      .toList();
  final salida = <String>[];
  for (final l in lineas) {
    if (l.isEmpty && (salida.isEmpty || salida.last.isEmpty)) continue;
    salida.add(l);
  }
  while (salida.isNotEmpty && salida.last.isEmpty) {
    salida.removeLast();
  }
  return salida.join('\n');
}

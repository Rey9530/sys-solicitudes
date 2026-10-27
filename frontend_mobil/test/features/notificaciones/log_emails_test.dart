import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend_mobil/core/auth/sesion.dart';
import 'package:frontend_mobil/features/notificaciones/log_emails_page.dart';
import 'package:frontend_mobil/features/notificaciones/notificaciones_api.dart';
import 'package:frontend_mobil/features/notificaciones/notificaciones_modelos.dart';

import '../../helpers/api_falsa.dart';
import '../../helpers/pantallas.dart';

const _emailLargo =
    'recepcion.administracion.inversiones.pacifico.centroamericano@'
    'empresa-con-dominio-muy-largo.com.sv';

Map<String, Object?> _email(
  String id, {
  String estado = 'enviado',
  String plantilla = 'solicitud-aprobada',
  String? lastError,
}) => {
  'id': id,
  'plazaId': 'p1',
  'solicitudId': 's1',
  'solicitudCodigo': 'SOL-carga-qa-1234',
  'destinatario': _emailLargo,
  'plantilla': plantilla,
  'estado': estado,
  'reintentos': estado == 'fallido' ? 3 : 0,
  'lastError': lastError,
  'nextRetryAt': null,
  'sentAt': estado == 'enviado' ? '2026-10-27T19:50:00.047Z' : null,
  'createdAt': '2026-10-27T19:49:17.190Z',
};

Map<String, ManejadorFalso> _rutas() => {
  'GET /notificaciones': (_) => {
    'items': [
      _email('e1'),
      _email('e2', estado: 'fallido', lastError: 'SMTP 550 mailbox full'),
      _email('e3', estado: 'fallido', plantilla: 'reset-password'),
      _email('e4', estado: 'pendiente', plantilla: 'solicitud-cerrada'),
    ],
    'total': 212,
    'page': 1,
    'pageSize': 20,
    'totalPages': 11,
  },
  'GET /notificaciones/unsubscribes': (_) => {
    'items': [
      {
        'id': 'u1',
        'plazaId': 'p1',
        'email': _emailLargo,
        'plantilla': 'contrato-por-vencer',
        'createdAt': '2026-10-01T10:00:00.000Z',
      },
    ],
    'total': 1,
    'page': 1,
    'pageSize': 50,
    'totalPages': 1,
  },
  'GET /notificaciones/:id/preview': (_) => {
    'subject': 'Bienvenido a Plazapp · Plaza Demo',
    'html':
        '<!doctype html><html><head><style>p{color:red}</style></head>'
        '<body><h2>Bienvenido a Plazapp</h2><p>Hola E2E,</p>'
        '<p>Tu cuenta para <strong>Plaza Demo</strong> ya está activa.</p>'
        '<a href="http://localhost:3000/login">Ir a Plazapp</a></body></html>',
  },
  'POST /notificaciones/:id/reintentar': (_) =>
      _email('e2', estado: 'pendiente'),
  'DELETE /notificaciones/unsubscribes/:id': (_) => const RespuestaFalsa(204),
};

Future<void> _montar(WidgetTester tester, {List<String>? permisos}) async {
  await tester.pumpWidget(
    envolver(
      () => const Scaffold(body: LogEmailsPage()),
      overrides: overridesBase(
        apiFalsa(_rutas()),
        sesion: sesionDe(Rol.adminPlaza, permisos: permisos),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  setUp(prepararPruebas);

  testWidgets('log de emails responsive con textos largos', (tester) async {
    await probarEnTamanos(
      tester,
      () => const Scaffold(body: LogEmailsPage()),
      overrides: overridesBase(
        apiFalsa(_rutas()),
        sesion: sesionDe(Rol.adminPlaza),
      ),
      alPintar: (_, _) async {
        expect(
          find.text(
            '212 emails en el log. Los fallidos se pueden reintentar '
            'manualmente.',
          ),
          findsOneWidget,
        );
        // Solo el fallido que no es de reset de contraseña se reintenta.
        expect(find.text('Reintentar', skipOffstage: false), findsOneWidget);
        expect(find.text('Ver', skipOffstage: false), findsNWidgets(4));
        // Las desuscripciones quedan al final: se bajan para pintarlas.
        await tester.scrollUntilVisible(
          find.text('Resetear'),
          300,
          scrollable: find.byType(Scrollable).first,
        );
        expect(tester.takeException(), isNull);
      },
    );
  });

  testWidgets('sin permisos no muestra Ver, Reintentar ni Resetear', (
    tester,
  ) async {
    await _montar(tester, permisos: ['notificaciones.ver_log']);
    expect(find.text('Ver', skipOffstage: false), findsNothing);
    expect(find.text('Reintentar', skipOffstage: false), findsNothing);
    expect(find.text('Resetear', skipOffstage: false), findsNothing);
    await tester.scrollUntilVisible(
      find.text('No hay desuscripciones registradas.'),
      200,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('No hay desuscripciones registradas.'), findsOneWidget);
  });

  testWidgets('"Reintentar" llama al backend y recarga', (tester) async {
    await _montar(tester);
    final boton = find.text('Reintentar');
    await tester.ensureVisible(boton);
    await tester.pumpAndSettle();
    await tester.tap(boton);
    await tester.pumpAndSettle();
    expect(
      peticionesFalsas.where(
        (r) => r.method == 'POST' && r.url.path.endsWith('/e2/reintentar'),
      ),
      hasLength(1),
    );
    expect(
      peticionesFalsas.where(
        (r) => r.method == 'GET' && r.url.path.endsWith('/notificaciones'),
      ),
      hasLength(2),
    );
  });

  testWidgets('"Resetear" pide confirmación; cancelar no hace nada', (
    tester,
  ) async {
    await _montar(tester);
    final boton = find.text('Resetear');
    await tester.scrollUntilVisible(
      boton,
      200,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pumpAndSettle();

    await tester.tap(boton);
    await tester.pumpAndSettle();
    expect(find.text('Sí, resetear'), findsOneWidget);
    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();
    expect(peticionesFalsas.where((r) => r.method == 'DELETE'), isEmpty);

    await tester.tap(boton);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Sí, resetear'));
    await tester.pumpAndSettle();
    final borrado = peticionesFalsas.singleWhere((r) => r.method == 'DELETE');
    expect(borrado.url.path, '/api/v1/notificaciones/unsubscribes/u1');
  });

  testWidgets('filtro de estado vuelve a pedir el log', (tester) async {
    await _montar(tester);
    await tester.tap(
      find.widgetWithText(DropdownButtonFormField<String?>, 'Estado'),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('fallido').last);
    await tester.pumpAndSettle();
    final ultima = peticionesFalsas
        .lastWhere((r) => r.url.path.endsWith('/notificaciones'))
        .url
        .queryParameters;
    expect(ultima, {'page': '1', 'pageSize': '20', 'estado': 'fallido'});
  });

  testWidgets('"Ver" muestra asunto, destinatario y el contenido legible', (
    tester,
  ) async {
    await _montar(tester);
    await tester.tap(find.text('Ver').first);
    await tester.pumpAndSettle();
    expect(find.text('Bienvenido a Plazapp · Plaza Demo'), findsOneWidget);
    expect(find.text('Para: $_emailLargo'), findsOneWidget);
    expect(
      find.textContaining('Ir a Plazapp (http://localhost:3000/login)'),
      findsOneWidget,
    );
  });

  testWidgets('vista del email responsive', (tester) async {
    await probarEnTamanos(
      tester,
      () => Scaffold(
        body: VistaEmail(
          destinatario: _emailLargo,
          preview: EmailPreview.fromJson({
            'subject': 'Asunto ' * 20,
            'html': '<p>${'Contenido largo ' * 80}</p>',
          }),
        ),
      ),
      overrides: overridesBase(apiFalsa({}), sesion: sesionDe(Rol.adminPlaza)),
    );
  });

  test('htmlATexto deja el email legible', () {
    final texto = htmlATexto(
      '<html><head><style>.x{}</style></head><body>'
      '<h2>Hola &amp; bienvenido</h2><p>Línea 1<br>Línea 2</p>'
      '<ul><li>Uno</li><li>Dos</li></ul>'
      '<a href="https://app.plazapp.com">https://app.plazapp.com</a>'
      '</body></html>',
    );
    expect(
      texto,
      'Hola & bienvenido\nLínea 1\nLínea 2\n• Uno\n• Dos\n\n'
      'https://app.plazapp.com',
    );
    expect(texto, isNot(contains('.x{}')));
  });
}

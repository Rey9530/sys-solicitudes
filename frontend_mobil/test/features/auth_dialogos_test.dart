import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend_mobil/core/api/api_client.dart';
import 'package:frontend_mobil/core/auth/sesion.dart';
import 'package:frontend_mobil/core/auth/token_storage.dart';
import 'package:frontend_mobil/features/auth/cambiar_password_dialog.dart';
import 'package:frontend_mobil/features/auth/reset_password_page.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import '../helpers/pantallas.dart';

/// `ApiClient` cuyas respuestas espera a que la prueba complete [respuesta]
/// (para cerrar la pantalla mientras la petición viaja).
ApiClient _apiPendiente(Completer<http.Response> respuesta) {
  final tokens = MemoryTokenStorage()
    ..guardar(Tokens('A', 'R', DateTime.now().add(const Duration(hours: 1))));
  return ApiClient(
    baseUrl: 'http://api.test/api/v1',
    tokens: tokens,
    cliente: MockClient((_) => respuesta.future),
  );
}

http.Response _error(int status, String code) => http.Response(
  jsonEncode({'code': code, 'detail': 'Error $code'}),
  status,
  headers: {'content-type': 'application/json'},
);

void main() {
  setUp(prepararPruebas);

  testWidgets('cambiar contraseña: no se cierra tocando fuera y un error '
      'tras cerrarlo no rompe', (tester) async {
    final respuesta = Completer<http.Response>();
    await tester.pumpWidget(
      envolver(
        () => Scaffold(
          body: Builder(
            builder: (context) => TextButton(
              onPressed: () => mostrarCambiarPassword(context),
              child: const Text('Abrir'),
            ),
          ),
        ),
        overrides: overridesBase(
          _apiPendiente(respuesta),
          sesion: sesionDe(Rol.adminPlaza),
        ),
      ),
    );
    await tester.tap(find.text('Abrir'));
    await tester.pumpAndSettle();

    // barrierDismissible: false.
    await tester.tapAt(const Offset(5, 5));
    await tester.pumpAndSettle();
    expect(find.byType(AlertDialog), findsOneWidget);

    final campos = find.byType(TextFormField);
    await tester.enterText(campos.at(0), 'Actual123');
    await tester.enterText(campos.at(1), 'Nueva1234');
    await tester.enterText(campos.at(2), 'Nueva1234');
    await tester.tap(find.widgetWithText(FilledButton, 'Cambiar contraseña'));
    await tester.pump();
    expect(find.text('Guardando…'), findsOneWidget);

    // El diálogo se cierra (p. ej. «atrás» en Android) con la petición en
    // vuelo; luego el backend responde con error.
    Navigator.of(tester.element(find.byType(AlertDialog))).pop();
    await tester.pumpAndSettle();
    respuesta.complete(_error(400, 'INVALID_CURRENT_PASSWORD'));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });

  testWidgets('restablecer contraseña: salir con la petición en vuelo no '
      'rompe', (tester) async {
    final respuesta = Completer<http.Response>();
    final visible = ValueNotifier(true);
    addTearDown(visible.dispose);
    await tester.pumpWidget(
      envolver(
        () => ValueListenableBuilder<bool>(
          valueListenable: visible,
          builder: (_, ver, _) =>
              ver ? const ResetPasswordPage() : const Text('Login'),
        ),
        overrides: overridesBase(_apiPendiente(respuesta)),
      ),
    );
    await tester.enterText(find.byType(TextFormField), 'yo@demo.com');
    await tester.tap(find.text('Enviar enlace'));
    await tester.pump();
    expect(find.text('Enviando…'), findsOneWidget);

    visible.value = false;
    await tester.pumpAndSettle();
    respuesta.complete(http.Response('', 204));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(find.text('Login'), findsOneWidget);
  });
}

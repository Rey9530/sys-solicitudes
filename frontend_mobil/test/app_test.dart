import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend_mobil/app.dart';
import 'package:frontend_mobil/core/api/api_providers.dart';

import 'helpers/api_falsa.dart';
import 'helpers/pantallas.dart';

void main() {
  setUp(prepararPruebas);

  testWidgets('sin sesión arranca en el login', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          apiClientProvider.overrideWithValue(apiFalsa({}, conSesion: false)),
        ],
        child: const PlazappApp(),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Plazapp'), findsOneWidget);
    expect(find.text('Inicia sesión'), findsOneWidget);
  });
}

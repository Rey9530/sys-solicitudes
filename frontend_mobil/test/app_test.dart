import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend_mobil/app.dart';

void main() {
  testWidgets('arranca y muestra Plazapp', (tester) async {
    await tester.pumpWidget(const ProviderScope(child: PlazappApp()));
    expect(find.text('Plazapp'), findsOneWidget);
  });
}

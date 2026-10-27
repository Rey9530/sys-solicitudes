import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend_mobil/core/auth/sesion.dart';
import 'package:frontend_mobil/features/dashboard/dashboard_page.dart';

import '../../helpers/api_falsa.dart';
import '../../helpers/pantallas.dart';
import 'dashboard_fixtures.dart';

void main() {
  setUp(prepararPruebas);

  testWidgets('dashboard responsive con datos reales y textos largos', (
    tester,
  ) async {
    await probarEnTamanos(
      tester,
      () => const Scaffold(body: DashboardPage()),
      overrides: overridesBase(
        apiFalsa(rutasDashboard()),
        sesion: sesionDe(Rol.adminPlaza),
      ),
      alPintar: (_, _) async {
        expect(find.text('Dashboard'), findsOneWidget);
        expect(find.text('Auto-refresh 5 min'), findsOneWidget);
        expect(find.text('Pendientes'), findsOneWidget);
        expect(find.text('87%'), findsOneWidget);
        expect(find.text('12.5 h'), findsOneWidget);
        expect(find.text('Fuga & goteo'), findsOneWidget);
        expect(find.text('Sin solicitudes pendientes.'), findsNothing);
      },
    );
  });

  testWidgets('sin permisos de indicadores muestra el aviso, sin llamar a la '
      'API', (tester) async {
    await tester.pumpWidget(
      envolver(
        () => const Scaffold(body: DashboardPage()),
        overrides: overridesBase(
          apiFalsa(rutasDashboard()),
          sesion: sesionDe(Rol.adminPlaza, permisos: ['locales.listar']),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(
      find.text('No tienes permiso para ver los indicadores.'),
      findsOneWidget,
    );
    expect(peticionesFalsas, isEmpty);
  });

  testWidgets('403 PERMISSION_DENIED del backend muestra el mismo aviso', (
    tester,
  ) async {
    await tester.pumpWidget(
      envolver(
        () => const Scaffold(body: DashboardPage()),
        overrides: overridesBase(
          apiFalsa({
            'GET /reportes/kpis': (_) => const RespuestaFalsa(403, {
              'code': 'PERMISSION_DENIED',
              'detail': 'No tienes permiso para realizar esta acción.',
            }),
            'GET /reportes/dashboard': (_) => graficasFalsas(),
          }),
          sesion: sesionDe(Rol.adminPlaza),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(
      find.text('No tienes permiso para ver los indicadores.'),
      findsOneWidget,
    );
  });

  testWidgets('otro error muestra "No se pudieron cargar los KPIs."', (
    tester,
  ) async {
    await tester.pumpWidget(
      envolver(
        () => const Scaffold(body: DashboardPage()),
        overrides: overridesBase(
          apiFalsa({
            'GET /reportes/kpis': (_) => kpisFalsos(),
            'GET /reportes/dashboard': (_) =>
                const RespuestaFalsa(500, {'code': 'INTERNAL_ERROR'}),
          }),
          sesion: sesionDe(Rol.adminPlaza),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('No se pudieron cargar los KPIs.'), findsOneWidget);
    expect(find.text('Reintentar'), findsOneWidget);
  });

  testWidgets('sin datos muestra los vacíos del web', (tester) async {
    await tester.pumpWidget(
      envolver(
        () => const Scaffold(body: DashboardPage()),
        overrides: overridesBase(
          apiFalsa({
            'GET /reportes/kpis': (_) => {
              ...kpisFalsos(),
              'tasaAprobacion': null,
              'tiempoMedioRespuestaHoras': null,
              'top5Antiguedad': <Object>[],
            },
            'GET /reportes/dashboard': (_) => {
              'tendenciaMensual': <Object>[],
              'porTipo': <Object>[],
              'porPrioridad': <Object>[],
              'actividadReciente': <Object>[],
            },
          }),
          sesion: sesionDe(Rol.adminPlaza),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Sin solicitudes pendientes.'), findsOneWidget);
    expect(find.text('Sin actividad registrada.'), findsOneWidget);
    expect(find.text('—'), findsNWidgets(2));
  });

  testWidgets('el código del top 5 abre el detalle de la solicitud', (
    tester,
  ) async {
    await tester.pumpWidget(
      envolver(
        () => const Scaffold(body: DashboardPage()),
        overrides: overridesBase(
          apiFalsa(rutasDashboard()),
          sesion: sesionDe(Rol.adminPlaza),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('SOL-DEMO-3').first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('SOL-DEMO-3').first);
    await tester.pumpAndSettle();
    expect(find.text('Ruta: /admin/solicitudes/s-2'), findsOneWidget);
  });

  testWidgets('se recarga solo cada 5 min', (tester) async {
    await tester.pumpWidget(
      envolver(
        () => const Scaffold(body: DashboardPage()),
        overrides: overridesBase(
          apiFalsa(rutasDashboard()),
          sesion: sesionDe(Rol.adminPlaza),
        ),
      ),
    );
    await tester.pumpAndSettle();
    int kpis() => peticionesFalsas
        .where((r) => r.url.path.endsWith('/reportes/kpis'))
        .length;
    expect(kpis(), 1);
    await tester.pump(const Duration(minutes: 5));
    await tester.pumpAndSettle();
    expect(kpis(), 2);
  });
}

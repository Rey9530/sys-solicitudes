import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend_mobil/core/auth/sesion.dart';
import 'package:frontend_mobil/core/theme/colores.dart';
import 'package:frontend_mobil/core/widgets/badges.dart';
import 'package:frontend_mobil/core/widgets/campos.dart';
import 'package:frontend_mobil/core/widgets/can.dart';
import 'package:frontend_mobil/core/widgets/dialogos.dart';
import 'package:frontend_mobil/core/widgets/lista_responsive.dart';
import 'package:frontend_mobil/core/widgets/pagina.dart';
import 'package:frontend_mobil/core/widgets/paginador.dart';

import '../helpers/api_falsa.dart';
import '../helpers/pantallas.dart';

const _largo =
    'Remodelación integral del local L-SOL-1 con cambio de piso, cielo falso, '
    'iluminación y fachada; incluye trabajos nocturnos y retiro de ripio';

class _Fila {
  const _Fila(this.codigo, this.titulo, this.estado);
  final String codigo;
  final String titulo;
  final String estado;
}

const _filas = [
  _Fila('SOL-carga-qa-1234', _largo, 'requerida_subsanacion'),
  _Fila('SOL-DEMO-2', 'Fuga de agua', 'aprobada'),
];

final _columnas = <ColumnaLista<_Fila>>[
  ColumnaLista(titulo: 'Código', principal: true, celda: (f) => Text(f.codigo)),
  ColumnaLista(
    titulo: 'Título',
    celda: (f) => Text(f.titulo, maxLines: 2, overflow: TextOverflow.ellipsis),
  ),
  ColumnaLista(titulo: 'Estado', celda: (f) => EstadoSolicitudBadge(f.estado)),
  ColumnaLista(titulo: 'Prioridad', celda: (_) => const PrioridadBadge('A')),
  ColumnaLista(titulo: 'SLA', celda: (_) => const SlaSemaforo('amarillo')),
];

Widget _pantallaCompleta() => Scaffold(
  body: ContenidoPagina(
    children: [
      EncabezadoPagina(
        titulo: _largo,
        subtitulo: '105 resultados · ordenadas por fecha, más reciente primero',
        badges: const [
          EstadoSolicitudBadge('requerida_subsanacion'),
          PrioridadBadge('B'),
        ],
        acciones: [
          FilledButton(onPressed: () {}, child: const Text('Nueva solicitud')),
          OutlinedButton(onPressed: () {}, child: const Text('Exportar CSV')),
        ],
        rutaVolver: '/admin/solicitudes',
      ),
      ListaResponsive<_Fila>(items: _filas, columnas: _columnas),
      Paginador(pagina: 5, totalPaginas: 20, onCambiar: (_) {}),
      const KeyValueGrid([
        ('Solicitante', Text('María Pérez (Tienda Sol S.A. de C.V.)')),
        ('Categoría / Subcategoría', Text('Eventos / Evento')),
        ('Fecha inicio', Text('01-10-2026')),
        ('Hora inicio', Text('3:42 pm')),
      ]),
      const SizedBox(height: 12),
      CampoFecha(
        label: 'Fecha inicio',
        valorYmd: '2026-10-30',
        onChanged: (_) {},
      ),
      const SizedBox(height: 12),
      CampoHora(label: 'Hora inicio', valorHhmm: '15:42', onChanged: (_) {}),
    ],
  ),
);

void main() {
  setUp(prepararPruebas);

  testWidgets('pedirTexto: Volver devuelve null', (tester) async {
    String? resultado = 'sin tocar';
    await tester.pumpWidget(
      envolver(
        () => Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () async => resultado = await pedirTexto(
                context,
                titulo: 'Cancelar solicitud',
                textoConfirmar: 'Sí, cancelar',
              ),
              child: const Text('abrir'),
            ),
          ),
        ),
        overrides: overridesBase(apiFalsa({})),
      ),
    );
    await tester.tap(find.text('abrir'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Volver'));
    await tester.pumpAndSettle();
    expect(resultado, isNull);
  });

  testWidgets('pedirTexto obligatorio deshabilita confirmar hasta escribir', (
    tester,
  ) async {
    String? resultado;
    await tester.pumpWidget(
      envolver(
        () => Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () async => resultado = await pedirTexto(
                context,
                titulo: 'Rechazar',
                textoConfirmar: 'Rechazar solicitud',
                obligatorio: true,
              ),
              child: const Text('abrir'),
            ),
          ),
        ),
        overrides: overridesBase(apiFalsa({})),
      ),
    );
    await tester.tap(find.text('abrir'));
    await tester.pumpAndSettle();
    final boton = find.byKey(const Key('dialogo-confirmar'));
    expect(tester.widget<FilledButton>(boton).onPressed, isNull);
    await tester.enterText(
      find.byKey(const Key('dialogo-texto')),
      '  Falta el plano  ',
    );
    await tester.pump();
    await tester.tap(boton);
    await tester.pumpAndSettle();
    expect(resultado, 'Falta el plano');
  });

  testWidgets('confirmar devuelve false al cancelar', (tester) async {
    bool? resultado;
    await tester.pumpWidget(
      envolver(
        () => Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () async => resultado = await confirmar(
                context,
                titulo: '¿Eliminar?',
                textoConfirmar: 'Sí, eliminar',
                destructiva: true,
              ),
              child: const Text('abrir'),
            ),
          ),
        ),
        overrides: overridesBase(apiFalsa({})),
      ),
    );
    await tester.tap(find.text('abrir'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();
    expect(resultado, isFalse);
  });

  testWidgets(
    'ListaResponsive: tarjetas en teléfono, tabla en tablet horizontal',
    (tester) async {
      await probarEnTamanos(
        tester,
        () => Scaffold(
          body: ContenidoPagina(
            children: [ListaResponsive(items: _filas, columnas: _columnas)],
          ),
        ),
        overrides: overridesBase(apiFalsa({})),
        alPintar: (tamano, _) async {
          // ContenidoPagina deja 16 px por lado: la tabla aparece con ≥ 932 px.
          final esperaTabla = tamano.width - 32 >= anchoTabla;
          expect(
            find.byType(DataTable),
            esperaTabla ? findsOneWidget : findsNothing,
          );
        },
      );
    },
  );

  test('paginasVisibles', () {
    expect(paginasVisibles(5, 20), [1, null, 4, 5, 6, null, 20]);
    expect(paginasVisibles(3, 20), [1, 2, 3, 4, null, 20]);
    expect(paginasVisibles(1, 3), [1, 2, 3]);
  });

  testWidgets('etiquetas de estado', (tester) async {
    await tester.pumpWidget(
      envolver(
        () =>
            const Scaffold(body: EstadoSolicitudBadge('requerida_subsanacion')),
        overrides: overridesBase(apiFalsa({})),
      ),
    );
    expect(find.text('Requiere subsanación'), findsOneWidget);
    expect(ColoresPlazapp.prioridades.keys, ['A', 'B', 'C', 'D', 'F']);
  });

  testWidgets('Can oculta sin permiso', (tester) async {
    await tester.pumpWidget(
      envolver(
        () => const Scaffold(
          body: Column(
            children: [
              Can(permiso: 'locales.crear', child: Text('crear')),
              Can(permiso: ['x', 'locales.listar'], child: Text('listar')),
            ],
          ),
        ),
        overrides: overridesBase(
          apiFalsa({}),
          sesion: sesionDe(Rol.adminPlaza, permisos: ['locales.listar']),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('crear'), findsNothing);
    expect(find.text('listar'), findsOneWidget);
  });

  testWidgets(
    'pantalla con todos los widgets: sin desbordes en 4 tamaños y 2 temas',
    (tester) async {
      await probarEnTamanos(
        tester,
        _pantallaCompleta,
        overrides: overridesBase(apiFalsa({})),
      );
    },
  );
}

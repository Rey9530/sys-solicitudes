import 'dart:async';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend_mobil/core/adjuntos/adjuntos.dart';
import 'package:frontend_mobil/core/adjuntos/adjuntos_seccion.dart';
import 'package:frontend_mobil/core/adjuntos/mime_permitidos.dart';
import 'package:frontend_mobil/core/auth/sesion.dart';
import 'package:frontend_mobil/core/widgets/pagina.dart';

import '../helpers/api_falsa.dart';
import '../helpers/pantallas.dart';

/// Selector de archivos falso (los pickers nativos no existen en pruebas).
class _SelectorFalso extends SelectorArchivos {
  const _SelectorFalso(this.archivos);
  final List<ArchivoElegido> archivos;

  @override
  Future<List<ArchivoElegido>> elegirArchivos({
    List<String>? extensiones,
  }) async => archivos;
}

Adjunto _adjunto(int i) => Adjunto(
  id: 'a$i',
  nombreOriginal: 'archivo-con-un-nombre-bastante-largo-para-probar-$i.pdf',
  mimeType: 'application/pdf',
  tamanoBytes: 2048,
  createdAt: '2026-10-27T18:00:00Z',
);

void main() {
  setUp(prepararPruebas);

  test('MIME declarado por extensión', () {
    expect(mimeParaArchivo('plano.DWG'), 'application/dwg');
    expect(mimeParaArchivo('video.mov'), 'video/quicktime');
    expect(mimeParaArchivo('foto.jpeg'), 'image/jpeg');
    expect(mimeParaArchivo('script.exe'), isNull);
    expect(mimeParaArchivo('sin-extension'), isNull);
    expect(
      mimeParaArchivo('doc.pdf', soloExtensiones: extensionesImagen),
      isNull,
    );
    expect(formatTamano(1536), '1.5 KB');
  });

  testWidgets('rechaza archivos de más de 50 MB y tipos no permitidos', (
    tester,
  ) async {
    final subidos = <String>[];
    final grande = ArchivoElegido(
      'enorme.pdf',
      Uint8List(tamanoMaxAdjuntoBytes + 1),
    );
    final exe = ArchivoElegido('virus.exe', Uint8List(10));
    final ok = ArchivoElegido('foto.png', Uint8List(10));
    await tester.pumpWidget(
      envolver(
        () => Scaffold(
          body: AdjuntosSeccion(
            adjuntos: const [],
            puedeSubir: true,
            subir: (nombre, bytes, mime) async => subidos.add('$nombre|$mime'),
          ),
        ),
        overrides: [
          ...overridesBase(apiFalsa({}), sesion: sesionDe(Rol.inquilino)),
          selectorArchivosProvider.overrideWithValue(
            _SelectorFalso([grande, exe, ok]),
          ),
        ],
      ),
    );
    await tester.tap(find.byKey(const Key('adjuntos-subir')));
    await tester.pumpAndSettle();
    expect(subidos, ['foto.png|image/png']);
  });

  testWidgets('cambiar de pestaña durante la subida no descarta archivos', (
    tester,
  ) async {
    final subidos = <String>[];
    final primera = Completer<void>();
    var cambios = 0;
    final visible = ValueNotifier(true);
    addTearDown(visible.dispose);
    await tester.pumpWidget(
      envolver(
        () => Scaffold(
          body: ValueListenableBuilder<bool>(
            valueListenable: visible,
            builder: (_, ver, _) => ver
                ? AdjuntosSeccion(
                    adjuntos: const [],
                    puedeSubir: true,
                    subir: (nombre, bytes, mime) async {
                      if (subidos.isEmpty) await primera.future;
                      subidos.add(nombre);
                    },
                    alCambiar: () => cambios++,
                  )
                : const Text('Otra pestaña'),
          ),
        ),
        overrides: [
          ...overridesBase(apiFalsa({}), sesion: sesionDe(Rol.inquilino)),
          selectorArchivosProvider.overrideWithValue(
            _SelectorFalso([
              ArchivoElegido('a.pdf', Uint8List(10)),
              ArchivoElegido('b.png', Uint8List(10)),
            ]),
          ),
        ],
      ),
    );
    await tester.tap(find.byKey(const Key('adjuntos-subir')));
    await tester.pump();
    expect(find.text('Subiendo 2 archivo(s)…'), findsOneWidget);

    // Se cambia de pestaña mientras sube el primero: la sección se desmonta.
    visible.value = false;
    await tester.pump();
    primera.complete();
    await tester.pumpAndSettle();
    expect(subidos, ['a.pdf', 'b.png']);
    expect(cambios, 1);
  });

  testWidgets('con el máximo de adjuntos oculta los botones de subida', (
    tester,
  ) async {
    await tester.pumpWidget(
      envolver(
        () => Scaffold(
          body: ContenidoPagina(
            children: [
              AdjuntosSeccion(
                adjuntos: [for (var i = 0; i < 10; i++) _adjunto(i)],
                puedeSubir: true,
                subir: (_, _, _) async {},
              ),
            ],
          ),
        ),
        overrides: overridesBase(apiFalsa({}), sesion: sesionDe(Rol.inquilino)),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('adjuntos-subir')), findsNothing);
    expect(find.text('Máximo 10 adjuntos.'), findsOneWidget);
  });

  testWidgets('adjuntos responsive', (tester) async {
    await probarEnTamanos(
      tester,
      () => Scaffold(
        body: ContenidoPagina(
          children: [
            AdjuntosSeccion(
              adjuntos: [_adjunto(1), _adjunto(2)],
              puedeSubir: true,
              subir: (_, _, _) async {},
            ),
          ],
        ),
      ),
      overrides: overridesBase(apiFalsa({}), sesion: sesionDe(Rol.inquilino)),
    );
  });
}

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend_mobil/core/format/fechas.dart';
import 'package:integration_test/integration_test.dart';

import 'helpers.dart';

/// Ciclo de vida completo de una solicitud en el dispositivo, contra el
/// backend real (igual que `frontend/e2e/flujo-solicitud.spec.ts`):
/// wizard → borrador → enviar → (admin) tomar → pedir subsanación →
/// (inquilino) reenviar → (admin) tomar → aprobar → cerrar.
void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  final titulo = 'E2E-MOVIL-${DateTime.now().millisecondsSinceEpoch}';

  testWidgets('ciclo completo de una solicitud', (tester) async {
    // ── Inquilino: wizard ─────────────────────────────────────────────────
    await arrancarApp(tester);
    await iniciarSesion(tester, 'inquilino@demo.com');
    await esperar(tester, find.byKey(const Key('nueva-solicitud')));
    await tocar(tester, find.byKey(const Key('nueva-solicitud')));
    await esperar(tester, find.byKey(const Key('wz-tipo')));

    await elegir(tester, const Key('wz-tipo'), 'Mantenimiento');
    // Única categoría seed con subcategoría activa en la plaza demo.
    await elegir(tester, const Key('wz-categoria'), 'Eventos');
    await elegir(tester, const Key('wz-subcategoria'), 'Evento', parcial: true);
    await captura(binding, tester, 'flujo-01-wizard-paso1');
    await tocar(tester, find.byKey(const Key('wizard-siguiente')));

    await esperar(tester, find.byKey(const Key('wz-local')));
    await elegir(tester, const Key('wz-local'), 'L-SOL-1', parcial: true);
    await escribir(tester, 'wz-titulo', titulo);
    await escribir(
      tester,
      'wz-descripcion',
      'Fuga de agua en el baño. Creada por la E2E móvil.',
    );
    await escribir(tester, 'empresa-nombre', 'Fontanería Móvil S.A.');
    await escribir(tester, 'empresa-responsable', 'Responsable Móvil');
    await escribir(tester, 'empresa-telefono', '+503 7000 0000');
    await escribir(tester, 'empresa-email', 'movil@example.com');
    await escribir(tester, 'emergencia-contacto', 'Contacto Móvil');
    await escribir(tester, 'emergencia-telefono', '+503 7000 0001');
    final fecha = fechaPlazaHoy(dias: 3);
    await elegirFecha(tester, const Key('wz-fecha-inicio'), fecha);
    await elegirFecha(tester, const Key('wz-fecha-fin'), fecha);
    await aceptarHora(tester, const Key('wz-hora-inicio'));
    await aceptarHora(tester, const Key('wz-hora-fin'));
    await escribir(tester, 'wz-area-afectada', 'Baño del local');
    await escribir(tester, 'asistentes-estimados', '1');
    await escribir(tester, 'asistente-0-nombre', 'Técnico Móvil');
    await escribir(tester, 'asistente-0-documento', '00000000-0');
    await captura(binding, tester, 'flujo-02-wizard-paso2');
    await tocar(tester, find.byKey(const Key('wizard-siguiente')));

    await buscarConScroll(tester, find.byKey(const Key('wizard-guardar')));
    await captura(binding, tester, 'flujo-03-wizard-revision');
    await tocar(tester, find.byKey(const Key('wizard-guardar')));
    await esperarEstado(tester, 'Borrador');
    final ruta = rutaActual(tester);
    final id = ruta.split('/').last;
    expect(ruta, '/inquilino/solicitudes/$id');
    await captura(binding, tester, 'flujo-04-borrador');

    await tocarAccion(tester, 'enviar');
    await esperarEstado(tester, 'Enviada');
    await cerrarSesion(tester);

    // ── Admin: tomar y pedir subsanación ─────────────────────────────────
    await iniciarSesion(tester, 'admin@demo.com');
    await irA(tester, '/admin/solicitudes/$id');
    await esperar(tester, find.textContaining(titulo));
    await tocarAccion(tester, 'tomar');
    await esperarEstado(tester, 'En revisión');
    await tocarAccion(tester, 'subsanacion');
    await responderDialogo(tester, 'Adjunta una foto del daño, por favor.');
    await esperarEstado(tester, 'Requiere subsanación');
    await captura(binding, tester, 'flujo-05-admin-subsanacion');
    await cerrarSesion(tester);

    // ── Inquilino: ve el motivo y reenvía ────────────────────────────────
    await iniciarSesion(tester, 'inquilino@demo.com');
    await irA(tester, '/inquilino/solicitudes/$id');
    await esperar(tester, find.text('La administración pidió correcciones.'));
    expect(find.textContaining('Adjunta una foto del daño'), findsWidgets);
    await captura(binding, tester, 'flujo-06-inquilino-aviso');
    await tocarAccion(tester, 'reenviar');
    await esperarEstado(tester, 'Enviada');
    await cerrarSesion(tester);

    // ── Admin: tomar, aprobar y cerrar ───────────────────────────────────
    await iniciarSesion(tester, 'admin@demo.com');
    await irA(tester, '/admin/solicitudes/$id');
    await esperar(tester, find.textContaining(titulo));
    await tocarAccion(tester, 'tomar');
    await esperarEstado(tester, 'En revisión');
    await tocarAccion(tester, 'aprobar');
    await responderDialogo(tester, 'Todo en orden.');
    await esperarEstado(tester, 'Aprobada');
    await tocarAccion(tester, 'cerrar');
    await esperar(tester, find.byKey(const Key('cierre-resultado')));
    await elegir(tester, const Key('cierre-resultado'), 'Cerrada con éxito');
    await tester.enterText(
      find.byKey(const Key('cierre-comentario')),
      'Trabajo terminado.',
    );
    await tocar(tester, find.byKey(const Key('cierre-confirmar')));
    await esperarEstado(tester, 'Cerrada');
    await captura(binding, tester, 'flujo-07-cerrada');

    // Historial con las transiciones.
    await tocar(tester, find.textContaining('Historial').first);
    for (final etiqueta in [
      'Enviada',
      'En revisión',
      'Requiere subsanación',
      'Aprobada',
      'Cerrada',
    ]) {
      expect(
        find.textContaining(etiqueta),
        findsWidgets,
        reason: 'historial sin $etiqueta',
      );
    }
    await captura(binding, tester, 'flujo-08-historial');
    await cerrarSesion(tester);
  });
}

Future<void> tocar(WidgetTester tester, Finder f) async {
  await buscarConScroll(tester, f);
  await tester.ensureVisible(f.first);
  await tester.pump(const Duration(milliseconds: 200));
  await tester.tap(f.first);
  await tester.pump(const Duration(milliseconds: 600));
}

Future<void> escribir(WidgetTester tester, String key, String texto) async {
  final f = find.byKey(Key(key));
  await buscarConScroll(tester, f);
  await tester.ensureVisible(f);
  await tester.enterText(f, texto);
  await tester.pump(const Duration(milliseconds: 200));
}

/// Abre el desplegable [key] y elige la opción con [texto].
Future<void> elegir(
  WidgetTester tester,
  Key key,
  String texto, {
  bool parcial = false,
}) async {
  await tocar(tester, find.byKey(key));
  final opcion = parcial ? find.textContaining(texto) : find.text(texto);
  await esperar(tester, opcion);
  await tester.tap(opcion.last);
  await tester.pump(const Duration(milliseconds: 600));
}

/// Elige [ymd] en el selector de fecha nativo de Material.
Future<void> elegirFecha(WidgetTester tester, Key key, String ymd) async {
  await tocar(tester, find.byKey(key));
  await esperar(tester, find.byType(DatePickerDialog));
  final fecha = DateTime.parse(ymd);
  // Si el día cae en el mes siguiente al que abre el selector, avanzar.
  final inicial = ahoraEnPlaza();
  if (fecha.month != inicial.month &&
      find.text('${fecha.day}').evaluate().isEmpty) {
    await tester.tap(find.byTooltip('Mes siguiente'));
    await tester.pump(const Duration(milliseconds: 600));
  }
  await tester.tap(find.text('${fecha.day}').last);
  await tester.pump(const Duration(milliseconds: 300));
  await confirmarDialogo(tester, find.byType(DatePickerDialog));
}

/// Acepta la hora propuesta por el selector de hora.
Future<void> aceptarHora(WidgetTester tester, Key key) async {
  await tocar(tester, find.byKey(key));
  await esperar(tester, find.byType(TimePickerDialog));
  await confirmarDialogo(tester, find.byType(TimePickerDialog));
}

/// Toca la acción `accion-<id>` del panel de decisión; en teléfono puede
/// estar en la barra inferior o dentro de "Más acciones".
Future<void> tocarAccion(WidgetTester tester, String id) async {
  final accion = find.byKey(Key('accion-$id'));
  await tester.pump(const Duration(milliseconds: 500));
  if (accion.evaluate().isEmpty) {
    await tocar(tester, find.byKey(const Key('barra-mas-acciones')));
  }
  await tocar(tester, accion);
}

/// Escribe en el diálogo de texto y confirma.
Future<void> responderDialogo(WidgetTester tester, String texto) async {
  await esperar(tester, find.byKey(const Key('dialogo-texto')));
  await tester.enterText(find.byKey(const Key('dialogo-texto')), texto);
  await tester.pump(const Duration(milliseconds: 200));
  await tester.tap(find.byKey(const Key('dialogo-confirmar')));
  await tester.pump(const Duration(milliseconds: 800));
}

/// Toca el botón de confirmar (el último) de un diálogo de Material, sin
/// depender del texto localizado.
Future<void> confirmarDialogo(WidgetTester tester, Finder dialogo) async {
  final botones = find.descendant(
    of: dialogo,
    matching: find.byType(TextButton),
  );
  await tester.tap(botones.last);
  await tester.pump(const Duration(milliseconds: 600));
}

/// Espera a [f]; si la pantalla terminó de cargar pero no está construido
/// (listas perezosas), desplaza el contenido principal hacia abajo hasta verlo.
Future<void> buscarConScroll(WidgetTester tester, Finder f) async {
  for (var i = 0; i < 10 && f.evaluate().isEmpty; i++) {
    await tester.pump(const Duration(milliseconds: 300));
  }
  for (var i = 0; i < 25 && f.evaluate().isEmpty; i++) {
    final scroll = scrollPrincipal();
    if (scroll == null) break;
    await tester.drag(scroll, const Offset(0, -300));
    await tester.pump(const Duration(milliseconds: 300));
  }
  await esperar(tester, f);
}

/// El scroll vertical más grande de la pantalla: el contenido de la página
/// (en tablet el menú lateral también tiene scroll y aparece primero).
Finder? scrollPrincipal() {
  double area(Element e) {
    final box = e.renderObject;
    return box is RenderBox && box.hasSize
        ? box.size.width * box.size.height
        : 0;
  }

  final candidatos = find
      .byWidgetPredicate(
        (w) => w is Scrollable && w.axisDirection == AxisDirection.down,
      )
      .evaluate()
      .toList();
  if (candidatos.isEmpty) return null;
  candidatos.sort((a, b) => area(b).compareTo(area(a)));
  final mayor = candidatos.first;
  return find.byElementPredicate((e) => e == mayor);
}

/// Espera el badge de estado [etiqueta] del encabezado. En tablet el panel de
/// decisión va dentro de la lista y el encabezado puede quedar fuera (lista
/// perezosa): se vuelve arriba mientras tanto.
Future<void> esperarEstado(WidgetTester tester, String etiqueta) async {
  final f = find.text(etiqueta);
  final inicio = DateTime.now();
  while (DateTime.now().difference(inicio) < const Duration(seconds: 20)) {
    await tester.pump(const Duration(milliseconds: 300));
    if (f.evaluate().isNotEmpty) return;
    final scroll = scrollPrincipal();
    if (scroll != null) await tester.drag(scroll, const Offset(0, 600));
  }
  expect(f, findsWidgets, reason: 'El estado no llegó a "$etiqueta"');
}

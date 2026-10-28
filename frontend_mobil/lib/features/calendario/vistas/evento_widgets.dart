import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../core/format/fechas.dart';
import '../../../core/theme/colores.dart';
import '../calendario_modelos.dart';
import '../layout_eventos.dart';

/// Piezas comunes de las vistas del calendario.

/// `"3:42 pm – 5:42 pm"` en la zona elegida, o "Todo el día".
String horasEvento(EventoCalendario e, ZonaCalendario zona) {
  if (e.todoElDia) return 'Todo el día';
  final ini = zona.aPared(e.inicio);
  final texto = hora12(ini.hour, ini.minute);
  if (e.fin == null || e.fin == e.inicio) return texto;
  final fin = zona.aPared(e.fin!);
  return '$texto – ${hora12(fin.hour, fin.minute)}';
}

/// `"Domingo, 27 de septiembre de 2026"`.
String tituloDia(DateTime dia) =>
    capitalizar(DateFormat("EEEE, d 'de' MMMM 'de' y", 'es').format(dia));

/// Primera letra en mayúscula (los nombres de días y meses de `intl` vienen
/// en minúscula).
String capitalizar(String s) =>
    s.isEmpty ? s : '${s[0].toUpperCase()}${s.substring(1)}';

/// Número de solicitud en negrita antes del título (pedido del cliente,
/// regresión del web 2026-09-28).
class TextoEvento extends StatelessWidget {
  const TextoEvento(
    this.evento, {
    super.key,
    this.maxLines = 2,
    this.tamano = 13.5,
    this.antes,
  });

  final EventoCalendario evento;
  final int maxLines;
  final double tamano;

  /// Texto opcional antes del código (la hora en la rejilla).
  final String? antes;

  @override
  Widget build(BuildContext context) {
    final codigo = evento.solicitudCodigo;
    return Text.rich(
      TextSpan(
        children: [
          if (antes != null) TextSpan(text: '$antes '),
          if (codigo != null)
            TextSpan(
              text: '$codigo ',
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          TextSpan(text: evento.tituloSinCodigo),
        ],
      ),
      maxLines: maxLines,
      overflow: TextOverflow.ellipsis,
      style: TextStyle(fontSize: tamano, height: 1.25),
    );
  }
}

/// Punto de color del tipo/estado del evento.
class PuntoEvento extends StatelessWidget {
  const PuntoEvento({super.key, required this.color, this.tamano = 10});

  final Color color;
  final double tamano;

  @override
  Widget build(BuildContext context) => Container(
    width: tamano,
    height: tamano,
    decoration: BoxDecoration(color: color, shape: BoxShape.circle),
  );
}

/// Fila de evento para la agenda y la lista del día (vista mes).
class FilaEvento extends StatelessWidget {
  const FilaEvento({
    super.key,
    required this.evento,
    required this.zona,
    required this.onTap,
  });

  final EventoCalendario evento;
  final ZonaCalendario zona;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        margin: const EdgeInsets.only(bottom: 6),
        padding: const EdgeInsets.fromLTRB(10, 9, 10, 9),
        decoration: BoxDecoration(
          color: c.surface2,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: evento.choque ? colorChoque : c.border,
            width: evento.choque ? 1.5 : 1,
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: PuntoEvento(color: evento.colorFondo),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    horasEvento(evento, zona),
                    style: TextStyle(
                      color: c.text2,
                      fontSize: 12.5,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 2),
                  TextoEvento(evento),
                  if (evento.localCodigo != null)
                    Text(
                      'Local: ${evento.localCodigo}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: c.text3, fontSize: 12),
                    ),
                ],
              ),
            ),
            if (evento.choque)
              const Padding(
                padding: EdgeInsets.only(left: 6),
                child: Tooltip(
                  message: 'Se solapa con otro evento del mismo local',
                  child: Icon(
                    Icons.warning_amber_rounded,
                    size: 18,
                    color: colorChoque,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Bloque de un evento en la rejilla de horas o en la fila "todo el día":
/// fondo tenue del color del evento, barra lateral sólida y borde rojo si hay
/// choque.
class BloqueEvento extends StatelessWidget {
  const BloqueEvento({
    super.key,
    required this.evento,
    required this.onTap,
    this.hora,
    this.maxLines = 3,
  });

  final EventoCalendario evento;
  final VoidCallback onTap;
  final String? hora;
  final int maxLines;

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    final color = evento.colorFondo;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: Color.alphaBlend(color.withValues(alpha: 0.22), c.surface),
          borderRadius: BorderRadius.circular(5),
          border: evento.choque
              ? Border.all(color: colorChoque, width: 1.5)
              : Border(left: BorderSide(color: color, width: 3)),
        ),
        padding: const EdgeInsets.fromLTRB(4, 2, 3, 2),
        clipBehavior: Clip.hardEdge,
        child: DefaultTextStyle.merge(
          style: TextStyle(color: c.text),
          child: TextoEvento(
            evento,
            antes: hora,
            maxLines: maxLines,
            tamano: 11.5,
          ),
        ),
      ),
    );
  }
}

/// Lista de eventos (para el "+N" de la rejilla). Toca uno para ver detalle.
Future<void> mostrarListaEventos(
  BuildContext context, {
  required String titulo,
  required List<EventoCalendario> eventos,
  required ZonaCalendario zona,
  required void Function(EventoCalendario) onTapEvento,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    builder: (hoja) => SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Text(titulo, style: Theme.of(hoja).textTheme.titleMedium),
          ),
          for (final e in eventos)
            FilaEvento(
              evento: e,
              zona: zona,
              onTap: () {
                Navigator.of(hoja).pop();
                onTapEvento(e);
              },
            ),
        ],
      ),
    ),
  );
}

/// Eventos del día en la lista inferior de la vista mes y en la agenda.
List<EventoCalendario> eventosParaLista(
  List<EventoCalendario> eventos,
  DateTime dia,
  ZonaCalendario zona,
) => eventosDelDia(eventos, dia, aPared: zona.aPared);

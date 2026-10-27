import 'package:flutter/material.dart';

import '../../../core/theme/colores.dart';
import '../../../core/widgets/badges.dart';
import '../solicitudes_modelos.dart';

/// Select controlado (equivale a `<select>` del web). `null` es la opción
/// vacía ("Todos", "Selecciona…"). Si [valor] no está entre las opciones se
/// muestra vacío.
class CampoSelect<T> extends StatelessWidget {
  const CampoSelect({
    super.key,
    required this.label,
    required this.valor,
    required this.opciones,
    required this.onChanged,
    this.enabled = true,
  });

  final String label;
  final T? valor;

  /// Pares (valor, texto). Incluir `(null, 'Todos')` para la opción vacía.
  final List<(T?, String)> opciones;
  final ValueChanged<T?> onChanged;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final existe = opciones.any((o) => o.$1 == valor);
    return InputDecorator(
      decoration: InputDecoration(labelText: label, enabled: enabled),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<T?>(
          value: existe ? valor : null,
          isExpanded: true,
          isDense: true,
          onChanged: enabled ? onChanged : null,
          items: [
            for (final (v, texto) in opciones)
              DropdownMenuItem<T?>(
                value: v,
                child: Text(texto, overflow: TextOverflow.ellipsis),
              ),
          ],
        ),
      ),
    );
  }
}

/// Opciones de estado en el orden canónico del web.
List<(String?, String)> opcionesEstado(String vacio) => [
  (null, vacio),
  for (final e in etiquetaEstadoSolicitud.entries) (e.key, e.value),
];

/// Opciones de tipo (etiquetas base del web).
List<(String?, String)> opcionesTipo() => [
  (null, 'Todos'),
  for (final e in etiquetaTipoSolicitud.entries) (e.key, e.value),
];

/// Opciones de prioridad.
List<(String?, String)> opcionesPrioridad() => [
  (null, 'Toda'),
  for (final p in prioridadesSolicitud) (p, p),
];

/// Tarjeta de filtros con botón "Filtrar" (el web aplica al enviar el
/// formulario). En teléfono va plegada para no tapar la lista.
class TarjetaFiltros extends StatelessWidget {
  const TarjetaFiltros({
    super.key,
    required this.campos,
    required this.onFiltrar,
  });

  final List<Widget> campos;
  final VoidCallback onFiltrar;

  @override
  Widget build(BuildContext context) {
    final telefono = MediaQuery.sizeOf(context).width < 600;
    final cuerpo = Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          LayoutBuilder(
            builder: (context, c) {
              final cols = c.maxWidth < 520
                  ? 1
                  : c.maxWidth < 860
                  ? 2
                  : 4;
              const gap = 12.0;
              final ancho = (c.maxWidth - gap * (cols - 1)) / cols;
              return Wrap(
                spacing: gap,
                runSpacing: 12,
                children: [
                  for (final campo in campos)
                    SizedBox(width: ancho, child: campo),
                ],
              );
            },
          ),
          const SizedBox(height: 12),
          Align(
            alignment: Alignment.centerRight,
            child: OutlinedButton(
              key: const Key('filtros-aplicar'),
              onPressed: onFiltrar,
              child: const Text('Filtrar'),
            ),
          ),
        ],
      ),
    );
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Card(
        clipBehavior: Clip.antiAlias,
        child: telefono
            ? ExpansionTile(
                key: const Key('filtros-plegables'),
                title: const Text('Filtros'),
                shape: const Border(),
                collapsedShape: const Border(),
                children: [cuerpo],
              )
            : Padding(padding: const EdgeInsets.only(top: 12), child: cuerpo),
      ),
    );
  }
}

/// Badge "⟳ 60 s" del autorefresco.
class BadgeAutorefresco extends StatelessWidget {
  const BadgeAutorefresco(this.texto, {super.key});

  final String texto;

  @override
  Widget build(BuildContext context) {
    final t = ColoresPlazapp.of(context).tono(Tono.neutral);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(
        color: t.bg,
        border: Border.all(color: t.bd),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.autorenew, size: 12, color: t.fg),
          const SizedBox(width: 4),
          Text(
            texto,
            style: TextStyle(
              color: t.fg,
              fontSize: 11.5,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

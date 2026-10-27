import 'package:flutter/material.dart';

import '../../core/theme/colores.dart';
import 'calendario_modelos.dart';
import 'vistas/evento_widgets.dart';

/// Panel de filtros del calendario (panel lateral del web): tipos, locales,
/// inquilinos (solo admin) y zona horaria.
class FiltrosCalendario extends StatelessWidget {
  const FiltrosCalendario({
    super.key,
    required this.esInquilino,
    required this.opciones,
    required this.tipos,
    required this.locales,
    required this.inquilinos,
    required this.zona,
    required this.onTipo,
    required this.onLocal,
    required this.onInquilino,
    required this.onZona,
  });

  final bool esInquilino;
  final OpcionesCalendario opciones;
  final Set<String> tipos;
  final Set<String> locales;
  final Set<String> inquilinos;
  final ZonaCalendario zona;
  final ValueChanged<String> onTipo;
  final ValueChanged<String> onLocal;
  final ValueChanged<String> onInquilino;
  final ValueChanged<ZonaCalendario> onZona;

  @override
  Widget build(BuildContext context) {
    // El inquilino siempre ve la casilla de hitos (el backend aplica el flag).
    final mostrarHitos = esInquilino || opciones.mostrarHitos;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const _Titulo('Tipo'),
        for (final t in tiposCalendario)
          if (t.valor != 'hito_contrato' || mostrarHitos)
            _Casilla(
              marcada: tipos.contains(t.valor),
              onTap: () => onTipo(t.valor),
              punto: t.color,
              etiqueta: etiquetaTipoCalendario(
                t.valor,
                esInquilino: esInquilino,
              ),
            ),
        const SizedBox(height: 12),
        const _Titulo('Local'),
        _ListaCasillas(
          opciones: opciones.locales,
          marcadas: locales,
          onTap: onLocal,
          vacio: 'Sin locales.',
        ),
        if (!esInquilino && opciones.inquilinos.isNotEmpty) ...[
          const SizedBox(height: 12),
          const _Titulo('Inquilino'),
          _ListaCasillas(
            opciones: opciones.inquilinos,
            marcadas: inquilinos,
            onTap: onInquilino,
          ),
        ],
        const SizedBox(height: 12),
        const _Titulo('Zona horaria'),
        RadioGroup<ZonaCalendario>(
          groupValue: zona,
          onChanged: (z) {
            if (z != null) onZona(z);
          },
          child: Column(
            children: [
              for (final z in ZonaCalendario.values)
                RadioListTile<ZonaCalendario>(
                  value: z,
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  visualDensity: VisualDensity.compact,
                  title: Text(z.etiqueta),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Leyenda de colores por tipo (siempre visible sobre el calendario).
class LeyendaCalendario extends StatelessWidget {
  const LeyendaCalendario({
    super.key,
    required this.esInquilino,
    required this.mostrarHitos,
  });

  final bool esInquilino;
  final bool mostrarHitos;

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    return Wrap(
      spacing: 14,
      runSpacing: 6,
      children: [
        for (final t in tiposCalendario)
          if (t.valor != 'hito_contrato' || esInquilino || mostrarHitos)
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                PuntoEvento(color: t.color, tamano: 9),
                const SizedBox(width: 6),
                Flexible(
                  child: Text(
                    etiquetaTipoCalendario(t.valor, esInquilino: esInquilino),
                    style: TextStyle(color: c.text2, fontSize: 12.5),
                  ),
                ),
              ],
            ),
      ],
    );
  }
}

class _Titulo extends StatelessWidget {
  const _Titulo(this.texto);

  final String texto;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 4),
    child: Text(
      texto,
      style: TextStyle(
        color: ColoresPlazapp.of(context).text2,
        fontWeight: FontWeight.w600,
      ),
    ),
  );
}

class _Casilla extends StatelessWidget {
  const _Casilla({
    required this.marcada,
    required this.onTap,
    required this.etiqueta,
    this.punto,
  });

  final bool marcada;
  final VoidCallback onTap;
  final String etiqueta;
  final Color? punto;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(7),
      child: Row(
        children: [
          Checkbox(value: marcada, onChanged: (_) => onTap()),
          if (punto != null) ...[
            PuntoEvento(color: punto!, tamano: 10),
            const SizedBox(width: 8),
          ],
          Expanded(
            child: Text(etiqueta, maxLines: 2, overflow: TextOverflow.ellipsis),
          ),
        ],
      ),
    );
  }
}

/// Casillas con scroll propio si la lista es larga (como el web, máx. ~176 px).
class _ListaCasillas extends StatelessWidget {
  const _ListaCasillas({
    required this.opciones,
    required this.marcadas,
    required this.onTap,
    this.vacio,
  });

  final List<OpcionFiltro> opciones;
  final Set<String> marcadas;
  final ValueChanged<String> onTap;
  final String? vacio;

  @override
  Widget build(BuildContext context) {
    if (opciones.isEmpty) {
      return vacio == null
          ? const SizedBox.shrink()
          : Text(
              vacio!,
              style: TextStyle(color: ColoresPlazapp.of(context).text3),
            );
    }
    return ConstrainedBox(
      constraints: const BoxConstraints(maxHeight: 192),
      child: ListView(
        shrinkWrap: true,
        padding: EdgeInsets.zero,
        children: [
          for (final o in opciones)
            _Casilla(
              marcada: marcadas.contains(o.id),
              onTap: () => onTap(o.id),
              etiqueta: o.etiqueta,
            ),
        ],
      ),
    );
  }
}

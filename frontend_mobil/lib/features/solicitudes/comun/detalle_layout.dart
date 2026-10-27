import 'package:flutter/material.dart';

import '../../../core/theme/colores.dart';
import '../../../core/widgets/badges.dart';
import '../../../core/widgets/pagina.dart';

/// Estilo visual de un botón de acción (variantes del web).
enum EstiloAccion { principal, exito, peligro, secundaria, fantasma }

/// Botón del panel de acciones de una solicitud.
class AccionSolicitud {
  const AccionSolicitud({
    required this.id,
    required this.etiqueta,
    required this.onPressed,
    this.estilo = EstiloAccion.secundaria,
    this.principal = false,
  });

  /// Identificador estable (`Key('accion-<id>')`).
  final String id;
  final String etiqueta;
  final VoidCallback onPressed;
  final EstiloAccion estilo;

  /// Acción principal: en teléfono va sola en la barra inferior.
  final bool principal;
}

/// Bloque "Prioridad / Asignada a / SLA" del panel del admin.
class DatosPanel {
  const DatosPanel({
    required this.prioridad,
    required this.asignadoA,
    required this.slaStatus,
    this.onCambiarPrioridad,
  });

  final String prioridad;
  final String asignadoA;
  final String? slaStatus;

  /// Si no es null se muestra el selector de prioridad.
  final ValueChanged<String>? onCambiarPrioridad;
}

/// Contenido del panel lateral ("Panel de decisión" del admin, "Estado de la
/// solicitud" del inquilino).
class ConfigPanel {
  const ConfigPanel({
    required this.titulo,
    required this.subtitulo,
    this.acciones = const [],
    this.avisos = const [],
    this.datos,
    this.secundarias = const [],
  });

  final String titulo;
  final String subtitulo;
  final List<AccionSolicitud> acciones;

  /// Textos informativos bajo las acciones.
  final List<Widget> avisos;
  final DatosPanel? datos;

  /// Acciones tras el bloque de datos (reasignar, liberar, cancelar).
  final List<AccionSolicitud> secundarias;

  /// La acción que va en la barra del teléfono: la marcada como principal o,
  /// si no hay, la primera que no sea destructiva. Sin ninguna, la barra solo
  /// muestra "Más acciones".
  AccionSolicitud? get accionBarra =>
      acciones.where((a) => a.principal).firstOrNull ??
      acciones.where((a) => a.estilo != EstiloAccion.peligro).firstOrNull;
}

/// Panel de acciones. En la hoja "Más acciones" se pasa [excluir] (la acción
/// que ya está en la barra) y [alElegir] (cierra la hoja antes de actuar).
class PanelAcciones extends StatelessWidget {
  const PanelAcciones({
    super.key,
    required this.config,
    required this.pendiente,
    this.excluir,
    this.alElegir,
    this.conTarjeta = true,
  });

  final ConfigPanel config;
  final bool pendiente;
  final String? excluir;
  final VoidCallback? alElegir;
  final bool conTarjeta;

  VoidCallback? _al(VoidCallback accion) {
    if (pendiente) return null;
    return () {
      alElegir?.call();
      accion();
    };
  }

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    final acciones = config.acciones.where((a) => a.id != excluir).toList();
    final secundarias = config.secundarias
        .where((a) => a.id != excluir)
        .toList();
    final datos = config.datos;
    final contenido = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          config.titulo,
          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
        ),
        const SizedBox(height: 2),
        Text(config.subtitulo, style: TextStyle(color: c.text3, fontSize: 13)),
        if (acciones.isNotEmpty || config.avisos.isNotEmpty)
          const SizedBox(height: 14),
        for (final a in acciones)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: BotonAccion(accion: a, onPressed: _al(a.onPressed)),
          ),
        for (final aviso in config.avisos)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: DefaultTextStyle.merge(
              style: TextStyle(color: c.text3, fontSize: 13.5),
              child: aviso,
            ),
          ),
        if (datos != null) ...[
          const Divider(height: 24),
          _FilaDato(
            etiqueta: 'Prioridad',
            valor: Wrap(
              spacing: 8,
              runSpacing: 6,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                PrioridadBadge(datos.prioridad),
                if (datos.onCambiarPrioridad != null)
                  _SelectorPrioridad(
                    valor: datos.prioridad,
                    onChanged: pendiente
                        ? null
                        : (p) {
                            alElegir?.call();
                            datos.onCambiarPrioridad!(p);
                          },
                  ),
              ],
            ),
          ),
          _FilaDato(
            etiqueta: 'Asignada a',
            valor: Text(datos.asignadoA, overflow: TextOverflow.ellipsis),
          ),
          _FilaDato(etiqueta: 'SLA', valor: SlaSemaforo(datos.slaStatus)),
        ],
        if (secundarias.isNotEmpty) ...[
          const Divider(height: 24),
          for (final a in secundarias)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: BotonAccion(accion: a, onPressed: _al(a.onPressed)),
            ),
        ],
      ],
    );
    if (!conTarjeta) return contenido;
    return Card(
      child: Padding(padding: const EdgeInsets.all(16), child: contenido),
    );
  }
}

class _FilaDato extends StatelessWidget {
  const _FilaDato({required this.etiqueta, required this.valor});

  final String etiqueta;
  final Widget valor;

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        children: [
          SizedBox(
            width: 92,
            child: Text(
              etiqueta,
              style: TextStyle(color: c.text3, fontSize: 13),
            ),
          ),
          Expanded(
            child: Align(alignment: Alignment.centerLeft, child: valor),
          ),
        ],
      ),
    );
  }
}

class _SelectorPrioridad extends StatelessWidget {
  const _SelectorPrioridad({required this.valor, required this.onChanged});

  final String valor;
  final ValueChanged<String>? onChanged;

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    return Tooltip(
      message: 'Cambiar prioridad',
      child: Container(
        height: 32,
        padding: const EdgeInsets.symmetric(horizontal: 8),
        decoration: BoxDecoration(
          border: Border.all(color: c.borderStrong),
          borderRadius: BorderRadius.circular(7),
        ),
        child: DropdownButtonHideUnderline(
          child: DropdownButton<String>(
            key: const Key('selector-prioridad'),
            value: valor,
            isDense: true,
            onChanged: onChanged == null
                ? null
                : (p) {
                    if (p != null && p != valor) onChanged!(p);
                  },
            items: [
              for (final p in const ['A', 'B', 'C', 'D', 'F'])
                DropdownMenuItem(value: p, child: Text(p)),
            ],
          ),
        ),
      ),
    );
  }
}

/// Botón a todo el ancho con el estilo de la acción.
class BotonAccion extends StatelessWidget {
  const BotonAccion({super.key, required this.accion, required this.onPressed});

  final AccionSolicitud accion;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    final key = Key('accion-${accion.id}');
    final texto = Text(
      accion.etiqueta,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
    );
    ButtonStyle tonal(Tono tono) {
      final t = c.tono(tono);
      return OutlinedButton.styleFrom(
        backgroundColor: t.bg,
        foregroundColor: t.fg,
        side: BorderSide(color: t.bd),
      );
    }

    return switch (accion.estilo) {
      EstiloAccion.principal => FilledButton(
        key: key,
        onPressed: onPressed,
        child: texto,
      ),
      EstiloAccion.exito => OutlinedButton(
        key: key,
        style: tonal(Tono.ok),
        onPressed: onPressed,
        child: texto,
      ),
      EstiloAccion.peligro => OutlinedButton(
        key: key,
        style: tonal(Tono.danger),
        onPressed: onPressed,
        child: texto,
      ),
      EstiloAccion.secundaria => OutlinedButton(
        key: key,
        onPressed: onPressed,
        child: texto,
      ),
      EstiloAccion.fantasma => TextButton(
        key: key,
        onPressed: onPressed,
        child: texto,
      ),
    };
  }
}

/// Barra fija inferior del teléfono: acción principal + "Más acciones" (hoja
/// inferior con el resto del panel).
class BarraAccionesTelefono extends StatelessWidget {
  const BarraAccionesTelefono({
    super.key,
    required this.config,
    required this.pendiente,
  });

  final ConfigPanel config;
  final bool pendiente;

  Future<void> _masAcciones(BuildContext context, AccionSolicitud? barra) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (hoja) => SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          child: PanelAcciones(
            config: config,
            pendiente: pendiente,
            excluir: barra?.id,
            conTarjeta: false,
            alElegir: () => Navigator.of(hoja).pop(),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    final barra = config.accionBarra;
    final mas = OutlinedButton.icon(
      key: const Key('barra-mas-acciones'),
      onPressed: () => _masAcciones(context, barra),
      icon: const Icon(Icons.more_horiz),
      // Junto a la acción principal solo cabe "Más" (se truncaba).
      label: Text(
        barra == null ? 'Más acciones' : 'Más',
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
    );
    return Material(
      color: c.surface,
      child: Container(
        decoration: BoxDecoration(
          border: Border(top: BorderSide(color: c.border)),
        ),
        child: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
            child: Row(
              children: [
                if (barra != null) ...[
                  Expanded(
                    flex: 3,
                    child: KeyedSubtree(
                      key: const Key('barra-principal'),
                      child: BotonAccion(
                        accion: barra,
                        onPressed: pendiente ? null : barra.onPressed,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                ],
                Expanded(flex: 2, child: mas),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Una pestaña del detalle.
class Pestana {
  const Pestana(this.etiqueta, this.contenido);

  final String etiqueta;
  final Widget Function() contenido;
}

/// Pestañas Detalle / Comentarios / Historial / Adjuntos. Solo pinta la
/// pestaña elegida (va dentro de la lista de la página, sin altura fija).
class PestanasSolicitud extends StatefulWidget {
  const PestanasSolicitud({super.key, required this.pestanas});

  final List<Pestana> pestanas;

  @override
  State<PestanasSolicitud> createState() => _PestanasSolicitudState();
}

class _PestanasSolicitudState extends State<PestanasSolicitud>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(
    length: widget.pestanas.length,
    vsync: this,
  );

  @override
  void initState() {
    super.initState();
    _tabs.addListener(() {
      if (!_tabs.indexIsChanging) setState(() {});
    });
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TabBar(
          controller: _tabs,
          isScrollable: true,
          tabAlignment: TabAlignment.start,
          tabs: [for (final p in widget.pestanas) Tab(text: p.etiqueta)],
        ),
        const SizedBox(height: 14),
        widget.pestanas[_tabs.index].contenido(),
      ],
    );
  }
}

/// Estructura del detalle de una solicitud:
/// - teléfono (< 600 px): una columna + barra fija inferior de acciones;
/// - tablet vertical: panel de acciones arriba de las pestañas;
/// - con espacio (≥ 860 px de contenido): pestañas + panel lateral.
class VistaDetalleSolicitud extends StatelessWidget {
  const VistaDetalleSolicitud({
    super.key,
    required this.encabezado,
    required this.pestanas,
    required this.panel,
    required this.pendiente,
    this.avisos = const [],
    this.onRefresh,
  });

  final Widget encabezado;
  final List<Widget> avisos;
  final List<Pestana> pestanas;
  final ConfigPanel panel;
  final bool pendiente;
  final Future<void> Function()? onRefresh;

  @override
  Widget build(BuildContext context) {
    final telefono = MediaQuery.sizeOf(context).width < 600;
    final pestanasW = PestanasSolicitud(pestanas: pestanas);
    final panelW = PanelAcciones(config: panel, pendiente: pendiente);
    final contenido = LayoutBuilder(
      builder: (context, c) {
        final dosColumnas = !telefono && c.maxWidth >= 860;
        return ContenidoPagina(
          onRefresh: onRefresh,
          children: [
            encabezado,
            for (final a in avisos)
              Padding(padding: const EdgeInsets.only(bottom: 14), child: a),
            if (dosColumnas)
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(child: pestanasW),
                  const SizedBox(width: 16),
                  SizedBox(width: 300, child: panelW),
                ],
              )
            else ...[
              if (!telefono)
                Padding(
                  padding: const EdgeInsets.only(bottom: 14),
                  child: panelW,
                ),
              pestanasW,
            ],
          ],
        );
      },
    );
    if (!telefono) return contenido;
    return Column(
      children: [
        Expanded(child: contenido),
        BarraAccionesTelefono(config: panel, pendiente: pendiente),
      ],
    );
  }
}

/// Subtítulo en mayúsculas de un bloque del detalle.
class TituloBloque extends StatelessWidget {
  const TituloBloque(this.texto, {super.key});

  final String texto;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 22, bottom: 10),
    child: Text(
      texto.toUpperCase(),
      style: TextStyle(
        color: ColoresPlazapp.of(context).text3,
        fontSize: 12,
        fontWeight: FontWeight.w600,
        letterSpacing: 0.6,
      ),
    ),
  );
}

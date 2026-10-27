import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/adjuntos/adjuntos_seccion.dart';
import '../../../core/api/api_providers.dart';
import '../../../core/theme/colores.dart';
import '../../../core/widgets/avisos.dart';
import '../../../core/widgets/badges.dart';
import '../../../core/widgets/dialogos.dart';
import '../../../core/widgets/estados.dart';
import '../../../core/widgets/pagina.dart';
import '../comun/comentarios_tab.dart';
import '../comun/detalle_campos.dart';
import '../comun/detalle_layout.dart';
import '../comun/historial_tab.dart';
import '../solicitudes_api.dart';
import '../solicitudes_modelos.dart';
import '../solicitudes_providers.dart';
import 'wizard/formulario_solicitud.dart';

/// Detalle de solicitud del inquilino. Espejo de
/// `frontend/src/components/client/solicitud-detail-inquilino.tsx`.
class DetalleInquilinoPage extends ConsumerStatefulWidget {
  const DetalleInquilinoPage({super.key, required this.id});

  final String id;

  @override
  ConsumerState<DetalleInquilinoPage> createState() => _DetalleInquilinoState();
}

class _DetalleInquilinoState extends ConsumerState<DetalleInquilinoPage> {
  bool _pendiente = false;

  void _recargar() {
    ref.invalidate(solicitudProvider(widget.id));
    ref.invalidate(misSolicitudesProvider);
  }

  /// Ejecuta una transición: deshabilita el panel, avisa y recarga.
  Future<void> _ejecutar(Future<void> Function() accion, String exito) async {
    if (_pendiente) return;
    setState(() => _pendiente = true);
    try {
      await accion();
      if (!mounted) return;
      mostrarExito(context, exito);
      _recargar();
    } on Object catch (e) {
      if (mounted) mostrarError(context, e);
    } finally {
      if (mounted) setState(() => _pendiente = false);
    }
  }

  Future<void> _duplicar() async {
    if (_pendiente) return;
    setState(() => _pendiente = true);
    try {
      final copia = await duplicar(ref.read(apiClientProvider), widget.id);
      if (!mounted) return;
      ref.invalidate(misSolicitudesProvider);
      setState(() => _pendiente = false);
      mostrarExito(context, 'Duplicada como ${copia.codigo}');
      unawaited(context.push('/inquilino/solicitudes/${copia.id}'));
    } on Object catch (e) {
      if (!mounted) return;
      setState(() => _pendiente = false);
      mostrarError(context, e);
    }
  }

  /// Enviar / reenviar: antes se revisan las fechas del permiso con las
  /// reglas del wizard (el backend no las valida al enviar y un borrador
  /// duplicado no trae fechas). Si fallan, se avisa y se abre la edición.
  void _enviarSiFechasValidas(
    SolicitudItem s,
    Future<void> Function() accion,
    String exito,
  ) {
    final error = FormularioSolicitud.desdeSolicitud(s)
        .validarFechas(DateTime.now());
    if (error != null) {
      mostrarError(context, error);
      unawaited(context.push('/inquilino/solicitudes/${s.id}/editar'));
      return;
    }
    unawaited(_ejecutar(accion, exito));
  }

  Future<void> _cancelar() async {
    final motivo = await pedirTexto(
      context,
      titulo: 'Cancelar solicitud',
      mensaje: 'La solicitud quedará cancelada y no podrá reabrirse.',
      hint: 'Motivo de cancelación (opcional)',
      textoConfirmar: 'Sí, cancelar',
      destructiva: true,
    );
    if (motivo == null) return; // "Volver" o cerrar el diálogo: no se cancela.
    await _ejecutar(
      () => cancelar(ref.read(apiClientProvider), widget.id, motivo: motivo),
      'Cancelada',
    );
  }

  ConfigPanel _panel(SolicitudItem s) {
    final api = ref.read(apiClientProvider);
    final estado = s.estado;
    final esBorrador = estado == 'borrador';
    final esSubsanacion = estado == 'requerida_subsanacion';
    final esPausada = estado == 'pausada';
    final esAprobada = estado == 'aprobada';
    final c = ColoresPlazapp.of(context);
    void editar() => context.push('/inquilino/solicitudes/${s.id}/editar');

    return ConfigPanel(
      titulo: 'Estado de la solicitud',
      subtitulo: etiquetaEstadoSolicitud[estado] ?? estado,
      acciones: [
        if (esBorrador) ...[
          AccionSolicitud(id: 'editar', etiqueta: 'Editar', onPressed: editar),
          AccionSolicitud(
            id: 'enviar',
            etiqueta: 'Enviar',
            estilo: EstiloAccion.principal,
            principal: true,
            onPressed: () => _enviarSiFechasValidas(
              s,
              () => enviar(api, s.id),
              'Enviada: quedó en cola de asignación',
            ),
          ),
        ],
        if (esSubsanacion) ...[
          AccionSolicitud(id: 'editar', etiqueta: 'Editar', onPressed: editar),
          AccionSolicitud(
            id: 'reenviar',
            etiqueta: 'Reenviar subsanada',
            estilo: EstiloAccion.principal,
            principal: true,
            onPressed: () => _enviarSiFechasValidas(
              s,
              () => subsanar(api, s.id),
              'Reenviada: volvió a la cola de asignación',
            ),
          ),
        ],
        AccionSolicitud(
          id: 'duplicar',
          etiqueta: 'Duplicar',
          onPressed: _duplicar,
        ),
        if (!s.esTerminal && !esPausada && !esAprobada)
          AccionSolicitud(
            id: 'cancelar',
            etiqueta: 'Cancelar',
            estilo: EstiloAccion.peligro,
            onPressed: _cancelar,
          ),
      ],
      avisos: [
        if (esAprobada)
          const Text(
            'Solicitud aprobada: pendiente de cierre por la administración. '
            'Te avisaremos cuando se registre el resultado.',
          ),
        if (estado == 'cerrada') BloqueCierre(s, color: c.text3),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final valor = ref.watch(solicitudProvider(widget.id));
    return Scaffold(
      body: AsyncView(
        value: valor,
        onRetry: () => ref.invalidate(solicitudProvider(widget.id)),
        data: (d) => _vista(d),
      ),
    );
  }

  Widget _vista(SolicitudDetalle d) {
    final s = d.solicitud;
    final api = ref.read(apiClientProvider);
    final esSubsanacion = s.estado == 'requerida_subsanacion';
    final esPausada = s.estado == 'pausada';
    final puedeAdjuntar = s.estado == 'borrador' || esSubsanacion;
    return VistaDetalleSolicitud(
      pendiente: _pendiente,
      onRefresh: () async => ref.refresh(solicitudProvider(widget.id).future),
      encabezado: EncabezadoPagina(
        titulo: s.codigo,
        rutaVolver: '/inquilino/solicitudes',
        badges: [EstadoSolicitudBadge(s.estado), PrioridadBadge(s.prioridad)],
        subtitulo:
            '${s.titulo} · Local ${s.localCodigo ?? '—'}'
            '${s.adminAsignado == null ? '' : ' · Asignada a ${s.adminAsignado!.nombre}'}',
        acciones: [BotonPermisoPdf(id: s.id, codigo: s.codigo)],
      ),
      avisos: [
        if (esSubsanacion && !esPausada)
          AvisoBanner(
            tono: Tono.warn,
            child: _AvisoSubsanacion(motivo: motivoUltimaSubsanacion(d)),
          ),
        if (esPausada)
          const AvisoBanner(
            tono: Tono.info,
            child: Text(
              'Esta solicitud está pausada por la administración. No puedes '
              'editarla ni reenviarla hasta que sea reanudada.',
            ),
          ),
      ],
      panel: _panel(s),
      pestanas: [
        Pestana(
          'Detalle',
          () => DetalleCamposSolicitud(detalle: d, vistaAdmin: false),
        ),
        Pestana(
          'Comentarios (${d.comentarios.length})',
          () => ComentariosTab(
            comentarios: d.comentarios,
            hint: 'Escribe un comentario…',
            comentar: (cuerpo) async {
              await comentar(api, s.id, cuerpo);
              ref.invalidate(solicitudProvider(widget.id));
            },
          ),
        ),
        Pestana(
          'Historial (${d.historial.length})',
          () => HistorialTab(historial: d.historial),
        ),
        Pestana(
          'Adjuntos (${d.adjuntos.length})',
          () => AdjuntosSeccion(
            adjuntos: d.adjuntos,
            // El backend solo acepta subir en borrador o requerida_subsanacion.
            puedeSubir: puedeAdjuntar,
            puedeEliminar: puedeAdjuntar,
            subir: (nombre, bytes, mime) =>
                subirAdjuntoSolicitud(api, s.id, nombre, bytes, mime),
            alCambiar: () => ref.invalidate(solicitudProvider(widget.id)),
          ),
        ),
      ],
    );
  }
}

/// Motivo de la última subsanación pedida (historial con
/// `estadoNuevo = requerida_subsanacion` y comentario), o `null`.
String? motivoUltimaSubsanacion(SolicitudDetalle d) {
  final pedidas =
      d.historial
          .where(
            (h) =>
                h.estadoNuevo == 'requerida_subsanacion' &&
                (h.comentario?.isNotEmpty ?? false),
          )
          .toList()
        ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
  return pedidas.firstOrNull?.comentario;
}

class _AvisoSubsanacion extends StatelessWidget {
  const _AvisoSubsanacion({required this.motivo});

  final String? motivo;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'La administración pidió correcciones.',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
        if (motivo != null)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text('«$motivo»'),
          ),
        const Padding(
          padding: EdgeInsets.only(top: 4),
          child: Text(
            'Edita la solicitud y pulsa «Reenviar subsanada» para que vuelva a '
            'revisión.',
          ),
        ),
      ],
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/adjuntos/adjuntos_seccion.dart';
import '../../../core/api/api_providers.dart';
import '../../../core/auth/sesion_controller.dart';
import '../../../core/theme/colores.dart';
import '../../../core/widgets/avisos.dart';
import '../../../core/widgets/badges.dart';
import '../../../core/widgets/dialogos.dart';
import '../../../core/widgets/estados.dart';
import '../../../core/widgets/pagina.dart';
import '../../../core/widgets/pestanas.dart';
import '../comun/comentarios_tab.dart';
import '../comun/detalle_campos.dart';
import '../comun/detalle_layout.dart';
import '../comun/historial_tab.dart';
import '../solicitudes_api.dart';
import '../solicitudes_modelos.dart';
import '../solicitudes_providers.dart';
import 'dialogos_decision.dart';
import 'panel_decision.dart';

/// Detalle del admin con el panel de decisión. Espejo de
/// `frontend/src/components/client/solicitud-detail-admin.tsx`.
///
/// En teléfono el panel es una barra fija inferior (acción principal +
/// "Más acciones"); en tablet, una columna o panel lateral.
class DetalleAdminPage extends ConsumerStatefulWidget {
  const DetalleAdminPage({super.key, required this.id});

  final String id;

  @override
  ConsumerState<DetalleAdminPage> createState() => _DetalleAdminState();
}

class _DetalleAdminState extends ConsumerState<DetalleAdminPage> {
  bool _pendiente = false;

  String get _id => widget.id;

  /// Ejecuta una acción del flujo: deshabilita el panel, avisa y recarga el
  /// detalle y la bandeja.
  Future<void> _ejecutar(Future<void> Function() accion, String exito) async {
    if (_pendiente) return;
    setState(() => _pendiente = true);
    try {
      await accion();
      if (!mounted) return;
      mostrarExito(context, exito);
      ref.invalidate(solicitudProvider(_id));
      ref.invalidate(bandejaProvider);
    } on Object catch (e) {
      if (mounted) mostrarError(context, e);
    } finally {
      if (mounted) setState(() => _pendiente = false);
    }
  }

  AccionesAdmin _acciones(SolicitudItem s) {
    final api = ref.read(apiClientProvider);
    return AccionesAdmin(
      tomar: () => _ejecutar(
        () => tomar(api, _id),
        s.estado == 'enviada' ? 'Tomada: en revisión' : 'En revisión',
      ),
      aprobar: () async {
        final texto = await pedirTexto(
          context,
          titulo: 'Aprobar solicitud',
          mensaje: 'Comentario opcional para el inquilino.',
          hint: 'Comentario (opcional)',
          textoConfirmar: 'Aprobar solicitud',
          maxLength: 4000,
        );
        if (texto == null) return;
        await _ejecutar(() => aprobar(api, _id, comentario: texto), 'Aprobada');
      },
      rechazar: () async {
        final texto = await pedirTexto(
          context,
          titulo: 'Rechazar solicitud',
          mensaje: 'El comentario es obligatorio y se notifica al inquilino.',
          hint: 'Comentario (obligatorio)',
          textoConfirmar: 'Rechazar solicitud',
          obligatorio: true,
          destructiva: true,
          maxLength: 4000,
        );
        if (texto == null || texto.isEmpty) return;
        await _ejecutar(() => rechazar(api, _id, texto), 'Rechazada');
      },
      pedirSubsanacion: () async {
        final texto = await pedirTexto(
          context,
          titulo: 'Pedir subsanación',
          mensaje: 'El comentario es obligatorio y se notifica al inquilino.',
          hint: 'Comentario (obligatorio)',
          textoConfirmar: 'Pedir subsanación',
          obligatorio: true,
          maxLength: 4000,
        );
        if (texto == null || texto.isEmpty) return;
        await _ejecutar(
          () => pedirSubsanacion(api, _id, texto),
          'Subsanación solicitada',
        );
      },
      pausar: () async {
        final motivo = await pedirTexto(
          context,
          titulo: 'Pausar solicitud',
          mensaje:
              'La solicitud volverá a tu revisión al reanudarla. El SLA queda '
              'congelado mientras esté pausada.',
          hint: 'Motivo (opcional, visible para el equipo)…',
          textoConfirmar: 'Pausar',
          maxLength: 1000,
        );
        if (motivo == null) return;
        await _ejecutar(
          () => pausar(api, _id, motivo: motivo),
          'Solicitud pausada',
        );
      },
      reanudar: () => _ejecutar(() => reanudar(api, _id), 'Reanudada'),
      cerrar: () async {
        final cierre = await pedirCierre(context);
        if (cierre == null) return;
        await _ejecutar(
          () => cerrar(
            api,
            _id,
            resultado: cierre.resultado,
            comentario: cierre.comentario,
          ),
          'Solicitud cerrada',
        );
      },
      reasignar: () async {
        final admins = await ref.read(adminsPlazaProvider.future);
        if (!mounted) return;
        final eleccion = await pedirReasignacion(
          context,
          admins.where((a) => a.id != s.adminAsignadoId).toList(),
        );
        if (eleccion == null) return;
        await _ejecutar(
          () => reasignar(
            api,
            _id,
            eleccion.responsableId,
            comentario: eleccion.motivo,
          ),
          'Reasignada',
        );
      },
      liberar: () async {
        final motivo = await pedirTexto(
          context,
          titulo: 'Liberar solicitud',
          mensaje: 'La solicitud vuelve a la cola de asignación.',
          hint: 'Motivo (opcional)',
          textoConfirmar: 'Sí, liberar',
          maxLength: 1000,
        );
        if (motivo == null) return; // "Volver" o cerrar: no se libera.
        await _ejecutar(
          () => liberar(api, _id, motivo: motivo),
          'Liberada: volvió a la cola',
        );
      },
      cancelar: () async {
        final motivo = await pedirTexto(
          context,
          titulo: 'Cancelar solicitud',
          mensaje: 'La solicitud quedará cancelada y no podrá reabrirse.',
          hint: 'Motivo de cancelación',
          textoConfirmar: 'Sí, cancelar',
          obligatorio: true,
          destructiva: true,
          maxLength: 1000,
        );
        if (motivo == null || motivo.isEmpty) return;
        await _ejecutar(() => cancelarAdmin(api, _id, motivo), 'Cancelada');
      },
      cambiarPrioridad: (p) =>
          _ejecutar(() => cambiarPrioridad(api, _id, p), 'Prioridad $p'),
    );
  }

  @override
  Widget build(BuildContext context) {
    final valor = ref.watch(solicitudProvider(_id));
    // Candidatos a reasignar: se cargan junto con el detalle (como el web) y
    // el provider queda vivo mientras la pantalla esté abierta.
    ref.watch(adminsPlazaProvider);
    return Scaffold(
      body: AsyncView(
        value: valor,
        onRetry: () => ref.invalidate(solicitudProvider(_id)),
        data: _vista,
      ),
    );
  }

  Widget _vista(SolicitudDetalle d) {
    final s = d.solicitud;
    final sesion = ref.watch(sesionProvider).value;
    final miId = sesion?.usuario.id;
    bool puede(String permiso) => sesion?.puede(permiso) ?? false;
    final api = ref.read(apiClientProvider);
    final soyCreador = s.usuarioCreadorId == miId;
    return VistaDetalleSolicitud(
      pendiente: _pendiente,
      onRefresh: () => recargar(ref, solicitudProvider(_id).future),
      encabezado: EncabezadoPagina(
        titulo: s.codigo,
        rutaVolver: '/admin/solicitudes',
        badges: [
          EstadoSolicitudBadge(s.estado),
          PrioridadBadge(s.prioridad),
          if (s.slaStatus != null) SlaSemaforo(s.slaStatus),
        ],
        subtitulo:
            '${s.titulo} · Local ${s.localCodigo ?? '—'} · '
            '${d.inquilinoRazonSocial ?? '—'}'
            '${s.adminAsignado == null ? '' : ' · Asignada a ${s.adminAsignado!.nombre}'}',
        acciones: [BotonPermisoPdf(id: s.id, codigo: s.codigo)],
      ),
      avisos: [
        if (soyCreador && !s.esTerminal)
          const AvisoBanner(
            tono: Tono.danger,
            child: Text.rich(
              TextSpan(
                children: [
                  TextSpan(
                    text: 'SC-4:',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                  TextSpan(
                    text:
                        ' creaste esta solicitud, por lo que no puedes '
                        'aprobarla ni rechazarla.',
                  ),
                ],
              ),
            ),
          ),
      ],
      panel: panelDecisionAdmin(
        s: s,
        miUsuarioId: miId,
        puede: puede,
        acciones: _acciones(s),
        colorAtenuado: ColoresPlazapp.of(context).text3,
      ),
      pestanas: [
        Pestana(
          'Detalle',
          () => DetalleCamposSolicitud(detalle: d, vistaAdmin: true),
        ),
        Pestana(
          'Comentarios (${d.comentarios.length})',
          () => ComentariosTab(
            comentarios: d.comentarios,
            hint: 'Comentario para el inquilino…',
            permiso: 'solicitudes.comentar',
            comentar: (cuerpo) async {
              await comentar(api, _id, cuerpo);
              ref.invalidate(solicitudProvider(_id));
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
            // El admin sube en cualquier estado no terminal.
            puedeSubir: !s.esTerminal && puede('solicitudes.adjuntos.subir'),
            puedeEliminar: puede('solicitudes.adjuntos.eliminar'),
            subir: (nombre, bytes, mime) =>
                subirAdjuntoSolicitud(api, _id, nombre, bytes, mime),
            alCambiar: () => ref.invalidate(solicitudProvider(_id)),
          ),
        ),
      ],
    );
  }
}

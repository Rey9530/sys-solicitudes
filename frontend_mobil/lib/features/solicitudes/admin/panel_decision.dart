import 'package:flutter/material.dart';

import '../../../core/widgets/badges.dart';
import '../comun/detalle_campos.dart';
import '../comun/detalle_layout.dart';
import '../solicitudes_modelos.dart';

/// Acciones que dispara el panel (las implementa la pantalla).
class AccionesAdmin {
  const AccionesAdmin({
    required this.tomar,
    required this.aprobar,
    required this.rechazar,
    required this.pedirSubsanacion,
    required this.pausar,
    required this.reanudar,
    required this.cerrar,
    required this.reasignar,
    required this.liberar,
    required this.cancelar,
    required this.cambiarPrioridad,
  });

  final VoidCallback tomar;
  final VoidCallback aprobar;
  final VoidCallback rechazar;
  final VoidCallback pedirSubsanacion;
  final VoidCallback pausar;
  final VoidCallback reanudar;
  final VoidCallback cerrar;
  final VoidCallback reasignar;
  final VoidCallback liberar;
  final VoidCallback cancelar;
  final ValueChanged<String> cambiarPrioridad;
}

/// "Panel de decisión" del admin: botones según la matriz del inventario
/// §4.3.2.1 (estado, si soy el asignado o el creador) y los permisos del
/// usuario (los botones sin permiso no se muestran, igual que `<Can>`).
///
/// Diferencias corregidas respecto al web: el selector de prioridad no se
/// muestra en `borrador` ni `aprobada` (el backend lo rechaza, F14).
ConfigPanel panelDecisionAdmin({
  required SolicitudItem s,
  required String? miUsuarioId,
  required bool Function(String permiso) puede,
  required AccionesAdmin acciones,
  required Color colorAtenuado,
}) {
  final estado = s.estado;
  final soyAsignado =
      s.adminAsignadoId != null && s.adminAsignadoId == miUsuarioId;
  final soyCreador = s.usuarioCreadorId == miUsuarioId; // SC-4
  final esTerminal = s.esTerminal;
  final esAprobada = estado == 'aprobada';
  final esPausada = estado == 'pausada';
  final activa = estado == 'asignado' || estado == 'en_revision';
  final nombreAsignado = s.adminAsignado?.nombre;

  return ConfigPanel(
    titulo: 'Panel de decisión',
    subtitulo: 'Acciones del flujo según el estado actual.',
    acciones: [
      if (estado == 'enviada' && puede('solicitudes.tomar'))
        AccionSolicitud(
          id: 'tomar',
          etiqueta: 'Tomar',
          estilo: EstiloAccion.principal,
          principal: true,
          onPressed: acciones.tomar,
        ),
      if (estado == 'asignado' && soyAsignado && puede('solicitudes.tomar'))
        AccionSolicitud(
          id: 'tomar',
          etiqueta: 'Tomar (revisar)',
          estilo: EstiloAccion.principal,
          principal: true,
          onPressed: acciones.tomar,
        ),
      if (estado == 'en_revision' && soyAsignado && !soyCreador) ...[
        if (puede('solicitudes.aprobar'))
          AccionSolicitud(
            id: 'aprobar',
            etiqueta: 'Aprobar',
            estilo: EstiloAccion.exito,
            principal: true,
            onPressed: acciones.aprobar,
          ),
        if (puede('solicitudes.rechazar'))
          AccionSolicitud(
            id: 'rechazar',
            etiqueta: 'Rechazar',
            estilo: EstiloAccion.peligro,
            onPressed: acciones.rechazar,
          ),
        if (puede('solicitudes.pedir_subsanacion'))
          AccionSolicitud(
            id: 'subsanacion',
            etiqueta: 'Pedir subsanación',
            onPressed: acciones.pedirSubsanacion,
          ),
      ],
      if (activa && puede('solicitudes.pausar'))
        AccionSolicitud(
          id: 'pausar',
          etiqueta: 'Pausar',
          onPressed: acciones.pausar,
        ),
      if (esPausada && puede('solicitudes.reanudar'))
        AccionSolicitud(
          id: 'reanudar',
          etiqueta: 'Reanudar',
          estilo: EstiloAccion.exito,
          principal: true,
          onPressed: acciones.reanudar,
        ),
      if (esAprobada && soyAsignado && puede('solicitudes.cerrar'))
        AccionSolicitud(
          id: 'cerrar',
          etiqueta: 'Cerrar solicitud',
          estilo: EstiloAccion.exito,
          principal: true,
          onPressed: acciones.cerrar,
        ),
    ],
    avisos: [
      if (esPausada)
        Text(
          'Solicitud pausada'
          '${nombreAsignado == null ? '' : ' por $nombreAsignado'}. Cualquier '
          'admin de la plaza puede reanudarla.',
        ),
      if (esAprobada && !soyAsignado)
        Text(
          'Aprobada, pendiente de cierre'
          '${nombreAsignado == null ? '' : ' por $nombreAsignado'}. Solo el '
          'administrador asignado puede cerrarla.',
        ),
      if (estado == 'cerrada') BloqueCierre(s, color: colorAtenuado),
      if (esTerminal && estado != 'cerrada')
        Text(
          'Solicitud '
          '${(etiquetaEstadoSolicitud[estado] ?? estado).toLowerCase()}. No '
          'hay acciones pendientes.',
        ),
    ],
    datos: DatosPanel(
      prioridad: s.prioridad,
      asignadoA: nombreAsignado ?? 'Sin asignar',
      slaStatus: s.slaStatus,
      onCambiarPrioridad:
          !esTerminal &&
              estado != 'borrador' &&
              !esAprobada &&
              puede('solicitudes.cambiar_prioridad')
          ? acciones.cambiarPrioridad
          : null,
    ),
    secundarias: [
      if (activa && puede('solicitudes.reasignar'))
        AccionSolicitud(
          id: 'reasignar',
          etiqueta: 'Reasignar',
          onPressed: acciones.reasignar,
        ),
      if (activa && soyAsignado && puede('solicitudes.liberar'))
        AccionSolicitud(
          id: 'liberar',
          etiqueta: 'Liberar',
          estilo: EstiloAccion.fantasma,
          onPressed: acciones.liberar,
        ),
      if (!esTerminal && !esAprobada && puede('solicitudes.cancelar'))
        AccionSolicitud(
          id: 'cancelar',
          etiqueta: 'Cancelar solicitud',
          estilo: EstiloAccion.peligro,
          onPressed: acciones.cancelar,
        ),
    ],
  );
}

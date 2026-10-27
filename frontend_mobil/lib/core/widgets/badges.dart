import 'package:flutter/material.dart';

import '../theme/colores.dart';

/// Pill con punto y tono (clases `.badge .b-*` del web).
class BadgePlazapp extends StatelessWidget {
  const BadgePlazapp(this.texto, this.tono, {super.key, this.punto = true});

  final String texto;
  final Tono tono;
  final bool punto;

  @override
  Widget build(BuildContext context) {
    final t = ColoresPlazapp.of(context).tono(tono);
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
          if (punto) ...[
            Container(
              width: 6,
              height: 6,
              decoration: BoxDecoration(color: t.fg, shape: BoxShape.circle),
            ),
            const SizedBox(width: 5),
          ],
          Flexible(
            child: Text(
              texto,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: t.fg,
                fontSize: 11.5,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Etiquetas de estado de solicitud (orden canónico de los filtros).
const etiquetaEstadoSolicitud = <String, String>{
  'borrador': 'Borrador',
  'enviada': 'Enviada',
  'asignado': 'Asignada',
  'en_revision': 'En revisión',
  'requerida_subsanacion': 'Requiere subsanación',
  'pausada': 'Pausada',
  'aprobada': 'Aprobada',
  'cerrada': 'Cerrada',
  'rechazada': 'Rechazada',
  'cancelada': 'Cancelada',
};

const _tonoEstadoSolicitud = <String, Tono>{
  'borrador': Tono.neutral,
  'enviada': Tono.info,
  'asignado': Tono.indigo,
  'en_revision': Tono.warn,
  'requerida_subsanacion': Tono.orange,
  'pausada': Tono.cyan,
  'aprobada': Tono.ok,
  'cerrada': Tono.violet,
  'rechazada': Tono.danger,
  'cancelada': Tono.neutral,
};

class EstadoSolicitudBadge extends StatelessWidget {
  const EstadoSolicitudBadge(this.estado, {super.key});
  final String estado;

  @override
  Widget build(BuildContext context) => BadgePlazapp(
    etiquetaEstadoSolicitud[estado] ?? estado,
    _tonoEstadoSolicitud[estado] ?? Tono.neutral,
  );
}

const etiquetaResultadoCierre = <String, String>{
  'exitoso': 'Exitoso',
  'parcial': 'Parcial',
  'fallido': 'Fallido',
  'no_realizado': 'No realizada',
};

class ResultadoCierreBadge extends StatelessWidget {
  const ResultadoCierreBadge(this.resultado, {super.key});
  final String resultado;

  @override
  Widget build(BuildContext context) => BadgePlazapp(
    etiquetaResultadoCierre[resultado] ?? resultado,
    switch (resultado) {
      'exitoso' => Tono.ok,
      'parcial' => Tono.warn,
      'fallido' => Tono.danger,
      _ => Tono.neutral,
    },
  );
}

const etiquetaEstadoLocal = <String, String>{
  'disponible': 'Disponible',
  'alquilado': 'Alquilado',
  'en_mantenimiento': 'En mantenimiento',
  'fuera_de_servicio': 'Fuera de servicio',
};

class EstadoLocalBadge extends StatelessWidget {
  const EstadoLocalBadge(this.estado, {super.key});
  final String estado;

  @override
  Widget build(BuildContext context) =>
      BadgePlazapp(etiquetaEstadoLocal[estado] ?? estado, switch (estado) {
        'disponible' => Tono.ok,
        'alquilado' => Tono.info,
        'en_mantenimiento' => Tono.warn,
        _ => Tono.neutral,
      });
}

const etiquetaEstadoContrato = <String, String>{
  'vigente': 'Vigente',
  'finalizado': 'Finalizado',
  'cancelado': 'Cancelado',
};

class EstadoContratoBadge extends StatelessWidget {
  const EstadoContratoBadge(this.estado, {super.key});
  final String estado;

  @override
  Widget build(BuildContext context) =>
      BadgePlazapp(etiquetaEstadoContrato[estado] ?? estado, switch (estado) {
        'vigente' => Tono.ok,
        'cancelado' => Tono.danger,
        _ => Tono.neutral,
      });
}

/// Chip cuadrado de prioridad (A B C D F), igual en claro y oscuro.
class PrioridadBadge extends StatelessWidget {
  const PrioridadBadge(this.prioridad, {super.key});
  final String prioridad;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 22,
      height: 22,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: ColoresPlazapp.prioridades[prioridad] ?? const Color(0xFF7A8499),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        prioridad,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 11,
          fontWeight: FontWeight.w700,
          fontFamily: 'monospace',
        ),
      ),
    );
  }
}

/// Semáforo SLA: `verde | amarillo | rojo | null` (null → "—").
class SlaSemaforo extends StatelessWidget {
  const SlaSemaforo(this.status, {super.key});
  final String? status;

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    final color = switch (status) {
      'verde' => c.slaVerde,
      'amarillo' => c.slaAmbar,
      'rojo' => c.slaRojo,
      _ => null,
    };
    if (color == null) return Text('—', style: TextStyle(color: c.textMuted));
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(color: color.withValues(alpha: 0.35), spreadRadius: 3),
            ],
          ),
        ),
        const SizedBox(width: 8),
        Text('${status![0].toUpperCase()}${status!.substring(1)}'),
      ],
    );
  }
}

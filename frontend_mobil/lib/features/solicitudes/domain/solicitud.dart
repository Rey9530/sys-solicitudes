// lib/features/solicitudes/domain/solicitud.dart
//
// Modelo de dominio de Solicitud. Espejo del Zod schema del backend
// (`packages/contracts/src/solicitudes`).

import 'package:flutter/material.dart';

import '../../../widgets/priority_chip.dart';
import '../../../widgets/sla_semaphore.dart';
import '../../../widgets/status_badge.dart';

class Solicitud {
  final String id;
  final String codigo; // "SOL-2026-00042"
  final String tipo; // mantenimiento | evento | remodelacion | otro
  final String subcategoria;
  final String descripcion;
  final String prioridad; // A..F
  final String estado; // borrador | enviada | asignado | en_revision | requerida_subsanacion | aprobada | cerrada | rechazada | cancelada | pausada (T-091e-cerrar)
  final String localCodigo;
  final String localNombre;
  final String? adminAsignadoNombre;
  final String creadoPorNombre;
  final DateTime creadaEn;
  final DateTime? enviadaEn;
  final DateTime? slaVenceEn;
  final List<Adjunto> adjuntos;

  const Solicitud({
    required this.id,
    required this.codigo,
    required this.tipo,
    required this.subcategoria,
    required this.descripcion,
    required this.prioridad,
    required this.estado,
    required this.localCodigo,
    required this.localNombre,
    this.adminAsignadoNombre,
    required this.creadoPorNombre,
    required this.creadaEn,
    this.enviadaEn,
    this.slaVenceEn,
    this.adjuntos = const [],
  });
}

class Adjunto {
  final String id;
  final String nombre;
  final String mime;
  final int sizeBytes;
  final String url;

  const Adjunto({
    required this.id,
    required this.nombre,
    required this.mime,
    required this.sizeBytes,
    required this.url,
  });
}

/// Helpers para presentación.
extension SolicitudDisplay on Solicitud {
  Prioridad get prioridadEnum => PrioridadParser.fromString(prioridad);
  (String, BadgeTone) get estadoDisplay => SolicitudEstadoMapper.map(estado);

  /// SLA: verde si > 50% del tiempo restante, ámbar 10-50%, rojo < 10% o vencido.
  ({SlaState state, String label})? slaEstado() {
    if (slaVenceEn == null) return null;
    final now = DateTime.now();
    final totalMs = slaVenceEn!.difference(enviadaEn ?? creadaEn).inMilliseconds;
    final restanteMs = slaVenceEn!.difference(now).inMilliseconds;
    if (totalMs <= 0) return (state: SlaState.red, label: 'Vencido');
    final ratio = restanteMs / totalMs;
    if (ratio < 0.10) return (state: SlaState.red, label: 'Por vencer');
    if (ratio < 0.50) return (state: SlaState.amber, label: 'Atención');
    return (state: SlaState.green, label: 'En tiempo');
  }
}
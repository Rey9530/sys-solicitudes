// lib/widgets/status_badge.dart
//
// Réplica de `.badge .b-{tone}` del web + `.bdot` (puntito interior).
// Mapea SolicitudEstado → Tone en el factory `statusBadgeFor()`.

import 'package:flutter/material.dart';

import '../core/theme/plazapp_colors.dart';

/// Tone semánticos disponibles.
enum BadgeTone { ok, info, warn, danger, neutral, primary, violet, orange, cyan, indigo }

extension BadgeToneLabel on BadgeTone {
  String get label => switch (this) {
        BadgeTone.ok => 'ok',
        BadgeTone.info => 'info',
        BadgeTone.warn => 'warn',
        BadgeTone.danger => 'danger',
        BadgeTone.neutral => 'neutral',
        BadgeTone.primary => 'primary',
        BadgeTone.violet => 'violet',
        BadgeTone.orange => 'orange',
        BadgeTone.cyan => 'cyan',
        BadgeTone.indigo => 'indigo',
      };
}

class StatusBadge extends StatelessWidget {
  const StatusBadge({
    super.key,
    required this.label,
    required this.tone,
    this.dot = true,
  });

  final String label;
  final BadgeTone tone;
  final bool dot;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<PlazappColors>()!;
    final t = switch (tone) {
      BadgeTone.ok => colors.ok,
      BadgeTone.info => colors.info,
      BadgeTone.warn => colors.warn,
      BadgeTone.danger => colors.danger,
      BadgeTone.neutral => colors.neutral,
      BadgeTone.primary => null, // special: use brand
      BadgeTone.violet => colors.violet,
      BadgeTone.orange => colors.orange,
      BadgeTone.cyan => colors.cyan,
      BadgeTone.indigo => colors.indigo,
    };

    final fg = t?.fg ?? colors.brand.primary;
    final bg = t?.bg ?? colors.brand.soft;
    final bd = t?.bd ?? colors.brand.primary.withValues(alpha: 0.3);

    final textStyle = Theme.of(context).textTheme.labelMedium?.copyWith(
          color: fg,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.1,
        );

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: bd),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (dot) ...[
            Container(
              width: 6,
              height: 6,
              decoration: BoxDecoration(
                color: fg,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 6),
          ],
          Text(label, style: textStyle),
        ],
      ),
    );
  }
}

/// Mapeo SolicitudEstado → (label, tone). Replica `estado-badge.tsx:60-69`.
/// Estados terminales: aprobada, rechazada, cancelada.
class SolicitudEstadoMapper {
  static (String, BadgeTone) map(String estado) => switch (estado) {
        'borrador' => ('Borrador', BadgeTone.neutral),
        'enviada' => ('Enviada', BadgeTone.info),
        'asignado' => ('Asignada', BadgeTone.indigo),
        'en_revision' => ('En revisión', BadgeTone.warn),
        'requerida_subsanacion' => ('Subsanación', BadgeTone.orange),
        'aprobada' => ('Aprobada', BadgeTone.ok),
        'rechazada' => ('Rechazada', BadgeTone.danger),
        'cancelada' => ('Cancelada', BadgeTone.neutral),
        'pausada' => ('Pausada', BadgeTone.cyan),
        _ => (estado, BadgeTone.neutral),
      };
}
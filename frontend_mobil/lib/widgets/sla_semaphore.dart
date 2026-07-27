// lib/widgets/sla_semaphore.dart
//
// Réplica de `.sla .sla-{green,amber,red}` del web (globals.css §13.5).
// Punto con halo de color.

import 'package:flutter/material.dart';

import '../core/theme/plazapp_colors.dart';

enum SlaState { green, amber, red }

class SlaSemaphore extends StatelessWidget {
  const SlaSemaphore({super.key, required this.state, this.label});

  final SlaState state;
  final String? label;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<PlazappColors>()!;
    final color = switch (state) {
      SlaState.green => colors.slaGreen,
      SlaState.amber => colors.slaAmber,
      SlaState.red => colors.slaRed,
    };

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 12,
          height: 12,
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(
                color: color.withValues(alpha: 0.45),
                blurRadius: 8,
                spreadRadius: 1,
              ),
            ],
          ),
        ),
        if (label != null) ...[
          const SizedBox(width: 6),
          Text(
            label!,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(color: color),
          ),
        ],
      ],
    );
  }
}
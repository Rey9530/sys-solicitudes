// lib/widgets/priority_chip.dart
//
// Réplica de `.prio .prio-{A..F}` del web (globals.css §13.4).
// Colores fijos por letra de prioridad.

import 'package:flutter/material.dart';

import '../core/theme/plazapp_colors.dart';
import '../core/theme/plazapp_text.dart';

enum Prioridad { a, b, c, d, e, f }

extension PrioridadParser on Prioridad {
  static Prioridad fromString(String s) =>
      Prioridad.values.firstWhere((p) => p.name.toUpperCase() == s.toUpperCase(),
          orElse: () => Prioridad.f);

  Color get bg => switch (this) {
        Prioridad.a => const Color(0xFFE0463A),
        Prioridad.b => const Color(0xFFE8852C),
        Prioridad.c => const Color(0xFFD6A811),
        Prioridad.d => const Color(0xFF3F9E5A),
        Prioridad.e => const Color(0xFF2F8FB0),
        Prioridad.f => const Color(0xFF7A8499),
      };
}

class PriorityChip extends StatelessWidget {
  const PriorityChip({super.key, required this.prioridad});

  final Prioridad prioridad;

  @override
  Widget build(BuildContext context) {
    final fg = Theme.of(context).extension<PlazappColors>()!.textInverse;
    return Container(
      width: 22,
      height: 22,
      decoration: BoxDecoration(
        color: prioridad.bg,
        borderRadius: BorderRadius.circular(4),
      ),
      alignment: Alignment.center,
      child: Text(
        prioridad.name.toUpperCase(),
        style: PlazappText.monoSmall.copyWith(
          color: fg,
          fontSize: 11,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
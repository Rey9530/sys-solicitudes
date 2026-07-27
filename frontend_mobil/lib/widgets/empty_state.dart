// lib/widgets/empty_state.dart
//
// Réplica de `.empty` del web (globals.css §13.7):
//   - Caja 56x56 con icono (radius 15)
//   - Título 15px / 600
//   - Body 13px muted
//   - CTA opcional

import 'package:flutter/material.dart';

import '../core/theme/plazapp_colors.dart';
import '../core/theme/plazapp_spacing.dart';

class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    this.message,
    this.cta,
  });

  final IconData icon;
  final String title;
  final String? message;
  final Widget? cta;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<PlazappColors>()!;
    final text = Theme.of(context).textTheme;

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: colors.surface3,
                borderRadius: BorderRadius.circular(15),
                border: Border.all(color: colors.border),
              ),
              alignment: Alignment.center,
              child: Icon(icon, size: 26, color: colors.text3),
            ),
            const SizedBox(height: 16),
            Text(
              title,
              textAlign: TextAlign.center,
              style: text.titleSmall?.copyWith(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: colors.text,
              ),
            ),
            if (message != null) ...[
              const SizedBox(height: 6),
              Text(
                message!,
                textAlign: TextAlign.center,
                style: text.bodySmall?.copyWith(color: colors.text3),
              ),
            ],
            if (cta != null) ...[
              const SizedBox(height: PlazSpacing.gutter),
              cta!,
            ],
          ],
        ),
      ),
    );
  }
}
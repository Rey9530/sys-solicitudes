// lib/widgets/kpi_card.dart
//
// Réplica de `.kpi` del web (globals.css §13.6). Card de estadística
// con icono en caja, label, valor grande y delta opcional.

import 'package:flutter/material.dart';

import '../core/theme/plazapp_colors.dart';
import '../core/theme/plazapp_spacing.dart';

enum KpiTint { primary, ok, info, warn, danger, violet }

extension KpiTintColor on KpiTint {
  ({Color fg, Color bg, Color bd}) resolve(PlazappColors c) {
    return switch (this) {
      KpiTint.primary => (fg: c.brand.primary, bg: c.brand.soft, bd: c.brand.primary),
      KpiTint.ok => (fg: c.ok.fg, bg: c.ok.bg, bd: c.ok.bd),
      KpiTint.info => (fg: c.info.fg, bg: c.info.bg, bd: c.info.bd),
      KpiTint.warn => (fg: c.warn.fg, bg: c.warn.bg, bd: c.warn.bd),
      KpiTint.danger => (fg: c.danger.fg, bg: c.danger.bg, bd: c.danger.bd),
      KpiTint.violet => (fg: c.violet.fg, bg: c.violet.bg, bd: c.violet.bd),
    };
  }
}

class KpiCard extends StatelessWidget {
  const KpiCard({
    super.key,
    required this.label,
    required this.value,
    this.icon,
    this.delta,
    this.deltaPositive = true,
    this.tint = KpiTint.primary,
    this.onTap,
  });

  final String label;
  final String value;
  final IconData? icon;
  final String? delta;
  final bool deltaPositive;
  final KpiTint tint;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<PlazappColors>()!;
    final t = tint.resolve(colors);
    final text = Theme.of(context).textTheme;

    return Material(
      color: colors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(PlazSpacing.radiusLg),
        side: BorderSide(color: colors.border),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(PlazSpacing.radiusLg),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(PlazSpacing.cardPad),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  if (icon != null)
                    Container(
                      width: 34,
                      height: 34,
                      decoration: BoxDecoration(
                        color: t.bg,
                        borderRadius: BorderRadius.circular(PlazSpacing.radiusSm),
                        border: Border.all(color: t.bd.withValues(alpha: 0.6)),
                      ),
                      alignment: Alignment.center,
                      child: Icon(icon, size: 17, color: t.fg),
                    ),
                  const Spacer(),
                  if (delta != null)
                    Text(
                      delta!,
                      style: text.labelSmall?.copyWith(
                        color: deltaPositive ? colors.ok.fg : colors.danger.fg,
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 16),
              Text(
                label,
                style: text.labelMedium?.copyWith(color: colors.text2),
              ),
              const SizedBox(height: 4),
              Text(
                value,
                style: text.displayMedium?.copyWith(color: colors.text),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
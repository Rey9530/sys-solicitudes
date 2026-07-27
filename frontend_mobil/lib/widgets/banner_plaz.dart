// lib/widgets/banner_plaz.dart
//
// Réplica de `.banner .banner-{warn,danger,info,ok}` del web.

import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../core/theme/plazapp_colors.dart';
import '../core/theme/plazapp_spacing.dart';

enum BannerTone { warn, danger, info, ok }

class BannerPlaz extends StatelessWidget {
  const BannerPlaz({
    super.key,
    required this.message,
    this.title,
    this.tone = BannerTone.info,
    this.icon,
    this.action,
  });

  final String? title;
  final String message;
  final BannerTone tone;
  final IconData? icon;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<PlazappColors>()!;
    final text = Theme.of(context).textTheme;

    final t = switch (tone) {
      BannerTone.warn => colors.warn,
      BannerTone.danger => colors.danger,
      BannerTone.info => colors.info,
      BannerTone.ok => colors.ok,
    };
    final defaultIcon = switch (tone) {
      BannerTone.warn => LucideIcons.alertTriangle,
      BannerTone.danger => LucideIcons.alertTriangle,
      BannerTone.info => LucideIcons.info,
      BannerTone.ok => LucideIcons.checkCircle2,
    };

    return Container(
      padding: const EdgeInsets.all(PlazSpacing.cardPad),
      decoration: BoxDecoration(
        color: t.bg,
        borderRadius: BorderRadius.circular(PlazSpacing.radiusMd),
        border: Border.all(color: t.bd),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon ?? defaultIcon, size: 18, color: t.fg),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (title != null)
                  Text(
                    title!,
                    style: text.titleSmall?.copyWith(color: t.fg),
                  ),
                if (title != null) const SizedBox(height: 2),
                Text(
                  message,
                  style: text.bodyMedium?.copyWith(color: t.fg),
                ),
              ],
            ),
          ),
          if (action != null) ...[
            const SizedBox(width: 12),
            action!,
          ],
        ],
      ),
    );
  }
}
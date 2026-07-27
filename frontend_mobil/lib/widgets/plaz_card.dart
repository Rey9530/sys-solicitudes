// lib/widgets/plaz_card.dart
//
// Réplica de `.card` del web. Composición:
//   PlazCard
//     └ CardHead (title + actions)
//     └ CardBody (content)
//     └ CardFoot (footer con acciones)

import 'package:flutter/material.dart';

import '../core/theme/plazapp_colors.dart';
import '../core/theme/plazapp_spacing.dart';

class PlazCard extends StatelessWidget {
  const PlazCard({
    super.key,
    this.padding = true,
    this.hoverable = false,
    this.onTap,
    this.child,
  });

  final bool padding;
  final bool hoverable;
  final VoidCallback? onTap;
  final Widget? child;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<PlazappColors>()!;
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
          padding: padding
              ? const EdgeInsets.all(PlazSpacing.cardPad)
              : EdgeInsets.zero,
          child: child,
        ),
      ),
    );
  }
}

/// Header con título + slot de acciones a la derecha.
class PlazCardHead extends StatelessWidget {
  const PlazCardHead({super.key, required this.title, this.actions, this.subtitle});

  final String title;
  final String? subtitle;
  final Widget? actions;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<PlazappColors>()!;
    final text = Theme.of(context).textTheme;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: PlazSpacing.cardHeadPx,
        vertical: PlazSpacing.cardHeadPy,
      ),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: colors.border)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: text.titleMedium),
                if (subtitle != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    subtitle!,
                    style: text.bodySmall?.copyWith(color: colors.text2),
                  ),
                ],
              ],
            ),
          ),
          if (actions != null) actions!,
        ],
      ),
    );
  }
}

/// Footer con acciones separadas por border superior sutil.
class PlazCardFoot extends StatelessWidget {
  const PlazCardFoot({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<PlazappColors>()!;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: PlazSpacing.cardFootPx,
        vertical: PlazSpacing.cardFootPy,
      ),
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: colors.border)),
      ),
      child: child,
    );
  }
}
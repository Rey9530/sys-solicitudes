// lib/widgets/plaz_button.dart
//
// Réplica de los `.btn*` del web (frontend/src/app/globals.css §13.1):
//   - Variants: primary, secondary, ghost, danger, dangerSolid, success
//   - Sizes: sm (32), default (38), lg (44), icon (38x38)
//   - Estados: enabled / disabled / loading

import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../core/theme/plazapp_colors.dart';
import '../core/theme/plazapp_spacing.dart';
import '../core/theme/plazapp_text.dart';

enum PlazButtonVariant { primary, secondary, ghost, danger, dangerSolid, success }

enum PlazButtonSize { sm, md, lg, icon }

class PlazButton extends StatelessWidget {
  const PlazButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.variant = PlazButtonVariant.primary,
    this.size = PlazButtonSize.md,
    this.icon,
    this.loading = false,
    this.block = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final PlazButtonVariant variant;
  final PlazButtonSize size;
  final IconData? icon;
  final bool loading;
  final bool block;

  double get _height {
    switch (size) {
      case PlazButtonSize.sm:
        return PlazSpacing.btnHeightSm;
      case PlazButtonSize.md:
        return PlazSpacing.btnHeight;
      case PlazButtonSize.lg:
        return PlazSpacing.btnHeightLg;
      case PlazButtonSize.icon:
        return PlazSpacing.iconBtn;
    }
  }

  double get _iconSize {
    switch (size) {
      case PlazButtonSize.sm:
        return 14;
      case PlazButtonSize.lg:
        return 18;
      case PlazButtonSize.icon:
        return 18;
      case PlazButtonSize.md:
        return 16;
    }
  }

  TextStyle get _textStyle {
    final base = (size == PlazButtonSize.lg
            ? PlazappText.textTheme.labelLarge?.copyWith(fontSize: 15)
            : PlazappText.textTheme.labelLarge) ??
        const TextStyle();
    return base;
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<PlazappColors>()!;

    final isDisabled = onPressed == null || loading;

    // Background y foreground por variante.
    late Color bg;
    late Color fg;
    Color? border;
    switch (variant) {
      case PlazButtonVariant.primary:
        bg = colors.brand.primary;
        fg = colors.textInverse;
        border = null;
        break;
      case PlazButtonVariant.secondary:
        bg = colors.surface;
        fg = colors.text;
        border = colors.borderStrong;
        break;
      case PlazButtonVariant.ghost:
        bg = Colors.transparent;
        fg = colors.text2;
        border = null;
        break;
      case PlazButtonVariant.danger:
        bg = colors.danger.bg;
        fg = colors.danger.fg;
        border = colors.danger.bd;
        break;
      case PlazButtonVariant.dangerSolid:
        bg = colors.danger.fg;
        fg = colors.textInverse;
        border = null;
        break;
      case PlazButtonVariant.success:
        bg = colors.ok.fg;
        fg = colors.textInverse;
        border = null;
        break;
    }

    final paddingH = switch (size) {
      PlazButtonSize.sm => PlazSpacing.btnPaddingXSm,
      PlazButtonSize.lg => PlazSpacing.btnPaddingXLg,
      PlazButtonSize.icon => 0.0,
      PlazButtonSize.md => PlazSpacing.btnPaddingX,
    };

    return Material(
      color: bg,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(PlazSpacing.radiusSm),
        side: border != null ? BorderSide(color: border) : BorderSide.none,
      ),
      child: InkWell(
        onTap: isDisabled ? null : onPressed,
        borderRadius: BorderRadius.circular(PlazSpacing.radiusSm),
        child: ConstrainedBox(
          constraints: BoxConstraints(
            minHeight: _height,
            minWidth: size == PlazButtonSize.icon ? _height : 0,
          ),
          child: Container(
            width: block && size != PlazButtonSize.icon ? double.infinity : null,
            padding: EdgeInsets.symmetric(horizontal: paddingH),
            alignment: Alignment.center,
            child: loading
                ? SizedBox(
                    width: _iconSize,
                    height: _iconSize,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation(fg),
                    ),
                  )
                : Row(
                    mainAxisSize: MainAxisSize.min,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      if (icon != null) ...[
                        Icon(icon, size: _iconSize, color: fg),
                        if (label.isNotEmpty) const SizedBox(width: 8),
                      ],
                      if (label.isNotEmpty)
                        Text(
                          label,
                          style: _textStyle.copyWith(color: fg),
                        ),
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}

/// Solo icono — para compact actions.
class PlazIconButton extends StatelessWidget {
  const PlazIconButton({
    super.key,
    required this.icon,
    required this.onPressed,
    this.tooltip,
    this.size = PlazSpacing.iconBtn,
    this.color,
  });

  final IconData icon;
  final VoidCallback? onPressed;
  final String? tooltip;
  final double size;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<PlazappColors>()!;
    return IconButton(
      icon: Icon(icon, size: 18, color: color ?? colors.text2),
      onPressed: onPressed,
      tooltip: tooltip,
      splashRadius: size / 2,
    );
  }
}

// lucide_icons usage examples (silence unused warning on import).
// ignore: unused_element
const _kExample = LucideIcons.user;
// lib/widgets/confirm_dialog.dart
//
// Wrapper sobre showDialog para reemplazar SweetAlert2 del web.
// Acciones destructivas → icon warning (enfoca Cancelar).
// Decisiones neutras → icon question.

import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../core/theme/plazapp_colors.dart';
import '../core/theme/plazapp_spacing.dart';
import 'plaz_button.dart';

enum ConfirmKind { danger, warning, info, question, success }

Future<bool> showPlazConfirm({
  required BuildContext context,
  required String title,
  required String message,
  required String confirmLabel,
  String cancelLabel = 'Cancelar',
  ConfirmKind kind = ConfirmKind.warning,
}) async {
  final colors = Theme.of(context).extension<PlazappColors>()!;
  final text = Theme.of(context).textTheme;

  final (iconData, iconBg, iconFg) = switch (kind) {
    ConfirmKind.danger => (
        LucideIcons.alertTriangle,
        colors.danger.bg,
        colors.danger.fg
      ),
    ConfirmKind.warning => (
        LucideIcons.alertTriangle,
        colors.warn.bg,
        colors.warn.fg
      ),
    ConfirmKind.info => (
        LucideIcons.info,
        colors.info.bg,
        colors.info.fg
      ),
    ConfirmKind.question => (
        LucideIcons.helpCircle,
        colors.brand.soft,
        colors.brand.primary
      ),
    ConfirmKind.success => (
        LucideIcons.checkCircle2,
        colors.ok.bg,
        colors.ok.fg
      ),
  };

  final result = await showDialog<bool>(
    context: context,
    barrierColor: Colors.black.withValues(alpha: 0.55),
    builder: (ctx) => AlertDialog(
      backgroundColor: colors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(PlazSpacing.radiusXl),
      ),
      contentPadding: const EdgeInsets.fromLTRB(24, 24, 24, 16),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: iconBg,
                  borderRadius: BorderRadius.circular(PlazSpacing.radiusSm),
                ),
                child: Icon(iconData, size: 20, color: iconFg),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Text(
                  title,
                  style: text.headlineMedium?.copyWith(color: colors.text),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Padding(
            padding: const EdgeInsets.only(left: 54),
            child: Text(
              message,
              style: text.bodyMedium?.copyWith(color: colors.text2),
            ),
          ),
          const SizedBox(height: 24),
          Padding(
            padding: const EdgeInsets.only(left: 54),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                PlazButton(
                  label: cancelLabel,
                  variant: PlazButtonVariant.secondary,
                  onPressed: () => Navigator.of(ctx).pop(false),
                ),
                const SizedBox(width: 8),
                PlazButton(
                  label: confirmLabel,
                  variant: kind == ConfirmKind.danger
                      ? PlazButtonVariant.dangerSolid
                      : PlazButtonVariant.primary,
                  onPressed: () => Navigator.of(ctx).pop(true),
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
  return result ?? false;
}
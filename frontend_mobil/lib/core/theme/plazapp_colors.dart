// lib/core/theme/plazapp_colors.dart
//
// Tokens de color del sistema de diseño Plazapp.
// Espejo 1:1 de los tokens definidos en `frontend/src/app/globals.css`.
//
// Estructura:
//   - PlazappColors extends ThemeExtension — slot consumible desde Theme.of(context).extension<PlazappColors>()
//   - BrandColors — escala derivada del color primario del tenant (replica el `color-mix` del CSS)
//   - SemanticTone — fg/bg/bd para ok/info/warn/orange/indigo/cyan/danger/violet/neutral
//
// Convenciones:
//   - Light y Dark se exponen como factories estáticos (`PlazappColors.light()`, `.dark()`).
//   - El BrandColors se inyecta en runtime (después del login) via `copyWith(brand: ...)`.
//   - Todos los colores son inmutables (final fields).

import 'package:flutter/material.dart';

import 'brand_colors.dart';

/// Slot del ThemeData que expone los tokens semánticos de Plazapp.
///
/// Acceso desde un widget:
/// ```dart
/// final colors = Theme.of(context).extension<PlazappColors>()!;
/// Container(color: colors.surface)
/// ```
class PlazappColors extends ThemeExtension<PlazappColors> {
  // Surfaces / fondo
  final Color bg;
  final Color surface;
  final Color surface2;
  final Color surface3;
  final Color surfaceInset;

  // Bordes
  final Color border;
  final Color border2;
  final Color borderStrong;

  // Texto
  final Color text;
  final Color text2;
  final Color text3;
  final Color textMuted;
  final Color textInverse;

  // Sidebar (navy permanente, ambos temas)
  final Color sideBg;
  final Color sideBg2;
  final Color sideBorder;
  final Color sideText;
  final Color sideTextDim;
  final Color sideTextStrong;
  final Color sideHoverBg;
  final Color sideSection;
  final Color sideActiveBar;

  // Semánticas
  final SemanticTone ok;
  final SemanticTone info;
  final SemanticTone warn;
  final SemanticTone orange;
  final SemanticTone indigo;
  final SemanticTone cyan;
  final SemanticTone danger;
  final SemanticTone violet;
  final SemanticTone neutral;

  // SLA semáforo
  final Color slaGreen;
  final Color slaAmber;
  final Color slaRed;

  // Brand — inyectado per-tenant
  final BrandColors brand;

  const PlazappColors({
    required this.bg,
    required this.surface,
    required this.surface2,
    required this.surface3,
    required this.surfaceInset,
    required this.border,
    required this.border2,
    required this.borderStrong,
    required this.text,
    required this.text2,
    required this.text3,
    required this.textMuted,
    required this.textInverse,
    required this.sideBg,
    required this.sideBg2,
    required this.sideBorder,
    required this.sideText,
    required this.sideTextDim,
    required this.sideTextStrong,
    required this.sideHoverBg,
    required this.sideSection,
    required this.sideActiveBar,
    required this.ok,
    required this.info,
    required this.warn,
    required this.orange,
    required this.indigo,
    required this.cyan,
    required this.danger,
    required this.violet,
    required this.neutral,
    required this.slaGreen,
    required this.slaAmber,
    required this.slaRed,
    required this.brand,
  });

  /// Tema claro — replica los tokens del web en `:root`.
  /// Brand por defecto = #2f62e6 (Plazapp).
  factory PlazappColors.light({BrandColors? brand}) => PlazappColors(
        bg: const Color(0xFFF4F6F9),
        surface: const Color(0xFFFFFFFF),
        surface2: const Color(0xFFFAFBFC),
        surface3: const Color(0xFFF1F3F6),
        surfaceInset: const Color(0xFFF6F8FA),
        border: const Color(0xFFE6E8EE),
        border2: const Color(0xFFEEF0F4),
        borderStrong: const Color(0xFFD6DAE2),
        text: const Color(0xFF131A26),
        text2: const Color(0xFF475063),
        text3: const Color(0xFF6B7486),
        textMuted: const Color(0xFF98A0B0),
        textInverse: const Color(0xFFFFFFFF),
        sideBg: const Color(0xFF0D1521),
        sideBg2: const Color(0xFF111C2C),
        sideBorder: const Color(0x1AFFFFFF), // rgba(255,255,255,.07) aprox.
        sideText: const Color(0xFF9AA7BA),
        sideTextDim: const Color(0xFF6B7791),
        sideTextStrong: const Color(0xFFFFFFFF),
        sideHoverBg: const Color(0x0DFFFFFF), // rgba(255,255,255,.05)
        sideSection: const Color(0xFF5D6A82),
        sideActiveBar: const Color(0xFF99B0FF), // primary-300 aproximado
        ok: const SemanticTone(fg: Color(0xFF0A6B46), bg: Color(0xFFE7F6EE), bd: Color(0xFFBCE6CF)),
        info: const SemanticTone(fg: Color(0xFF0B5CAB), bg: Color(0xFFE6F1FD), bd: Color(0xFFBCDCF6)),
        warn: const SemanticTone(fg: Color(0xFF9A6206), bg: Color(0xFFFDF3E2), bd: Color(0xFFF3DCAB)),
        orange: const SemanticTone(fg: Color(0xFFB14A08), bg: Color(0xFFFDEEE2), bd: Color(0xFFF6CBA6)),
        indigo: const SemanticTone(fg: Color(0xFF3F3FB0), bg: Color(0xFFEBEBFB), bd: Color(0xFFCFCFF3)),
        cyan: const SemanticTone(fg: Color(0xFF0A6A78), bg: Color(0xFFE2F5F8), bd: Color(0xFFA9E2EA)),
        danger: const SemanticTone(fg: Color(0xFFB42318), bg: Color(0xFFFDECEB), bd: Color(0xFFF5C4C0)),
        violet: const SemanticTone(fg: Color(0xFF6B35C2), bg: Color(0xFFF1E9FC), bd: Color(0xFFDCC8F4)),
        neutral: const SemanticTone(fg: Color(0xFF5A6678), bg: Color(0xFFEEF0F3), bd: Color(0xFFDDE1E8)),
        slaGreen: const Color(0xFF16A34A),
        slaAmber: const Color(0xFFE0A106),
        slaRed: const Color(0xFFE0463A),
        brand: brand ?? const BrandColors(primary: Color(0xFF2F62E6)),
      );

  /// Tema oscuro — replica los tokens del web en `[data-theme="dark"]`.
  factory PlazappColors.dark({BrandColors? brand}) => PlazappColors(
        bg: const Color(0xFF080B11),
        surface: const Color(0xFF10151E),
        surface2: const Color(0xFF0C111A),
        surface3: const Color(0xFF18202C),
        surfaceInset: const Color(0xFF0C121B),
        border: const Color(0xFF222B39),
        border2: const Color(0xFF1A2230),
        borderStrong: const Color(0xFF2D3848),
        text: const Color(0xFFE9EDF4),
        text2: const Color(0xFFA4AFC0),
        text3: const Color(0xFF818C9F),
        textMuted: const Color(0xFF5F6A7D),
        textInverse: const Color(0xFF0B1118),
        sideBg: const Color(0xFF0A1019),
        sideBg2: const Color(0xFF0E1622),
        sideBorder: const Color(0x1AFFFFFF),
        sideText: const Color(0xFF9AA7BA),
        sideTextDim: const Color(0xFF6B7791),
        sideTextStrong: const Color(0xFFFFFFFF),
        sideHoverBg: const Color(0x0DFFFFFF),
        sideSection: const Color(0xFF5D6A82),
        sideActiveBar: const Color(0xFF99B0FF),
        ok: const SemanticTone(fg: Color(0xFF5FD6A0), bg: Color(0xFF0E2920), bd: Color(0xFF1D4838)),
        info: const SemanticTone(fg: Color(0xFF6FB4F4), bg: Color(0xFF0E2436), bd: Color(0xFF1D3F5C)),
        warn: const SemanticTone(fg: Color(0xFFF0BD5A), bg: Color(0xFF2C2210), bd: Color(0xFF4D3C18)),
        orange: const SemanticTone(fg: Color(0xFFF3A164), bg: Color(0xFF2E1D10), bd: Color(0xFF523619)),
        indigo: const SemanticTone(fg: Color(0xFF9A9AF0), bg: Color(0xFF1B1B38), bd: Color(0xFF33336A)),
        cyan: const SemanticTone(fg: Color(0xFF54C6D6), bg: Color(0xFF0C2A30), bd: Color(0xFF19474F)),
        danger: const SemanticTone(fg: Color(0xFFF3837A), bg: Color(0xFF2E1414), bd: Color(0xFF562525)),
        violet: const SemanticTone(fg: Color(0xFFB794F0), bg: Color(0xFF241734), bd: Color(0xFF412B5E)),
        neutral: const SemanticTone(fg: Color(0xFF9AA6B8), bg: Color(0xFF1A2230), bd: Color(0xFF2A3543)),
        slaGreen: const Color(0xFF34C77B),
        slaAmber: const Color(0xFFEDB43C),
        slaRed: const Color(0xFFEF6258),
        brand: brand ?? const BrandColors(primary: Color(0xFF2F62E6)),
      );

  /// Inyecta (o reemplaza) la escala del color de marca.
  /// Usado por el loader de branding al cambiar de tenant.
  @override
  PlazappColors copyWith({BrandColors? brand}) => PlazappColors(
        bg: bg,
        surface: surface,
        surface2: surface2,
        surface3: surface3,
        surfaceInset: surfaceInset,
        border: border,
        border2: border2,
        borderStrong: borderStrong,
        text: text,
        text2: text2,
        text3: text3,
        textMuted: textMuted,
        textInverse: textInverse,
        sideBg: sideBg,
        sideBg2: sideBg2,
        sideBorder: sideBorder,
        sideText: sideText,
        sideTextDim: sideTextDim,
        sideTextStrong: sideTextStrong,
        sideHoverBg: sideHoverBg,
        sideSection: sideSection,
        sideActiveBar: sideActiveBar,
        ok: ok,
        info: info,
        warn: warn,
        orange: orange,
        indigo: indigo,
        cyan: cyan,
        danger: danger,
        violet: violet,
        neutral: neutral,
        slaGreen: slaGreen,
        slaAmber: slaAmber,
        slaRed: slaRed,
        brand: brand ?? this.brand,
      );

  @override
  PlazappColors lerp(ThemeExtension<PlazappColors>? other, double t) {
    if (other is! PlazappColors) return this;
    // Solo lerpeamos superficies/texto; brand y semánticas saltan abruptamente.
    return PlazappColors(
      bg: Color.lerp(bg, other.bg, t)!,
      surface: Color.lerp(surface, other.surface, t)!,
      surface2: Color.lerp(surface2, other.surface2, t)!,
      surface3: Color.lerp(surface3, other.surface3, t)!,
      surfaceInset: Color.lerp(surfaceInset, other.surfaceInset, t)!,
      border: Color.lerp(border, other.border, t)!,
      border2: Color.lerp(border2, other.border2, t)!,
      borderStrong: Color.lerp(borderStrong, other.borderStrong, t)!,
      text: Color.lerp(text, other.text, t)!,
      text2: Color.lerp(text2, other.text2, t)!,
      text3: Color.lerp(text3, other.text3, t)!,
      textMuted: Color.lerp(textMuted, other.textMuted, t)!,
      textInverse: Color.lerp(textInverse, other.textInverse, t)!,
      sideBg: Color.lerp(sideBg, other.sideBg, t)!,
      sideBg2: Color.lerp(sideBg2, other.sideBg2, t)!,
      sideBorder: Color.lerp(sideBorder, other.sideBorder, t)!,
      sideText: Color.lerp(sideText, other.sideText, t)!,
      sideTextDim: Color.lerp(sideTextDim, other.sideTextDim, t)!,
      sideTextStrong: Color.lerp(sideTextStrong, other.sideTextStrong, t)!,
      sideHoverBg: Color.lerp(sideHoverBg, other.sideHoverBg, t)!,
      sideSection: Color.lerp(sideSection, other.sideSection, t)!,
      sideActiveBar: Color.lerp(sideActiveBar, other.sideActiveBar, t)!,
      ok: ok,
      info: info,
      warn: warn,
      orange: orange,
      indigo: indigo,
      cyan: cyan,
      danger: danger,
      violet: violet,
      neutral: neutral,
      slaGreen: Color.lerp(slaGreen, other.slaGreen, t)!,
      slaAmber: Color.lerp(slaAmber, other.slaAmber, t)!,
      slaRed: Color.lerp(slaRed, other.slaRed, t)!,
      brand: t < 0.5 ? brand : other.brand,
    );
  }
}

/// Tono semántico con tres slots: fg (texto), bg (relleno), bd (borde).
@immutable
class SemanticTone {
  final Color fg;
  final Color bg;
  final Color bd;
  const SemanticTone({required this.fg, required this.bg, required this.bd});
}
// lib/core/theme/plazapp_theme.dart
//
// Builder de ThemeData para Plazapp. Usa Material 3 + el ThemeExtension<PlazappColors>
// para exponer tokens semánticos. Genera theme light y dark, parametrizados por
// BrandColors (color de marca del tenant).

import 'package:flutter/material.dart';

import 'brand_colors.dart';
import 'plazapp_colors.dart';
import 'plazapp_spacing.dart';
import 'plazapp_text.dart';

class PlazappTheme {
  PlazappTheme._();

  /// Tema claro de Plazapp.
  static ThemeData light({BrandColors brand = const BrandColors(primary: Color(0xFF2F62E6))}) =>
      _buildTheme(PlazappColors.light(brand: brand), brightness: Brightness.light);

  /// Tema oscuro de Plazapp.
  static ThemeData dark({BrandColors brand = const BrandColors(primary: Color(0xFF2F62E6))}) =>
      _buildTheme(PlazappColors.dark(brand: brand), brightness: Brightness.dark);

  static ThemeData _buildTheme(PlazappColors colors, {required Brightness brightness}) {
    // Derivar ColorScheme de Material 3 desde el brand.
    final scheme = ColorScheme.fromSeed(
      seedColor: colors.brand.primary,
      brightness: brightness,
      surface: colors.surface,
      onSurface: colors.text,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: scheme,
      scaffoldBackgroundColor: colors.bg,

      // TextTheme
      textTheme: PlazappText.textTheme.apply(
        bodyColor: colors.text,
        displayColor: colors.text,
      ),
      primaryTextTheme: PlazappText.textTheme.apply(
        bodyColor: colors.textInverse,
        displayColor: colors.textInverse,
      ),

      // AppBar (topbar) — sticky, blur
      appBarTheme: AppBarTheme(
        backgroundColor: colors.surface.withValues(alpha: 0.80),
        foregroundColor: colors.text,
        elevation: 0,
        scrolledUnderElevation: 1,
        titleTextStyle: PlazappText.textTheme.titleMedium?.copyWith(color: colors.text),
        toolbarHeight: PlazSpacing.topbarHeight,
        surfaceTintColor: Colors.transparent,
      ),

      // Card
      cardTheme: CardThemeData(
        color: colors.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(PlazSpacing.radiusLg),
          side: BorderSide(color: colors.border),
        ),
      ),

      // ElevatedButton (no usado directamente — usamos PlazButton; dejamos config base)
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: colors.brand.primary,
          foregroundColor: colors.textInverse,
          elevation: 0,
          minimumSize: const Size(0, PlazSpacing.btnHeight),
          padding: const EdgeInsets.symmetric(horizontal: PlazSpacing.btnPaddingX),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(PlazSpacing.radiusSm)),
          textStyle: PlazappText.textTheme.labelLarge,
        ),
      ),

      // Input (TextField base)
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: colors.surface,
        contentPadding: const EdgeInsets.symmetric(horizontal: PlazSpacing.inputPaddingX),
        constraints: const BoxConstraints(minHeight: PlazSpacing.inputHeight),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(PlazSpacing.radiusSm),
          borderSide: BorderSide(color: colors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(PlazSpacing.radiusSm),
          borderSide: BorderSide(color: colors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(PlazSpacing.radiusSm),
          borderSide: BorderSide(color: colors.brand.primary, width: 2),
        ),
        labelStyle: PlazappText.textTheme.bodyMedium?.copyWith(color: colors.text2),
        hintStyle: PlazappText.textTheme.bodyMedium?.copyWith(color: colors.textMuted),
      ),

      // Dialog
      dialogTheme: DialogThemeData(
        backgroundColor: colors.surface,
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(PlazSpacing.radiusXl)),
      ),

      // Divider
      dividerTheme: DividerThemeData(color: colors.border, space: 1, thickness: 1),

      // BottomNavigationBar (shell inquilino)
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: colors.surface,
        selectedItemColor: colors.brand.primary,
        unselectedItemColor: colors.text3,
        type: BottomNavigationBarType.fixed,
        elevation: 8,
        selectedLabelStyle: PlazappText.textTheme.labelSmall?.copyWith(color: colors.brand.primary),
        unselectedLabelStyle: PlazappText.textTheme.labelSmall?.copyWith(color: colors.text3),
      ),

      // NavigationRail (shell admin en tablets/desktop)
      navigationRailTheme: NavigationRailThemeData(
        backgroundColor: colors.sideBg,
        selectedIconTheme: IconThemeData(color: colors.brand.p300),
        unselectedIconTheme: IconThemeData(color: colors.sideText),
        selectedLabelTextStyle: PlazappText.textTheme.labelMedium?.copyWith(color: colors.sideTextStrong),
        unselectedLabelTextStyle: PlazappText.textTheme.labelMedium?.copyWith(color: colors.sideText),
        indicatorColor: colors.brand.primary.withValues(alpha: 0.22),
      ),

      // ThemeExtension — el slot de PlazappColors
      extensions: <ThemeExtension<dynamic>>[colors],
    );
  }
}
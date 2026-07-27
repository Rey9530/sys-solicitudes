// lib/core/theme/plazapp_text.dart
//
// TextTheme de Plazapp. Replica la escala del frontend web
// (ver `frontend/src/app/globals.css` y el summary del analysis agent).
//
// Pesos clave:
//   400 = Regular (body)
//   500 = Medium (controles)
//   600 = SemiBold (títulos)
//   700 = Bold (logo, prioridad chip)

import 'package:flutter/material.dart';

class PlazappText {
  PlazappText._();

  static const String fontFamilySans = 'GeneralSans';
  static const String fontFamilyMono = 'JetBrainsMono';

  /// Escala replicada del web (en px del CSS → se aplican como sp en Flutter).
  static const TextTheme textTheme = TextTheme(
    // Hero / auth brand
    displayLarge: TextStyle(
      fontFamily: fontFamilySans,
      fontSize: 34,
      fontWeight: FontWeight.w600,
      letterSpacing: -0.75,
      height: 1.15,
    ),
    // KPI value
    displayMedium: TextStyle(
      fontFamily: fontFamilySans,
      fontSize: 30,
      fontWeight: FontWeight.w700, // 650 no existe en Flutter → 700
      letterSpacing: -0.6,
      height: 1.0,
    ),
    // Auth h1
    displaySmall: TextStyle(
      fontFamily: fontFamilySans,
      fontSize: 25,
      fontWeight: FontWeight.w600,
      letterSpacing: -0.5,
    ),
    // Page title (.page-title)
    headlineLarge: TextStyle(
      fontFamily: fontFamilySans,
      fontSize: 23,
      fontWeight: FontWeight.w600,
      letterSpacing: -0.45,
      height: 1.15,
    ),
    // Dialog title
    headlineMedium: TextStyle(
      fontFamily: fontFamilySans,
      fontSize: 17,
      fontWeight: FontWeight.w600,
      letterSpacing: -0.2,
    ),
    // Card head h3
    titleMedium: TextStyle(
      fontFamily: fontFamilySans,
      fontSize: 14.5,
      fontWeight: FontWeight.w600,
      letterSpacing: -0.1,
    ),
    // Labels en controles
    titleSmall: TextStyle(
      fontFamily: fontFamilySans,
      fontSize: 13.5,
      fontWeight: FontWeight.w500,
    ),
    // Body
    bodyLarge: TextStyle(
      fontFamily: fontFamilySans,
      fontSize: 14,
      height: 1.5,
    ),
    bodyMedium: TextStyle(
      fontFamily: fontFamilySans,
      fontSize: 13.5,
      height: 1.5,
    ),
    // Cell text
    bodySmall: TextStyle(
      fontFamily: fontFamilySans,
      fontSize: 13,
      height: 1.5,
    ),
    // Button label
    labelLarge: TextStyle(
      fontFamily: fontFamilySans,
      fontSize: 13.5,
      fontWeight: FontWeight.w500,
    ),
    labelMedium: TextStyle(
      fontFamily: fontFamilySans,
      fontSize: 12.5,
      fontWeight: FontWeight.w500,
    ),
    // Filter labels, sidebar section, table headers — uppercase tracking 0.05em
    labelSmall: TextStyle(
      fontFamily: fontFamilySans,
      fontSize: 11,
      fontWeight: FontWeight.w600,
      letterSpacing: 0.5,
    ),
  );

  /// Variante monoespaciada (JetBrains Mono). Para cellcode, kbd, contadores, prio chip.
  static const TextStyle monoBase = TextStyle(
    fontFamily: fontFamilyMono,
    fontSize: 13,
    height: 1.5,
    fontFeatures: [FontFeature.tabularFigures()],
  );

  static const TextStyle monoSmall = TextStyle(
    fontFamily: fontFamilyMono,
    fontSize: 11.5,
    fontWeight: FontWeight.w600,
    fontFeatures: [FontFeature.tabularFigures()],
  );

  static const TextStyle monoCounter = TextStyle(
    fontFamily: fontFamilyMono,
    fontSize: 11,
    fontWeight: FontWeight.w600,
    fontFeatures: [FontFeature.tabularFigures()],
  );
}
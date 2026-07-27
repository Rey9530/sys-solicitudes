// lib/core/theme/brand_colors.dart
//
// Escala de color de marca (BrandColors) derivada del color primario del tenant.
// Replica el `color-mix(in srgb, var(--primary) X%, white|black)` del CSS.
//
// En el web los tokens son:
//
//   --primary-50   = mix(primary 8%,  white)
//   --primary-100  = mix(primary 14%, white)
//   --primary-200  = mix(primary 26%, white)
//   --primary-300  = mix(primary 42%, white)
//   --primary-500  = var(--primary)
//   --primary-600  = mix(primary 84%, black)
//   --primary-700  = mix(primary 68%, black)
//   --primary-soft = mix(primary 12%, white)
//   --primary-ring = mix(primary 38%, transparent)
//
// En Flutter lo implementamos con Color.lerp(primary, white, factor).

import 'package:flutter/material.dart';

@immutable
class BrandColors {
  final Color primary;

  const BrandColors({required this.primary});

  // Escala derivada del primary.
  Color get p50 => Color.lerp(primary, Colors.white, 0.08)!;
  Color get p100 => Color.lerp(primary, Colors.white, 0.14)!;
  Color get p200 => Color.lerp(primary, Colors.white, 0.26)!;
  Color get p300 => Color.lerp(primary, Colors.white, 0.42)!;
  Color get p500 => primary;
  Color get p600 => Color.lerp(primary, Colors.black, 0.16)!; // 84% primary, 16% black
  Color get p700 => Color.lerp(primary, Colors.black, 0.32)!; // 68% primary, 32% black
  Color get soft => Color.lerp(primary, Colors.white, 0.12)!;
  Color get ring => primary.withValues(alpha: 0.38);

  /// Versión para dark mode — replica el override del web:
  /// `--primary-soft: mix(primary 22%, #0d1420)` (fondo dark)
  Color get softDark => Color.lerp(primary, const Color(0xFF0D1420), 0.22)!;
  Color get p700Dark => Color.lerp(primary, Colors.white, 0.52)!; // se aclara para contraste

  /// Helper para construir un gradiente idéntico al logo "P" del web:
  ///   linear-gradient(150deg, var(--primary-300), var(--primary))
  LinearGradient get logoGradient => LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [p300, primary],
      );

  @override
  bool operator ==(Object other) =>
      other is BrandColors && other.primary == primary;

  @override
  int get hashCode => primary.hashCode;
}

/// Parsea un hex color (#RRGGBB o #RGB) a `Color`.
/// Acepta también #RRGGBBAA.
Color hexToColor(String hex) {
  var h = hex.replaceFirst('#', '').trim();
  if (h.length == 3) {
    h = h.split('').map((c) => '$c$c').join();
  }
  if (h.length == 6) h = '${h}FF';
  return Color(int.parse(h, radix: 16));
}

/// Construye BrandColors a partir de un string hex (colorPrimario del backend).
BrandColors buildBrandColorsFromHex(String hex) =>
    BrandColors(primary: hexToColor(hex));
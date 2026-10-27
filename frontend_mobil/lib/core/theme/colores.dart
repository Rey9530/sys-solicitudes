import 'package:flutter/material.dart';

/// Tonos semánticos del sistema de diseño (badges, avisos, estados). Mismos
/// nombres que las clases `.b-*` del web.
enum Tono { ok, info, warn, orange, indigo, cyan, danger, violet, neutral }

/// Colores de un tono: texto, fondo y borde.
@immutable
class ColoresTono {
  const ColoresTono(this.fg, this.bg, this.bd);
  final Color fg;
  final Color bg;
  final Color bd;
}

/// Tokens de color del web (`frontend/src/app/globals.css`), claro y oscuro.
/// Acceso: `ColoresPlazapp.of(context).surface`.
@immutable
class ColoresPlazapp extends ThemeExtension<ColoresPlazapp> {
  const ColoresPlazapp({
    required this.bg,
    required this.surface,
    required this.surface2,
    required this.surface3,
    required this.border,
    required this.borderStrong,
    required this.text,
    required this.text2,
    required this.text3,
    required this.textMuted,
    required this.sideBg,
    required this.sideText,
    required this.sideTextDim,
    required this.sideSection,
    required this.tonos,
    required this.slaVerde,
    required this.slaAmbar,
    required this.slaRojo,
  });

  final Color bg;
  final Color surface;
  final Color surface2;
  final Color surface3;
  final Color border;
  final Color borderStrong;
  final Color text;
  final Color text2;
  final Color text3;
  final Color textMuted;
  final Color sideBg;
  final Color sideText;
  final Color sideTextDim;
  final Color sideSection;
  final Map<Tono, ColoresTono> tonos;
  final Color slaVerde;
  final Color slaAmbar;
  final Color slaRojo;

  ColoresTono tono(Tono t) => tonos[t]!;

  static ColoresPlazapp of(BuildContext context) =>
      Theme.of(context).extension<ColoresPlazapp>()!;

  static const claro = ColoresPlazapp(
    bg: Color(0xFFF4F6F9),
    surface: Color(0xFFFFFFFF),
    surface2: Color(0xFFFAFBFC),
    surface3: Color(0xFFF1F3F6),
    border: Color(0xFFE6E8EE),
    borderStrong: Color(0xFFD6DAE2),
    text: Color(0xFF131A26),
    text2: Color(0xFF475063),
    text3: Color(0xFF6B7486),
    textMuted: Color(0xFF98A0B0),
    sideBg: Color(0xFF0D1521),
    sideText: Color(0xFF9AA7BA),
    sideTextDim: Color(0xFF6B7791),
    sideSection: Color(0xFF5D6A82),
    tonos: {
      Tono.ok: ColoresTono(
        Color(0xFF0A6B46),
        Color(0xFFE7F6EE),
        Color(0xFFBCE6CF),
      ),
      Tono.info: ColoresTono(
        Color(0xFF0B5CAB),
        Color(0xFFE6F1FD),
        Color(0xFFBCDCF6),
      ),
      Tono.warn: ColoresTono(
        Color(0xFF9A6206),
        Color(0xFFFDF3E2),
        Color(0xFFF3DCAB),
      ),
      Tono.orange: ColoresTono(
        Color(0xFFB14A08),
        Color(0xFFFDEEE2),
        Color(0xFFF6CBA6),
      ),
      Tono.indigo: ColoresTono(
        Color(0xFF3F3FB0),
        Color(0xFFEBEBFB),
        Color(0xFFCFCFF3),
      ),
      Tono.cyan: ColoresTono(
        Color(0xFF0A6A78),
        Color(0xFFE2F5F8),
        Color(0xFFA9E2EA),
      ),
      Tono.danger: ColoresTono(
        Color(0xFFB42318),
        Color(0xFFFDECEB),
        Color(0xFFF5C4C0),
      ),
      Tono.violet: ColoresTono(
        Color(0xFF6B35C2),
        Color(0xFFF1E9FC),
        Color(0xFFDCC8F4),
      ),
      Tono.neutral: ColoresTono(
        Color(0xFF5A6678),
        Color(0xFFEEF0F3),
        Color(0xFFDDE1E8),
      ),
    },
    slaVerde: Color(0xFF16A34A),
    slaAmbar: Color(0xFFE0A106),
    slaRojo: Color(0xFFE0463A),
  );

  static const oscuro = ColoresPlazapp(
    bg: Color(0xFF080B11),
    surface: Color(0xFF10151E),
    surface2: Color(0xFF0C111A),
    surface3: Color(0xFF18202C),
    border: Color(0xFF222B39),
    borderStrong: Color(0xFF2D3848),
    text: Color(0xFFE9EDF4),
    text2: Color(0xFFA4AFC0),
    text3: Color(0xFF818C9F),
    textMuted: Color(0xFF5F6A7D),
    sideBg: Color(0xFF0A1019),
    sideText: Color(0xFF97A3B6),
    sideTextDim: Color(0xFF636F83),
    sideSection: Color(0xFF5D6A82),
    tonos: {
      Tono.ok: ColoresTono(
        Color(0xFF5FD6A0),
        Color(0xFF0E2920),
        Color(0xFF1D4838),
      ),
      Tono.info: ColoresTono(
        Color(0xFF6FB4F4),
        Color(0xFF0E2436),
        Color(0xFF1D3F5C),
      ),
      Tono.warn: ColoresTono(
        Color(0xFFF0BD5A),
        Color(0xFF2C2210),
        Color(0xFF4D3C18),
      ),
      Tono.orange: ColoresTono(
        Color(0xFFF3A164),
        Color(0xFF2E1D10),
        Color(0xFF523619),
      ),
      Tono.indigo: ColoresTono(
        Color(0xFF9A9AF0),
        Color(0xFF1B1B38),
        Color(0xFF33336A),
      ),
      Tono.cyan: ColoresTono(
        Color(0xFF54C6D6),
        Color(0xFF0C2A30),
        Color(0xFF19474F),
      ),
      Tono.danger: ColoresTono(
        Color(0xFFF3837A),
        Color(0xFF2E1414),
        Color(0xFF562525),
      ),
      Tono.violet: ColoresTono(
        Color(0xFFB794F0),
        Color(0xFF241734),
        Color(0xFF412B5E),
      ),
      Tono.neutral: ColoresTono(
        Color(0xFF9AA6B8),
        Color(0xFF1A2230),
        Color(0xFF2A3543),
      ),
    },
    slaVerde: Color(0xFF34C77B),
    slaAmbar: Color(0xFFEDB43C),
    slaRojo: Color(0xFFEF6258),
  );

  /// Colores de prioridad (iguales en claro y oscuro). Enum real: A B C D F.
  static const prioridades = <String, Color>{
    'A': Color(0xFFE0463A),
    'B': Color(0xFFE8852C),
    'C': Color(0xFFD6A811),
    'D': Color(0xFF3F9E5A),
    'F': Color(0xFF7A8499),
  };

  /// Color primario por defecto (plazas sin color propio y portal del inquilino).
  static const primarioPorDefecto = Color(0xFF2F62E6);

  @override
  ColoresPlazapp copyWith() => this;

  @override
  ColoresPlazapp lerp(ColoresPlazapp? other, double t) =>
      t < 0.5 ? this : (other ?? this);
}

/// `#RRGGBB` → [Color] (o el primario por defecto si no es válido).
Color colorDesdeHex(String? hex) {
  final m = RegExp(r'^#?([0-9a-fA-F]{6})$').firstMatch(hex?.trim() ?? '');
  if (m == null) return ColoresPlazapp.primarioPorDefecto;
  return Color(int.parse('FF${m[1]}', radix: 16));
}

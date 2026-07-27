// lib/core/theme/plazapp_spacing.dart
//
// Constantes de spacing, radius, alturas y breakpoints.
// Espejo de `frontend/src/app/globals.css` §3.

import 'package:flutter/material.dart';

class PlazSpacing {
  PlazSpacing._();

  // ── Gutter / padding base
  static const double gutter = 28; // main padding desktop; mobile: 18 (≤920)
  static const double pageMaxWidth = 1180;
  static const double pageMaxWidthWide = 1320;

  // ── Border radius
  static const double radiusXs = 5; // btn-sm, pager
  static const double radiusSm = 7; // btn, input, swatch
  static const double radiusMd = 10; // card-pad, kpi, mini-card, dropzone
  static const double radiusLg = 14; // card, plaza-menu
  static const double radiusXl = 18; // auth-card, modal large
  static const double radiusPill = 999; // badges, avatar, dots, switches

  // ── Altura de controles
  static const double btnHeight = 38; // default
  static const double btnHeightSm = 32;
  static const double btnHeightLg = 44;
  static const double iconBtn = 38;
  static const double inputHeight = 40;
  static const double topbarHeight = 64;

  // ── Sidebar (navy permanente)
  static const double sidebarWidth = 256;
  static const double sidebarCollapsedWidth = 76;

  // ── Padding interno de componentes
  static const double btnPaddingX = 15;
  static const double btnPaddingXSm = 11;
  static const double btnPaddingXLg = 22;
  static const double inputPaddingX = 12;
  static const double cardPad = 22;
  static const double cardHeadPy = 16;
  static const double cardHeadPx = 20;
  static const double cardBodyPx = 20;
  static const double cardFootPy = 14;
  static const double cardFootPx = 20;
  static const double tableCellPx = 16;
  static const double tableCellPy = 13;
  static const double tableHeaderPx = 16;
  static const double tableHeaderPy = 11;

  // ── Sombras (replicadas como BoxShadow)
  static const double shadowXsOpacity = 0.05;
  static const double shadowSmOpacity = 0.07;
  static const double shadowMdOpacity = 0.10;
  static const double shadowLgOpacity = 0.22;

  // ── Z-index (referencia; Flutter usa Elevation, pero útil para overlay custom)
  static const double zSide = 40;
  static const double zTop = 45;
  static const double zDialog = 80;
  static const double zToast = 90;

  // ── Breakpoints (mobile-first, alineados con Bootstrap 5)
  static const double bpSm = 576;
  static const double bpMd = 768;
  static const double bpLg = 992;
  static const double bpXl = 1200;
  static const double bpXxl = 1400;

  // Excepción: el shell web conserva su corte a 920 para el drawer móvil.
  static const double shellBreakpoint = 920;
}

/// Helpers para construir BoxShadow consistentes con el CSS.
class PlazShadows {
  PlazShadows._();

  static const xs = BoxShadow(
    color: Color(0x0A101828), // 0x10, 0x18, 0x28 con alpha .05
    offset: Offset(0, 1),
    blurRadius: 2,
  );

  static const sm = [
    BoxShadow(
      color: Color(0x12101828),
      offset: Offset(0, 1),
      blurRadius: 3,
    ),
    BoxShadow(
      color: Color(0x0A101828),
      offset: Offset(0, 1),
      blurRadius: 2,
    ),
  ];

  static const md = [
    BoxShadow(
      color: Color(0x1A101828),
      offset: Offset(0, 4),
      blurRadius: 12,
    ),
    BoxShadow(
      color: Color(0x0F101828),
      offset: Offset(0, 2),
      blurRadius: 6,
    ),
  ];

  static const lg = [
    BoxShadow(
      color: Color(0x38101828),
      offset: Offset(0, 18),
      blurRadius: 40,
    ),
    BoxShadow(
      color: Color(0x1A101828),
      offset: Offset(0, 6),
      blurRadius: 14,
    ),
  ];

  static const pop = BoxShadow(
    color: Color(0x33101828),
    offset: Offset(0, 12),
    blurRadius: 32,
  );
}
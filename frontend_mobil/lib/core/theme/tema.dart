import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'colores.dart';

/// Tema claro con el color de marca de la plaza.
ThemeData temaClaro(Color primario) =>
    _tema(Brightness.light, primario, ColoresPlazapp.claro);

/// Tema oscuro con el color de marca de la plaza.
ThemeData temaOscuro(Color primario) =>
    _tema(Brightness.dark, primario, ColoresPlazapp.oscuro);

ThemeData _tema(Brightness brillo, Color primario, ColoresPlazapp c) {
  final esquema = ColorScheme.fromSeed(seedColor: primario, brightness: brillo)
      .copyWith(
        primary: primario,
        onPrimary: Colors.white,
        surface: c.surface,
        onSurface: c.text,
        error: c.tono(Tono.danger).fg,
        outline: c.border,
        outlineVariant: c.border,
      );
  final borde = OutlineInputBorder(
    borderRadius: BorderRadius.circular(7),
    borderSide: BorderSide(color: c.borderStrong),
  );
  return ThemeData(
    useMaterial3: true,
    brightness: brillo,
    colorScheme: esquema,
    scaffoldBackgroundColor: c.bg,
    extensions: [c],
    appBarTheme: AppBarTheme(
      backgroundColor: c.surface,
      foregroundColor: c.text,
      elevation: 0,
      scrolledUnderElevation: 0.5,
      surfaceTintColor: Colors.transparent,
      titleTextStyle: TextStyle(
        color: c.text,
        fontSize: 17,
        fontWeight: FontWeight.w600,
      ),
    ),
    cardTheme: CardThemeData(
      color: c.surface,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(color: c.border),
      ),
    ),
    dividerTheme: DividerThemeData(color: c.border, space: 1),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: c.surface,
      isDense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      border: borde,
      enabledBorder: borde,
      focusedBorder: borde.copyWith(
        borderSide: BorderSide(color: primario, width: 1.5),
      ),
      labelStyle: TextStyle(color: c.text2),
      hintStyle: TextStyle(color: c.textMuted),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(64, 44),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(7)),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(64, 44),
        foregroundColor: c.text,
        side: BorderSide(color: c.borderStrong),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(7)),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(minimumSize: const Size(48, 44)),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: c.surface3,
      side: BorderSide(color: c.border),
      labelStyle: TextStyle(color: c.text2, fontSize: 12.5),
    ),
    snackBarTheme: const SnackBarThemeData(behavior: SnackBarBehavior.floating),
  );
}

/// Preferencia de tema (sistema / claro / oscuro), persistida como en el web
/// (`localStorage['theme']`).
class TemaModoController extends Notifier<ThemeMode> {
  static const _clave = 'theme';

  @override
  ThemeMode build() {
    _cargar();
    return ThemeMode.system;
  }

  Future<void> _cargar() async {
    final prefs = await SharedPreferences.getInstance();
    state = switch (prefs.getString(_clave)) {
      'dark' => ThemeMode.dark,
      'light' => ThemeMode.light,
      _ => ThemeMode.system,
    };
  }

  /// Alterna claro/oscuro partiendo del brillo que se ve ahora.
  Future<void> alternar(Brightness actual) async {
    final nuevo = actual == Brightness.dark ? ThemeMode.light : ThemeMode.dark;
    state = nuevo;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_clave, nuevo == ThemeMode.dark ? 'dark' : 'light');
  }
}

final temaModoProvider = NotifierProvider<TemaModoController, ThemeMode>(
  TemaModoController.new,
);

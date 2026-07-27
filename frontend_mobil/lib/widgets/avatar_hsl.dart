// lib/widgets/avatar_hsl.dart
//
// Réplica exacta del avatar del web (`frontend/src/components/ui/avatar.tsx`).
// Gradiente HSL derivado del hash del nombre:
//   hsl($hue 58% 56%) → hsl(($hue+28)%360 62% 44%)
//
// Iniciales del nombre renderizadas en blanco.

import 'package:flutter/material.dart';

class AvatarHsl extends StatelessWidget {
  const AvatarHsl({
    super.key,
    required this.name,
    this.size = 34,
  });

  final String name;
  final double size;

  int _hueFromName(String n) {
    if (n.isEmpty) return 200;
    var sum = 0;
    for (final code in n.codeUnits) {
      sum = (sum + code) & 0x7fffffff;
    }
    return sum % 360;
  }

  String _initials(String n) {
    final parts = n.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty);
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts.first[0] + parts.last[0]).toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final hue = _hueFromName(name);
    final hue2 = (hue + 28) % 360;
    final c1 = HSLColor.fromAHSL(1, hue.toDouble(), 0.58, 0.56).toColor();
    final c2 = HSLColor.fromAHSL(1, hue2.toDouble(), 0.62, 0.44).toColor();

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [c1, c2],
        ),
      ),
      alignment: Alignment.center,
      child: Text(
        _initials(name),
        style: TextStyle(
          color: Colors.white,
          fontSize: size * 0.42,
          fontWeight: FontWeight.w600,
          letterSpacing: -0.2,
        ),
      ),
    );
  }
}
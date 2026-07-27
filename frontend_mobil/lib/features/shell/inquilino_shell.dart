// lib/features/shell/inquilino_shell.dart
//
// Shell del inquilino. BottomNavigationBar con 4 destinos:
//   Inicio · Mis solicitudes · Calendario · Perfil.
//
// Usa `StatefulNavigationShell` de go_router para mantener el estado de cada tab.

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../core/theme/plazapp_colors.dart';

class InquilinoShell extends StatelessWidget {
  const InquilinoShell({super.key, required this.navShell});

  final StatefulNavigationShell navShell;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<PlazappColors>()!;

    return Scaffold(
      backgroundColor: colors.bg,
      body: navShell,
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: navShell.currentIndex,
        onTap: (i) => navShell.goBranch(
          i,
          initialLocation: i == navShell.currentIndex,
        ),
        items: const [
          BottomNavigationBarItem(
            icon: Icon(LucideIcons.layoutDashboard),
            label: 'Inicio',
          ),
          BottomNavigationBarItem(
            icon: Icon(LucideIcons.inbox),
            label: 'Solicitudes',
          ),
          BottomNavigationBarItem(
            icon: Icon(LucideIcons.calendarDays),
            label: 'Calendario',
          ),
          BottomNavigationBarItem(
            icon: Icon(LucideIcons.user),
            label: 'Perfil',
          ),
        ],
      ),
    );
  }
}
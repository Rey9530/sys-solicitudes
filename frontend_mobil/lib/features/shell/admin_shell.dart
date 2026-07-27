// lib/features/shell/admin_shell.dart
//
// Shell del admin de plaza.
//   - En móvil (< 600dp): BottomNavigationBar con 5 destinos
//   - En tablet/desktop (≥ 600dp): NavigationRail lateral fijo (sidebar navy compacto)
//
// Destinos: Bandeja · Calendario · Dashboard · Configuración · Perfil

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../core/theme/plazapp_colors.dart';
import '../../core/theme/plazapp_spacing.dart';

class _Dest {
  final IconData icon;
  final String label;
  const _Dest(this.icon, this.label);
}

const List<_Dest> _kAdminDestinations = [
  _Dest(LucideIcons.inbox, 'Bandeja'),
  _Dest(LucideIcons.calendarDays, 'Calendario'),
  _Dest(LucideIcons.barChart3, 'Dashboard'),
  _Dest(LucideIcons.settings, 'Configuración'),
  _Dest(LucideIcons.user, 'Perfil'),
];

class AdminShell extends StatelessWidget {
  const AdminShell({super.key, required this.navShell});

  final StatefulNavigationShell navShell;

  void _go(int i) {
    navShell.goBranch(i, initialLocation: i == navShell.currentIndex);
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<PlazappColors>()!;
    final isWide = MediaQuery.sizeOf(context).width >= 600;

    if (isWide) {
      // Tablet / fold abierto → NavigationRail con sidebar navy compacto
      return Scaffold(
        backgroundColor: colors.bg,
        body: Row(
          children: [
            Container(
              width: PlazSpacing.sidebarCollapsedWidth,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [colors.sideBg2, colors.sideBg],
                ),
                border: Border(
                  right: BorderSide(color: colors.sideBorder),
                ),
              ),
              child: NavigationRail(
                extended: false,
                minWidth: PlazSpacing.sidebarCollapsedWidth,
                backgroundColor: Colors.transparent,
                selectedIndex: navShell.currentIndex,
                onDestinationSelected: _go,
                labelType: NavigationRailLabelType.all,
                destinations: [
                  for (var i = 0; i < _kAdminDestinations.length; i++)
                    NavigationRailDestination(
                      icon: Icon(
                        _kAdminDestinations[i].icon,
                        color: colors.sideText,
                      ),
                      selectedIcon: Icon(
                        _kAdminDestinations[i].icon,
                        color: colors.brand.p300,
                      ),
                      label: Text(
                        _kAdminDestinations[i].label,
                        style: TextStyle(
                          color: i == navShell.currentIndex
                              ? colors.sideTextStrong
                              : colors.sideText,
                          fontSize: 11,
                        ),
                      ),
                    ),
                ],
              ),
            ),
            Expanded(child: navShell),
          ],
        ),
      );
    }

    // Móvil → BottomNavigationBar
    return Scaffold(
      backgroundColor: colors.bg,
      body: navShell,
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: navShell.currentIndex,
        type: BottomNavigationBarType.fixed,
        onTap: _go,
        items: [
          for (final d in _kAdminDestinations)
            BottomNavigationBarItem(
              icon: Icon(d.icon),
              label: d.label,
            ),
        ],
      ),
    );
  }
}
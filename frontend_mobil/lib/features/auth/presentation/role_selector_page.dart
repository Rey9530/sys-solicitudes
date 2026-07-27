// lib/features/auth/presentation/role_selector_page.dart
//
// Pantalla post-login cuando el usuario tiene varios roles (inquilino + admin_plaza).
// Elige a cuál shell entrar. Réplica del patrón del web (`nav-config.ts`).

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../../../core/router/routes.dart';
import '../../../core/theme/plazapp_colors.dart';
import '../../../core/theme/plazapp_spacing.dart';
import '../../../core/theme/plazapp_text.dart';
import '../controllers/auth_controller.dart';

class RoleSelectorPage extends StatelessWidget {
  const RoleSelectorPage({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthController>();
    final session = auth.session;
    final colors = Theme.of(context).extension<PlazappColors>()!;

    if (session == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return Scaffold(
      backgroundColor: colors.bg,
      appBar: AppBar(
        title: const Text('Selecciona un rol'),
        leading: IconButton(
          icon: const Icon(Icons.logout),
          tooltip: 'Cerrar sesión',
          onPressed: () => auth.logout(),
        ),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 24),
              Text(
                'Hola, ${session.nombre}',
                style: PlazappText.textTheme.headlineLarge,
              ),
              const SizedBox(height: 6),
              Text(
                'Tienes varios roles asignados. ¿Con cuál quieres entrar?',
                style: PlazappText.textTheme.bodyMedium
                    ?.copyWith(color: colors.text2),
              ),
              const SizedBox(height: 32),
              if (session.isInquilino)
                _RoleCard(
                  icon: LucideIcons.store,
                  title: 'Portal de inquilino',
                  subtitle:
                      'Crea solicitudes, revisa su estado y agrega adjuntos.',
                  onTap: () => context.go(Routes.inquilinoInicio),
                ),
              if (session.isInquilino && session.isAdminPlaza)
                const SizedBox(height: 12),
              if (session.isAdminPlaza)
                _RoleCard(
                  icon: LucideIcons.building2,
                  title: 'Admin de plaza',
                  subtitle:
                      'Bandeja, calendario, dashboard y configuración de la plaza.',
                  onTap: () => context.go(Routes.adminBandeja),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RoleCard extends StatelessWidget {
  const _RoleCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<PlazappColors>()!;
    return Material(
      color: colors.surface,
      borderRadius: BorderRadius.circular(PlazSpacing.radiusLg),
      child: InkWell(
        borderRadius: BorderRadius.circular(PlazSpacing.radiusLg),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(PlazSpacing.radiusLg),
            border: Border.all(color: colors.border),
          ),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(PlazSpacing.radiusSm),
                  color: colors.brand.soft,
                ),
                child: Icon(icon, color: colors.brand.primary),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: PlazappText.textTheme.titleMedium),
                    const SizedBox(height: 4),
                    Text(subtitle,
                        style: PlazappText.textTheme.bodySmall
                            ?.copyWith(color: colors.text2)),
                  ],
                ),
              ),
              Icon(Icons.chevron_right, color: colors.text3),
            ],
          ),
        ),
      ),
    );
  }
}
// lib/features/shell/inicio_page.dart
//
// Pantalla de inicio del inquilino. Réplica del patrón `.home-entry` del web:
//   - Header con saludo + avatar
//   - 2-3 KPI cards (grid 2 col en móvil)
//   - "Última actividad" lista corta

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';

import '../../core/router/routes.dart';
import '../../core/theme/plazapp_colors.dart';
import '../../core/theme/plazapp_spacing.dart';
import '../../core/theme/plazapp_text.dart';
import '../../features/auth/controllers/auth_controller.dart';
import '../../widgets/avatar_hsl.dart';
import '../../widgets/kpi_card.dart';
import '../../widgets/plaz_card.dart';
import '../../widgets/status_badge.dart';
import '../solicitudes/data/solicitudes_seed.dart';

class InicioPage extends StatelessWidget {
  const InicioPage({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<PlazappColors>()!;
    final auth = context.watch<AuthController>();
    final session = auth.session;
    final text = Theme.of(context).textTheme;

    final solicitudes = kSolicitudesSeed;
    final pendientes = solicitudes.where((s) =>
        s.estado == 'enviada' || s.estado == 'en_revision' || s.estado == 'asignado'
    ).length;
    final aprobadas = solicitudes.where((s) => s.estado == 'aprobada').length;
    final subsanacion = solicitudes.where((s) => s.estado == 'requerida_subsanacion').length;

    return Scaffold(
      backgroundColor: colors.bg,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(PlazSpacing.gutter),
          children: [
            // Header
            Row(
              children: [
                AvatarHsl(name: session?.nombre ?? 'Invitado', size: 44),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Hola, ${session?.nombre.split(' ').first ?? ''}',
                        style: text.headlineLarge?.copyWith(color: colors.text),
                      ),
                      Text(
                        'Tienes $pendientes solicitudes activas',
                        style: text.bodyMedium?.copyWith(color: colors.text2),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(LucideIcons.bell, size: 22),
                  onPressed: () {},
                ),
              ],
            ),
            const SizedBox(height: 24),

            // KPIs (grid 2 col en móvil)
            GridView.count(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisCount: 2,
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              childAspectRatio: 1.45,
              children: [
                KpiCard(
                  label: 'Pendientes',
                  value: pendientes.toString(),
                  icon: LucideIcons.inbox,
                  tint: KpiTint.primary,
                  onTap: () => context.go(Routes.inquilinoSolicitudes),
                ),
                KpiCard(
                  label: 'Aprobadas',
                  value: aprobadas.toString(),
                  icon: LucideIcons.checkCircle2,
                  tint: KpiTint.ok,
                ),
                KpiCard(
                  label: 'Subsanación',
                  value: subsanacion.toString(),
                  icon: LucideIcons.alertTriangle,
                  tint: KpiTint.warn,
                ),
                KpiCard(
                  label: 'Total',
                  value: solicitudes.length.toString(),
                  icon: LucideIcons.scrollText,
                  tint: KpiTint.info,
                ),
              ],
            ),
            const SizedBox(height: 28),

            // Última actividad
            Row(
              children: [
                Text('Última actividad', style: text.titleMedium),
                const Spacer(),
                TextButton(
                  onPressed: () => context.go(Routes.inquilinoSolicitudes),
                  child: Text(
                    'Ver todas',
                    style: text.labelMedium?.copyWith(color: colors.brand.primary),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            for (final s in solicitudes.take(3)) ...[
              _MiniSolicitudRow(s: s),
              const SizedBox(height: 8),
            ],
          ],
        ),
      ),
    );
  }
}

class _MiniSolicitudRow extends StatelessWidget {
  const _MiniSolicitudRow({required this.s});
  final dynamic s;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<PlazappColors>()!;
    final text = Theme.of(context).textTheme;
    final (estadoLabel, estadoTone) = s.estadoDisplay as (String, dynamic);
    final fmt = DateFormat('d MMM', 'es');

    return PlazCard(
      padding: false,
      onTap: () => context.push('/inquilino/solicitudes/${s.id}'),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(s.subcategoria,
                      style: text.bodyMedium
                          ?.copyWith(color: colors.text, fontWeight: FontWeight.w500)),
                  Text(
                    '${s.localNombre} · ${fmt.format(s.creadaEn)}',
                    style: text.labelMedium?.copyWith(color: colors.textMuted),
                  ),
                ],
              ),
            ),
            StatusBadge(label: estadoLabel, tone: estadoTone),
          ],
        ),
      ),
    );
  }
}
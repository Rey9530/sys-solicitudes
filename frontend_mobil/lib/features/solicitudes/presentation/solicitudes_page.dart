// lib/features/solicitudes/presentation/solicitudes_page.dart
//
// Pantalla "Mis Solicitudes" del inquilino. Lista de cards con filtros.
// Réplica del patrón `.rdv-card*` (responsive-data-view) que el web usa para móvil.

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/router/routes.dart';
import '../../../core/theme/plazapp_colors.dart';
import '../../../core/theme/plazapp_spacing.dart';
import '../../../core/theme/plazapp_text.dart';
import '../../../widgets/empty_state.dart';
import '../../../widgets/plaz_card.dart';
import '../../../widgets/priority_chip.dart';
import '../../../widgets/sla_semaphore.dart';
import '../../../widgets/status_badge.dart';
import '../domain/solicitud.dart';
import '../data/solicitudes_seed.dart';

class SolicitudesPage extends StatefulWidget {
  const SolicitudesPage({super.key});

  @override
  State<SolicitudesPage> createState() => _SolicitudesPageState();
}

class _SolicitudesPageState extends State<SolicitudesPage> {
  String _filterEstado = 'todas';

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<PlazappColors>()!;
    final all = kSolicitudesSeed;
    final filtered = _filterEstado == 'todas'
        ? all
        : all.where((s) => s.estado == _filterEstado).toList();

    return Scaffold(
      backgroundColor: colors.bg,
      appBar: AppBar(
        title: const Text('Mis solicitudes'),
        actions: [
          IconButton(
            icon: const Icon(LucideIcons.plus),
            tooltip: 'Nueva solicitud',
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Wizard de nueva solicitud: Fase 8+')),
              );
            },
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(48),
          child: Container(
            height: 48,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                _filterChip('Todas', 'todas'),
                _filterChip('Enviadas', 'enviada'),
                _filterChip('En revisión', 'en_revision'),
                _filterChip('Aprobadas', 'aprobada'),
                _filterChip('Rechazadas', 'rechazada'),
              ],
            ),
          ),
        ),
      ),
      body: filtered.isEmpty
          ? const EmptyState(
              icon: LucideIcons.inbox,
              title: 'Sin solicitudes',
              message: 'Cuando crees una solicitud aparecerá aquí.',
            )
          : ListView.separated(
              padding: const EdgeInsets.all(PlazSpacing.gutter),
              itemCount: filtered.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (_, i) => _SolicitudCard(s: filtered[i]),
            ),
    );
  }

  Widget _filterChip(String label, String value) {
    final selected = _filterEstado == value;
    final colors = Theme.of(context).extension<PlazappColors>()!;
    return Padding(
      padding: const EdgeInsets.only(right: 8, top: 8, bottom: 8),
      child: ChoiceChip(
        label: Text(label, style: PlazappText.textTheme.labelMedium),
        selected: selected,
        onSelected: (_) => setState(() => _filterEstado = value),
        selectedColor: colors.brand.soft,
        backgroundColor: colors.surface,
        side: BorderSide(color: selected ? colors.brand.primary : colors.border),
        labelStyle: TextStyle(color: selected ? colors.brand.primary : colors.text2),
      ),
    );
  }
}

class _SolicitudCard extends StatelessWidget {
  const _SolicitudCard({required this.s});
  final Solicitud s;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<PlazappColors>()!;
    final text = Theme.of(context).textTheme;
    final fmt = DateFormat('d MMM', 'es');
    final (estadoLabel, estadoTone) = s.estadoDisplay;
    final sla = s.slaEstado();

    return PlazCard(
      padding: false,
      onTap: () => context.push('/inquilino/solicitudes/${s.id}'),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                PriorityChip(prioridad: s.prioridadEnum),
                const SizedBox(width: 8),
                Text(
                  s.codigo,
                  style: PlazappText.monoCounter.copyWith(color: colors.text2),
                ),
                const Spacer(),
                StatusBadge(label: estadoLabel, tone: estadoTone),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              s.subcategoria,
              style: text.titleSmall?.copyWith(
                color: colors.text,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              s.localNombre,
              style: text.bodySmall?.copyWith(color: colors.text3),
            ),
            const SizedBox(height: 10),
            Text(
              s.descripcion,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: text.bodySmall?.copyWith(color: colors.text2),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                if (sla != null) ...[
                  SlaSemaphore(state: sla.state, label: sla.label),
                  const SizedBox(width: 12),
                ],
                const Spacer(),
                Icon(LucideIcons.clock, size: 12, color: colors.textMuted),
                const SizedBox(width: 4),
                Text(
                  fmt.format(s.creadaEn),
                  style: text.labelMedium?.copyWith(color: colors.textMuted),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
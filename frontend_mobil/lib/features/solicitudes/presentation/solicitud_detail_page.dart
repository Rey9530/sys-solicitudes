// lib/features/solicitudes/presentation/solicitud_detail_page.dart
//
// Detalle de una solicitud. Réplica del patrón `.detail-grid` del web:
//   - Header con código, estado badge, prioridad chip, SLA
//   - Descripción
//   - Lista de adjuntos
//   - Acciones contextuales según estado (para inquilino: subsanar / cancelar)

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/theme/plazapp_colors.dart';
import '../../../core/theme/plazapp_spacing.dart';
import '../../../core/theme/plazapp_text.dart';
import '../../../widgets/banner_plaz.dart';
import '../../../widgets/plaz_button.dart';
import '../../../widgets/plaz_card.dart';
import '../../../widgets/priority_chip.dart';
import '../../../widgets/sla_semaphore.dart';
import '../../../widgets/status_badge.dart';
import '../data/solicitudes_seed.dart';
import '../domain/solicitud.dart';

class SolicitudDetailPage extends StatelessWidget {
  const SolicitudDetailPage({super.key, required this.id, this.isAdmin = false});

  final String id;
  final bool isAdmin;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<PlazappColors>()!;
    final s = kSolicitudesSeed.firstWhere(
      (x) => x.id == id,
      orElse: () => kSolicitudesSeed.first,
    );
    final text = Theme.of(context).textTheme;
    final fmt = DateFormat("d 'de' MMMM 'a las' HH:mm", 'es');
    final (estadoLabel, estadoTone) = s.estadoDisplay;
    final sla = s.slaEstado();

    return Scaffold(
      backgroundColor: colors.bg,
      appBar: AppBar(
        title: Text(s.codigo, style: PlazappText.monoCounter.copyWith(fontSize: 14)),
      ),
      body: ListView(
        padding: const EdgeInsets.all(PlazSpacing.gutter),
        children: [
          // Header card
          PlazCard(
            padding: false,
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      PriorityChip(prioridad: s.prioridadEnum),
                      const SizedBox(width: 10),
                      StatusBadge(label: estadoLabel, tone: estadoTone),
                      const Spacer(),
                      if (sla != null) SlaSemaphore(state: sla.state, label: sla.label),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Text(s.subcategoria,
                      style: text.headlineMedium?.copyWith(color: colors.text)),
                  const SizedBox(height: 6),
                  Text(
                    '${s.tipo[0].toUpperCase()}${s.tipo.substring(1)} · ${s.localNombre}',
                    style: text.bodyMedium?.copyWith(color: colors.text2),
                  ),
                  const SizedBox(height: 16),
                  Text(s.descripcion, style: text.bodyLarge),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Si requiere subsanación
          if (s.estado == 'requerida_subsanacion')
            Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: BannerPlaz(
                tone: BannerTone.warn,
                title: 'Subsanación requerida',
                message:
                    'El admin de plaza pidió aclaraciones. Responde para que la solicitud siga su curso.',
                action: PlazButton(
                  label: 'Subsanar',
                  size: PlazButtonSize.sm,
                  variant: PlazButtonVariant.primary,
                  onPressed: () {},
                ),
              ),
            ),

          // Datos del solicitante
          PlazCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Solicitante', style: text.labelSmall),
                const SizedBox(height: 8),
                Text(s.creadoPorNombre, style: text.bodyLarge),
                Text(
                  'Enviada ${fmt.format(s.enviadaEn ?? s.creadaEn)}',
                  style: text.bodySmall?.copyWith(color: colors.text2),
                ),
                if (s.adminAsignadoNombre != null) ...[
                  const SizedBox(height: 12),
                  Text('Asignada a', style: text.labelSmall),
                  const SizedBox(height: 4),
                  Text(s.adminAsignadoNombre!, style: text.bodyLarge),
                ],
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Adjuntos
          if (s.adjuntos.isNotEmpty) ...[
            PlazCard(
              padding: false,
              child: Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
                    child: Row(
                      children: [
                        Text('Adjuntos (${s.adjuntos.length})',
                            style: text.titleSmall),
                      ],
                    ),
                  ),
                  for (final a in s.adjuntos) _AdjuntoRow(adj: a),
                ],
              ),
            ),
            const SizedBox(height: 16),
          ],

          // Acciones admin
          if (isAdmin && s.estado == 'en_revision') ...[
            Row(
              children: [
                Expanded(
                  child: PlazButton(
                    label: 'Rechazar',
                    icon: LucideIcons.xCircle,
                    variant: PlazButtonVariant.danger,
                    block: true,
                    onPressed: () {},
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: PlazButton(
                    label: 'Aprobar',
                    icon: LucideIcons.checkCircle2,
                    variant: PlazButtonVariant.success,
                    block: true,
                    onPressed: () {},
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _AdjuntoRow extends StatelessWidget {
  const _AdjuntoRow({required this.adj});
  final Adjunto adj;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<PlazappColors>()!;
    final text = Theme.of(context).textTheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: colors.border)),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: colors.surface3,
              borderRadius: BorderRadius.circular(PlazSpacing.radiusSm),
            ),
            alignment: Alignment.center,
            child: Icon(
              adj.mime.startsWith('image')
                  ? LucideIcons.image
                  : LucideIcons.fileText,
              size: 18,
              color: colors.text2,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(adj.nombre, style: text.bodyMedium, overflow: TextOverflow.ellipsis),
                Text(
                  _formatSize(adj.sizeBytes),
                  style: text.labelMedium?.copyWith(color: colors.textMuted),
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(LucideIcons.download, size: 18),
            onPressed: () {},
          ),
        ],
      ),
    );
  }

  String _formatSize(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }
}
// lib/features/dashboard/presentation/dashboard_page.dart
//
// Dashboard del admin de plaza. Réplica del patrón `.kpi-grid` (5 col desktop,
// 2 col móvil) + chart con fl_chart.

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';

import '../../../core/theme/plazapp_colors.dart';
import '../../../core/theme/plazapp_spacing.dart';
import '../../../core/theme/plazapp_text.dart';
import '../../../widgets/kpi_card.dart';
import '../../solicitudes/data/solicitudes_seed.dart';

class DashboardPage extends StatelessWidget {
  const DashboardPage({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<PlazappColors>()!;
    final text = Theme.of(context).textTheme;
    final all = kSolicitudesSeed;

    return Scaffold(
      backgroundColor: colors.bg,
      appBar: AppBar(
        title: const Text('Dashboard'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(PlazSpacing.gutter),
        children: [
          // KPIs
          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 2,
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 1.45,
            children: [
              KpiCard(
                label: 'En bandeja',
                value: all.length.toString(),
                delta: '+12%',
                icon: LucideIcons.inbox,
                tint: KpiTint.primary,
              ),
              KpiCard(
                label: 'Aprobadas (mes)',
                value: '23',
                delta: '+5%',
                icon: LucideIcons.checkCircle2,
                tint: KpiTint.ok,
              ),
              KpiCard(
                label: 'Rechazadas',
                value: '4',
                delta: '-2%',
                deltaPositive: false,
                icon: LucideIcons.xCircle,
                tint: KpiTint.danger,
              ),
              KpiCard(
                label: 'SLA en riesgo',
                value: '2',
                icon: LucideIcons.alertTriangle,
                tint: KpiTint.warn,
              ),
            ],
          ),
          const SizedBox(height: 24),

          // Chart
          Text('Solicitudes por día (últimos 7)',
              style: text.titleMedium),
          const SizedBox(height: 12),
          Container(
            height: 220,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: colors.surface,
              borderRadius: BorderRadius.circular(PlazSpacing.radiusLg),
              border: Border.all(color: colors.border),
            ),
            child: _BarChart(colors: colors),
          ),
          const SizedBox(height: 24),

          // Por tipo
          Text('Distribución por tipo', style: text.titleMedium),
          const SizedBox(height: 12),
          Container(
            height: 220,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: colors.surface,
              borderRadius: BorderRadius.circular(PlazSpacing.radiusLg),
              border: Border.all(color: colors.border),
            ),
            child: _PieChart(colors: colors),
          ),
        ],
      ),
    );
  }
}

class _BarChart extends StatelessWidget {
  const _BarChart({required this.colors});
  final PlazappColors colors;

  @override
  Widget build(BuildContext context) {
    return BarChart(
      BarChartData(
        gridData: FlGridData(show: false),
        borderData: FlBorderData(show: false),
        titlesData: FlTitlesData(
          leftTitles: const AxisTitles(),
          topTitles: const AxisTitles(),
          rightTitles: const AxisTitles(),
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 28,
              getTitlesWidget: (v, _) {
                const labels = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
                return Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text(
                    labels[v.toInt() % 7],
                    style: TextStyle(color: colors.text3, fontSize: 11),
                  ),
                );
              },
            ),
          ),
        ),
        barGroups: [
          for (var i = 0; i < 7; i++)
            BarChartGroupData(x: i, barRods: [
              BarChartRodData(
                toY: 4.0 + (i.isEven ? 2 : -1) + (i % 3),
                color: colors.brand.primary,
                width: 14,
                borderRadius:
                    const BorderRadius.vertical(top: Radius.circular(4)),
              ),
            ]),
        ],
      ),
    );
  }
}

class _PieChart extends StatelessWidget {
  const _PieChart({required this.colors});
  final PlazappColors colors;

  @override
  Widget build(BuildContext context) {
    return PieChart(
      PieChartData(
        sectionsSpace: 2,
        centerSpaceRadius: 40,
        sections: [
          PieChartSectionData(
              value: 40,
              color: colors.brand.primary,
              title: '40%',
              titleStyle: const TextStyle(color: Colors.white, fontSize: 11),
              radius: 50),
          PieChartSectionData(
              value: 25,
              color: colors.info.fg,
              title: '25%',
              titleStyle: const TextStyle(color: Colors.white, fontSize: 11),
              radius: 50),
          PieChartSectionData(
              value: 20,
              color: colors.warn.fg,
              title: '20%',
              titleStyle: const TextStyle(color: Colors.white, fontSize: 11),
              radius: 50),
          PieChartSectionData(
              value: 15,
              color: colors.ok.fg,
              title: '15%',
              titleStyle: const TextStyle(color: Colors.white, fontSize: 11),
              radius: 50),
        ],
      ),
    );
  }
}
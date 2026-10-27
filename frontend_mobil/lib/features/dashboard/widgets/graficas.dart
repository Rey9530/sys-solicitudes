import 'dart:math' as math;

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import '../../../core/theme/colores.dart';
import '../../../core/widgets/badges.dart';
import '../../solicitudes/solicitudes_modelos.dart';
import '../dashboard_modelos.dart';
import 'kpis.dart';

/// Colores de las líneas por estado (paleta de las gráficas del web,
/// `components/client/dashboard-charts.tsx`; iguales en claro y oscuro).
const coloresEstadoGrafica = <String, Color>{
  'borrador': Color(0xFF9CA3AF),
  'enviada': Color(0xFF3B82F6),
  'asignado': Color(0xFF06B6D4),
  'en_revision': Color(0xFFF59E0B),
  'requerida_subsanacion': Color(0xFFF97316),
  'pausada': Color(0xFF22D3EE),
  'aprobada': Color(0xFF10B981),
  'cerrada': Color(0xFF8B5CF6),
  'rechazada': Color(0xFFEF4444),
  'cancelada': Color(0xFF6B7280),
};

const _colorPorDefecto = Color(0xFF6B7280);

/// Gráficas del dashboard con `fl_chart`: tendencia mensual (líneas),
/// solicitudes por tipo (barras) y distribución por prioridad (dona).
class GraficasDashboardView extends StatelessWidget {
  const GraficasDashboardView({super.key, required this.graficas});

  final GraficasDashboard graficas;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TarjetaDashboard(
          titulo: 'Tendencia mensual por estado (últimos 6 meses)',
          child: _Tendencia(meses: graficas.tendenciaMensual),
        ),
        const SizedBox(height: 12),
        LayoutBuilder(
          builder: (context, constraints) {
            final dos = constraints.maxWidth >= 760;
            final porTipo = TarjetaDashboard(
              titulo: 'Solicitudes por tipo',
              child: _PorTipo(datos: graficas.porTipo),
            );
            final porPrioridad = TarjetaDashboard(
              titulo: 'Distribución por prioridad',
              child: _PorPrioridad(datos: graficas.porPrioridad),
            );
            if (!dos) {
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [porTipo, const SizedBox(height: 12), porPrioridad],
              );
            }
            return Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(child: porTipo),
                const SizedBox(width: 12),
                Expanded(child: porPrioridad),
              ],
            );
          },
        ),
      ],
    );
  }
}

class _SinDatos extends StatelessWidget {
  const _SinDatos();

  @override
  Widget build(BuildContext context) => SizedBox(
    height: 80,
    child: Center(
      child: Text(
        'Sin datos.',
        style: TextStyle(color: ColoresPlazapp.of(context).text3),
      ),
    ),
  );
}

/// Intervalo "redondo" del eje Y para que haya ~4 marcas enteras.
double _intervalo(double maximo) =>
    maximo <= 5 ? 1 : (maximo / 4).ceilToDouble();

FlTitlesData _titulos(
  BuildContext context, {
  required double intervaloY,
  required Widget Function(double valor, TitleMeta meta) inferior,
  double reservadoInferior = 28,
}) {
  final c = ColoresPlazapp.of(context);
  return FlTitlesData(
    topTitles: const AxisTitles(),
    rightTitles: const AxisTitles(),
    leftTitles: AxisTitles(
      sideTitles: SideTitles(
        showTitles: true,
        reservedSize: 32,
        interval: intervaloY,
        getTitlesWidget: (v, meta) => SideTitleWidget(
          meta: meta,
          child: Text(
            v.toInt().toString(),
            style: TextStyle(color: c.text3, fontSize: 11),
          ),
        ),
      ),
    ),
    bottomTitles: AxisTitles(
      sideTitles: SideTitles(
        showTitles: true,
        reservedSize: reservadoInferior,
        interval: 1,
        getTitlesWidget: inferior,
      ),
    ),
  );
}

FlGridData _rejilla(BuildContext context, double intervaloY) {
  final borde = ColoresPlazapp.of(context).border;
  return FlGridData(
    drawVerticalLine: false,
    horizontalInterval: intervaloY,
    getDrawingHorizontalLine: (_) =>
        FlLine(color: borde, strokeWidth: 1, dashArray: const [3, 3]),
  );
}

class _Tendencia extends StatelessWidget {
  const _Tendencia({required this.meses});

  final List<MesTendencia> meses;

  @override
  Widget build(BuildContext context) {
    if (meses.isEmpty) return const _SinDatos();
    final c = ColoresPlazapp.of(context);
    // Estados con datos, en el orden canónico de los filtros.
    final presentes = {for (final m in meses) ...m.porEstado.keys};
    final estados = [
      ...etiquetaEstadoSolicitud.keys.where(presentes.contains),
      ...presentes.where((e) => !etiquetaEstadoSolicitud.containsKey(e)),
    ];
    final maximo = [
      for (final m in meses) ...m.porEstado.values,
      1,
    ].reduce(math.max).toDouble();
    final intervaloY = _intervalo(maximo);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SizedBox(
          height: 240,
          child: LineChart(
            LineChartData(
              minX: 0,
              maxX: math.max(1, meses.length - 1).toDouble(),
              minY: 0,
              maxY: (maximo / intervaloY).ceil() * intervaloY,
              gridData: _rejilla(context, intervaloY),
              borderData: FlBorderData(show: false),
              titlesData: _titulos(
                context,
                intervaloY: intervaloY,
                inferior: (v, meta) {
                  final i = v.round();
                  if (v != i || i < 0 || i >= meses.length) {
                    return const SizedBox.shrink();
                  }
                  return SideTitleWidget(
                    meta: meta,
                    child: Text(
                      _mesCorto(meses[i].mes),
                      style: TextStyle(color: c.text3, fontSize: 11),
                    ),
                  );
                },
              ),
              lineBarsData: [
                for (final e in estados)
                  LineChartBarData(
                    spots: [
                      for (final (i, m) in meses.indexed)
                        FlSpot(i.toDouble(), (m.porEstado[e] ?? 0).toDouble()),
                    ],
                    color: coloresEstadoGrafica[e] ?? _colorPorDefecto,
                    barWidth: 2,
                    dotData: const FlDotData(show: true),
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 10),
        Wrap(
          spacing: 12,
          runSpacing: 6,
          children: [
            for (final e in estados)
              _Leyenda(
                color: coloresEstadoGrafica[e] ?? _colorPorDefecto,
                texto: etiquetaEstadoSolicitud[e] ?? e,
              ),
          ],
        ),
      ],
    );
  }
}

/// `"2026-08"` → `"08/26"` (cabe en un teléfono con 6 meses).
String _mesCorto(String mes) {
  final m = RegExp(r'^\d{2}(\d{2})-(\d{2})').firstMatch(mes);
  return m == null ? mes : '${m[2]}/${m[1]}';
}

class _PorTipo extends StatelessWidget {
  const _PorTipo({required this.datos});

  final List<(String, int)> datos;

  @override
  Widget build(BuildContext context) {
    if (datos.isEmpty) return const _SinDatos();
    final c = ColoresPlazapp.of(context);
    final primario = Theme.of(context).colorScheme.primary;
    final maximo = datos.map((d) => d.$2).fold(1, math.max).toDouble();
    final intervaloY = _intervalo(maximo);
    return SizedBox(
      height: 240,
      child: LayoutBuilder(
        builder: (context, constraints) {
          // Ancho de cada etiqueta = ancho de su grupo (sin solaparse).
          final anchoEtiqueta = math.max(
            24.0,
            (constraints.maxWidth - 32) / datos.length - 4,
          );
          return BarChart(
            BarChartData(
              minY: 0,
              maxY: (maximo / intervaloY).ceil() * intervaloY,
              alignment: BarChartAlignment.spaceAround,
              gridData: _rejilla(context, intervaloY),
              borderData: FlBorderData(show: false),
              titlesData: _titulos(
                context,
                intervaloY: intervaloY,
                reservadoInferior: 30,
                inferior: (v, meta) {
                  final i = v.toInt();
                  if (i < 0 || i >= datos.length) {
                    return const SizedBox.shrink();
                  }
                  final tipo = datos[i].$1;
                  return SideTitleWidget(
                    meta: meta,
                    child: SizedBox(
                      width: anchoEtiqueta,
                      child: Text(
                        etiquetaTipoSolicitud[tipo] ?? tipo,
                        textAlign: TextAlign.center,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(color: c.text3, fontSize: 11),
                      ),
                    ),
                  );
                },
              ),
              barGroups: [
                for (final (i, d) in datos.indexed)
                  BarChartGroupData(
                    x: i,
                    barRods: [
                      BarChartRodData(
                        toY: d.$2.toDouble(),
                        color: primario,
                        width: 22,
                        borderRadius: const BorderRadius.vertical(
                          top: Radius.circular(5),
                        ),
                      ),
                    ],
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _PorPrioridad extends StatelessWidget {
  const _PorPrioridad({required this.datos});

  final List<(String, int)> datos;

  @override
  Widget build(BuildContext context) {
    final conValor = datos.where((d) => d.$2 > 0).toList();
    if (conValor.isEmpty) return const _SinDatos();
    final c = ColoresPlazapp.of(context);
    Color color(String p) => ColoresPlazapp.prioridades[p] ?? _colorPorDefecto;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SizedBox(
          height: 220,
          child: PieChart(
            PieChartData(
              centerSpaceRadius: 34,
              sectionsSpace: 2,
              sections: [
                for (final (p, total) in conValor)
                  PieChartSectionData(
                    value: total.toDouble(),
                    color: color(p),
                    radius: 46,
                    title: '$p: $total',
                    titlePositionPercentageOffset: 1.4,
                    titleStyle: TextStyle(
                      color: c.text2,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 12,
          runSpacing: 6,
          children: [
            for (final (p, total) in conValor)
              _Leyenda(color: color(p), texto: '$p: $total'),
          ],
        ),
      ],
    );
  }
}

class _Leyenda extends StatelessWidget {
  const _Leyenda({required this.color, required this.texto});

  final Color color;
  final String texto;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 5),
        Text(
          texto,
          style: TextStyle(
            color: ColoresPlazapp.of(context).text2,
            fontSize: 12,
          ),
        ),
      ],
    );
  }
}

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/format/fechas.dart';
import '../../../core/theme/colores.dart';
import '../dashboard_modelos.dart';
import 'graficas.dart';

/// Contenido compartido del dashboard (`DashboardContenido` de
/// `components/dashboard-kpis.tsx`): 5 KPIs, 3 indicadores, gráficas, top 5
/// por antigüedad y actividad reciente.
///
/// [rutaDetalle] = base de la ruta del detalle de solicitud (`null` en el
/// dashboard global: sin enlaces, las solicitudes viven en cada plaza).
class ContenidoDashboard extends StatelessWidget {
  const ContenidoDashboard({
    super.key,
    required this.datos,
    required this.rutaDetalle,
  });

  final DatosDashboard datos;
  final String? rutaDetalle;

  @override
  Widget build(BuildContext context) {
    final k = datos.kpis;
    final tasa = k.tasaAprobacion == null
        ? null
        : (k.tasaAprobacion! * 100).round();
    final tiempo = k.tiempoMedioRespuestaHoras;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _Rejilla(
          columnas: (ancho) => ancho >= 900
              ? 5
              : ancho >= 560
              ? 3
              : 2,
          children: [
            _TarjetaKpi(
              etiqueta: 'Pendientes',
              valor: k.pendientes,
              icono: Icons.inbox_outlined,
              tono: Tono.warn,
            ),
            _TarjetaKpi(
              etiqueta: 'Aprobadas hoy',
              valor: k.aprobadasHoy,
              icono: Icons.check_circle_outline,
              tono: Tono.ok,
            ),
            _TarjetaKpi(
              etiqueta: 'Rechazadas hoy',
              valor: k.rechazadasHoy,
              icono: Icons.cancel_outlined,
              tono: Tono.danger,
            ),
            _TarjetaKpi(
              etiqueta: 'Eventos próximos (7d)',
              valor: k.eventosProximos7d,
              icono: Icons.event_available_outlined,
              tono: Tono.info,
            ),
            _TarjetaKpi(
              etiqueta: 'Contratos por vencer (30d)',
              valor: k.contratosPorVencer30d,
              icono: Icons.pending_actions_outlined,
              tono: Tono.violet,
            ),
          ],
        ),
        const SizedBox(height: 12),
        _Rejilla(
          columnas: (ancho) => ancho >= 640 ? 3 : 1,
          children: [
            _TarjetaIndicador(
              etiqueta: 'Tasa de aprobación',
              valor: tasa == null ? '—' : '$tasa%',
              progreso: tasa == null ? null : tasa / 100,
            ),
            _TarjetaIndicador(
              etiqueta: 'Tiempo medio de respuesta',
              valor: tiempo == null ? '—' : '${_numero(tiempo)} h',
            ),
            _TarjetaIndicador(
              etiqueta: 'Solicitudes con subsanación',
              valor: '${k.solicitudesConSubsanacion}',
            ),
          ],
        ),
        const SizedBox(height: 12),
        GraficasDashboardView(graficas: datos.graficas),
        const SizedBox(height: 12),
        _Rejilla(
          columnas: (ancho) => ancho >= 860 ? 2 : 1,
          children: [
            TarjetaDashboard(
              titulo: 'Top 5 por antigüedad',
              child: k.top5Antiguedad.isEmpty
                  ? const _Vacio('Sin solicitudes pendientes.')
                  : Column(
                      children: [
                        for (final s in k.top5Antiguedad)
                          _Fila(
                            principal: _Codigo(
                              s.codigo,
                              ruta: rutaDetalle == null
                                  ? null
                                  : '$rutaDetalle/${s.id}',
                            ),
                            texto: s.titulo,
                            fecha: formatFecha(s.enviadaAt),
                          ),
                      ],
                    ),
            ),
            TarjetaDashboard(
              titulo: 'Actividad reciente',
              child: datos.graficas.actividadReciente.isEmpty
                  ? const _Vacio('Sin actividad registrada.')
                  : Column(
                      children: [
                        for (final a in datos.graficas.actividadReciente)
                          _Fila(
                            principal: _Codigo(a.solicitudCodigo),
                            texto: [
                              a.evento.replaceAll('_', ' '),
                              if (a.usuario != null) a.usuario!,
                            ].join(' · '),
                            fecha: formatFechaHora(a.createdAt),
                          ),
                      ],
                    ),
            ),
          ],
        ),
      ],
    );
  }
}

/// `12.0` → `"12"`, `1.5` → `"1.5"`.
String _numero(double v) =>
    v == v.roundToDouble() ? v.toInt().toString() : v.toString();

/// Tarjetas en columnas según el ancho disponible.
class _Rejilla extends StatelessWidget {
  const _Rejilla({required this.columnas, required this.children});

  final int Function(double ancho) columnas;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final n = columnas(constraints.maxWidth);
        const gap = 12.0;
        final ancho = (constraints.maxWidth - gap * (n - 1)) / n;
        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: [
            for (final c in children) SizedBox(width: ancho, child: c),
          ],
        );
      },
    );
  }
}

/// Tarjeta con título (`card-head h3` del web).
class TarjetaDashboard extends StatelessWidget {
  const TarjetaDashboard({
    super.key,
    required this.titulo,
    required this.child,
  });

  final String titulo;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              titulo,
              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
            ),
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }
}

class _TarjetaKpi extends StatelessWidget {
  const _TarjetaKpi({
    required this.etiqueta,
    required this.valor,
    required this.icono,
    required this.tono,
  });

  final String etiqueta;
  final int valor;
  final IconData icono;
  final Tono tono;

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    final t = c.tono(tono);
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: t.bg,
                border: Border.all(color: t.bd),
                borderRadius: BorderRadius.circular(9),
              ),
              child: Icon(icono, size: 18, color: t.fg),
            ),
            const SizedBox(height: 10),
            Text(
              '$valor',
              style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 2),
            Text(etiqueta, style: TextStyle(color: c.text3, fontSize: 12.5)),
          ],
        ),
      ),
    );
  }
}

class _TarjetaIndicador extends StatelessWidget {
  const _TarjetaIndicador({
    required this.etiqueta,
    required this.valor,
    this.progreso,
  });

  final String etiqueta;
  final String valor;
  final double? progreso;

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(etiqueta, style: TextStyle(color: c.text3, fontSize: 12.5)),
            const SizedBox(height: 8),
            Text(
              valor,
              style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w700),
            ),
            if (progreso != null) ...[
              const SizedBox(height: 12),
              ClipRRect(
                borderRadius: BorderRadius.circular(999),
                child: LinearProgressIndicator(
                  value: progreso!.clamp(0, 1),
                  minHeight: 7,
                  backgroundColor: c.surface3,
                  color: c.tono(Tono.ok).fg,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Código de solicitud en monoespaciada; con [ruta] es un enlace al detalle.
class _Codigo extends StatelessWidget {
  const _Codigo(this.codigo, {this.ruta});

  final String codigo;
  final String? ruta;

  @override
  Widget build(BuildContext context) {
    final primario = Theme.of(context).colorScheme.primary;
    final texto = Text(
      codigo,
      style: TextStyle(
        fontFamily: 'monospace',
        fontSize: 12.5,
        fontWeight: FontWeight.w600,
        color: ruta == null ? null : primario,
      ),
    );
    if (ruta == null) return texto;
    return InkWell(
      onTap: () => context.push(ruta!),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: texto,
      ),
    );
  }
}

class _Fila extends StatelessWidget {
  const _Fila({
    required this.principal,
    required this.texto,
    required this.fecha,
  });

  final Widget principal;
  final String texto;
  final String fecha;

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 8),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: c.border)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 2,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              principal,
              Text(fecha, style: TextStyle(color: c.textMuted, fontSize: 12)),
            ],
          ),
          const SizedBox(height: 2),
          Text(texto, style: TextStyle(color: c.text2, fontSize: 13)),
        ],
      ),
    );
  }
}

class _Vacio extends StatelessWidget {
  const _Vacio(this.texto);
  final String texto;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 8),
    child: Text(
      texto,
      style: TextStyle(color: ColoresPlazapp.of(context).text3, fontSize: 13),
    ),
  );
}

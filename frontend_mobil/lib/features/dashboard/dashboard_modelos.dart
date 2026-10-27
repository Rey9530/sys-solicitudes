import '../../core/format/texto.dart';

/// Indicadores del dashboard (`KpisOutput` de `GET /reportes/kpis`).
class Kpis {
  const Kpis({
    required this.pendientes,
    required this.aprobadasHoy,
    required this.rechazadasHoy,
    required this.eventosProximos7d,
    required this.contratosPorVencer30d,
    required this.solicitudesConSubsanacion,
    required this.top5Antiguedad,
    this.tasaAprobacion,
    this.tiempoMedioRespuestaHoras,
  });

  factory Kpis.fromJson(Map<String, dynamic> j) {
    int n(String k) => (j[k] as num?)?.toInt() ?? 0;
    return Kpis(
      pendientes: n('pendientes'),
      aprobadasHoy: n('aprobadasHoy'),
      rechazadasHoy: n('rechazadasHoy'),
      eventosProximos7d: n('eventosProximos7d'),
      contratosPorVencer30d: n('contratosPorVencer30d'),
      solicitudesConSubsanacion: n('solicitudesConSubsanacion'),
      tasaAprobacion: (j['tasaAprobacion'] as num?)?.toDouble(),
      tiempoMedioRespuestaHoras: (j['tiempoMedioRespuestaHoras'] as num?)
          ?.toDouble(),
      top5Antiguedad: (j['top5Antiguedad'] as List<dynamic>? ?? const [])
          .cast<Map<String, dynamic>>()
          .map(SolicitudAntigua.fromJson)
          .toList(),
    );
  }

  final int pendientes;
  final int aprobadasHoy;
  final int rechazadasHoy;
  final int eventosProximos7d;
  final int contratosPorVencer30d;
  final int solicitudesConSubsanacion;

  /// 0..1 o `null` si aún no hay decisiones.
  final double? tasaAprobacion;
  final double? tiempoMedioRespuestaHoras;
  final List<SolicitudAntigua> top5Antiguedad;
}

/// Solicitud pendiente más antigua (top 5).
class SolicitudAntigua {
  const SolicitudAntigua({
    required this.id,
    required this.codigo,
    required this.titulo,
    required this.enviadaAt,
  });

  factory SolicitudAntigua.fromJson(Map<String, dynamic> j) => SolicitudAntigua(
    id: j['id'] as String,
    codigo: j['codigo'] as String? ?? '',
    titulo: decodificarHtml(j['titulo'] as String?),
    enviadaAt: j['enviadaAt'] as String? ?? '',
  );

  final String id;
  final String codigo;
  final String titulo;
  final String enviadaAt;
}

/// Datos de las gráficas (`DashboardChartsOutput` de `GET /reportes/dashboard`).
class GraficasDashboard {
  const GraficasDashboard({
    required this.tendenciaMensual,
    required this.porTipo,
    required this.porPrioridad,
    required this.actividadReciente,
  });

  factory GraficasDashboard.fromJson(Map<String, dynamic> j) {
    List<Map<String, dynamic>> lista(String k) =>
        (j[k] as List<dynamic>? ?? const []).cast<Map<String, dynamic>>();
    return GraficasDashboard(
      tendenciaMensual: [
        for (final m in lista('tendenciaMensual'))
          MesTendencia(
            mes: m['mes'] as String? ?? '',
            porEstado: {
              for (final e in m.entries)
                if (e.key != 'mes' && e.value is num)
                  e.key: (e.value as num).toInt(),
            },
          ),
      ],
      porTipo: [
        for (final t in lista('porTipo'))
          (t['tipo'] as String? ?? '', (t['total'] as num?)?.toInt() ?? 0),
      ],
      porPrioridad: [
        for (final p in lista('porPrioridad'))
          (p['prioridad'] as String? ?? '', (p['total'] as num?)?.toInt() ?? 0),
      ],
      actividadReciente: lista('actividadReciente')
          .map(ActividadReciente.fromJson)
          .toList(),
    );
  }

  /// Últimos 6 meses; en cada mes solo aparecen los estados con datos.
  final List<MesTendencia> tendenciaMensual;

  /// (tipo, total).
  final List<(String, int)> porTipo;

  /// (prioridad, total).
  final List<(String, int)> porPrioridad;
  final List<ActividadReciente> actividadReciente;
}

class MesTendencia {
  const MesTendencia({required this.mes, required this.porEstado});

  /// `YYYY-MM`.
  final String mes;
  final Map<String, int> porEstado;
}

/// Entrada reciente del historial de solicitudes.
class ActividadReciente {
  const ActividadReciente({
    required this.id,
    required this.solicitudCodigo,
    required this.evento,
    required this.createdAt,
    this.usuario,
  });

  factory ActividadReciente.fromJson(Map<String, dynamic> j) =>
      ActividadReciente(
        id: j['id'] as String,
        solicitudCodigo: j['solicitudCodigo'] as String? ?? '',
        evento: j['evento'] as String? ?? '',
        createdAt: j['createdAt'] as String? ?? '',
        usuario: (j['usuario'] as String?) == null
            ? null
            : decodificarHtml(j['usuario'] as String?),
      );

  final String id;
  final String solicitudCodigo;
  final String evento;
  final String createdAt;
  final String? usuario;
}

/// Lo que pinta la pantalla: KPIs + gráficas (se piden en paralelo).
class DatosDashboard {
  const DatosDashboard({required this.kpis, required this.graficas});

  final Kpis kpis;
  final GraficasDashboard graficas;
}

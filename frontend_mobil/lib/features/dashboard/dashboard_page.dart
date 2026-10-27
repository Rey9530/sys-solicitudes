import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_error.dart';
import '../../core/auth/sesion_controller.dart';
import '../../core/theme/colores.dart';
import '../../core/widgets/avisos.dart';
import '../../core/widgets/badges.dart';
import '../../core/widgets/pagina.dart';
import 'dashboard_providers.dart';
import 'widgets/kpis.dart';

/// `/admin/dashboard`: estado operativo de la plaza
/// (`app/(admin-plaza)/admin/dashboard/page.tsx`).
class DashboardPage extends StatelessWidget {
  const DashboardPage({super.key});

  @override
  Widget build(BuildContext context) => const VistaDashboard(
    titulo: 'Dashboard',
    subtitulo: 'Estado operativo de la plaza.',
    global: false,
    rutaDetalle: '/admin/solicitudes',
  );
}

/// Pantalla de dashboard compartida por el de plaza y el global: KPIs +
/// gráficas, recarga automática cada 5 min (badge "Auto-refresh 5 min").
///
/// Si el rol de staff no tiene `reportes.kpis.ver` y `reportes.dashboard.ver`
/// muestra un aviso en lugar del error del backend (C-R3).
class VistaDashboard extends ConsumerStatefulWidget {
  const VistaDashboard({
    super.key,
    required this.titulo,
    required this.subtitulo,
    required this.global,
    required this.rutaDetalle,
  });

  final String titulo;
  final String subtitulo;

  /// `true` = dashboard global del superadmin ([dashboardGlobalProvider]).
  final bool global;
  final String? rutaDetalle;

  @override
  ConsumerState<VistaDashboard> createState() => _VistaDashboardState();
}

class _VistaDashboardState extends ConsumerState<VistaDashboard> {
  static const _cadaCuanto = Duration(minutes: 5);
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(_cadaCuanto, (_) => _recargar());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _recargar() => ref.invalidate(
    widget.global ? dashboardGlobalProvider : dashboardProvider,
  );

  @override
  Widget build(BuildContext context) {
    final sesion = ref.watch(sesionProvider).value;
    final conPermiso =
        sesion != null &&
        sesion.puede('reportes.kpis.ver') &&
        sesion.puede('reportes.dashboard.ver');

    final Widget cuerpo;
    if (!conPermiso) {
      cuerpo = const _SinPermiso();
    } else {
      cuerpo = ref
          .watch(widget.global ? dashboardGlobalProvider : dashboardProvider)
          .when(
            loading: () => const Padding(
              padding: EdgeInsets.all(40),
              child: Center(child: CircularProgressIndicator()),
            ),
            error: (e, _) => e is ApiError && e.code == 'PERMISSION_DENIED'
                ? const _SinPermiso()
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const AvisoBanner(
                        tono: Tono.danger,
                        child: Text('No se pudieron cargar los KPIs.'),
                      ),
                      const SizedBox(height: 10),
                      OutlinedButton.icon(
                        onPressed: _recargar,
                        icon: const Icon(Icons.refresh),
                        label: const Text('Reintentar'),
                      ),
                    ],
                  ),
            data: (datos) => ContenidoDashboard(
              datos: datos,
              rutaDetalle: widget.rutaDetalle,
            ),
          );
    }

    return ContenidoPagina(
      onRefresh: conPermiso ? () async => _recargar() : null,
      children: [
        EncabezadoPagina(
          titulo: widget.titulo,
          subtitulo: widget.subtitulo,
          badges: const [
            BadgePlazapp('Auto-refresh 5 min', Tono.neutral, punto: false),
          ],
        ),
        cuerpo,
      ],
    );
  }
}

class _SinPermiso extends StatelessWidget {
  const _SinPermiso();

  @override
  Widget build(BuildContext context) => const AvisoBanner(
    tono: Tono.info,
    child: Text('No tienes permiso para ver los indicadores.'),
  );
}

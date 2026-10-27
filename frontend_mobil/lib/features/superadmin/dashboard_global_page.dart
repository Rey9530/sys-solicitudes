import 'package:flutter/material.dart';

import '../dashboard/dashboard_page.dart';

/// `/superadmin/dashboard`: métricas agregadas de todas las plazas
/// (`app/(admin-plataform)/superadmin/dashboard/page.tsx`).
///
/// Siempre global: pide los datos sin `x-plaza-id` aunque el superadmin tenga
/// una plaza elegida (en el web mostraba los de esa plaza, C-R4). Sin enlaces
/// de detalle: las solicitudes viven en el panel de cada plaza.
class DashboardGlobalPage extends StatelessWidget {
  const DashboardGlobalPage({super.key});

  @override
  Widget build(BuildContext context) => const VistaDashboard(
    titulo: 'Dashboard global',
    subtitulo: 'Métricas agregadas de todas las plazas.',
    global: true,
    rutaDetalle: null,
  );
}

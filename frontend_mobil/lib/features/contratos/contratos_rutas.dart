import 'package:go_router/go_router.dart';

import '../../core/widgets/en_construccion_page.dart';

/// Rutas del módulo (mismas URLs que el web). Stub: lo reemplaza la tarea
/// del plan que implementa este módulo, sin cambiar la firma.
List<RouteBase> rutasContratos() => [
  GoRoute(
    path: '/admin/contratos',
    builder: (context, state) => const EnConstruccionPage(titulo: 'Contratos'),
  ),
  GoRoute(
    path: '/admin/contratos/nuevo',
    builder: (context, state) =>
        const EnConstruccionPage(titulo: 'Nuevo contrato'),
  ),
  GoRoute(
    path: '/admin/contratos/importar',
    builder: (context, state) =>
        const EnConstruccionPage(titulo: 'Carga inicial desde Excel'),
  ),
  GoRoute(
    path: '/admin/contratos/:id',
    builder: (context, state) =>
        const EnConstruccionPage(titulo: 'Detalle de contrato'),
  ),
  GoRoute(
    path: '/inquilino/contratos',
    builder: (context, state) =>
        const EnConstruccionPage(titulo: 'Mis contratos'),
  ),
  GoRoute(
    path: '/inquilino/contratos/:id',
    builder: (context, state) =>
        const EnConstruccionPage(titulo: 'Mi contrato'),
  ),
];

import 'package:go_router/go_router.dart';

import '../../core/widgets/en_construccion_page.dart';

/// Rutas del módulo (mismas URLs que el web). Stub: lo reemplaza la tarea
/// del plan que implementa este módulo, sin cambiar la firma.
List<RouteBase> rutasCatalogos() => [
  GoRoute(
    path: '/admin/categorias',
    builder: (context, state) => const EnConstruccionPage(titulo: 'Categorías'),
  ),
  GoRoute(
    path: '/admin/categorias/nueva',
    builder: (context, state) =>
        const EnConstruccionPage(titulo: 'Nueva categoría'),
  ),
  GoRoute(
    path: '/admin/categorias/:id',
    builder: (context, state) => const EnConstruccionPage(titulo: 'Categoría'),
  ),
  GoRoute(
    path: '/admin/categorias/:id/subcategorias',
    builder: (context, state) =>
        const EnConstruccionPage(titulo: 'Subcategorías'),
  ),
  GoRoute(
    path: '/admin/catalogos/tipos-solicitud',
    builder: (context, state) =>
        const EnConstruccionPage(titulo: 'Tipos de solicitud'),
  ),
  GoRoute(
    path: '/admin/catalogos/tipos-solicitud/:id',
    builder: (context, state) =>
        const EnConstruccionPage(titulo: 'Tipo de solicitud'),
  ),
];

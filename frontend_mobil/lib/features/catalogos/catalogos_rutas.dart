import 'package:go_router/go_router.dart';

import 'categoria_form_page.dart';
import 'categorias_page.dart';
import 'subcategorias_page.dart';
import 'tipo_solicitud_page.dart';
import 'tipos_solicitud_page.dart';

/// Rutas de categorías, subcategorías y tipos de solicitud (mismas URLs que
/// el web). `nueva` va antes de `:id` para que no la capture el parámetro.
List<RouteBase> rutasCatalogos() => [
  GoRoute(
    path: '/admin/categorias',
    builder: (context, state) => const CategoriasPage(),
  ),
  GoRoute(
    path: '/admin/categorias/nueva',
    builder: (context, state) => const CategoriaFormPage(),
  ),
  GoRoute(
    path: '/admin/categorias/:id',
    builder: (context, state) =>
        CategoriaDetallePage(id: state.pathParameters['id']!),
  ),
  GoRoute(
    path: '/admin/categorias/:id/subcategorias',
    builder: (context, state) =>
        SubcategoriasPage(categoriaId: state.pathParameters['id']!),
  ),
  GoRoute(
    path: '/admin/catalogos/tipos-solicitud',
    builder: (context, state) => const TiposSolicitudPage(),
  ),
  GoRoute(
    path: '/admin/catalogos/tipos-solicitud/:id',
    builder: (context, state) =>
        TipoSolicitudPage(id: state.pathParameters['id']!),
  ),
];

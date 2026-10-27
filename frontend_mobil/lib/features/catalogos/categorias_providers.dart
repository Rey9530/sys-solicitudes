import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_error.dart';
import '../../core/api/api_providers.dart';
import '../../core/api/paginado.dart';
import 'categorias_api.dart';
import 'categorias_modelos.dart';

/// Listado de categorías con filtros.
final categoriasProvider = FutureProvider.autoDispose
    .family<Paginado<Categoria>, FiltroCategorias>(
      (ref, f) => listarCategorias(ref.watch(apiClientProvider), f),
    );

/// Detalle de una categoría (con sus subcategorías activas).
final categoriaProvider = FutureProvider.autoDispose.family<Categoria, String>(
  (ref, id) => obtenerCategoria(ref.watch(apiClientProvider), id),
);

/// Todas las subcategorías (activas e inactivas) de una categoría.
final subcategoriasProvider = FutureProvider.autoDispose
    .family<Paginado<Subcategoria>, String>(
      (ref, categoriaId) =>
          listarSubcategorias(ref.watch(apiClientProvider), categoriaId),
    );

/// Opciones de responsable/supervisor (admins con rol de staff activo). Si el
/// backend lo niega (sin `usuarios_plaza.listar`, B2-R16) quedan vacías,
/// igual que en el web.
final staffElegibleProvider = FutureProvider.autoDispose<List<PersonaStaff>>((
  ref,
) async {
  try {
    return await listarStaffElegible(ref.watch(apiClientProvider));
  } on ApiError {
    return const [];
  }
});

/// Listado de tipos de solicitud con filtro de estado.
final tiposSolicitudProvider = FutureProvider.autoDispose
    .family<Paginado<TipoSolicitudConfig>, FiltroTipos>(
      (ref, f) => listarTiposSolicitud(ref.watch(apiClientProvider), f),
    );

/// Un tipo de solicitud.
final tipoSolicitudProvider = FutureProvider.autoDispose
    .family<TipoSolicitudConfig, String>(
      (ref, id) => obtenerTipoSolicitud(ref.watch(apiClientProvider), id),
    );

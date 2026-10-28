import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_error.dart';
import '../../core/api/api_providers.dart';
import '../../core/api/paginado.dart';
import 'solicitudes_api.dart';
import 'solicitudes_modelos.dart';

/// Providers de LECTURA del módulo. Las escrituras llaman a
/// `solicitudes_api.dart` desde la pantalla y luego hacen `ref.invalidate`.

/// "Mis solicitudes" del inquilino.
final misSolicitudesProvider = FutureProvider.autoDispose
    .family<Paginado<SolicitudItem>, FiltroSolicitudes>(
      (ref, f) => listarSolicitudes(ref.watch(apiClientProvider), f),
    );

/// Detalle de una solicitud (inquilino y admin).
final solicitudProvider = FutureProvider.autoDispose
    .family<SolicitudDetalle, String>(
      (ref, id) => obtenerSolicitud(ref.watch(apiClientProvider), id),
    );

/// Catálogos del wizard. Igual que el web, un catálogo que falla queda vacío
/// sin bloquear el formulario.
final datosWizardProvider = FutureProvider.autoDispose<DatosWizard>((
  ref,
) async {
  final api = ref.watch(apiClientProvider);
  Future<List<T>> oVacio<T>(Future<List<T>> f) async {
    try {
      return await f;
    } on ApiError {
      return <T>[];
    }
  }

  final (tipos, categorias, locales) = await (
    oVacio(listarTiposActivos(api)),
    oVacio(listarCategoriasConSubcategorias(api)),
    oVacio(listarLocalesInquilino(api)),
  ).wait;
  return DatosWizard(tipos: tipos, categorias: categorias, locales: locales);
});

/// Posibles duplicados para el aviso del wizard (un error = sin aviso).
final duplicadosProvider = FutureProvider.autoDispose
    .family<List<SolicitudItem>, ({String localId, String tipo})>((
      ref,
      clave,
    ) async {
      try {
        return await buscarDuplicados(
          ref.watch(apiClientProvider),
          clave.localId,
          clave.tipo,
        );
      } on ApiError {
        return const [];
      }
    });

/// Bandeja del admin.
final bandejaProvider = FutureProvider.autoDispose
    .family<Paginado<SolicitudItem>, FiltroBandeja>(
      (ref, f) => bandeja(ref.watch(apiClientProvider), f),
    );

/// Candidatos a reasignar. Sin permiso para listar usuarios queda vacía
/// (igual que el web).
final adminsPlazaProvider = FutureProvider.autoDispose<List<AdminOpcion>>((
  ref,
) async {
  try {
    return await listarAdminsPlaza(ref.watch(apiClientProvider));
  } on ApiError {
    return const [];
  }
});

/// Vista global del superadmin.
final solicitudesGlobalesProvider = FutureProvider.autoDispose
    .family<Paginado<SolicitudItem>, FiltroGlobal>(
      (ref, f) => solicitudesGlobales(ref.watch(apiClientProvider), f),
    );

/// Detalle cross-plaza del superadmin.
final solicitudGlobalProvider = FutureProvider.autoDispose
    .family<SolicitudDetalle, String>(
      (ref, id) => solicitudGlobal(ref.watch(apiClientProvider), id),
    );

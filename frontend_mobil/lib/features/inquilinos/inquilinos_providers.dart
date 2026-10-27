import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_providers.dart';
import '../../core/api/paginado.dart';
import '../solicitudes/solicitudes_modelos.dart';
import 'inquilinos_api.dart';
import 'inquilinos_modelos.dart';

/// Listado paginado con filtros.
final inquilinosProvider = FutureProvider.autoDispose
    .family<Paginado<Inquilino>, FiltroInquilinos>(
      (ref, filtro) => listarInquilinos(ref.watch(apiClientProvider), filtro),
    );

/// Detalle con contratos vigentes e histórico.
final inquilinoProvider = FutureProvider.autoDispose
    .family<InquilinoDetalle, String>(
      (ref, id) => obtenerInquilino(ref.watch(apiClientProvider), id),
    );

/// Usuarios del portal de un inquilino.
final usuariosInquilinoProvider = FutureProvider.autoDispose
    .family<List<UsuarioInquilino>, String>(
      (ref, id) => listarUsuariosInquilino(ref.watch(apiClientProvider), id),
    );

/// Solicitudes de los locales del inquilino.
final solicitudesInquilinoProvider = FutureProvider.autoDispose
    .family<List<SolicitudItem>, String>((ref, id) async {
      final detalle = await ref.watch(inquilinoProvider(id).future);
      return solicitudesDeInquilino(
        ref.watch(apiClientProvider),
        inquilinoId: id,
        localIds: detalle.historicoContratos.map((c) => c.localId),
      );
    });

/// Inquilinos para los combos de contratos.
final opcionesInquilinosProvider = FutureProvider.autoDispose<List<Inquilino>>(
  (ref) => opcionesInquilinos(ref.watch(apiClientProvider)),
);

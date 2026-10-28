import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/adjuntos/adjuntos.dart';
import '../../core/api/api_providers.dart';
import '../../core/api/paginado.dart';
import '../solicitudes/solicitudes_modelos.dart';
import 'locales_api.dart';
import 'locales_modelos.dart';

/// Listado paginado de locales con filtros.
final localesProvider = FutureProvider.autoDispose
    .family<Paginado<Local>, FiltroLocales>(
      (ref, filtro) => listarLocales(ref.watch(apiClientProvider), filtro),
    );

/// Detalle de un local (con contrato vigente e histórico).
final localProvider = FutureProvider.autoDispose.family<LocalDetalle, String>(
  (ref, id) => obtenerLocal(ref.watch(apiClientProvider), id),
);

/// Fotos del local.
final adjuntosLocalProvider = FutureProvider.autoDispose
    .family<List<Adjunto>, String>(
      (ref, id) => listarAdjuntosLocal(ref.watch(apiClientProvider), id),
    );

/// Solicitudes de un local: `(localId, página)`.
final solicitudesLocalProvider = FutureProvider.autoDispose
    .family<Paginado<SolicitudItem>, (String, int)>(
      (ref, arg) =>
          solicitudesDeLocal(ref.watch(apiClientProvider), arg.$1, arg.$2),
    );

/// Locales para los combos de contratos (`soloDisponibles` en "Nuevo
/// contrato").
final opcionesLocalesProvider = FutureProvider.autoDispose
    .family<List<Local>, bool>(
      (ref, soloDisponibles) => opcionesLocales(
        ref.watch(apiClientProvider),
        soloDisponibles: soloDisponibles,
      ),
    );

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_providers.dart';
import '../../core/api/paginado.dart';
import 'notificaciones_api.dart';
import 'notificaciones_modelos.dart';

/// Página del log de emails con sus filtros.
final emailLogProvider = FutureProvider.autoDispose
    .family<Paginado<EmailLog>, FiltrosEmailLog>(
      (ref, filtros) => listarEmails(ref.read(apiClientProvider), filtros),
    );

/// Desuscripciones de la plaza (primeras 50).
final desuscripcionesProvider = FutureProvider.autoDispose<List<Desuscripcion>>(
  (ref) => listarDesuscripciones(ref.read(apiClientProvider)),
);

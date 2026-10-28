import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/adjuntos/adjuntos.dart';
import '../../core/api/api_providers.dart';
import '../../core/api/paginado.dart';
import 'contratos_api.dart';
import 'contratos_modelos.dart';

/// Listado paginado con filtros (admin).
final contratosProvider = FutureProvider.autoDispose
    .family<Paginado<Contrato>, FiltroContratos>(
      (ref, filtro) => listarContratos(ref.watch(apiClientProvider), filtro),
    );

/// Detalle (admin e inquilino; al inquilino ajeno le responde 404).
final contratoProvider = FutureProvider.autoDispose.family<Contrato, String>(
  (ref, id) => obtenerContrato(ref.watch(apiClientProvider), id),
);

/// PDF del contrato firmado.
final adjuntosContratoProvider = FutureProvider.autoDispose
    .family<List<Adjunto>, String>(
      (ref, id) => listarAdjuntosContrato(ref.watch(apiClientProvider), id),
    );

/// "Mis contratos" del inquilino.
final misContratosProvider = FutureProvider.autoDispose<Paginado<Contrato>>(
  (ref) => listarMisContratos(ref.watch(apiClientProvider)),
);

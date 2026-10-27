import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_providers.dart';
import 'reportes_api.dart';

/// Locales, inquilinos y tipos para los filtros del generador.
final opcionesReporteProvider = FutureProvider.autoDispose<OpcionesReporte>(
  (ref) => cargarOpcionesReporte(ref.watch(apiClientProvider)),
);

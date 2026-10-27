import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_providers.dart';
import 'configuracion_api.dart';
import 'configuracion_modelos.dart';

/// Plaza + configuración de la plaza [plazaId].
final configuracionProvider = FutureProvider.autoDispose
    .family<DatosConfiguracion, String>(
      (ref, plazaId) =>
          cargarConfiguracion(ref.read(apiClientProvider), plazaId),
    );

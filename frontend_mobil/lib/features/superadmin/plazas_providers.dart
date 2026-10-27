import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_providers.dart';
import 'plazas_api.dart';
import 'plazas_modelos.dart';

/// Lista de `/superadmin/plazas`.
final listaPlazasProvider = FutureProvider.autoDispose<List<Plaza>>(
  (ref) => listarPlazas(ref.read(apiClientProvider)),
);

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_providers.dart';
import '../../core/api/paginado.dart';
import 'auditoria_api.dart';
import 'auditoria_modelos.dart';

/// Página del log de auditoría con sus filtros.
final auditoriaProvider = FutureProvider.autoDispose
    .family<Paginado<RegistroAuditoria>, FiltrosAuditoria>(
      (ref, filtros) => listarAuditoria(ref.watch(apiClientProvider), filtros),
    );

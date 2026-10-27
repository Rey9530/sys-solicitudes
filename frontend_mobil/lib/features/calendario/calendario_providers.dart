import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_providers.dart';
import 'calendario_api.dart';
import 'calendario_modelos.dart';

/// Eventos del rango y filtros visibles. Cambiar de rango o de filtro es otra
/// clave del provider, así que vuelve a consultar sola.
final feedCalendarioProvider = FutureProvider.autoDispose
    .family<List<EventoCalendario>, FiltroCalendario>((ref, filtro) {
      return feedCalendario(
        ref.read(apiClientProvider),
        desde: filtro.desde,
        hasta: filtro.hasta,
        locales: filtro.locales,
        inquilinos: filtro.inquilinos,
        tipos: filtro.tipos.toSet(),
      );
    });

/// Opciones de los filtros. La clave es `true` para el inquilino (locales de
/// sus contratos) y `false` para el admin (locales, inquilinos y config).
final opcionesCalendarioProvider = FutureProvider.autoDispose
    .family<OpcionesCalendario, bool>((ref, esInquilino) {
      final api = ref.read(apiClientProvider);
      return esInquilino ? opcionesInquilino(api) : opcionesAdmin(api);
    });

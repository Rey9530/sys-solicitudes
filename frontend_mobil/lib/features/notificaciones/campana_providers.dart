import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_providers.dart';
import 'campana_api.dart';
import 'notificaciones_modelos.dart';

/// Sin reintentos automáticos de Riverpod: como en el web, si falla se
/// vuelve a pedir en el siguiente ciclo de *polling* o al reabrir la hoja.
Duration? _sinReintentos(int intento, Object error) => null;

/// Notificaciones sin leer (badge). La campana lo invalida cada 45 s
/// mientras la app está en primer plano.
final conteoNoLeidasProvider = FutureProvider.autoDispose<int>(
  (ref) => conteoNoLeidas(ref.watch(apiClientProvider)),
  retry: _sinReintentos,
);

/// Las 20 más recientes. Se vuelve a pedir cada vez que se abre la hoja.
final bandejaNotificacionesProvider =
    FutureProvider.autoDispose<BandejaNotificaciones>(
      (ref) => bandejaNotificaciones(ref.watch(apiClientProvider)),
      retry: _sinReintentos,
    );

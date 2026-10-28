import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_providers.dart';
import '../../core/auth/sesion.dart';
import '../../core/auth/sesion_controller.dart';
import '../../core/config.dart';
import '../notificaciones/campana_api.dart';
import '../notificaciones/campana_providers.dart';
import '../notificaciones/notificaciones_modelos.dart';
import '../notificaciones/widgets/hoja_notificaciones.dart';

/// Campana de notificaciones in-app de la barra superior
/// (`components/shell/notifications-bell.tsx`). Solo admin de plaza e
/// inquilino.
///
/// - Contador con *polling* cada 45 s, solo con la app en primer plano (al
///   volver a primer plano pide el conteo enseguida).
/// - Badge "9+" si hay más de 9; oculto con 0.
/// - Al tocar, abre la hoja con las 20 más recientes. Tocar una la marca como
///   leída (sin esperar al backend) y navega a su solicitud o contrato.
class Campana extends ConsumerStatefulWidget {
  const Campana({super.key});

  @override
  ConsumerState<Campana> createState() => _CampanaState();
}

class _CampanaState extends ConsumerState<Campana> {
  Timer? _timer;
  late final AppLifecycleListener _ciclo;

  /// Contador mostrado mientras el backend confirma una marca (optimista).
  int? _optimista;

  @override
  void initState() {
    super.initState();
    _ciclo = AppLifecycleListener(
      onResume: () {
        _refrescar();
        _iniciar();
      },
      onHide: _detener,
      onPause: _detener,
    );
    final estado = WidgetsBinding.instance.lifecycleState;
    if (estado == null || estado == AppLifecycleState.resumed) _iniciar();
  }

  @override
  void dispose() {
    _detener();
    _ciclo.dispose();
    super.dispose();
  }

  bool get _aplica {
    final rol = ref.read(sesionProvider).value?.rol;
    return rol == Rol.adminPlaza || rol == Rol.inquilino;
  }

  void _iniciar() {
    _timer ??= Timer.periodic(intervaloCampana, (_) => _refrescar());
  }

  void _detener() {
    _timer?.cancel();
    _timer = null;
  }

  void _refrescar() {
    if (mounted && _aplica) ref.invalidate(conteoNoLeidasProvider);
  }

  /// Muestra [optimista] hasta que el backend confirma la marca y el contador
  /// se vuelve a pedir (si falla, el contador real lo corrige).
  Future<void> _marcar(Future<void> Function() marca, int optimista) async {
    setState(() => _optimista = optimista);
    try {
      await marca();
    } on Object {
      // Igual que el web: se ignora y se vuelve a pedir el conteo.
    }
    if (!mounted) return;
    ref.invalidate(conteoNoLeidasProvider);
    try {
      await ref.read(conteoNoLeidasProvider.future);
    } on Object {
      // Se reintenta en el siguiente ciclo.
    }
    if (mounted) setState(() => _optimista = null);
  }

  Future<void> _abrir(int conteo) async {
    final api = ref.read(apiClientProvider);
    final elegida = await showModalBottomSheet<NotificacionInApp>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => HojaNotificaciones(
        alMarcarTodas: () => _marcar(() => marcarTodasLeidas(api), 0),
      ),
    );
    if (elegida == null || !mounted) return;
    if (!elegida.leida) {
      final actual = _optimista ?? conteo;
      unawaited(
        _marcar(
          () => marcarNotificacionLeida(api, elegida.id),
          math.max(0, actual - 1),
        ),
      );
    }
    final ruta = rutaDeNotificacion(
      elegida,
      ref.read(sesionProvider).value?.rol,
    );
    if (ruta != null) unawaited(context.push(ruta));
  }

  @override
  Widget build(BuildContext context) {
    final rol = ref.watch(sesionProvider).value?.rol;
    if (rol != Rol.adminPlaza && rol != Rol.inquilino) {
      return const SizedBox.shrink();
    }
    final conteo = _optimista ?? ref.watch(conteoNoLeidasProvider).value ?? 0;
    return IconButton(
      key: const Key('campana'),
      tooltip: conteo > 0
          ? 'Notificaciones: $conteo sin leer'
          : 'Notificaciones',
      onPressed: () => _abrir(conteo),
      icon: Badge(
        isLabelVisible: conteo > 0,
        label: Text(conteo > 9 ? '9+' : '$conteo'),
        child: const Icon(Icons.notifications_none_outlined),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/sesion_controller.dart';

/// Muestra [child] solo si la sesión tiene [permiso] (código o lista = OR).
/// Igual que `<Can>` del web: el backend vuelve a validar siempre.
class Can extends ConsumerWidget {
  const Can({
    super.key,
    required this.permiso,
    required this.child,
    this.otherwise = const SizedBox.shrink(),
  });

  final Object permiso;
  final Widget child;
  final Widget otherwise;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sesion = ref.watch(sesionProvider).value;
    return sesion != null && sesion.puede(permiso) ? child : otherwise;
  }
}

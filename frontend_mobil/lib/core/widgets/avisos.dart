import 'package:flutter/material.dart';

import '../api/api_error.dart';
import '../theme/colores.dart';

/// Aviso contextual (equivalente a `<Banner>` del web).
class AvisoBanner extends StatelessWidget {
  const AvisoBanner({
    super.key,
    required this.tono,
    required this.child,
    this.icono,
  });

  final Tono tono;
  final Widget child;
  final IconData? icono;

  @override
  Widget build(BuildContext context) {
    final t = ColoresPlazapp.of(context).tono(tono);
    final icon =
        icono ??
        switch (tono) {
          Tono.ok => Icons.check_circle_outline,
          Tono.danger => Icons.cancel_outlined,
          Tono.warn || Tono.orange => Icons.warning_amber_outlined,
          _ => Icons.info_outline,
        };
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: t.bg,
        border: Border.all(color: t.bd),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: t.fg, size: 18),
          const SizedBox(width: 10),
          Expanded(
            child: DefaultTextStyle.merge(
              style: TextStyle(color: t.fg, fontSize: 13.5),
              child: child,
            ),
          ),
        ],
      ),
    );
  }
}

/// Mensaje efímero de éxito (los toasts de `sonner` del web).
void mostrarExito(BuildContext context, String mensaje) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(mensaje)));
}

/// Mensaje efímero de error. Muestra `ApiError.mensaje` (el `detail` del backend).
void mostrarError(BuildContext context, Object error) {
  final mensaje = error is ApiError ? error.mensaje : '$error';
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(
      SnackBar(
        backgroundColor: Theme.of(context).colorScheme.error,
        content: Text(mensaje, style: const TextStyle(color: Colors.white)),
      ),
    );
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_error.dart';
import '../theme/colores.dart';

/// Lista vacía o pantalla sin datos (mismos textos que el web).
class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.icono,
    required this.titulo,
    this.mensaje,
  });

  final IconData icono;
  final String titulo;
  final String? mensaje;

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 16),
      child: Column(
        children: [
          Icon(icono, size: 36, color: c.textMuted),
          const SizedBox(height: 10),
          Text(
            titulo,
            textAlign: TextAlign.center,
            style: TextStyle(fontWeight: FontWeight.w600, color: c.text),
          ),
          if (mensaje != null) ...[
            const SizedBox(height: 4),
            Text(
              mensaje!,
              textAlign: TextAlign.center,
              style: TextStyle(color: c.text3),
            ),
          ],
        ],
      ),
    );
  }
}

/// Error al cargar datos, con "Reintentar".
class ErrorView extends StatelessWidget {
  const ErrorView({super.key, required this.error, this.onRetry});

  final Object error;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final t = ColoresPlazapp.of(context).tono(Tono.danger);
    final mensaje = error is ApiError
        ? (error as ApiError).mensaje
        : 'Ocurrió un error inesperado.';
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.error_outline, color: t.fg, size: 32),
          const SizedBox(height: 8),
          Text(
            mensaje,
            textAlign: TextAlign.center,
            style: TextStyle(color: t.fg),
          ),
          if (onRetry != null) ...[
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Reintentar'),
            ),
          ],
        ],
      ),
    );
  }
}

/// Pinta un [AsyncValue]: cargando, error con "Reintentar" o los datos.
/// Al refrescar mantiene los datos anteriores en pantalla.
class AsyncView<T> extends StatelessWidget {
  const AsyncView({
    super.key,
    required this.value,
    required this.data,
    this.onRetry,
  });

  final AsyncValue<T> value;
  final Widget Function(T datos) data;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return value.when(
      data: data,
      loading: () => const Padding(
        padding: EdgeInsets.all(40),
        child: Center(child: CircularProgressIndicator()),
      ),
      error: (e, _) => Center(
        child: ErrorView(error: e, onRetry: onRetry),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_error.dart';
import '../../core/api/api_providers.dart';
import '../../core/auth/sesion_controller.dart';
import 'auth_api.dart';

/// Abre el diálogo "Cambiar contraseña" (pie del menú en el web).
Future<void> mostrarCambiarPassword(BuildContext context) {
  return showDialog<void>(
    context: context,
    // Solo se cierra con «Cancelar» (deshabilitado mientras se guarda).
    barrierDismissible: false,
    builder: (_) => const _CambiarPasswordDialog(),
  );
}

class _CambiarPasswordDialog extends ConsumerStatefulWidget {
  const _CambiarPasswordDialog();

  @override
  ConsumerState<_CambiarPasswordDialog> createState() =>
      _CambiarPasswordDialogState();
}

class _CambiarPasswordDialogState
    extends ConsumerState<_CambiarPasswordDialog> {
  final _form = GlobalKey<FormState>();
  final _actual = TextEditingController();
  final _nueva = TextEditingController();
  final _confirmar = TextEditingController();
  bool _ver = false;
  bool _enviando = false;
  String? _errorActual;
  String? _errorNueva;
  String? _error;

  @override
  void dispose() {
    _actual.dispose();
    _nueva.dispose();
    _confirmar.dispose();
    super.dispose();
  }

  Future<void> _guardar() async {
    setState(() {
      _errorActual = null;
      _errorNueva = null;
      _error = null;
    });
    if (!_form.currentState!.validate()) return;
    setState(() => _enviando = true);
    // Todo lo que se usa tras el await se toma antes (el diálogo podría
    // cerrarse mientras tanto, p. ej. con «atrás» en Android).
    final router = GoRouter.of(context);
    final navigator = Navigator.of(context);
    final sesion = ref.read(sesionProvider.notifier);
    try {
      await cambiarPassword(
        ref.read(apiClientProvider),
        actual: _actual.text,
        nueva: _nueva.text,
      );
      // El backend revocó todas las sesiones: cerrar la local y volver al login.
      await sesion.cerrarSesion();
      navigator.pop();
      router.go('/login?password_changed=1');
    } on ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        switch (e.code) {
          case 'INVALID_CURRENT_PASSWORD':
            _errorActual = 'La contraseña actual no es correcta.';
          case 'SAME_PASSWORD':
            _errorNueva = 'La nueva contraseña debe ser distinta de la actual';
          default:
            _error = e.mensaje;
        }
      });
      _form.currentState!.validate();
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  InputDecoration _decoracion(String label, String? errorServidor) =>
      InputDecoration(
        labelText: label,
        errorText: errorServidor,
        suffixIcon: IconButton(
          tooltip: _ver ? 'Ocultar' : 'Mostrar',
          icon: Icon(
            _ver ? Icons.visibility_off_outlined : Icons.visibility_outlined,
          ),
          onPressed: () => setState(() => _ver = !_ver),
        ),
      );

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Cambiar contraseña'),
      content: SingleChildScrollView(
        child: Form(
          key: _form,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextFormField(
                controller: _actual,
                obscureText: !_ver,
                decoration: _decoracion('Contraseña actual', _errorActual),
                validator: (v) =>
                    (v ?? '').isEmpty ? 'Este campo es obligatorio.' : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _nueva,
                obscureText: !_ver,
                decoration: _decoracion('Nueva contraseña', _errorNueva),
                validator: (v) {
                  final error = validarPasswordNueva(v);
                  if (error != null) return error;
                  if (v == _actual.text) {
                    return 'La nueva contraseña debe ser distinta de la actual';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _confirmar,
                obscureText: !_ver,
                decoration: _decoracion('Confirmar nueva contraseña', null),
                validator: (v) =>
                    v != _nueva.text ? 'Las contraseñas no coinciden' : null,
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(
                  _error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ],
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: _enviando ? null : () => Navigator.of(context).pop(),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          onPressed: _enviando ? null : _guardar,
          child: Text(_enviando ? 'Guardando…' : 'Cambiar contraseña'),
        ),
      ],
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_error.dart';
import '../../core/api/api_providers.dart';
import '../../core/theme/colores.dart';
import 'auth_api.dart';

/// Solicitar el enlace de restablecimiento. El enlace del correo abre el web
/// (la app no maneja deep links en v1).
class ResetPasswordPage extends ConsumerStatefulWidget {
  const ResetPasswordPage({super.key});

  @override
  ConsumerState<ResetPasswordPage> createState() => _ResetPasswordPageState();
}

class _ResetPasswordPageState extends ConsumerState<ResetPasswordPage> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  bool _enviando = false;
  bool _enviado = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _enviar() async {
    if (!_form.currentState!.validate()) return;
    setState(() {
      _enviando = true;
      _error = null;
    });
    try {
      await solicitarResetPassword(ref.read(apiClientProvider), _email.text);
      if (mounted) setState(() => _enviado = true);
    } on ApiError catch (e) {
      if (mounted) setState(() => _error = e.mensaje);
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    final ok = c.tono(Tono.ok);
    return Scaffold(
      appBar: AppBar(),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Form(
                    key: _form,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          'Restablecer contraseña',
                          style: Theme.of(context).textTheme.headlineSmall
                              ?.copyWith(fontWeight: FontWeight.w600),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Te enviaremos un enlace para crear una nueva.',
                          style: TextStyle(color: c.text3),
                        ),
                        const SizedBox(height: 20),
                        if (_enviado)
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: ok.bg,
                              border: Border.all(color: ok.bd),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Text(
                              'Si el email existe, recibirás un enlace para '
                              'restablecer tu contraseña. Expira en 30 minutos.',
                              style: TextStyle(color: ok.fg),
                            ),
                          )
                        else ...[
                          TextFormField(
                            controller: _email,
                            keyboardType: TextInputType.emailAddress,
                            decoration: const InputDecoration(
                              labelText: 'Email',
                              hintText: 'tucorreo@plazapp.com',
                            ),
                            validator: validarEmail,
                            onFieldSubmitted: (_) => _enviar(),
                          ),
                          if (_error != null) ...[
                            const SizedBox(height: 12),
                            Text(
                              _error!,
                              style: TextStyle(color: c.tono(Tono.danger).fg),
                            ),
                          ],
                          const SizedBox(height: 20),
                          FilledButton(
                            onPressed: _enviando ? null : _enviar,
                            child: Text(
                              _enviando ? 'Enviando…' : 'Enviar enlace',
                            ),
                          ),
                        ],
                        const SizedBox(height: 8),
                        TextButton(
                          onPressed: () => context.go('/login'),
                          child: const Text('Volver a iniciar sesión'),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

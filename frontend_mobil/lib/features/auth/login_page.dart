import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_error.dart';
import '../../core/auth/sesion_controller.dart';
import '../../core/theme/colores.dart';
import 'auth_api.dart';

/// Inicio de sesión (mismos textos que `frontend/src/components/client/login-form.tsx`).
class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({
    super.key,
    this.expirada = false,
    this.passwordCambiada = false,
  });

  /// `?expired=1`: la sesión venció o fue revocada.
  final bool expirada;

  /// `?password_changed=1`: se acaba de cambiar la contraseña.
  final bool passwordCambiada;

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _enviando = false;
  bool _verPassword = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _enviar() async {
    if (!_form.currentState!.validate()) return;
    setState(() {
      _enviando = true;
      _error = null;
    });
    try {
      await ref
          .read(sesionProvider.notifier)
          .iniciarSesion(_email.text, _password.text);
      // El router redirige a la home del rol al cambiar la sesión.
    } on ApiError catch (e) {
      setState(() => _error = mensajeErrorLogin(e));
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    final aviso = widget.passwordCambiada
        ? 'Contraseña actualizada. Inicia sesión con tu nueva contraseña.'
        : widget.expirada
        ? 'Tu sesión expiró. Vuelve a iniciar sesión.'
        : null;
    return Scaffold(
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
                        Row(
                          children: [
                            Container(
                              width: 34,
                              height: 34,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                color: Theme.of(context).colorScheme.primary,
                                borderRadius: BorderRadius.circular(9),
                              ),
                              child: const Text(
                                'P',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Text(
                              'Plazapp',
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                          ],
                        ),
                        const SizedBox(height: 24),
                        Text(
                          'Inicia sesión',
                          style: Theme.of(context).textTheme.headlineSmall
                              ?.copyWith(fontWeight: FontWeight.w600),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Accede a la consola de tu plaza.',
                          style: TextStyle(color: c.text3),
                        ),
                        if (aviso != null) ...[
                          const SizedBox(height: 16),
                          _Aviso(texto: aviso, tono: Tono.info),
                        ],
                        const SizedBox(height: 20),
                        TextFormField(
                          key: const Key('login-email'),
                          controller: _email,
                          keyboardType: TextInputType.emailAddress,
                          autofillHints: const [AutofillHints.email],
                          textInputAction: TextInputAction.next,
                          decoration: const InputDecoration(
                            labelText: 'Email',
                            hintText: 'tucorreo@plazapp.com',
                          ),
                          validator: validarEmail,
                        ),
                        const SizedBox(height: 14),
                        TextFormField(
                          key: const Key('login-password'),
                          controller: _password,
                          obscureText: !_verPassword,
                          autofillHints: const [AutofillHints.password],
                          textInputAction: TextInputAction.done,
                          onFieldSubmitted: (_) => _enviar(),
                          decoration: InputDecoration(
                            labelText: 'Contraseña',
                            suffixIcon: IconButton(
                              tooltip: _verPassword
                                  ? 'Ocultar contraseña'
                                  : 'Mostrar contraseña',
                              icon: Icon(
                                _verPassword
                                    ? Icons.visibility_off_outlined
                                    : Icons.visibility_outlined,
                              ),
                              onPressed: () =>
                                  setState(() => _verPassword = !_verPassword),
                            ),
                          ),
                          validator: (v) => (v ?? '').isEmpty
                              ? 'Este campo es obligatorio.'
                              : null,
                        ),
                        if (_error != null) ...[
                          const SizedBox(height: 14),
                          _Aviso(texto: _error!, tono: Tono.danger),
                        ],
                        const SizedBox(height: 20),
                        FilledButton(
                          key: const Key('login-enviar'),
                          onPressed: _enviando ? null : _enviar,
                          child: Text(
                            _enviando ? 'Iniciando…' : 'Iniciar sesión',
                          ),
                        ),
                        const SizedBox(height: 8),
                        TextButton(
                          onPressed: () => context.push('/reset-password'),
                          child: const Text('¿Olvidaste tu contraseña?'),
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

/// Texto para cada error de login (por `code`, nunca por status).
String mensajeErrorLogin(ApiError e) {
  switch (e.code) {
    case 'INVALID_CREDENTIALS':
    case 'VALIDATION_ERROR':
      return 'Email o contraseña incorrectos';
    case 'ACCOUNT_LOCKED':
      return 'Cuenta bloqueada temporalmente por varios intentos fallidos. '
          'Intenta más tarde.';
    case 'TOO_MANY_REQUESTS':
      final s = e.retryAfter;
      return s == null
          ? 'Demasiados intentos. Espera un momento e intenta de nuevo.'
          : 'Demasiados intentos. Espera $s s e intenta de nuevo.';
    case 'PLAZA_INACTIVA':
      return 'La plaza de este usuario está desactivada. Contacta al '
          'administrador de la plataforma.';
    case 'SIN_CONEXION':
    case 'TIEMPO_AGOTADO':
      return e.mensaje;
    default:
      return 'No se pudo iniciar sesión. Intenta de nuevo.';
  }
}

class _Aviso extends StatelessWidget {
  const _Aviso({required this.texto, required this.tono});

  final String texto;
  final Tono tono;

  @override
  Widget build(BuildContext context) {
    final t = ColoresPlazapp.of(context).tono(tono);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: t.bg,
        border: Border.all(color: t.bd),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(texto, style: TextStyle(color: t.fg)),
    );
  }
}

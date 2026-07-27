// lib/features/auth/presentation/login_page.dart
//
// Pantalla de login. Réplica del `.auth-card` del web pero apilada para móvil.
//
// Spec del web (frontend/src/app/globals.css §13.5):
//   - Brand panel (navy con gradiente) → oculto en móvil (< 992dp), solo logo + form.
//   - Card con auth-head (logo + h1 "Bienvenido de vuelta") + form.
//   - Inputs 40px, botones 38px (sm en mobile), radius 18 (auth-card).

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/plazapp_colors.dart';
import '../../../core/theme/plazapp_spacing.dart';
import '../../../core/theme/plazapp_text.dart';
import '../controllers/auth_controller.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  bool _showPass = false;
  bool _submitting = false;

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _submitting = true);
    final auth = context.read<AuthController>();
    final ok = await auth.login(_emailCtrl.text.trim(), _passCtrl.text);
    if (!mounted) return;
    setState(() => _submitting = false);
    if (!ok && auth.lastError != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(auth.lastError!),
          backgroundColor: Theme.of(context).extension<PlazappColors>()!.danger.bg,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<PlazappColors>()!;
    final text = Theme.of(context).textTheme;

    return Scaffold(
      backgroundColor: colors.bg,
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            // En móvil: solo el form (full screen). En ≥ 992dp: split con brand panel.
            final isWide = constraints.maxWidth >= 992;
            if (!isWide) return _buildForm(context, colors, text);

            return Row(
              children: [
                Expanded(flex: 1, child: _buildBrandPanel(colors)),
                Expanded(
                  flex: 1,
                  child: Center(child: _buildForm(context, colors, text)),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _buildBrandPanel(PlazappColors colors) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [colors.sideBg2, colors.sideBg],
        ),
      ),
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(11),
                  gradient: colors.brand.logoGradient,
                ),
                alignment: Alignment.center,
                child: Text(
                  'P',
                  style: TextStyle(
                    fontFamily: PlazappText.fontFamilySans,
                    fontSize: 24,
                    fontWeight: FontWeight.w700,
                    color: colors.textInverse,
                  ),
                ),
              ),
              const SizedBox(height: 24),
              Text(
                'Gestión operativa de tu plaza, sin fricción.',
                textAlign: TextAlign.center,
                style: PlazappText.textTheme.displayLarge?.copyWith(
                  color: colors.sideTextStrong,
                  fontSize: 30,
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'Plataforma de gestión de solicitudes para centros comerciales.',
                textAlign: TextAlign.center,
                style: PlazappText.textTheme.bodyLarge?.copyWith(
                  color: Colors.white.withValues(alpha: 0.66),
                ),
              ),
              const SizedBox(height: 32),
              Text(
                'Plazapp · Helixsys',
                style: PlazappText.textTheme.labelMedium?.copyWith(
                  color: colors.brand.p300,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildForm(BuildContext context, PlazappColors colors, TextTheme text) {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
      child: Container(
        constraints: const BoxConstraints(maxWidth: 400),
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: BorderRadius.circular(PlazSpacing.radiusXl),
          border: Border.all(color: colors.border),
          boxShadow: PlazShadows.sm,
        ),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Logo + brand
              Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(8),
                      gradient: colors.brand.logoGradient,
                    ),
                    alignment: Alignment.center,
                    child: Text('P',
                        style: TextStyle(
                          fontFamily: PlazappText.fontFamilySans,
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: colors.textInverse,
                        )),
                  ),
                  const SizedBox(width: 10),
                  Text('Plazapp',
                      style: PlazappText.textTheme.titleMedium?.copyWith(
                        letterSpacing: -0.2,
                      )),
                ],
              ),
              const SizedBox(height: 28),
              Text('Bienvenido de vuelta',
                  style: PlazappText.textTheme.displaySmall
                      ?.copyWith(color: colors.text)),
              const SizedBox(height: 6),
              Text('Ingresa con tu correo y contraseña.',
                  style: PlazappText.textTheme.bodyMedium
                      ?.copyWith(color: colors.text2)),
              const SizedBox(height: 28),

              // Email
              TextFormField(
                controller: _emailCtrl,
                keyboardType: TextInputType.emailAddress,
                autofillHints: const [AutofillHints.email],
                decoration: const InputDecoration(
                  labelText: 'Correo',
                  prefixIcon: Icon(Icons.alternate_email),
                ),
                validator: (v) =>
                    (v == null || !v.contains('@')) ? 'Correo inválido' : null,
              ),
              const SizedBox(height: 14),

              // Password
              TextFormField(
                controller: _passCtrl,
                obscureText: !_showPass,
                autofillHints: const [AutofillHints.password],
                decoration: InputDecoration(
                  labelText: 'Contraseña',
                  prefixIcon: const Icon(Icons.lock_outline),
                  suffixIcon: IconButton(
                    icon: Icon(_showPass
                        ? Icons.visibility_off
                        : Icons.visibility),
                    onPressed: () => setState(() => _showPass = !_showPass),
                  ),
                ),
                validator: (v) =>
                    (v == null || v.length < 4) ? 'Mínimo 4 caracteres' : null,
              ),
              const SizedBox(height: 24),

              FilledButton(
                onPressed: _submitting ? null : _submit,
                style: FilledButton.styleFrom(
                  backgroundColor: colors.brand.primary,
                  foregroundColor: colors.textInverse,
                  minimumSize: const Size.fromHeight(PlazSpacing.btnHeightLg),
                  shape: RoundedRectangleBorder(
                    borderRadius:
                        BorderRadius.circular(PlazSpacing.radiusSm),
                  ),
                  textStyle: PlazappText.textTheme.labelLarge,
                ),
                child: _submitting
                    ? const SizedBox(
                        height: 18,
                        width: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Text('Ingresar'),
              ),
              const SizedBox(height: 16),
              Center(
                child: Text(
                  'Plazapp · Helixsys',
                  style: PlazappText.textTheme.labelMedium
                      ?.copyWith(color: colors.textMuted),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
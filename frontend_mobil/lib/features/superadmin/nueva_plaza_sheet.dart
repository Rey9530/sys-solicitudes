import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_providers.dart';
import '../../core/format/validaciones.dart';
import '../../core/theme/colores.dart';
import '../../core/widgets/avisos.dart';
import '../../core/widgets/campo_select.dart';
import '../../core/widgets/filtros.dart';
import '../auth/auth_api.dart';
import '../configuracion/widgets/selector_color.dart';
import 'plazas_api.dart';
import 'plazas_modelos.dart';

/// Abre el formulario "Nueva plaza". Devuelve `true` si se creó.
Future<bool> mostrarNuevaPlaza(BuildContext context) async {
  final creada = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    showDragHandle: true,
    builder: (_) => const NuevaPlazaSheet(),
  );
  return creada ?? false;
}

/// Formulario "Nueva plaza" (`components/client/nueva-plaza-dialog.tsx`): crea
/// la plaza con su configuración, roles de staff y un administrador inicial.
///
/// A diferencia del web, la contraseña temporal del administrador exige la
/// política completa (mayúscula, minúscula y dígito; C-R12).
class NuevaPlazaSheet extends ConsumerStatefulWidget {
  const NuevaPlazaSheet({super.key});

  @override
  ConsumerState<NuevaPlazaSheet> createState() => _NuevaPlazaSheetState();
}

class _NuevaPlazaSheetState extends ConsumerState<NuevaPlazaSheet> {
  final _form = GlobalKey<FormState>();
  final _nombre = TextEditingController();
  final _slug = TextEditingController();
  final _email = TextEditingController();
  final _telefono = TextEditingController();
  final _adminNombre = TextEditingController();
  final _adminEmail = TextEditingController();
  final _adminPassword = TextEditingController();
  String _color = paletaColores.first;
  String _rol = 'admin';
  bool _enviando = false;

  @override
  void dispose() {
    for (final c in [
      _nombre,
      _slug,
      _email,
      _telefono,
      _adminNombre,
      _adminEmail,
      _adminPassword,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  static String? _requerido(String? v) =>
      (v ?? '').trim().isEmpty ? 'Requerido' : null;

  static String? _validarSlug(String? v) {
    final s = (v ?? '').trim().toLowerCase();
    if (s.length < 3 || s.length > 32) {
      return 'El slug debe tener entre 3 y 32 caracteres.';
    }
    return RegExp(r'^[a-z0-9-]+$').hasMatch(s)
        ? null
        : 'El slug solo puede contener minúsculas, dígitos y guiones';
  }

  Future<void> _crear() async {
    if (!_form.currentState!.validate() || !esHexValido(_color)) return;
    setState(() => _enviando = true);
    final email = _email.text.trim().toLowerCase();
    final telefono = _telefono.text.trim();
    try {
      await crearPlaza(ref.read(apiClientProvider), {
        'slug': _slug.text.trim().toLowerCase(),
        'nombreComercial': _nombre.text.trim(),
        if (email.isNotEmpty) 'emailContacto': email,
        if (telefono.isNotEmpty) 'telefonoContacto': telefono,
        'colorPrimario': _color.trim(),
        'adminPlazaInicial': {
          'email': _adminEmail.text.trim().toLowerCase(),
          'nombre': _adminNombre.text.trim(),
          'password': _adminPassword.text,
          'rolStaffCodigo': _rol,
        },
      });
      if (!mounted) return;
      mostrarExito(context, 'Plaza creada');
      Navigator.of(context).pop(true);
    } on Object catch (e) {
      if (mounted) mostrarError(context, e);
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
        child: Form(
          key: _form,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Nueva plaza',
                style: Theme.of(context).textTheme.titleLarge
                    ?.copyWith(fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 4),
              Text(
                'Se crea la plaza con su configuración, roles de staff y un '
                'administrador inicial.',
                style: TextStyle(color: c.text3, fontSize: 13.5),
              ),
              const SizedBox(height: 16),
              TextFormField(
                key: const Key('plaza-nombre'),
                controller: _nombre,
                maxLength: 120,
                decoration: const InputDecoration(
                  labelText: 'Nombre comercial',
                  counterText: '',
                ),
                validator: _requerido,
                onChanged: (v) => _slug.text = slugDesdeNombre(v),
              ),
              const SizedBox(height: 12),
              RejillaCampos(
                maxColumnas: 2,
                children: [
                  TextFormField(
                    key: const Key('plaza-slug'),
                    controller: _slug,
                    maxLength: 32,
                    autocorrect: false,
                    decoration: const InputDecoration(
                      labelText: 'Slug',
                      counterText: '',
                      errorMaxLines: 2,
                    ),
                    validator: _validarSlug,
                  ),
                  TextFormField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(
                      labelText: 'Email de contacto',
                    ),
                    validator: (v) => validarEmailOpcional(v),
                  ),
                  TextFormField(
                    controller: _telefono,
                    keyboardType: TextInputType.phone,
                    maxLength: 40,
                    decoration: const InputDecoration(
                      labelText: 'Teléfono',
                      counterText: '',
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              SelectorColor(
                valor: _color,
                onChanged: (v) => setState(() => _color = v),
              ),
              const SizedBox(height: 16),
              Divider(color: c.border),
              const SizedBox(height: 8),
              Text(
                'Administrador inicial',
                style: TextStyle(fontWeight: FontWeight.w600, color: c.text2),
              ),
              const SizedBox(height: 12),
              RejillaCampos(
                maxColumnas: 2,
                children: [
                  TextFormField(
                    key: const Key('admin-nombre'),
                    controller: _adminNombre,
                    maxLength: 120,
                    decoration: const InputDecoration(
                      labelText: 'Nombre',
                      counterText: '',
                    ),
                    validator: _requerido,
                  ),
                  CampoSelect<String>(
                    label: 'Rol de staff',
                    valor: _rol,
                    opciones: rolesAdminInicial,
                    onChanged: (v) => setState(() => _rol = v ?? 'admin'),
                  ),
                  TextFormField(
                    key: const Key('admin-email'),
                    controller: _adminEmail,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(labelText: 'Email'),
                    validator: validarEmailObligatorio,
                  ),
                  TextFormField(
                    key: const Key('admin-password'),
                    controller: _adminPassword,
                    autocorrect: false,
                    enableSuggestions: false,
                    decoration: const InputDecoration(
                      labelText: 'Contraseña temporal',
                      errorMaxLines: 2,
                    ),
                    validator: validarPasswordNueva,
                  ),
                ],
              ),
              const SizedBox(height: 20),
              Wrap(
                alignment: WrapAlignment.end,
                spacing: 8,
                runSpacing: 8,
                children: [
                  OutlinedButton(
                    onPressed: () => Navigator.of(context).pop(false),
                    child: const Text('Cancelar'),
                  ),
                  FilledButton(
                    key: const Key('crear-plaza'),
                    onPressed: _enviando || !esHexValido(_color)
                        ? null
                        : _crear,
                    child: Text(_enviando ? 'Creando…' : 'Crear plaza'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

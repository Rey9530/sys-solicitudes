import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_error.dart';
import '../../core/api/api_providers.dart';
import '../../core/theme/colores.dart';
import '../../core/widgets/avisos.dart';
import 'usuarios_api.dart';
import 'usuarios_modelos.dart';
import 'usuarios_providers.dart';
import '../../core/api/payload.dart';

/// Abre el formulario de rol de staff (nuevo si [rol] es null). Al guardar
/// muestra el aviso y recarga los listados.
Future<void> mostrarRolStaffSheet(
  BuildContext context,
  WidgetRef ref, {
  RolStaff? rol,
}) async {
  final guardado = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => RolStaffSheet(rol: rol),
  );
  if (guardado != true || !context.mounted) return;
  mostrarExito(context, rol == null ? 'Rol creado' : 'Rol actualizado');
  invalidarRoles(ref);
}

/// Crear/editar un rol de staff (espejo de `rol-staff-form-dialog.tsx`). El
/// código es inmutable tras crearse.
class RolStaffSheet extends ConsumerStatefulWidget {
  const RolStaffSheet({super.key, this.rol});

  final RolStaff? rol;

  @override
  ConsumerState<RolStaffSheet> createState() => _RolStaffSheetState();
}

class _RolStaffSheetState extends ConsumerState<RolStaffSheet> {
  final _form = GlobalKey<FormState>();
  final _codigo = TextEditingController();
  late final _nombre = TextEditingController(text: widget.rol?.nombre);
  late final _descripcion = TextEditingController(
    text: widget.rol?.descripcion,
  );
  late bool _activo = widget.rol?.activo ?? true;
  String? _errorCodigo;
  ApiError? _error;
  bool _guardando = false;

  bool get _esEdicion => widget.rol != null;

  @override
  void dispose() {
    _codigo.dispose();
    _nombre.dispose();
    _descripcion.dispose();
    super.dispose();
  }

  String? _validarCodigo(String? v) {
    final codigo = (v ?? '').trim().toLowerCase();
    if (codigo.length < 2) return 'Mínimo 2 caracteres';
    if (!RegExp(r'^[a-z0-9-]+$').hasMatch(codigo)) {
      return 'El código solo puede contener minúsculas, dígitos y guiones';
    }
    return null;
  }

  Future<void> _guardar() async {
    setState(() {
      _errorCodigo = null;
      _error = null;
    });
    if (!_form.currentState!.validate()) return;
    setState(() => _guardando = true);
    final api = ref.read(apiClientProvider);
    try {
      final rol = widget.rol;
      if (rol == null) {
        await crearRolStaff(
          api,
          codigo: _codigo.text,
          nombre: _nombre.text.trim(),
          descripcion: textoOpcional(_descripcion.text),
        );
      } else {
        await actualizarRolStaff(
          api,
          rol.id,
          nombre: _nombre.text.trim(),
          descripcion: textoOpcional(_descripcion.text),
          activo: _activo,
        );
      }
      if (mounted) Navigator.of(context).pop(true);
    } on ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        _guardando = false;
        if (e.code == 'ROL_STAFF_CODIGO_DUPLICADO') {
          _errorCodigo = e.mensaje;
        } else {
          _error = e;
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    final rol = widget.rol;
    return Padding(
      // Sube el formulario por encima del teclado.
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 560),
            child: Form(
              key: _form,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    rol == null
                        ? 'Nuevo rol de staff'
                        : 'Editar rol: ${rol.nombre}',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 6),
                  Text(
                    rol == null
                        ? 'Crea un rol operativo para clasificar al personal '
                              'de la plaza.'
                        : 'Modifica nombre, descripción o estado del rol.',
                    style: TextStyle(color: c.text3),
                  ),
                  const SizedBox(height: 16),
                  if (_error != null) ...[
                    AvisoBanner(
                      tono: Tono.danger,
                      child: Text(_error!.mensaje),
                    ),
                    const SizedBox(height: 12),
                  ],
                  if (rol == null)
                    TextFormField(
                      key: const Key('rol-codigo'),
                      controller: _codigo,
                      autocorrect: false,
                      maxLength: 40,
                      decoration: InputDecoration(
                        labelText: 'Código (slug, inmutable)',
                        hintText: 'tecnico',
                        helperText:
                            'minúsculas, dígitos y guiones. Ej.: tecnico, '
                            'supervisor-nocturno.',
                        helperMaxLines: 3,
                        errorText: _errorCodigo,
                        errorMaxLines: 3,
                      ),
                      validator: _validarCodigo,
                    )
                  else
                    TextFormField(
                      initialValue: rol.codigo,
                      enabled: false,
                      decoration: const InputDecoration(
                        labelText: 'Código',
                        helperText: 'Inmutable tras la creación.',
                      ),
                    ),
                  const SizedBox(height: 8),
                  TextFormField(
                    key: const Key('rol-nombre'),
                    controller: _nombre,
                    maxLength: 80,
                    decoration: const InputDecoration(labelText: 'Nombre'),
                    validator: (v) =>
                        (v ?? '').trim().isEmpty ? 'Requerido' : null,
                  ),
                  const SizedBox(height: 4),
                  TextFormField(
                    key: const Key('rol-descripcion'),
                    controller: _descripcion,
                    maxLength: 500,
                    decoration: const InputDecoration(
                      labelText: 'Descripción (opcional)',
                    ),
                  ),
                  if (_esEdicion)
                    CheckboxListTile(
                      key: const Key('rol-activo'),
                      contentPadding: EdgeInsets.zero,
                      controlAffinity: ListTileControlAffinity.leading,
                      value: _activo,
                      onChanged: (v) => setState(() => _activo = v ?? _activo),
                      title: const Text('Activo'),
                    ),
                  const SizedBox(height: 12),
                  Wrap(
                    alignment: WrapAlignment.end,
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      TextButton(
                        onPressed: () => Navigator.of(context).pop(false),
                        child: const Text('Cancelar'),
                      ),
                      FilledButton(
                        key: const Key('rol-guardar'),
                        onPressed: _guardando ? null : _guardar,
                        child: Text(
                          _guardando
                              ? (_esEdicion ? 'Guardando…' : 'Creando…')
                              : (_esEdicion ? 'Guardar' : 'Crear rol'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

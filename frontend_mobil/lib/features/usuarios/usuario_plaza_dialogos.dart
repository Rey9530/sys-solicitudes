import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_error.dart';
import '../../core/api/api_providers.dart';
import '../../core/auth/sesion_controller.dart';
import '../../core/theme/colores.dart';
import '../../core/widgets/avisos.dart';
import '../../core/widgets/badges.dart';
import '../../core/widgets/dialogos.dart';
import 'usuarios_api.dart';
import 'usuarios_modelos.dart';
import 'usuarios_providers.dart';
import '../../core/api/payload.dart';
import '../../core/format/validaciones.dart';

/// Códigos de error del backend que se muestran bajo el selector de rol.
const _erroresDeRol = {
  'ROL_STAFF_INVALIDO',
  'ROL_STAFF_NO_EXISTE',
  'ROL_STAFF_REQUERIDO',
  'ULTIMO_ADMIN_SISTEMA',
};

/// Badge del rol de staff de un usuario (`—` si no tiene).
class RolStaffBadge extends StatelessWidget {
  const RolStaffBadge(this.usuario, {super.key});

  final UsuarioPlaza usuario;

  @override
  Widget build(BuildContext context) {
    final nombre = usuario.rolStaffNombre;
    if (nombre == null) {
      return Text(
        '—',
        style: TextStyle(color: ColoresPlazapp.of(context).textMuted),
      );
    }
    return usuario.rolStaffActivo == false
        ? BadgePlazapp('$nombre (inactivo)', Tono.warn)
        : BadgePlazapp(nombre, Tono.ok);
  }
}

/// Estado del usuario: Inactivo / Email inválido / Activo.
class EstadoUsuarioBadge extends StatelessWidget {
  const EstadoUsuarioBadge(this.usuario, {super.key});

  final UsuarioPlaza usuario;

  @override
  Widget build(BuildContext context) {
    if (usuario.deshabilitado) {
      return const BadgePlazapp('Inactivo', Tono.neutral);
    }
    if (usuario.emailInvalido) {
      return const BadgePlazapp('Email inválido', Tono.warn);
    }
    return const BadgePlazapp('Activo', Tono.ok);
  }
}

/// Opción de rol en los selectores: `Nombre (codigo)` y ` — inactivo`.
String etiquetaRol(RolStaff r) =>
    '${r.nombre} (${r.codigo})${r.activo ? '' : ' — inactivo'}';

String? _requerido(String? v) => (v ?? '').trim().isEmpty ? 'Requerido' : null;

Widget _cuerpo(List<Widget> children) => SizedBox(
  width: 480,
  child: Column(
    mainAxisSize: MainAxisSize.min,
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: children,
  ),
);

/// Selector de rol de staff. Si el valor actual no está entre las opciones
/// (p. ej. su rol quedó inactivo) se muestra vacío y hay que elegir otro.
class _SelectorRol extends StatelessWidget {
  const _SelectorRol({
    required this.roles,
    required this.valor,
    required this.onChanged,
    this.errorText,
  });

  final List<RolStaff> roles;
  final String? valor;
  final ValueChanged<String?> onChanged;
  final String? errorText;

  @override
  Widget build(BuildContext context) {
    return DropdownButtonFormField<String>(
      key: const Key('usuario-rol'),
      initialValue: roles.any((r) => r.id == valor) ? valor : null,
      isExpanded: true,
      hint: const Text('Selecciona…'),
      decoration: InputDecoration(
        labelText: 'Rol de staff',
        errorText: errorText,
        errorMaxLines: 4,
      ),
      items: [
        for (final r in roles)
          DropdownMenuItem(
            value: r.id,
            child: Text(etiquetaRol(r), overflow: TextOverflow.ellipsis),
          ),
      ],
      onChanged: onChanged,
    );
  }
}

// ── Alta ────────────────────────────────────────────────────────────────────

/// Abre el alta de usuario `admin_plaza`. La contraseña temporal se muestra
/// una sola vez; el diálogo no se cierra tocando fuera para no perderla.
Future<void> mostrarAltaUsuarioPlaza(
  BuildContext context,
  List<RolStaff> roles,
) => showDialog<void>(
  context: context,
  barrierDismissible: false,
  builder: (_) => AltaUsuarioPlazaDialog(roles: roles),
);

/// Espejo de `alta-usuario-plaza-dialog.tsx`.
class AltaUsuarioPlazaDialog extends ConsumerStatefulWidget {
  const AltaUsuarioPlazaDialog({super.key, required this.roles});

  final List<RolStaff> roles;

  @override
  ConsumerState<AltaUsuarioPlazaDialog> createState() =>
      _AltaUsuarioPlazaDialogState();
}

class _AltaUsuarioPlazaDialogState
    extends ConsumerState<AltaUsuarioPlazaDialog> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _nombre = TextEditingController();
  final _telefono = TextEditingController();
  String? _rolId;
  String? _errorRol;
  String? _errorEmail;
  ApiError? _error;
  bool _guardando = false;
  String? _password;

  @override
  void dispose() {
    _email.dispose();
    _nombre.dispose();
    _telefono.dispose();
    super.dispose();
  }

  Future<void> _crear() async {
    final valido = _form.currentState!.validate();
    setState(() {
      _errorRol = _rolId == null ? 'Selecciona un rol de staff' : null;
      _errorEmail = null;
      _error = null;
    });
    if (!valido || _rolId == null) return;
    setState(() => _guardando = true);
    try {
      final password = await crearUsuarioPlaza(
        ref.read(apiClientProvider),
        email: _email.text,
        nombre: _nombre.text.trim(),
        telefono: textoOpcional(_telefono.text),
        rolStaffId: _rolId!,
      );
      if (!mounted) return;
      invalidarUsuarios(ref);
      mostrarExito(context, 'Usuario creado; se envió el email de bienvenida');
      setState(() => _password = password);
    } on ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        if (e.code == 'USUARIO_EMAIL_DUPLICADO') {
          _errorEmail = e.mensaje;
        } else if (_erroresDeRol.contains(e.code)) {
          _errorRol = e.mensaje;
        } else {
          _error = e;
        }
      });
    } finally {
      if (mounted) setState(() => _guardando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final password = _password;
    const titulo = Text('Nuevo usuario admin_plaza');
    if (password != null) {
      final c = ColoresPlazapp.of(context);
      return AlertDialog(
        scrollable: true,
        title: titulo,
        content: _cuerpo([
          Text(
            'Usuario creado. Comparte esta contraseña temporal de forma '
            'segura — no se volverá a mostrar:',
            style: TextStyle(color: c.text2),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: c.surface3,
              borderRadius: BorderRadius.circular(7),
            ),
            child: SelectableText(
              password,
              key: const Key('alta-password'),
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontFamily: 'monospace',
                fontSize: 18,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          const SizedBox(height: 8),
          Align(
            child: TextButton.icon(
              onPressed: () async {
                await Clipboard.setData(ClipboardData(text: password));
                if (context.mounted) {
                  mostrarExito(context, 'Contraseña copiada');
                }
              },
              icon: const Icon(Icons.copy, size: 18),
              label: const Text('Copiar'),
            ),
          ),
        ]),
        actions: [
          FilledButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Entendido'),
          ),
        ],
      );
    }
    return AlertDialog(
      scrollable: true,
      title: titulo,
      content: Form(
        key: _form,
        child: _cuerpo([
          Text(
            'Crea un nuevo administrador de la plaza. Se le asignará un rol de '
            'staff y se le enviará un email de bienvenida.',
            style: TextStyle(color: ColoresPlazapp.of(context).text3),
          ),
          const SizedBox(height: 12),
          if (_error != null) ...[
            AvisoBanner(tono: Tono.danger, child: Text(_error!.mensaje)),
            const SizedBox(height: 12),
          ],
          TextFormField(
            key: const Key('alta-email'),
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            autocorrect: false,
            decoration: InputDecoration(
              labelText: 'Email',
              errorText: _errorEmail,
            ),
            validator: validarEmailObligatorio,
          ),
          const SizedBox(height: 12),
          TextFormField(
            key: const Key('alta-nombre'),
            controller: _nombre,
            maxLength: 120,
            decoration: const InputDecoration(labelText: 'Nombre'),
            validator: _requerido,
          ),
          const SizedBox(height: 4),
          TextFormField(
            key: const Key('alta-telefono'),
            controller: _telefono,
            keyboardType: TextInputType.phone,
            maxLength: 40,
            decoration: const InputDecoration(labelText: 'Teléfono (opcional)'),
          ),
          const SizedBox(height: 4),
          _SelectorRol(
            roles: widget.roles,
            valor: _rolId,
            errorText: _errorRol,
            onChanged: (v) => setState(() {
              _rolId = v;
              _errorRol = null;
            }),
          ),
        ]),
      ),
      actions: [
        TextButton(
          onPressed: _guardando ? null : () => Navigator.of(context).pop(),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          key: const Key('alta-crear'),
          onPressed: _guardando ? null : _crear,
          child: Text(_guardando ? 'Creando…' : 'Crear usuario'),
        ),
      ],
    );
  }
}

// ── Edición ─────────────────────────────────────────────────────────────────

/// Edita nombre, teléfono y rol de staff. Muestra "Usuario actualizado" e
/// invalida las listas si se guardó. Si el editado es el usuario de la
/// sesión, también relee su sesión (nombre, rol de staff y permisos).
Future<void> editarUsuarioPlaza(
  BuildContext context,
  WidgetRef ref,
  UsuarioPlaza usuario,
  List<RolStaff> roles,
) async {
  final guardado = await showDialog<bool>(
    context: context,
    builder: (_) => EditarUsuarioPlazaDialog(usuario: usuario, roles: roles),
  );
  if (guardado != true || !context.mounted) return;
  mostrarExito(context, 'Usuario actualizado');
  invalidarUsuarios(ref);
  if (ref.read(sesionProvider).value?.usuario.id == usuario.id) {
    await ref.read(sesionProvider.notifier).recargar();
  }
}

/// Espejo de `editar-usuario-plaza-dialog.tsx`. El cambio de rol lo aplica el
/// backend (fix F5); sus errores se muestran bajo el selector.
class EditarUsuarioPlazaDialog extends ConsumerStatefulWidget {
  const EditarUsuarioPlazaDialog({
    super.key,
    required this.usuario,
    required this.roles,
  });

  final UsuarioPlaza usuario;
  final List<RolStaff> roles;

  @override
  ConsumerState<EditarUsuarioPlazaDialog> createState() =>
      _EditarUsuarioPlazaDialogState();
}

class _EditarUsuarioPlazaDialogState
    extends ConsumerState<EditarUsuarioPlazaDialog> {
  final _form = GlobalKey<FormState>();
  late final _nombre = TextEditingController(text: widget.usuario.nombre);
  late final _telefono = TextEditingController(text: widget.usuario.telefono);
  late String? _rolId =
      widget.roles.any((r) => r.id == widget.usuario.rolStaffId)
      ? widget.usuario.rolStaffId
      : null;
  String? _errorRol;
  ApiError? _error;
  bool _guardando = false;

  @override
  void dispose() {
    _nombre.dispose();
    _telefono.dispose();
    super.dispose();
  }

  Future<void> _guardar() async {
    final valido = _form.currentState!.validate();
    setState(() {
      _errorRol = _rolId == null ? 'Selecciona un rol de staff' : null;
      _error = null;
    });
    if (!valido || _rolId == null) return;
    setState(() => _guardando = true);
    try {
      await actualizarUsuarioPlaza(
        ref.read(apiClientProvider),
        widget.usuario.id,
        nombre: _nombre.text.trim(),
        telefono: textoOpcional(_telefono.text),
        rolStaffId: _rolId!,
      );
      if (mounted) Navigator.of(context).pop(true);
    } on ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        _guardando = false;
        if (_erroresDeRol.contains(e.code)) {
          _errorRol = e.mensaje;
        } else {
          _error = e;
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      scrollable: true,
      title: const Text('Editar usuario'),
      content: Form(
        key: _form,
        child: _cuerpo([
          Text.rich(
            TextSpan(
              text: 'Modifica nombre, teléfono y rol de staff de ',
              children: [
                TextSpan(
                  text: widget.usuario.email,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
                const TextSpan(text: '.'),
              ],
            ),
            style: TextStyle(color: ColoresPlazapp.of(context).text3),
          ),
          const SizedBox(height: 12),
          if (_error != null) ...[
            AvisoBanner(tono: Tono.danger, child: Text(_error!.mensaje)),
            const SizedBox(height: 12),
          ],
          TextFormField(
            key: const Key('editar-nombre'),
            controller: _nombre,
            maxLength: 120,
            decoration: const InputDecoration(labelText: 'Nombre'),
            validator: _requerido,
          ),
          const SizedBox(height: 4),
          TextFormField(
            key: const Key('editar-telefono'),
            controller: _telefono,
            keyboardType: TextInputType.phone,
            maxLength: 40,
            decoration: const InputDecoration(
              labelText: 'Teléfono (opcional)',
              hintText: '+52 55 1234 5678',
            ),
          ),
          const SizedBox(height: 4),
          _SelectorRol(
            roles: widget.roles,
            valor: _rolId,
            errorText: _errorRol,
            onChanged: (v) => setState(() {
              _rolId = v;
              _errorRol = null;
            }),
          ),
        ]),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          key: const Key('editar-guardar'),
          onPressed: _guardando ? null : _guardar,
          child: Text(_guardando ? 'Guardando…' : 'Guardar'),
        ),
      ],
    );
  }
}

// ── Acciones de fila ────────────────────────────────────────────────────────

/// Envía el email de reseteo de contraseña (enlace válido 30 min).
Future<void> resetearClaveUsuarioPlaza(
  BuildContext context,
  WidgetRef ref,
  UsuarioPlaza u,
) async {
  final ok = await confirmar(
    context,
    titulo: '¿Enviar email de reseteo de contraseña?',
    mensaje:
        'Se enviará a ${u.email} un enlace válido por 30 minutos para que '
        'fije una nueva contraseña.',
    textoConfirmar: 'Sí, enviar',
  );
  if (!ok || !context.mounted) return;
  try {
    await resetearClaveUsuario(ref.read(apiClientProvider), u.id);
    if (context.mounted) {
      mostrarExito(context, 'Email de reseteo enviado al usuario');
    }
  } catch (e) {
    // USUARIO_EMAIL_INVALIDO (hard bounce) trae su detalle.
    if (context.mounted) mostrarError(context, e);
  }
}

/// Deshabilita con motivo obligatorio (3..500, queda en auditoría).
Future<void> deshabilitarUsuarioPlaza(
  BuildContext context,
  WidgetRef ref,
  UsuarioPlaza u,
) async {
  final motivo = await pedirTexto(
    context,
    titulo: '¿Deshabilitar a ${u.nombre}?',
    mensaje:
        '${u.email}. El usuario no podrá iniciar sesión ni tomar decisiones '
        'sobre solicitudes. Puedes reactivarlo después. Indica el motivo '
        '(queda registrado en auditoría).',
    hint: 'Motivo (obligatorio)',
    textoConfirmar: 'Sí, deshabilitar',
    obligatorio: true,
    destructiva: true,
    maxLength: 500,
  );
  if (motivo == null || !context.mounted) return;
  if (motivo.length < 3) {
    mostrarError(context, 'Indica el motivo (mínimo 3 caracteres).');
    return;
  }
  try {
    await deshabilitarUsuario(ref.read(apiClientProvider), u.id, motivo);
    if (!context.mounted) return;
    mostrarExito(context, 'Usuario deshabilitado');
    invalidarUsuarios(ref);
  } catch (e) {
    // ULTIMO_ADMIN_ACTIVO trae su detalle.
    if (context.mounted) mostrarError(context, e);
  }
}

/// Reactiva un usuario deshabilitado.
Future<void> reactivarUsuarioPlaza(
  BuildContext context,
  WidgetRef ref,
  UsuarioPlaza u,
) async {
  final ok = await confirmar(
    context,
    titulo: '¿Reactivar a "${u.nombre}"?',
    mensaje:
        '${u.email}\n\nVolverá a poder iniciar sesión y tomar/decidir '
        'solicitudes.',
    textoConfirmar: 'Sí, reactivar',
  );
  if (!ok || !context.mounted) return;
  try {
    await reactivarUsuario(ref.read(apiClientProvider), u.id);
    if (!context.mounted) return;
    mostrarExito(context, 'Usuario reactivado');
    invalidarUsuarios(ref);
  } catch (e) {
    if (context.mounted) mostrarError(context, e);
  }
}

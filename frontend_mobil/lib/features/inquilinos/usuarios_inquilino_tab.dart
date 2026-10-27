import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_error.dart';
import '../../core/api/api_providers.dart';
import '../../core/format/fechas.dart';
import '../../core/theme/colores.dart';
import '../../core/widgets/avisos.dart';
import '../../core/widgets/badges.dart';
import '../../core/widgets/can.dart';
import '../../core/widgets/dialogos.dart';
import '../../core/widgets/estados.dart';
import '../../core/widgets/lista_responsive.dart';
import '../contratos/catalogo_comun.dart';
import 'inquilinos_api.dart';
import 'inquilinos_modelos.dart';
import 'inquilinos_providers.dart';
import '../../core/format/validaciones.dart';

/// Pestaña "Usuarios" del detalle de inquilino (espejo de
/// `usuarios-inquilino-table.tsx`). A diferencia del web, cada acción se
/// oculta sin su permiso (bug B1-R6) y la lista se recarga tras editar
/// (bug B1-R15).
class UsuariosInquilinoTab extends ConsumerWidget {
  const UsuariosInquilinoTab({super.key, required this.inquilinoId});

  final String inquilinoId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final usuarios = ref.watch(usuariosInquilinoProvider(inquilinoId));
    final conAcciones = puedeHacer(ref, const [
      'inquilinos.editar',
      'inquilinos.resetear_clave',
      'inquilinos.deshabilitar_usuario',
      'inquilinos.reactivar_usuario',
    ]);
    return AsyncView(
      value: usuarios,
      onRetry: () => ref.invalidate(usuariosInquilinoProvider(inquilinoId)),
      data: (lista) => ListaResponsive<UsuarioInquilino>(
        items: lista,
        vacio: const EmptyState(
          icono: Icons.person_off_outlined,
          titulo: 'Sin usuarios',
          mensaje:
              'Este inquilino aún no tiene accesos al portal. Usa «Alta '
              'rápida de usuario» para crear el primero.',
        ),
        columnas: [
          ColumnaLista(
            titulo: 'Nombre',
            principal: true,
            celda: (u) => Text(
              u.nombre,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
          ColumnaLista(
            titulo: 'Email',
            celda: (u) => TextoCelda(u.email, mono: true),
          ),
          ColumnaLista(
            titulo: 'Teléfono',
            celda: (u) => TextoCelda(u.telefono),
          ),
          ColumnaLista(
            titulo: 'Rol staff',
            celda: (u) => TextoCelda(u.rolStaffNombre),
          ),
          ColumnaLista(
            titulo: 'Último acceso',
            celda: (u) => TextoCelda(
              u.lastLoginAt == null ? 'Nunca' : formatFechaHora(u.lastLoginAt),
            ),
          ),
          ColumnaLista(titulo: 'Estado', celda: (u) => _EstadoUsuario(u)),
        ],
        acciones: conAcciones
            ? (u) => _AccionesUsuario(usuario: u, inquilinoId: inquilinoId)
            : null,
      ),
    );
  }
}

class _EstadoUsuario extends StatelessWidget {
  const _EstadoUsuario(this.usuario);
  final UsuarioInquilino usuario;

  @override
  Widget build(BuildContext context) {
    if (!usuario.activo) return const BadgePlazapp('Inactivo', Tono.neutral);
    if (usuario.emailInvalido) {
      return const BadgePlazapp('Email inválido', Tono.warn);
    }
    return const BadgePlazapp('Activo', Tono.ok);
  }
}

class _AccionesUsuario extends ConsumerStatefulWidget {
  const _AccionesUsuario({required this.usuario, required this.inquilinoId});

  final UsuarioInquilino usuario;
  final String inquilinoId;

  @override
  ConsumerState<_AccionesUsuario> createState() => _AccionesUsuarioState();
}

class _AccionesUsuarioState extends ConsumerState<_AccionesUsuario> {
  bool _ocupado = false;

  UsuarioInquilino get _u => widget.usuario;

  /// Confirma, ejecuta [accion] y recarga la lista.
  Future<void> _ejecutar({
    required String titulo,
    required String mensaje,
    required String textoConfirmar,
    required String exito,
    required Future<void> Function() accion,
    bool destructiva = false,
  }) async {
    final ok = await confirmar(
      context,
      titulo: titulo,
      mensaje: mensaje,
      textoConfirmar: textoConfirmar,
      destructiva: destructiva,
    );
    if (!ok || !mounted) return;
    setState(() => _ocupado = true);
    try {
      await accion();
      if (!mounted) return;
      mostrarExito(context, exito);
      ref.invalidate(usuariosInquilinoProvider(widget.inquilinoId));
    } on Object catch (e) {
      if (mounted) mostrarError(context, e);
    } finally {
      if (mounted) setState(() => _ocupado = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final api = ref.read(apiClientProvider);
    final error = Theme.of(context).colorScheme.error;
    final compacto = OutlinedButton.styleFrom(
      visualDensity: VisualDensity.compact,
      minimumSize: const Size(0, 36),
    );
    if (!_u.activo) {
      return Can(
        permiso: 'inquilinos.reactivar_usuario',
        child: OutlinedButton.icon(
          style: compacto,
          onPressed: _ocupado
              ? null
              : () => _ejecutar(
                  titulo: '¿Reactivar a "${_u.nombre}"?',
                  mensaje: '${_u.email}\n\nVolverá a poder iniciar sesión.',
                  textoConfirmar: 'Sí, reactivar',
                  exito: 'Usuario reactivado',
                  accion: () => reactivarUsuario(api, _u.id),
                ),
          icon: const Icon(Icons.power_settings_new, size: 18),
          label: Text(_ocupado ? 'Reactivando…' : 'Reactivar'),
        ),
      );
    }
    return Wrap(
      spacing: 6,
      runSpacing: 6,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        Can(
          permiso: 'inquilinos.editar',
          child: IconButton(
            tooltip: 'Editar ${_u.email}',
            visualDensity: VisualDensity.compact,
            onPressed: _ocupado
                ? null
                : () => mostrarEditarUsuario(
                    context,
                    usuario: _u,
                    inquilinoId: widget.inquilinoId,
                  ),
            icon: const Icon(Icons.edit_outlined, size: 20),
          ),
        ),
        Can(
          permiso: 'inquilinos.resetear_clave',
          child: OutlinedButton.icon(
            style: compacto,
            onPressed: _ocupado
                ? null
                : () => _ejecutar(
                    titulo: '¿Enviar email de reseteo de contraseña?',
                    mensaje:
                        'Se enviará a ${_u.email} un enlace válido por 30 '
                        'minutos para que fije una nueva contraseña.',
                    textoConfirmar: 'Sí, enviar',
                    exito: 'Email de reseteo enviado al usuario',
                    accion: () => resetearClaveUsuario(api, _u.id),
                  ),
            icon: const Icon(Icons.key_outlined, size: 18),
            label: const Text('Resetear clave'),
          ),
        ),
        Can(
          permiso: 'inquilinos.deshabilitar_usuario',
          child: OutlinedButton.icon(
            style: compacto.copyWith(
              foregroundColor: WidgetStatePropertyAll(error),
            ),
            onPressed: _ocupado
                ? null
                : () => _ejecutar(
                    titulo: '¿Deshabilitar a "${_u.nombre}"?',
                    mensaje:
                        '${_u.email}\n\nEl usuario no podrá iniciar sesión. '
                        'Sus datos se conservan y puedes reactivarlo después.',
                    textoConfirmar: 'Sí, deshabilitar',
                    exito: 'Usuario deshabilitado',
                    destructiva: true,
                    accion: () => deshabilitarUsuario(api, _u.id),
                  ),
            icon: const Icon(Icons.power_off_outlined, size: 18),
            label: const Text('Deshabilitar'),
          ),
        ),
      ],
    );
  }
}

// ── Diálogos ────────────────────────────────────────────────────────────────

/// "Alta rápida de usuario": crea el acceso del inquilino al portal y muestra
/// la contraseña temporal UNA sola vez (al cerrar el diálogo se descarta).
Future<void> mostrarAltaUsuario(
  BuildContext context, {
  required Inquilino inquilino,
}) => showDialog<void>(
  context: context,
  builder: (_) => _AltaUsuarioDialog(inquilino: inquilino),
);

class _AltaUsuarioDialog extends ConsumerStatefulWidget {
  const _AltaUsuarioDialog({required this.inquilino});

  final Inquilino inquilino;

  @override
  ConsumerState<_AltaUsuarioDialog> createState() => _AltaUsuarioDialogState();
}

class _AltaUsuarioDialogState extends ConsumerState<_AltaUsuarioDialog> {
  final _form = GlobalKey<FormState>();
  late final _email = TextEditingController(
    text: widget.inquilino.contacto1Email ?? '',
  );
  late final _nombre = TextEditingController(
    text: widget.inquilino.contacto1Nombre ?? '',
  );
  bool _enviando = false;
  String? _errorEmail;

  /// Solo vive mientras el diálogo está abierto.
  String? _password;

  @override
  void dispose() {
    _email.dispose();
    _nombre.dispose();
    super.dispose();
  }

  Future<void> _crear() async {
    setState(() => _errorEmail = null);
    if (!_form.currentState!.validate()) return;
    setState(() => _enviando = true);
    try {
      final password = await altaUsuarioInquilino(
        ref.read(apiClientProvider),
        inquilinoId: widget.inquilino.id,
        email: _email.text,
        nombre: _nombre.text,
      );
      if (!mounted) return;
      mostrarExito(context, 'Usuario creado; se envió el email de bienvenida');
      ref.invalidate(usuariosInquilinoProvider(widget.inquilino.id));
      setState(() => _password = password);
    } on ApiError catch (e) {
      if (!mounted) return;
      if (e.code == 'USUARIO_EMAIL_DUPLICADO') {
        setState(() => _errorEmail = e.mensaje);
      } else {
        mostrarError(context, e);
      }
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  Future<void> _copiar() async {
    await Clipboard.setData(ClipboardData(text: _password!));
    if (mounted) mostrarExito(context, 'Contraseña copiada');
  }

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    final password = _password;
    return AlertDialog(
      title: Text('Usuario para ${widget.inquilino.razonSocial}'),
      content: SingleChildScrollView(
        child: password != null
            ? Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
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
                      borderRadius: BorderRadius.circular(10),
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
                ],
              )
            : Form(
                key: _form,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'Crea el acceso del inquilino al portal (rol «inquilino»).',
                      style: TextStyle(color: c.text2),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      key: const Key('alta-email'),
                      controller: _email,
                      keyboardType: TextInputType.emailAddress,
                      validator: (v) => (v ?? '').trim().isEmpty
                          ? 'Email inválido'
                          : validarEmailOpcional(v),
                      decoration: InputDecoration(
                        labelText: 'Email',
                        errorText: _errorEmail,
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      key: const Key('alta-nombre'),
                      controller: _nombre,
                      inputFormatters: [LengthLimitingTextInputFormatter(120)],
                      validator: (v) =>
                          (v ?? '').trim().isEmpty ? 'Requerido' : null,
                      decoration: const InputDecoration(labelText: 'Nombre'),
                    ),
                  ],
                ),
              ),
      ),
      actions: password != null
          ? [
              OutlinedButton.icon(
                key: const Key('alta-copiar'),
                onPressed: _copiar,
                icon: const Icon(Icons.copy, size: 18),
                label: const Text('Copiar'),
              ),
              FilledButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Entendido'),
              ),
            ]
          : [
              TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Cancelar'),
              ),
              FilledButton(
                key: const Key('alta-crear'),
                onPressed: _enviando ? null : _crear,
                child: Text(_enviando ? 'Creando…' : 'Crear usuario'),
              ),
            ],
    );
  }
}

/// "Editar usuario": nombre y teléfono (el email no se cambia).
Future<void> mostrarEditarUsuario(
  BuildContext context, {
  required UsuarioInquilino usuario,
  required String inquilinoId,
}) => showDialog<void>(
  context: context,
  builder: (_) =>
      _EditarUsuarioDialog(usuario: usuario, inquilinoId: inquilinoId),
);

class _EditarUsuarioDialog extends ConsumerStatefulWidget {
  const _EditarUsuarioDialog({
    required this.usuario,
    required this.inquilinoId,
  });

  final UsuarioInquilino usuario;
  final String inquilinoId;

  @override
  ConsumerState<_EditarUsuarioDialog> createState() =>
      _EditarUsuarioDialogState();
}

class _EditarUsuarioDialogState extends ConsumerState<_EditarUsuarioDialog> {
  final _form = GlobalKey<FormState>();
  late final _nombre = TextEditingController(text: widget.usuario.nombre);
  late final _telefono = TextEditingController(
    text: widget.usuario.telefono ?? '',
  );
  bool _enviando = false;

  @override
  void dispose() {
    _nombre.dispose();
    _telefono.dispose();
    super.dispose();
  }

  Future<void> _guardar() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _enviando = true);
    final navigator = Navigator.of(context);
    try {
      await editarUsuarioInquilino(
        ref.read(apiClientProvider),
        widget.usuario.id,
        nombre: _nombre.text,
        telefono: _telefono.text,
      );
      if (!mounted) return;
      mostrarExito(context, 'Usuario actualizado');
      ref.invalidate(usuariosInquilinoProvider(widget.inquilinoId));
      navigator.pop();
    } on Object catch (e) {
      if (mounted) mostrarError(context, e);
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Editar usuario'),
      content: SingleChildScrollView(
        child: Form(
          key: _form,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Modifica el nombre y teléfono de ${widget.usuario.email}.'),
              const SizedBox(height: 12),
              TextFormField(
                key: const Key('editar-usuario-nombre'),
                controller: _nombre,
                inputFormatters: [LengthLimitingTextInputFormatter(120)],
                validator: (v) => (v ?? '').trim().isEmpty ? 'Requerido' : null,
                decoration: const InputDecoration(labelText: 'Nombre'),
              ),
              const SizedBox(height: 12),
              TextFormField(
                key: const Key('editar-usuario-telefono'),
                controller: _telefono,
                keyboardType: TextInputType.phone,
                validator: (v) => (v ?? '').trim().length > 40
                    ? 'Máximo 40 caracteres'
                    : null,
                decoration: const InputDecoration(
                  labelText: 'Teléfono (opcional)',
                  hintText: '+52 55 1234 5678',
                ),
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          key: const Key('editar-usuario-guardar'),
          onPressed: _enviando ? null : _guardar,
          child: Text(_enviando ? 'Guardando…' : 'Guardar'),
        ),
      ],
    );
  }
}

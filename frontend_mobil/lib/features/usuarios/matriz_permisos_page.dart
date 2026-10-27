import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_error.dart';
import '../../core/api/api_providers.dart';
import '../../core/auth/sesion_controller.dart';
import '../../core/theme/colores.dart';
import '../../core/widgets/avisos.dart';
import '../../core/widgets/badges.dart';
import '../../core/widgets/can.dart';
import '../../core/widgets/dialogos.dart';
import '../../core/widgets/estados.dart';
import '../../core/widgets/pagina.dart';
import 'usuarios_api.dart';
import 'usuarios_modelos.dart';
import 'usuarios_providers.dart';

/// Permisos para ver la página (OR), igual que el web.
const _permisosVer = ['permisos.ver_matriz', 'roles_staff.gestionar_permisos'];

/// Permisos para guardar cambios (OR).
const _permisosGuardar = [
  'roles_staff.gestionar_permisos',
  'permisos.asignar_a_roles',
];

/// `/admin/usuarios-plaza/permisos` — matriz rol × permiso. En móvil se usa
/// el modo compacto del web en todos los tamaños: se elige un rol y se marcan
/// sus permisos por módulo. "Guardar cambios" reemplaza el set completo del
/// rol (`PUT /permisos/roles/:id`). El rol de sistema queda bloqueado.
/// Espejo de `usuarios-plaza/permisos/page.tsx` + `matriz-permisos.tsx`.
class MatrizPermisosPage extends ConsumerWidget {
  const MatrizPermisosPage({super.key});

  static const _encabezado = EncabezadoPagina(
    titulo: 'Permisos de roles',
    subtitulo:
        'Asigna permisos granulares a cada rol de la plaza. Los cambios '
        'afectan a todos los usuarios que tengan el rol.',
    rutaVolver: '/admin/usuarios-plaza?tab=permisos',
  );

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sesion = ref.watch(sesionProvider).value;
    if (sesion == null || !sesion.puede(_permisosVer)) {
      return const ContenidoPagina(children: [_encabezado, _SinAcceso()]);
    }
    final datos = ref.watch(matrizPermisosProvider);
    return ContenidoPagina(
      onRefresh: () => ref.refresh(matrizPermisosProvider.future),
      children: [
        _encabezado,
        const _Convenciones(),
        AsyncView(
          value: datos,
          onRetry: () => ref.invalidate(matrizPermisosProvider),
          // Datos nuevos (recarga) = se descartan los cambios sin guardar.
          data: (d) => _Matriz(key: ObjectKey(d), datos: d),
        ),
      ],
    );
  }
}

class _SinAcceso extends StatelessWidget {
  const _SinAcceso();

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Sin acceso', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            Text(
              'Permiso denegado: requiere ${_permisosVer.join(' o ')}',
              style: TextStyle(color: c.text3),
            ),
            const SizedBox(height: 8),
            Text(
              'Para gestionar permisos necesitas el permiso '
              'permisos.ver_matriz (o roles_staff.gestionar_permisos). '
              'Pídele a un administrador con rol "admin" que te lo asigne.',
              style: TextStyle(color: c.text3),
            ),
          ],
        ),
      ),
    );
  }
}

class _Convenciones extends StatelessWidget {
  const _Convenciones();

  static const _puntos = [
    'El rol admin es del sistema e inamovible. Siempre tiene todos los '
        'permisos del catálogo.',
    'Los permisos del catálogo se actualizan ejecutando npx prisma db seed; '
        'el seed es idempotente.',
    'Los cambios en permisos de un rol afectan a TODOS los usuarios con ese '
        'rol (pueden perder acceso a pantallas si les quitas un permiso).',
    'Añadir un nuevo permiso al catálogo requiere también aplicarlo en los '
        'endpoints via @RequirePermission(...) y en los Server Actions con '
        'assertCan(...).',
  ];

  /// En el web es una tarjeta fija; en el teléfono se pliega para que la
  /// matriz quede a la vista (mismos textos).
  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Card(
        color: c.surface2,
        clipBehavior: Clip.antiAlias,
        child: ExpansionTile(
          shape: const Border(),
          collapsedShape: const Border(),
          childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
          expandedCrossAxisAlignment: CrossAxisAlignment.start,
          title: const Text(
            'Convenciones del sistema RBAC',
            style: TextStyle(fontWeight: FontWeight.w600),
          ),
          children: [
            for (final p in _puntos)
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Text('• $p', style: TextStyle(color: c.text3)),
              ),
          ],
        ),
      ),
    );
  }
}

class _Matriz extends ConsumerStatefulWidget {
  const _Matriz({super.key, required this.datos});

  final DatosMatriz datos;

  @override
  ConsumerState<_Matriz> createState() => _MatrizState();
}

class _MatrizState extends ConsumerState<_Matriz> {
  /// Último estado guardado por rol (para saber qué cambió).
  late final Map<String, Set<String>> _inicial = _copiar(
    widget.datos.permisosPorRol,
  );

  /// Cambios en curso por rol.
  late final Map<String, Set<String>> _borrador = _copiar(
    widget.datos.permisosPorRol,
  );
  final _buscar = TextEditingController();
  final Set<String> _guardando = {};
  String? _rolId;

  static Map<String, Set<String>> _copiar(Map<String, Set<String>> m) => {
    for (final e in m.entries) e.key: {...e.value},
  };

  List<RolStaff> get _roles => widget.datos.roles;

  bool _esSistema(String rolId) => widget.datos.rolesSistema.contains(rolId);

  bool _sucio(String rolId) =>
      !setEquals(_inicial[rolId] ?? const {}, _borrador[rolId] ?? const {});

  /// Rol elegido; por defecto el primero que no es de sistema.
  RolStaff get _rolActivo =>
      _roles.where((r) => r.id == _rolId).firstOrNull ??
      _roles.where((r) => !_esSistema(r.id)).firstOrNull ??
      _roles.first;

  @override
  void initState() {
    super.initState();
    _buscar.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _buscar.dispose();
    super.dispose();
  }

  List<ModuloPermisos> get _modulosFiltrados {
    final q = _buscar.text.trim().toLowerCase();
    return [
      for (final m in widget.datos.catalogo.modulos)
        ModuloPermisos(
          modulo: m.modulo,
          permisos: q.isEmpty
              ? m.permisos
              : m.permisos
                    .where(
                      (p) =>
                          p.codigo.toLowerCase().contains(q) ||
                          (p.descripcion?.toLowerCase().contains(q) ?? false) ||
                          p.accion.toLowerCase().contains(q),
                    )
                    .toList(),
        ),
    ].where((m) => m.permisos.isNotEmpty).toList();
  }

  void _marcar(String rolId, Iterable<String> permisoIds, bool marcado) {
    setState(() {
      final set = _borrador.putIfAbsent(rolId, () => {});
      marcado ? set.addAll(permisoIds) : set.removeAll(permisoIds);
    });
  }

  void _descartar(String rolId) =>
      setState(() => _borrador[rolId] = {...?_inicial[rolId]});

  String _mensajeError(ApiError e) => switch (e.code) {
    'ROL_SISTEMA_NO_MODIFICABLE' =>
      'El rol del sistema es inamovible. No se pueden modificar sus permisos.',
    'PERMISO_NO_ENCONTRADO' || 'ROL_STAFF_NO_ENCONTRADO' => 'Algunos permisos o el rol seleccionado ya no existen. Recarga la página.',
    'PERMISSION_DENIED' =>
      'No tienes permiso para modificar permisos de roles.',
    _ when e.status == 0 => e.mensaje,
    _ => 'Error al guardar permisos (${e.status}).',
  };

  Future<void> _guardar(RolStaff rol) async {
    if (_esSistema(rol.id)) return;
    final ids = {...?_borrador[rol.id]};
    final ok = await confirmar(
      context,
      titulo: '¿Guardar permisos del rol "${rol.nombre}"?',
      mensaje: ids.isEmpty
          ? 'El rol quedará sin permisos asignados (los usuarios con este rol '
                'no podrán hacer nada).'
          : 'Se asignarán ${ids.length} permiso(s). Los cambios afectan a '
                'TODOS los usuarios con este rol.',
      textoConfirmar: 'Sí, guardar',
      destructiva: true,
    );
    if (!ok || !mounted) return;
    setState(() => _guardando.add(rol.id));
    try {
      await guardarPermisosDeRol(ref.read(apiClientProvider), rol.id, ids);
      if (!mounted) return;
      setState(() => _inicial[rol.id] = ids);
      mostrarExito(context, 'Permisos del rol "${rol.nombre}" actualizados');
      // Si es el rol del propio usuario, sus permisos cambian al instante.
      final sesion = ref.read(sesionProvider).value;
      if (sesion?.usuario.rolStaffId == rol.id) {
        try {
          await ref.read(sesionProvider.notifier).refrescarPermisos();
        } on ApiError {
          // Se vuelven a leer al regresar la app a primer plano.
        }
      }
    } on ApiError catch (e) {
      if (mounted) mostrarError(context, _mensajeError(e));
    } finally {
      if (mounted) setState(() => _guardando.remove(rol.id));
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    if (_roles.isEmpty) {
      return const Card(
        child: EmptyState(
          icono: Icons.verified_user_outlined,
          titulo: 'Sin roles de staff',
          mensaje:
              'Crea primero un rol en la pestaña «Roles de staff». Luego '
              'podrás asignarle permisos aquí.',
        ),
      );
    }
    final puedeEditar =
        ref.watch(sesionProvider).value?.puede(_permisosGuardar) ?? false;
    final rol = _rolActivo;
    final sistema = _esSistema(rol.id);
    final editable = puedeEditar && !sistema;
    final asignados = _borrador[rol.id] ?? const <String>{};
    final pendientes = _roles
        .where((r) => !_esSistema(r.id) && _sucio(r.id))
        .toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          key: const Key('matriz-buscar'),
          controller: _buscar,
          decoration: const InputDecoration(
            hintText: 'Buscar permiso (código o descripción)…',
            prefixIcon: Icon(Icons.search),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          '${widget.datos.catalogo.total} permisos · ${_roles.length} rol(es) '
          '· ${widget.datos.rolesSistema.length} de sistema',
          style: TextStyle(color: c.text3, fontSize: 13),
        ),
        const SizedBox(height: 12),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                DropdownButtonFormField<String>(
                  key: const Key('matriz-rol'),
                  initialValue: rol.id,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Rol a editar'),
                  items: [
                    for (final r in _roles)
                      DropdownMenuItem(
                        value: r.id,
                        child: Text(
                          '${r.nombre}${_esSistema(r.id) ? ' (sistema)' : ''}',
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                  ],
                  onChanged: (v) => setState(() => _rolId = v),
                ),
                if (sistema) ...[
                  const SizedBox(height: 8),
                  Text(
                    'El rol del sistema es inamovible: siempre tiene todos '
                    'los permisos.',
                    style: TextStyle(color: c.text3, fontSize: 12.5),
                  ),
                ] else if (_sucio(rol.id)) ...[
                  const SizedBox(height: 8),
                  const BadgePlazapp('Cambios sin guardar', Tono.warn),
                ],
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        for (final m in _modulosFiltrados)
          _ModuloCard(
            modulo: m,
            asignados: asignados,
            mostrarTodos: !sistema,
            editable: editable,
            onMarcar: (ids, marcado) => _marcar(rol.id, ids, marcado),
          ),
        Can(
          permiso: _permisosGuardar,
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${pendientes.length} rol(es) con cambios pendientes',
                    style: TextStyle(color: c.text3),
                  ),
                  for (final r in pendientes)
                    Padding(
                      padding: const EdgeInsets.only(top: 10),
                      child: Wrap(
                        spacing: 8,
                        runSpacing: 6,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          Text(
                            '${r.nombre}:',
                            style: const TextStyle(fontWeight: FontWeight.w500),
                          ),
                          TextButton.icon(
                            onPressed: _guardando.contains(r.id)
                                ? null
                                : () => _descartar(r.id),
                            icon: const Icon(Icons.restart_alt, size: 18),
                            label: const Text('Descartar'),
                          ),
                          FilledButton.icon(
                            key: Key('matriz-guardar-${r.id}'),
                            onPressed: _guardando.contains(r.id)
                                ? null
                                : () => _guardar(r),
                            icon: const Icon(Icons.save_outlined, size: 18),
                            label: Text(
                              _guardando.contains(r.id)
                                  ? 'Guardando…'
                                  : 'Guardar cambios',
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// Tarjeta de un módulo: casilla "todos" (tri-estado) y una casilla por
/// permiso.
class _ModuloCard extends StatelessWidget {
  const _ModuloCard({
    required this.modulo,
    required this.asignados,
    required this.mostrarTodos,
    required this.editable,
    required this.onMarcar,
  });

  final ModuloPermisos modulo;
  final Set<String> asignados;
  final bool mostrarTodos;
  final bool editable;
  final void Function(Iterable<String> ids, bool marcado) onMarcar;

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    final ids = modulo.permisos.map((p) => p.id);
    final todos = ids.every(asignados.contains);
    final alguno = ids.any(asignados.contains);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Card(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 8, 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          modulo.modulo,
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                        Text(
                          '${modulo.permisos.length} permiso(s)',
                          style: TextStyle(color: c.text3, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                  if (mostrarTodos) ...[
                    Checkbox(
                      key: Key('todos-${modulo.modulo}'),
                      tristate: true,
                      value: todos ? true : (alguno ? null : false),
                      onChanged: editable ? (_) => onMarcar(ids, !todos) : null,
                    ),
                    Text('todos', style: TextStyle(color: c.text3)),
                  ],
                ],
              ),
              const Divider(),
              for (final p in modulo.permisos)
                CheckboxListTile(
                  key: Key('permiso-${p.codigo}'),
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  value: asignados.contains(p.id),
                  onChanged: editable
                      ? (v) => onMarcar([p.id], v ?? false)
                      : null,
                  title: Text(
                    p.codigo,
                    style: const TextStyle(
                      fontFamily: 'monospace',
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  subtitle: p.descripcion == null ? null : Text(p.descripcion!),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

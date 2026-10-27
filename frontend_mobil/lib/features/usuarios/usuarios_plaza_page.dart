import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_providers.dart';
import '../../core/api/paginado.dart';
import '../../core/api/payload.dart';
import '../../core/format/fechas.dart';
import '../../core/theme/colores.dart';
import '../../core/widgets/avisos.dart';
import '../../core/widgets/badges.dart';
import '../../core/widgets/can.dart';
import '../../core/widgets/dialogos.dart';
import '../../core/widgets/estados.dart';
import '../../core/widgets/lista_responsive.dart';
import '../../core/widgets/pagina.dart';
import '../../core/widgets/paginador.dart';
import '../catalogos/catalogos_widgets.dart';
import 'rol_staff_sheet.dart';
import 'usuario_plaza_dialogos.dart';
import 'usuarios_api.dart';
import 'usuarios_modelos.dart';
import 'usuarios_providers.dart';

/// Pestañas en el orden del web (`?tab=usuarios|roles|permisos`).
const _pestanas = ['usuarios', 'roles', 'permisos'];

/// `/admin/usuarios-plaza` — pestañas Usuarios / Roles de staff / Permisos.
/// Espejo de `usuarios-plaza/page.tsx` y sus tablas/diálogos.
class UsuariosPlazaPage extends ConsumerStatefulWidget {
  const UsuariosPlazaPage({super.key, this.tab});

  /// Pestaña inicial (`?tab=`); por defecto "usuarios".
  final String? tab;

  @override
  ConsumerState<UsuariosPlazaPage> createState() => _UsuariosPlazaPageState();
}

class _UsuariosPlazaPageState extends ConsumerState<UsuariosPlazaPage>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(
    length: _pestanas.length,
    vsync: this,
    initialIndex: math.max(0, _pestanas.indexOf(widget.tab ?? '')),
  )..addListener(_alCambiarPestana);
  final _buscar = TextEditingController();
  FiltroUsuarios _filtro = (pagina: 1, buscar: null, deshabilitados: false);
  int _paginaRoles = 1;
  String? _pendiente;

  @override
  void dispose() {
    _tabs.dispose();
    _buscar.dispose();
    super.dispose();
  }

  /// Cambiar de pestaña vuelve a la página 1 (como el web).
  void _alCambiarPestana() => setState(() {
    _paginaRoles = 1;
    _filtro = (
      pagina: 1,
      buscar: _filtro.buscar,
      deshabilitados: _filtro.deshabilitados,
    );
  });

  void _filtrar({String? buscar, bool? deshabilitados}) => setState(
    () => _filtro = (
      pagina: 1,
      buscar: buscar,
      deshabilitados: deshabilitados ?? _filtro.deshabilitados,
    ),
  );

  /// Ejecuta una acción de fila marcando la fila como ocupada.
  Future<void> _conFila(String id, Future<void> Function() accion) async {
    setState(() => _pendiente = id);
    try {
      await accion();
    } finally {
      if (mounted) setState(() => _pendiente = null);
    }
  }

  Future<void> _desactivarRol(RolStaff rol, int asignados) async {
    final aviso = asignados > 0
        ? '\n\n⚠️ Hay $asignados usuario(s) con este rol asignado. Quedarán '
              'con el rol inactivo visible en la UI.'
        : '';
    final ok = await confirmar(
      context,
      titulo: '¿Desactivar el rol "${rol.nombre}"?',
      mensaje: '${rol.codigo}$aviso',
      textoConfirmar: 'Sí, desactivar',
      destructiva: true,
    );
    if (!ok || !mounted) return;
    await _conFila(rol.id, () async {
      try {
        await desactivarRolStaff(ref.read(apiClientProvider), rol.id);
        if (!mounted) return;
        mostrarExito(context, 'Rol desactivado');
        invalidarRoles(ref);
      } catch (e) {
        if (mounted) mostrarError(context, e);
      }
    });
  }

  Future<void> _recargar() {
    invalidarRoles(ref);
    ref.invalidate(totalPermisosProvider);
    return _tabs.index == 1
        ? recargar(ref, rolesStaffProvider(_paginaRoles).future)
        : recargar(ref, usuariosPlazaProvider(_filtro).future);
  }

  @override
  Widget build(BuildContext context) {
    final usuarios = ref.watch(usuariosPlazaProvider(_filtro));
    final roles = ref.watch(rolesStaffProvider(_paginaRoles));
    final totalPermisos = ref.watch(totalPermisosProvider).value;

    return ContenidoPagina(
      onRefresh: _recargar,
      children: [
        const EncabezadoPagina(
          titulo: 'Usuarios de plaza',
          subtitulo:
              'Administra los usuarios con rol admin_plaza, el catálogo de '
              'roles de staff y la matriz de permisos granulares.',
        ),
        TabBar(
          controller: _tabs,
          isScrollable: true,
          tabAlignment: TabAlignment.start,
          tabs: [
            _Pestana('Usuarios', usuarios.value?.total),
            _Pestana('Roles de staff', roles.value?.total),
            _Pestana('Permisos', totalPermisos),
          ],
        ),
        const SizedBox(height: 16),
        ...switch (_tabs.index) {
          0 => _pestanaUsuarios(usuarios),
          1 => _pestanaRoles(roles),
          _ => [const _PestanaPermisos()],
        },
      ],
    );
  }

  // ── Pestaña Usuarios ──────────────────────────────────────────────────────

  List<Widget> _pestanaUsuarios(AsyncValue<Paginado<UsuarioPlaza>> datos) {
    final rolesActivos = ref.watch(rolesStaffActivosProvider).value;
    return [
      BarraFiltros(
        campos: [
          TextField(
            key: const Key('usuarios-buscar'),
            controller: _buscar,
            textInputAction: TextInputAction.search,
            onSubmitted: (v) => _filtrar(buscar: textoOpcional(v)),
            decoration: const InputDecoration(
              hintText: 'Buscar por nombre o email',
              prefixIcon: Icon(Icons.search),
            ),
          ),
          DropdownButtonFormField<bool>(
            key: const Key('usuarios-estado'),
            initialValue: _filtro.deshabilitados,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'Estado'),
            items: const [
              DropdownMenuItem(value: false, child: Text('Activos')),
              DropdownMenuItem(value: true, child: Text('Deshabilitados')),
            ],
            onChanged: (v) => _filtrar(
              buscar: textoOpcional(_buscar.text),
              deshabilitados: v ?? false,
            ),
          ),
        ],
        botones: [
          OutlinedButton(
            onPressed: () => _filtrar(buscar: textoOpcional(_buscar.text)),
            child: const Text('Buscar'),
          ),
          if (_filtro.buscar != null)
            TextButton(
              onPressed: () {
                _buscar.clear();
                _filtrar();
              },
              child: const Text('Limpiar'),
            ),
          Can(
            permiso: 'usuarios_plaza.crear',
            child: FilledButton.icon(
              // Sin roles activos no se puede dar de alta (rol obligatorio).
              onPressed: rolesActivos == null || rolesActivos.isEmpty
                  ? null
                  : () => mostrarAltaUsuarioPlaza(context, rolesActivos),
              icon: const Icon(Icons.person_add_alt_1_outlined),
              label: const Text('Nuevo usuario'),
            ),
          ),
        ],
      ),
      AsyncView(
        value: datos,
        onRetry: () => ref.invalidate(usuariosPlazaProvider(_filtro)),
        data: (p) => Column(
          children: [
            ListaResponsive<UsuarioPlaza>(
              items: p.items,
              vacio: const EmptyState(
                icono: Icons.person_off_outlined,
                titulo: 'Sin usuarios admin_plaza',
                mensaje:
                    'Crea el primero con «Nuevo usuario». Necesitarás al menos '
                    'un rol de staff activo (pestaña «Roles de staff»).',
              ),
              onTap: (u) => context.push('/admin/usuarios-plaza/${u.id}'),
              columnas: [
                ColumnaLista(
                  titulo: 'Nombre',
                  principal: true,
                  celda: (u) => Text(u.nombre),
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
                  titulo: 'Rol de staff',
                  celda: (u) => RolStaffBadge(u),
                ),
                ColumnaLista(
                  titulo: 'Último acceso',
                  celda: (u) => TextoCelda(
                    u.lastLoginAt == null
                        ? 'Nunca'
                        : formatFechaHora(u.lastLoginAt),
                  ),
                ),
                ColumnaLista(
                  titulo: 'Estado',
                  celda: (u) => EstadoUsuarioBadge(u),
                ),
              ],
              acciones: (u) => _accionesUsuario(u, rolesActivos),
            ),
            Paginador(
              pagina: p.page,
              totalPaginas: p.totalPages,
              onCambiar: (n) => setState(
                () => _filtro = (
                  pagina: n,
                  buscar: _filtro.buscar,
                  deshabilitados: _filtro.deshabilitados,
                ),
              ),
            ),
          ],
        ),
      ),
    ];
  }

  /// [rolesActivos] es `null` mientras carga: "Editar" espera a tenerlos.
  Widget _accionesUsuario(UsuarioPlaza u, List<RolStaff>? rolesActivos) {
    final ocupado = _pendiente == u.id;
    if (u.deshabilitado) {
      return Can(
        permiso: 'usuarios_plaza.reactivar',
        child: TextButton.icon(
          onPressed: ocupado
              ? null
              : () => _conFila(
                  u.id,
                  () => reactivarUsuarioPlaza(context, ref, u),
                ),
          icon: const Icon(Icons.power_settings_new, size: 18),
          label: const Text('Reactivar'),
        ),
      );
    }
    return Wrap(
      spacing: 4,
      runSpacing: 4,
      children: [
        Can(
          permiso: 'usuarios_plaza.editar',
          child: TextButton.icon(
            onPressed: rolesActivos == null
                ? null
                : () => editarUsuarioPlaza(context, ref, u, rolesActivos),
            icon: const Icon(Icons.edit_outlined, size: 18),
            label: const Text('Editar'),
          ),
        ),
        Can(
          permiso: 'usuarios_plaza.resetear_clave',
          child: TextButton.icon(
            onPressed: ocupado
                ? null
                : () => _conFila(
                    u.id,
                    () => resetearClaveUsuarioPlaza(context, ref, u),
                  ),
            icon: const Icon(Icons.key_outlined, size: 18),
            label: const Text('Resetear clave'),
          ),
        ),
        Can(
          permiso: 'usuarios_plaza.deshabilitar',
          child: TextButton.icon(
            style: TextButton.styleFrom(
              foregroundColor: Theme.of(context).colorScheme.error,
            ),
            onPressed: ocupado
                ? null
                : () => _conFila(
                    u.id,
                    () => deshabilitarUsuarioPlaza(context, ref, u),
                  ),
            icon: const Icon(Icons.power_settings_new, size: 18),
            label: const Text('Deshabilitar'),
          ),
        ),
      ],
    );
  }

  // ── Pestaña Roles de staff ────────────────────────────────────────────────

  List<Widget> _pestanaRoles(AsyncValue<Paginado<RolStaff>> datos) {
    final asignados = ref.watch(usuariosAsignadosProvider).value ?? const {};
    final c = ColoresPlazapp.of(context);
    return [
      Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: Wrap(
          alignment: WrapAlignment.spaceBetween,
          crossAxisAlignment: WrapCrossAlignment.center,
          spacing: 12,
          runSpacing: 12,
          children: [
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 560),
              child: Text(
                'Catálogo de roles operativos que se asignan a cada '
                'admin_plaza (técnico, ingeniero, supervisor, etc.). Cada '
                'plaza crea los que necesite.',
                style: TextStyle(color: c.text3),
              ),
            ),
            Can(
              permiso: 'roles_staff.crear',
              child: FilledButton.icon(
                onPressed: () => mostrarRolStaffSheet(context, ref),
                icon: const Icon(Icons.add),
                label: const Text('Nuevo rol'),
              ),
            ),
          ],
        ),
      ),
      AsyncView(
        value: datos,
        onRetry: () => ref.invalidate(rolesStaffProvider(_paginaRoles)),
        data: (p) => Column(
          children: [
            ListaResponsive<RolStaff>(
              items: p.items,
              vacio: const EmptyState(
                icono: Icons.remove_moderator_outlined,
                titulo: 'Sin roles de staff',
                mensaje:
                    'Crea el primer rol (técnico, supervisor, etc.) con '
                    '«Nuevo rol».',
              ),
              columnas: [
                ColumnaLista(
                  titulo: 'Código',
                  principal: true,
                  celda: (r) => Text(
                    r.codigo,
                    style: const TextStyle(fontFamily: 'monospace'),
                  ),
                ),
                ColumnaLista(titulo: 'Nombre', celda: (r) => Text(r.nombre)),
                ColumnaLista(
                  titulo: 'Descripción',
                  celda: (r) => TextoCelda(r.descripcion),
                ),
                ColumnaLista(
                  titulo: 'Usuarios asignados',
                  celda: (r) {
                    final n = asignados[r.id] ?? 0;
                    return n > 0
                        ? BadgePlazapp('$n', Tono.info)
                        : const TextoCelda('0');
                  },
                ),
                ColumnaLista(
                  titulo: 'Estado',
                  celda: (r) => BadgeActivo(r.activo),
                ),
              ],
              acciones: (r) => _accionesRol(r, asignados[r.id] ?? 0),
            ),
            Paginador(
              pagina: p.page,
              totalPaginas: p.totalPages,
              onCambiar: (n) => setState(() => _paginaRoles = n),
            ),
          ],
        ),
      ),
    ];
  }

  Widget _accionesRol(RolStaff r, int asignados) {
    // El rol de sistema (`admin`) no se edita ni se desactiva desde la app.
    if (r.esSistema) return const BadgePlazapp('Sistema', Tono.info);
    return Wrap(
      spacing: 4,
      runSpacing: 4,
      children: [
        Can(
          permiso: 'roles_staff.editar',
          child: TextButton.icon(
            onPressed: () => mostrarRolStaffSheet(context, ref, rol: r),
            icon: const Icon(Icons.edit_outlined, size: 18),
            label: const Text('Editar'),
          ),
        ),
        if (r.activo)
          Can(
            permiso: 'roles_staff.deshabilitar',
            child: TextButton.icon(
              style: TextButton.styleFrom(
                foregroundColor: Theme.of(context).colorScheme.error,
              ),
              onPressed: _pendiente == r.id
                  ? null
                  : () => _desactivarRol(r, asignados),
              icon: const Icon(Icons.power_settings_new, size: 18),
              label: const Text('Desactivar'),
            ),
          ),
      ],
    );
  }
}

/// Etiqueta de pestaña con contador.
class _Pestana extends StatelessWidget {
  const _Pestana(this.texto, this.cantidad);

  final String texto;
  final int? cantidad;

  @override
  Widget build(BuildContext context) {
    return Tab(
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(texto),
          if (cantidad != null) ...[
            const SizedBox(width: 6),
            BadgePlazapp('$cantidad', Tono.neutral, punto: false),
          ],
        ],
      ),
    );
  }
}

/// Pestaña Permisos: enlace a la matriz (página dedicada).
class _PestanaPermisos extends StatelessWidget {
  const _PestanaPermisos();

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Matriz de permisos granulares',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            Text(
              'Asigna permisos específicos a cada rol de staff (aprobar '
              'solicitudes, editar locales, ver auditoría, etc.). Los cambios '
              'afectan a todos los usuarios con ese rol.',
              style: TextStyle(color: c.text3),
            ),
            const SizedBox(height: 8),
            Text.rich(
              const TextSpan(
                text: 'El rol ',
                children: [
                  TextSpan(
                    text: 'admin',
                    style: TextStyle(fontFamily: 'monospace'),
                  ),
                  TextSpan(
                    text:
                        ' es del sistema y siempre tiene todos los permisos; '
                        'no se puede modificar.',
                  ),
                ],
              ),
              style: TextStyle(color: c.text3),
            ),
            const SizedBox(height: 16),
            Align(
              alignment: Alignment.centerRight,
              child: FilledButton(
                onPressed: () => context.push('/admin/usuarios-plaza/permisos'),
                child: const Text('Abrir matriz de permisos →'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/format/fechas.dart';
import '../../core/theme/colores.dart';
import '../../core/widgets/campos.dart';
import '../../core/widgets/can.dart';
import '../../core/widgets/estados.dart';
import '../../core/widgets/pagina.dart';
import 'usuario_plaza_dialogos.dart';
import 'usuarios_modelos.dart';
import 'usuarios_providers.dart';

/// `/admin/usuarios-plaza/:id` — identidad, operación y edición de un
/// usuario de plaza (espejo de `usuarios-plaza/[id]/page.tsx`). En la app se
/// llega tocando el usuario en la lista.
class UsuarioPlazaPage extends ConsumerWidget {
  const UsuarioPlazaPage({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final datos = ref.watch(usuarioPlazaProvider(id));
    // Todos los roles (también inactivos) para el selector de edición.
    // `null` mientras carga: "Editar" espera a tenerlos (si no, el selector
    // del diálogo quedaría vacío).
    final roles = ref.watch(rolesStaffTodosProvider).value;
    final c = ColoresPlazapp.of(context);

    return AsyncView(
      value: datos,
      onRetry: () => ref.invalidate(usuarioPlazaProvider(id)),
      data: (u) => ContenidoPagina(
        onRefresh: () => recargar(ref, usuarioPlazaProvider(id).future),
        children: [
          EncabezadoPagina(
            titulo: u.nombre,
            subtitulo: u.email,
            rutaVolver: '/admin/usuarios-plaza',
            acciones: [
              if (!u.deshabilitado)
                Can(
                  permiso: 'usuarios_plaza.editar',
                  child: OutlinedButton.icon(
                    onPressed: roles == null
                        ? null
                        : () => editarUsuarioPlaza(context, ref, u, roles),
                    icon: const Icon(Icons.edit_outlined, size: 18),
                    label: const Text('Editar'),
                  ),
                ),
            ],
          ),
          Seccion(
            titulo: 'Identidad',
            child: KeyValueGrid([
              (
                'Email',
                Text(u.email, style: const TextStyle(fontFamily: 'monospace')),
              ),
              ('Nombre', Text(u.nombre)),
              ('Teléfono', Text(u.telefono ?? '—')),
              ('Rol global', const Text('admin_plaza')),
            ]),
          ),
          Seccion(
            titulo: 'Operación',
            child: KeyValueGrid([
              ('Rol de staff', Text(_rolStaff(u))),
              (
                'Último acceso',
                Text(
                  u.lastLoginAt == null
                      ? 'Nunca'
                      : formatFechaHora(u.lastLoginAt),
                ),
              ),
              ('Estado', Text(_estado(u))),
            ]),
          ),
          Seccion(
            titulo: 'Solicitudes asignadas',
            child: Wrap(
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Text(
                  'Vista pendiente de integración. Por ahora filtra por '
                  'responsable en ',
                  style: TextStyle(color: c.text3),
                ),
                TextButton(
                  onPressed: () => context.go('/admin/solicitudes'),
                  child: const Text('Solicitudes'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _rolStaff(UsuarioPlaza u) {
    final nombre = u.rolStaffNombre;
    if (nombre == null) return '—';
    return u.rolStaffActivo == true ? nombre : '$nombre (inactivo)';
  }

  String _estado(UsuarioPlaza u) {
    if (u.deshabilitado) {
      return 'Inactivo desde ${formatFechaHora(u.deletedAt)}';
    }
    if (u.emailInvalido) return 'Email inválido (hard bounce)';
    return 'Activo';
  }
}

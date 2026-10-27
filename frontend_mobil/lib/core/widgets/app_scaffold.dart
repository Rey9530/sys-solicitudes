import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/cambiar_password_dialog.dart';
import '../../features/shell/campana.dart';
import '../../features/shell/plaza_selector.dart';
import '../auth/sesion.dart';
import '../auth/sesion_controller.dart';
import '../format/texto.dart';
import '../navegacion/menu.dart';
import '../plaza/plaza_seleccionada.dart';
import '../theme/colores.dart';
import '../theme/tema.dart';

/// Ancho a partir del cual el menú se muestra como rail (tablet vertical).
const anchoRail = 600.0;

/// Ancho a partir del cual el menú queda fijo y completo (tablet horizontal).
const anchoMenuFijo = 1024.0;

/// Estructura de toda pantalla autenticada: barra superior + menú del rol.
///
/// - < 600 px: menú en `Drawer` (botón hamburguesa).
/// - 600–1023 px: `NavigationRail` con iconos.
/// - ≥ 1024 px: menú lateral completo y fijo.
///
/// Las pantallas solo pintan su contenido; su título y acciones van en
/// `EncabezadoPagina` dentro del contenido (igual que el web).
class AppScaffold extends ConsumerWidget {
  const AppScaffold({super.key, required this.child, required this.rutaActual});

  final Widget child;
  final String rutaActual;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sesion = ref.watch(sesionProvider).value;
    if (sesion == null) return child;
    final conPlaza = ref.watch(plazaSeleccionadaProvider) != null;
    final items = menuPara(sesion, conPlaza: conPlaza);
    final ancho = MediaQuery.sizeOf(context).width;
    final c = ColoresPlazapp.of(context);

    final barra = AppBar(
      titleSpacing: ancho >= anchoRail ? 16 : 0,
      title: _Marca(sesion: sesion),
      actions: [
        if (sesion.rol == Rol.superadmin)
          const PlazaSelector()
        else
          const _ChipPlaza(),
        const _BotonTema(),
        if (sesion.rol != Rol.superadmin) const Campana(),
        _MenuUsuario(sesion: sesion),
        const SizedBox(width: 8),
      ],
      bottom: PreferredSize(
        preferredSize: const Size.fromHeight(1),
        child: Container(height: 1, color: c.border),
      ),
    );

    if (ancho < anchoRail) {
      return Scaffold(
        appBar: barra,
        drawer: Drawer(
          backgroundColor: c.sideBg,
          child: SafeArea(
            child: _MenuLateral(
              items: items,
              rutaActual: rutaActual,
              sesion: sesion,
              alNavegar: () => Navigator.of(context).pop(),
            ),
          ),
        ),
        body: child,
      );
    }

    final menu = ancho >= anchoMenuFijo
        ? SizedBox(
            width: 256,
            child: ColoredBox(
              color: c.sideBg,
              child: SafeArea(
                right: false,
                child: _MenuLateral(
                  items: items,
                  rutaActual: rutaActual,
                  sesion: sesion,
                ),
              ),
            ),
          )
        : _Rail(items: items, rutaActual: rutaActual);

    return Scaffold(
      appBar: barra,
      body: Row(
        children: [
          menu,
          Expanded(child: child),
        ],
      ),
    );
  }
}

class _Marca extends StatelessWidget {
  const _Marca({required this.sesion});
  final Sesion sesion;

  @override
  Widget build(BuildContext context) {
    final primario = Theme.of(context).colorScheme.primary;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 30,
          height: 30,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: primario,
            borderRadius: BorderRadius.circular(8),
          ),
          child: const Text(
            'P',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
          ),
        ),
        // En teléfono solo el logo: el nombre no cabe junto a las acciones.
        if (MediaQuery.sizeOf(context).width >= anchoRail) ...[
          const SizedBox(width: 10),
          const Flexible(
            child: Text('Plazapp', overflow: TextOverflow.ellipsis),
          ),
        ],
      ],
    );
  }
}

/// Chip con el nombre de la plaza (admin) o "Mi plaza" (inquilino).
class _ChipPlaza extends ConsumerWidget {
  const _ChipPlaza();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (MediaQuery.sizeOf(context).width < 400) return const SizedBox.shrink();
    final plaza = ref.watch(plazaActualProvider).value;
    final c = ColoresPlazapp.of(context);
    return Container(
      constraints: const BoxConstraints(maxWidth: 180),
      margin: const EdgeInsets.symmetric(horizontal: 4),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: c.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.primary,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              plaza?.nombreComercial ?? 'Mi plaza',
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 12.5, color: c.text2),
            ),
          ),
        ],
      ),
    );
  }
}

class _BotonTema extends ConsumerWidget {
  const _BotonTema();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final oscuro = Theme.of(context).brightness == Brightness.dark;
    return IconButton(
      tooltip: 'Cambiar tema',
      icon: Icon(oscuro ? Icons.light_mode_outlined : Icons.dark_mode_outlined),
      onPressed: () => ref
          .read(temaModoProvider.notifier)
          .alternar(Theme.of(context).brightness),
    );
  }
}

/// Avatar con iniciales → hoja con usuario, rol, cambiar contraseña y salir.
class _MenuUsuario extends ConsumerWidget {
  const _MenuUsuario({required this.sesion});
  final Sesion sesion;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return IconButton(
      key: const Key('menu-usuario'),
      tooltip: 'Cuenta',
      onPressed: () => showModalBottomSheet<void>(
        context: context,
        showDragHandle: true,
        builder: (hoja) => SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: AvatarIniciales(nombre: sesion.usuario.nombre),
                title: Text(sesion.usuario.nombre),
                subtitle: Text(
                  '${sesion.usuario.email} · ${sesion.rol.etiqueta}',
                ),
              ),
              const Divider(),
              ListTile(
                leading: const Icon(Icons.key_outlined),
                title: const Text('Cambiar contraseña'),
                onTap: () {
                  Navigator.of(hoja).pop();
                  mostrarCambiarPassword(context);
                },
              ),
              ListTile(
                key: const Key('cerrar-sesion'),
                leading: const Icon(Icons.logout),
                title: const Text('Cerrar sesión'),
                onTap: () {
                  Navigator.of(hoja).pop();
                  // Los avisos de esta sesión no deben verse en el login ni
                  // en la sesión siguiente.
                  ScaffoldMessenger.of(context).clearSnackBars();
                  ref.read(sesionProvider.notifier).cerrarSesion();
                },
              ),
            ],
          ),
        ),
      ),
      icon: AvatarIniciales(nombre: sesion.usuario.nombre),
    );
  }
}

/// Avatar circular con las iniciales del nombre.
class AvatarIniciales extends StatelessWidget {
  const AvatarIniciales({super.key, required this.nombre, this.radio = 16});

  final String nombre;
  final double radio;

  @override
  Widget build(BuildContext context) {
    return CircleAvatar(
      radius: radio,
      backgroundColor: Theme.of(context).colorScheme.primary,
      child: Text(
        iniciales(nombre),
        style: TextStyle(
          color: Colors.white,
          fontSize: radio * 0.75,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _MenuLateral extends StatelessWidget {
  const _MenuLateral({
    required this.items,
    required this.rutaActual,
    required this.sesion,
    this.alNavegar,
  });

  final List<ItemMenu> items;
  final String rutaActual;
  final Sesion sesion;
  final VoidCallback? alNavegar;

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    final primario = Theme.of(context).colorScheme.primary;
    final filas = <Widget>[
      Padding(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 12),
        child: Text(switch (sesion.rol) {
          Rol.superadmin => 'Consola de plataforma',
          Rol.adminPlaza => 'Administración de plaza',
          Rol.inquilino => 'Portal de inquilino',
        }, style: TextStyle(color: c.sideTextDim, fontSize: 12)),
      ),
    ];
    String? grupoActual;
    for (final item in items) {
      if (item.grupo != null && item.grupo != grupoActual) {
        grupoActual = item.grupo;
        filas.add(
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 6),
            child: Text(
              item.grupo!.toUpperCase(),
              style: TextStyle(
                color: c.sideSection,
                fontSize: 11,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.6,
              ),
            ),
          ),
        );
      }
      final activo = esRutaActiva(item, rutaActual);
      filas.add(
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 1),
          child: Material(
            color: activo
                ? primario.withValues(alpha: 0.22)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(8),
            child: InkWell(
              key: Key('menu-${item.ruta}'),
              borderRadius: BorderRadius.circular(8),
              onTap: () {
                alNavegar?.call();
                context.go(item.ruta);
              },
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 12,
                ),
                child: Row(
                  children: [
                    Icon(
                      item.icono,
                      size: 20,
                      color: activo ? Colors.white : c.sideText,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        item.etiqueta,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: activo ? Colors.white : c.sideText,
                          fontWeight: activo
                              ? FontWeight.w600
                              : FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
    }
    return ListView(
      padding: const EdgeInsets.only(bottom: 16),
      children: filas,
    );
  }
}

class _Rail extends StatelessWidget {
  const _Rail({required this.items, required this.rutaActual});

  final List<ItemMenu> items;
  final String rutaActual;

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    final indice = items.indexWhere((i) => esRutaActiva(i, rutaActual));
    return ColoredBox(
      color: c.sideBg,
      child: SafeArea(
        right: false,
        child: LayoutBuilder(
          builder: (context, constraints) => SingleChildScrollView(
            child: ConstrainedBox(
              constraints: BoxConstraints(minHeight: constraints.maxHeight),
              child: IntrinsicHeight(
                child: NavigationRail(
                  backgroundColor: c.sideBg,
                  selectedIndex: indice < 0 ? null : indice,
                  labelType: NavigationRailLabelType.none,
                  indicatorColor: Theme.of(context).colorScheme.primary
                      .withValues(alpha: 0.3),
                  selectedIconTheme: const IconThemeData(color: Colors.white),
                  unselectedIconTheme: IconThemeData(color: c.sideText),
                  onDestinationSelected: (i) => context.go(items[i].ruta),
                  destinations: [
                    for (final i in items)
                      NavigationRailDestination(
                        icon: Tooltip(
                          message: i.etiqueta,
                          child: Icon(i.icono),
                        ),
                        label: Text(i.etiqueta),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/plaza/plaza_seleccionada.dart';
import '../../core/theme/colores.dart';

/// Selector de plaza del superadmin (impersonación). Elegir una plaza lleva a
/// su dashboard; "Todas las plazas" vuelve al dashboard global (como el web).
class PlazaSelector extends ConsumerWidget {
  const PlazaSelector({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final seleccionada = ref.watch(plazaSeleccionadaProvider);
    final plaza = ref.watch(plazaActualProvider).value;
    final c = ColoresPlazapp.of(context);
    final estrecho = MediaQuery.sizeOf(context).width < 400;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: OutlinedButton.icon(
        key: const Key('selector-plaza'),
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(44, 40),
          padding: const EdgeInsets.symmetric(horizontal: 10),
          side: BorderSide(color: c.border),
        ),
        onPressed: () => _abrir(context, ref),
        icon: Icon(
          seleccionada == null ? Icons.public : Icons.apartment_outlined,
          size: 18,
        ),
        label: estrecho
            ? const Icon(Icons.expand_more, size: 18)
            : ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 150),
                child: Text(
                  seleccionada == null
                      ? 'Todas las plazas'
                      : (plaza?.nombreComercial ?? 'Plaza'),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
      ),
    );
  }

  Future<void> _abrir(BuildContext context, WidgetRef ref) async {
    final elegida = await showModalBottomSheet<_Eleccion>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => const _ListaPlazas(),
    );
    if (elegida == null || !context.mounted) return;
    await ref.read(plazaSeleccionadaProvider.notifier).seleccionar(elegida.id);
    if (!context.mounted) return;
    context.go(
      elegida.id == null ? '/superadmin/dashboard' : '/admin/dashboard',
    );
  }
}

class _Eleccion {
  const _Eleccion(this.id);
  final String? id;
}

class _ListaPlazas extends ConsumerStatefulWidget {
  const _ListaPlazas();

  @override
  ConsumerState<_ListaPlazas> createState() => _ListaPlazasState();
}

class _ListaPlazasState extends ConsumerState<_ListaPlazas> {
  String _filtro = '';

  @override
  Widget build(BuildContext context) {
    final plazas = ref.watch(plazasProvider);
    final seleccionada = ref.watch(plazaSeleccionadaProvider);
    return SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.75,
        ),
        child: plazas.when(
          loading: () => const Padding(
            padding: EdgeInsets.all(32),
            child: Center(child: CircularProgressIndicator()),
          ),
          error: (e, _) =>
              Padding(padding: const EdgeInsets.all(24), child: Text('$e')),
          data: (lista) {
            final visibles = lista
                .where(
                  (p) =>
                      _filtro.isEmpty ||
                      p.nombreComercial.toLowerCase().contains(_filtro) ||
                      p.slug.toLowerCase().contains(_filtro),
                )
                .toList();
            return ListView(
              shrinkWrap: true,
              children: [
                if (lista.length > 7)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                    child: TextField(
                      decoration: const InputDecoration(
                        hintText: 'Buscar plaza…',
                        prefixIcon: Icon(Icons.search),
                      ),
                      onChanged: (v) =>
                          setState(() => _filtro = v.trim().toLowerCase()),
                    ),
                  ),
                ListTile(
                  leading: const Icon(Icons.public),
                  title: const Text('Todas las plazas'),
                  subtitle: const Text('Vista global de la plataforma'),
                  selected: seleccionada == null,
                  onTap: () => Navigator.of(context).pop(const _Eleccion(null)),
                ),
                if (visibles.isEmpty)
                  const Padding(
                    padding: EdgeInsets.all(16),
                    child: Text('Sin plazas que coincidan.'),
                  ),
                for (final p in visibles)
                  ListTile(
                    leading: CircleAvatar(
                      radius: 6,
                      backgroundColor: colorDesdeHex(p.colorPrimario),
                    ),
                    title: Text(p.nombreComercial),
                    subtitle: Text(p.slug),
                    selected: seleccionada == p.id,
                    onTap: () => Navigator.of(context).pop(_Eleccion(p.id)),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_providers.dart';
import '../../core/api/payload.dart';
import '../../core/widgets/avisos.dart';
import '../../core/widgets/badges.dart';
import '../../core/widgets/campo_select.dart';
import '../../core/widgets/can.dart';
import '../../core/widgets/celdas.dart';
import '../../core/widgets/dialogos.dart';
import '../../core/widgets/estados.dart';
import '../../core/widgets/filtros.dart';
import '../../core/widgets/lista_responsive.dart';
import '../../core/widgets/pagina.dart';
import '../../core/widgets/paginador.dart';
import 'categorias_api.dart';
import 'categorias_modelos.dart';
import 'categorias_providers.dart';

/// `/admin/categorias` — listado de categorías con búsqueda, estado y
/// desactivar. Espejo de `admin/categorias/page.tsx` + `categorias-table.tsx`.
class CategoriasPage extends ConsumerStatefulWidget {
  const CategoriasPage({super.key});

  @override
  ConsumerState<CategoriasPage> createState() => _CategoriasPageState();
}

class _CategoriasPageState extends ConsumerState<CategoriasPage> {
  final _buscar = TextEditingController();
  bool? _estado;
  FiltroCategorias _filtro = (pagina: 1, activo: null, buscar: null);
  String? _desactivando;

  @override
  void dispose() {
    _buscar.dispose();
    super.dispose();
  }

  void _filtrar() => setState(
    () => _filtro = (
      pagina: 1,
      activo: _estado,
      buscar: textoOpcional(_buscar.text),
    ),
  );

  Future<void> _desactivar(Categoria c) async {
    final ok = await confirmar(
      context,
      titulo: '¿Desactivar la categoría "${c.nombre}"?',
      textoConfirmar: 'Sí, desactivar',
      destructiva: true,
    );
    if (!ok || !mounted) return;
    setState(() => _desactivando = c.id);
    try {
      await desactivarCategoria(ref.read(apiClientProvider), c.id);
      if (!mounted) return;
      mostrarExito(context, 'Categoría desactivada');
      ref.invalidate(categoriasProvider);
    } catch (e) {
      // Con subcategorías activas el backend responde
      // CATEGORIA_HAS_ACTIVE_SUBCATEGORIAS con el detalle a mostrar.
      if (mounted) mostrarError(context, e);
    } finally {
      if (mounted) setState(() => _desactivando = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final datos = ref.watch(categoriasProvider(_filtro));
    final total = datos.value?.total;
    return ContenidoPagina(
      onRefresh: () => recargar(ref, categoriasProvider(_filtro).future),
      children: [
        EncabezadoPagina(
          titulo: 'Categorías',
          subtitulo:
              '${total ?? '…'} categorías · clasifican las solicitudes de los inquilinos.',
          acciones: [
            Can(
              permiso: 'categorias.crear',
              child: FilledButton.icon(
                onPressed: () => context.push('/admin/categorias/nueva'),
                icon: const Icon(Icons.add),
                label: const Text('Nueva categoría'),
              ),
            ),
          ],
        ),
        TarjetaFiltros(
          enLinea: true,
          campos: [
            TextField(
              key: const Key('categorias-buscar'),
              controller: _buscar,
              textInputAction: TextInputAction.search,
              onSubmitted: (_) => _filtrar(),
              decoration: const InputDecoration(
                labelText: 'Buscar',
                hintText: 'Buscar por nombre…',
                prefixIcon: Icon(Icons.search),
              ),
            ),
            CampoSelect<bool>(
              label: 'Estado',
              valor: _estado,
              opcionVacia: 'Todas',
              opciones: const [(true, 'Activas'), (false, 'Inactivas')],
              onChanged: (v) => _estado = v,
            ),
          ],
          onFiltrar: _filtrar,
        ),
        AsyncView(
          value: datos,
          onRetry: () => ref.invalidate(categoriasProvider(_filtro)),
          data: (p) => Column(
            children: [
              ListaResponsive<Categoria>(
                items: p.items,
                vacio: const EmptyState(
                  icono: Icons.sell_outlined,
                  titulo: 'Sin categorías',
                  mensaje: 'No hay categorías con esos criterios.',
                ),
                onTap: (c) => context.push('/admin/categorias/${c.id}'),
                columnas: [
                  ColumnaLista(
                    titulo: 'Nombre',
                    principal: true,
                    celda: (c) => Text(c.nombre),
                  ),
                  ColumnaLista(
                    titulo: 'Descripción',
                    celda: (c) => TextoCelda(c.descripcion),
                  ),
                  ColumnaLista(
                    titulo: 'Estado',
                    celda: (c) => BadgeActivo(c.activo, femenino: true),
                  ),
                ],
                acciones: (c) => Wrap(
                  spacing: 8,
                  runSpacing: 4,
                  children: [
                    TextButton(
                      onPressed: () => context.push(
                        '/admin/categorias/${c.id}/subcategorias',
                      ),
                      child: const Text('Subcategorías'),
                    ),
                    if (c.activo)
                      Can(
                        permiso: 'categorias.deshabilitar',
                        child: TextButton(
                          style: TextButton.styleFrom(
                            foregroundColor: Theme.of(context)
                                .colorScheme
                                .error,
                          ),
                          onPressed: _desactivando == c.id
                              ? null
                              : () => _desactivar(c),
                          child: const Text('Desactivar'),
                        ),
                      ),
                  ],
                ),
              ),
              Paginador(
                pagina: p.page,
                totalPaginas: p.totalPages,
                onCambiar: (n) => setState(
                  () => _filtro = (
                    pagina: n,
                    activo: _filtro.activo,
                    buscar: _filtro.buscar,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

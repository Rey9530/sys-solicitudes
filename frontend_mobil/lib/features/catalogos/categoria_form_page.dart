import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_providers.dart';
import '../../core/auth/sesion_controller.dart';
import '../../core/theme/colores.dart';
import '../../core/widgets/avisos.dart';
import '../../core/widgets/badges.dart';
import '../../core/widgets/estados.dart';
import '../../core/widgets/pagina.dart';
import 'categorias_api.dart';
import 'categorias_modelos.dart';
import 'categorias_providers.dart';

const _rutaListado = '/admin/categorias';

/// Vuelve al listado: `pop` si se llegó con `push`, si no navega.
void _volverAlListado(BuildContext context) =>
    context.canPop() ? context.pop() : context.go(_rutaListado);

/// `/admin/categorias/nueva` — alta de categoría
/// (espejo de `categorias/nueva/page.tsx` + `categoria-form.tsx`).
class CategoriaFormPage extends StatelessWidget {
  const CategoriaFormPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const ContenidoPagina(
      children: [
        EncabezadoPagina(
          titulo: 'Nueva categoría',
          subtitulo: 'Las categorías agrupan subcategorías con responsable y supervisores.',
          rutaVolver: _rutaListado,
        ),
        Card(
          child: Padding(padding: EdgeInsets.all(16), child: _CategoriaForm()),
        ),
      ],
    );
  }
}

/// `/admin/categorias/:id` — editar la categoría y ver sus subcategorías
/// activas (espejo de `categorias/[id]/page.tsx`).
class CategoriaDetallePage extends ConsumerWidget {
  const CategoriaDetallePage({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final datos = ref.watch(categoriaProvider(id));
    return AsyncView(
      value: datos,
      onRetry: () => ref.invalidate(categoriaProvider(id)),
      data: (cat) {
        final editar = Seccion(
          titulo: 'Editar',
          child: _CategoriaForm(key: ValueKey(cat.id), categoria: cat),
        );
        final subcategorias = Seccion(
          titulo: 'Subcategorías activas',
          child: _SubcategoriasActivas(cat.subcategorias),
        );
        return ContenidoPagina(
          onRefresh: () => ref.refresh(categoriaProvider(id).future),
          children: [
            EncabezadoPagina(
              titulo: cat.nombre,
              subtitulo:
                  '${cat.activo ? 'Activa' : 'Inactiva'} · '
                  '${cat.subcategorias.length} subcategoría(s) activa(s)',
              rutaVolver: _rutaListado,
              acciones: [
                OutlinedButton(
                  onPressed: () =>
                      context.push('/admin/categorias/${cat.id}/subcategorias'),
                  child: const Text('Gestionar subcategorías'),
                ),
              ],
            ),
            LayoutBuilder(
              builder: (context, constraints) => constraints.maxWidth >= 760
                  ? Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(child: editar),
                        const SizedBox(width: 14),
                        Expanded(child: subcategorias),
                      ],
                    )
                  : Column(children: [editar, subcategorias]),
            ),
          ],
        );
      },
    );
  }
}

class _SubcategoriasActivas extends StatelessWidget {
  const _SubcategoriasActivas(this.subcategorias);

  final List<Subcategoria> subcategorias;

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    if (subcategorias.isEmpty) {
      return Text(
        'Sin subcategorías activas.',
        style: TextStyle(color: c.text3),
      );
    }
    return Column(
      children: [
        for (final s in subcategorias)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 6),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        s.nombre,
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      Text(
                        'Responsable: ${s.responsable?.nombre ?? '—'} · '
                        'Supervisores: ${s.supervisores.length}/$maxSupervisores',
                        style: TextStyle(color: c.text3, fontSize: 12),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                PrioridadBadge(s.prioridad),
              ],
            ),
          ),
      ],
    );
  }
}

/// Formulario de categoría: crea o edita según reciba [categoria].
class _CategoriaForm extends ConsumerStatefulWidget {
  const _CategoriaForm({super.key, this.categoria});

  final Categoria? categoria;

  @override
  ConsumerState<_CategoriaForm> createState() => _CategoriaFormState();
}

class _CategoriaFormState extends ConsumerState<_CategoriaForm> {
  final _form = GlobalKey<FormState>();
  late final _nombre = TextEditingController(text: widget.categoria?.nombre);
  late final _descripcion = TextEditingController(
    text: widget.categoria?.descripcion,
  );
  bool _guardando = false;

  bool get _esEdicion => widget.categoria != null;

  @override
  void dispose() {
    _nombre.dispose();
    _descripcion.dispose();
    super.dispose();
  }

  Future<void> _guardar() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _guardando = true);
    final api = ref.read(apiClientProvider);
    try {
      final categoria = widget.categoria;
      if (categoria == null) {
        await crearCategoria(
          api,
          nombre: _nombre.text.trim(),
          descripcion: textoOpcional(_descripcion.text),
        );
      } else {
        await actualizarCategoria(
          api,
          categoria.id,
          nombre: _nombre.text.trim(),
          descripcion: textoOpcional(_descripcion.text),
        );
        ref.invalidate(categoriaProvider(categoria.id));
      }
      ref.invalidate(categoriasProvider);
      if (!mounted) return;
      mostrarExito(
        context,
        _esEdicion ? 'Categoría actualizada' : 'Categoría creada',
      );
      _volverAlListado(context);
    } catch (e) {
      // CATEGORIA_NOMBRE_DUPLICADO llega con su detalle legible.
      if (mounted) mostrarError(context, e);
    } finally {
      if (mounted) setState(() => _guardando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final sesion = ref.watch(sesionProvider).value;
    final puede =
        sesion?.puede(_esEdicion ? 'categorias.editar' : 'categorias.crear') ??
        false;
    return Form(
      key: _form,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextFormField(
            key: const Key('categoria-nombre'),
            controller: _nombre,
            enabled: puede,
            maxLength: 80,
            decoration: const InputDecoration(labelText: 'Nombre *'),
            validator: (v) =>
                (v ?? '').trim().isEmpty ? 'Este campo es obligatorio.' : null,
          ),
          const SizedBox(height: 8),
          TextFormField(
            key: const Key('categoria-descripcion'),
            controller: _descripcion,
            enabled: puede,
            minLines: 3,
            maxLines: 5,
            maxLength: 500,
            decoration: const InputDecoration(labelText: 'Descripción'),
          ),
          const SizedBox(height: 12),
          Wrap(
            alignment: WrapAlignment.end,
            spacing: 8,
            runSpacing: 8,
            children: [
              OutlinedButton(
                onPressed: () => _volverAlListado(context),
                child: const Text('Cancelar'),
              ),
              if (puede)
                FilledButton(
                  key: const Key('categoria-guardar'),
                  onPressed: _guardando ? null : _guardar,
                  child: Text(
                    _guardando
                        ? 'Guardando…'
                        : _esEdicion
                        ? 'Guardar cambios'
                        : 'Crear categoría',
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

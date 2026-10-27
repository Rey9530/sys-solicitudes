import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/widgets/estados.dart';
import '../../core/widgets/filtros.dart';
import '../../core/widgets/lista_responsive.dart';
import '../../core/widgets/pagina.dart';
import '../../core/widgets/paginador.dart';
import 'catalogos_widgets.dart';
import 'categorias_api.dart';
import 'categorias_modelos.dart';
import 'categorias_providers.dart';

/// `/admin/catalogos/tipos-solicitud` — los 4 tipos de la plaza con su
/// etiqueta, orden y estado. Espejo de `tipos-solicitud/page.tsx` +
/// `tipos-solicitud-table.tsx`.
class TiposSolicitudPage extends ConsumerStatefulWidget {
  const TiposSolicitudPage({super.key});

  @override
  ConsumerState<TiposSolicitudPage> createState() => _TiposSolicitudPageState();
}

class _TiposSolicitudPageState extends ConsumerState<TiposSolicitudPage> {
  bool? _estado;
  FiltroTipos _filtro = (pagina: 1, activo: null);

  void _abrir(TipoSolicitudConfig t) =>
      context.push('/admin/catalogos/tipos-solicitud/${t.id}');

  @override
  Widget build(BuildContext context) {
    final datos = ref.watch(tiposSolicitudProvider(_filtro));
    return ContenidoPagina(
      onRefresh: () => recargar(ref, tiposSolicitudProvider(_filtro).future),
      children: [
        EncabezadoPagina(
          titulo: 'Tipos de solicitud',
          subtitulo:
              '${datos.value?.total ?? '…'} tipos · controla la etiqueta visible '
              'y si se ofrecen a los inquilinos.',
        ),
        TarjetaFiltros(
          enLinea: true,
          campos: [
            DropdownButtonFormField<bool?>(
              initialValue: _estado,
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'Estado'),
              items: const [
                DropdownMenuItem(child: Text('Todos')),
                DropdownMenuItem(value: true, child: Text('Activos')),
                DropdownMenuItem(value: false, child: Text('Inactivos')),
              ],
              onChanged: (v) => _estado = v,
            ),
          ],
          onFiltrar: () =>
              setState(() => _filtro = (pagina: 1, activo: _estado)),
        ),
        AsyncView(
          value: datos,
          onRetry: () => ref.invalidate(tiposSolicitudProvider(_filtro)),
          data: (p) => Column(
            children: [
              ListaResponsive<TipoSolicitudConfig>(
                items: p.items,
                vacio: const EmptyState(
                  icono: Icons.category_outlined,
                  titulo: 'Sin tipos',
                  mensaje:
                      'No hay tipos con esos criterios. Si es la primera vez, '
                      'ejecuta el seed.',
                ),
                onTap: _abrir,
                columnas: [
                  ColumnaLista(
                    titulo: 'Etiqueta',
                    principal: true,
                    celda: (t) => Text(t.etiqueta),
                  ),
                  ColumnaLista(
                    titulo: 'Código',
                    celda: (t) => TextoCelda(t.codigo, mono: true),
                  ),
                  ColumnaLista(
                    titulo: 'Descripción',
                    celda: (t) => TextoCelda(t.descripcion),
                  ),
                  ColumnaLista(
                    titulo: 'Orden',
                    celda: (t) => TextoCelda('${t.orden}'),
                  ),
                  ColumnaLista(
                    titulo: 'Estado',
                    celda: (t) => BadgeActivo(t.activo),
                  ),
                ],
                acciones: (t) => TextButton(
                  onPressed: () => _abrir(t),
                  child: const Text('Editar'),
                ),
              ),
              Paginador(
                pagina: p.page,
                totalPaginas: p.totalPages,
                onCambiar: (n) => setState(
                  () => _filtro = (pagina: n, activo: _filtro.activo),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

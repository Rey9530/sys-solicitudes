import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_providers.dart';
import '../../core/widgets/avisos.dart';
import '../../core/widgets/can.dart';
import '../../core/widgets/dialogos.dart';
import '../../core/widgets/estados.dart';
import '../../core/widgets/lista_responsive.dart';
import '../../core/widgets/pagina.dart';
import '../../core/widgets/paginador.dart';
import '../contratos/catalogo_comun.dart';
import 'inquilinos_api.dart';
import 'inquilinos_modelos.dart';
import 'inquilinos_providers.dart';
import '../../core/api/payload.dart';

/// `/admin/inquilinos` — listado con filtros razón social / identificación
/// (espejo de `admin/inquilinos/page.tsx`, `inquilinos-table.tsx` e
/// `inquilinos-filtros.tsx`).
class InquilinosPage extends ConsumerStatefulWidget {
  const InquilinosPage({super.key});

  @override
  ConsumerState<InquilinosPage> createState() => _InquilinosPageState();
}

class _InquilinosPageState extends ConsumerState<InquilinosPage> {
  final _razon = TextEditingController();
  final _identificacion = TextEditingController();
  FiltroInquilinos _filtro = (
    pagina: 1,
    razonSocial: null,
    identificacion: null,
  );

  @override
  void dispose() {
    _razon.dispose();
    _identificacion.dispose();
    super.dispose();
  }

  void _aplicar() {
    String? valor(TextEditingController c) => textoOpcional(c.text);
    final razon = valor(_razon);
    final ident = valor(_identificacion);
    if (razon == _filtro.razonSocial && ident == _filtro.identificacion) {
      return;
    }
    setState(
      () => _filtro = (pagina: 1, razonSocial: razon, identificacion: ident),
    );
  }

  void _limpiar() {
    _razon.clear();
    _identificacion.clear();
    setState(
      () => _filtro = (pagina: 1, razonSocial: null, identificacion: null),
    );
  }

  Future<void> _desactivar(Inquilino inquilino) async {
    final ok = await confirmar(
      context,
      titulo: '¿Desactivar a "${inquilino.razonSocial}"?',
      textoConfirmar: 'Sí, desactivar',
      destructiva: true,
    );
    if (!ok || !mounted) return;
    try {
      await desactivarInquilino(ref.read(apiClientProvider), inquilino.id);
      if (!mounted) return;
      mostrarExito(context, 'Inquilino desactivado');
      ref.invalidate(inquilinosProvider);
    } on Object catch (e) {
      if (mounted) mostrarError(context, e);
    }
  }

  Widget _campoTexto(Key key, TextEditingController c, String etiqueta) {
    return Focus(
      onFocusChange: (enfocado) {
        if (!enfocado) _aplicar();
      },
      child: TextField(
        key: key,
        controller: c,
        textInputAction: TextInputAction.search,
        decoration: InputDecoration(labelText: etiqueta),
        onSubmitted: (_) => _aplicar(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final datos = ref.watch(inquilinosProvider(_filtro));
    final puedeDesactivar = puedeHacer(ref, 'inquilinos.deshabilitar');
    final hayFiltros =
        _filtro.razonSocial != null || _filtro.identificacion != null;

    return ContenidoPagina(
      onRefresh: () => recargar(ref, inquilinosProvider(_filtro).future),
      children: [
        EncabezadoPagina(
          titulo: 'Inquilinos',
          subtitulo: datos.value == null
              ? null
              : '${datos.value!.total} inquilinos registrados.',
          acciones: [
            Can(
              permiso: 'inquilinos.crear',
              child: FilledButton.icon(
                key: const Key('inquilinos-nuevo'),
                onPressed: () => context.push('/admin/inquilinos/nuevo'),
                icon: const Icon(Icons.add),
                label: const Text('Nuevo inquilino'),
              ),
            ),
          ],
        ),
        PanelFiltros(
          children: [
            CampoFiltro(
              ancho: 240,
              child: _campoTexto(
                const Key('inquilinos-filtro-razon'),
                _razon,
                'Razón social',
              ),
            ),
            CampoFiltro(
              ancho: 190,
              child: _campoTexto(
                const Key('inquilinos-filtro-identificacion'),
                _identificacion,
                'Identificación',
              ),
            ),
            OutlinedButton(onPressed: _aplicar, child: const Text('Filtrar')),
            if (hayFiltros)
              TextButton(
                onPressed: _limpiar,
                child: const Text('Limpiar filtros'),
              ),
          ],
        ),
        AsyncView(
          value: datos,
          onRetry: () => ref.invalidate(inquilinosProvider(_filtro)),
          data: (pagina) => Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ListaResponsive<Inquilino>(
                items: pagina.items,
                vacio: const EmptyState(
                  icono: Icons.groups_outlined,
                  titulo: 'Sin inquilinos',
                  mensaje:
                      'No hay inquilinos que coincidan con esos criterios.',
                ),
                onTap: (i) => context.push('/admin/inquilinos/${i.id}'),
                columnas: [
                  ColumnaLista(
                    titulo: 'Razón social',
                    principal: true,
                    celda: (i) => Text(
                      i.razonSocial,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                  ),
                  ColumnaLista(
                    titulo: 'NIT',
                    celda: (i) => TextoCelda(i.identificacion, mono: true),
                  ),
                  ColumnaLista(
                    titulo: 'Nombre comercial',
                    celda: (i) => TextoCelda(i.nombreComercial),
                  ),
                  ColumnaLista(
                    titulo: 'Contacto',
                    celda: (i) => TextoCelda(i.contacto1Nombre),
                  ),
                  ColumnaLista(
                    titulo: 'Tipo',
                    celda: (i) => TextoCelda(i.tipoClienteEtiqueta),
                  ),
                ],
                acciones: puedeDesactivar
                    ? (i) => Align(
                        alignment: Alignment.centerLeft,
                        child: OutlinedButton(
                          style: OutlinedButton.styleFrom(
                            foregroundColor: Theme.of(context)
                                .colorScheme
                                .error,
                          ),
                          onPressed: () => _desactivar(i),
                          child: const Text('Desactivar'),
                        ),
                      )
                    : null,
              ),
              Paginador(
                pagina: pagina.page,
                totalPaginas: pagina.totalPages,
                onCambiar: (p) => setState(
                  () => _filtro = (
                    pagina: p,
                    razonSocial: _filtro.razonSocial,
                    identificacion: _filtro.identificacion,
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

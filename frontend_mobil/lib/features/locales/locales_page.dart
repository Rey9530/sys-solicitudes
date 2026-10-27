import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_providers.dart';
import '../../core/api/payload.dart';
import '../../core/format/validaciones.dart';
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
import 'locales_api.dart';
import 'locales_modelos.dart';
import 'locales_providers.dart';

/// `/admin/locales` — listado con filtros estado/módulo/nivel (espejo de
/// `admin/locales/page.tsx` + `locales-table.tsx` + `locales-filtros.tsx`).
class LocalesPage extends ConsumerStatefulWidget {
  const LocalesPage({super.key});

  @override
  ConsumerState<LocalesPage> createState() => _LocalesPageState();
}

class _LocalesPageState extends ConsumerState<LocalesPage> {
  final _modulo = TextEditingController();
  final _nivel = TextEditingController();
  FiltroLocales _filtro = (pagina: 1, estado: null, modulo: null, nivel: null);

  @override
  void dispose() {
    _modulo.dispose();
    _nivel.dispose();
    super.dispose();
  }

  /// Módulo y nivel se aplican con Enter o al salir del campo (como el web).
  void _aplicarTextos() {
    String? valor(TextEditingController c) => textoOpcional(c.text);
    if (valor(_modulo) == _filtro.modulo && valor(_nivel) == _filtro.nivel) {
      return;
    }
    setState(
      () => _filtro = (
        pagina: 1,
        estado: _filtro.estado,
        modulo: valor(_modulo),
        nivel: valor(_nivel),
      ),
    );
  }

  void _limpiar() {
    _modulo.clear();
    _nivel.clear();
    setState(
      () => _filtro = (pagina: 1, estado: null, modulo: null, nivel: null),
    );
  }

  Future<void> _desactivar(Local local) async {
    final ok = await confirmar(
      context,
      titulo: '¿Desactivar el local "${local.codigo}"?',
      textoConfirmar: 'Sí, desactivar',
      destructiva: true,
    );
    if (!ok || !mounted) return;
    try {
      await desactivarLocal(ref.read(apiClientProvider), local.id);
      if (!mounted) return;
      mostrarExito(context, 'Local desactivado');
      ref.invalidate(localesProvider);
    } on Object catch (e) {
      if (mounted) mostrarError(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final datos = ref.watch(localesProvider(_filtro));
    final puedeDesactivar = puedeHacer(ref, 'locales.deshabilitar');
    final hayFiltros =
        _filtro.estado != null ||
        _filtro.modulo != null ||
        _filtro.nivel != null;

    return ContenidoPagina(
      onRefresh: () => recargar(ref, localesProvider(_filtro).future),
      children: [
        EncabezadoPagina(
          titulo: 'Locales',
          subtitulo: datos.value == null
              ? null
              : '${datos.value!.total} locales · gestiona las unidades de la plaza.',
          acciones: [
            Can(
              permiso: 'locales.crear',
              child: FilledButton.icon(
                key: const Key('locales-nuevo'),
                onPressed: () => context.push('/admin/locales/nuevo'),
                icon: const Icon(Icons.add),
                label: const Text('Nuevo local'),
              ),
            ),
          ],
        ),
        TarjetaFiltros(
          enLinea: true,
          campos: [
            CampoFiltro(
              ancho: 220,
              child: CampoSelect<String>(
                key: const Key('locales-filtro-estado'),
                label: 'Estado',
                valor: _filtro.estado,
                opcionVacia: 'Todos',
                opciones: [
                  for (final e in estadosLocal) (e, estadoLocalCrudo(e)),
                ],
                onChanged: (v) => setState(
                  () => _filtro = (
                    pagina: 1,
                    estado: v,
                    modulo: _filtro.modulo,
                    nivel: _filtro.nivel,
                  ),
                ),
              ),
            ),
            CampoFiltro(
              ancho: 150,
              child: Focus(
                onFocusChange: (enfocado) {
                  if (!enfocado) _aplicarTextos();
                },
                child: TextField(
                  key: const Key('locales-filtro-modulo'),
                  controller: _modulo,
                  textInputAction: TextInputAction.search,
                  decoration: const InputDecoration(labelText: 'Módulo'),
                  onSubmitted: (_) => _aplicarTextos(),
                ),
              ),
            ),
            CampoFiltro(
              ancho: 120,
              child: Focus(
                onFocusChange: (enfocado) {
                  if (!enfocado) _aplicarTextos();
                },
                child: TextField(
                  key: const Key('locales-filtro-nivel'),
                  controller: _nivel,
                  textInputAction: TextInputAction.search,
                  decoration: const InputDecoration(labelText: 'Nivel'),
                  onSubmitted: (_) => _aplicarTextos(),
                ),
              ),
            ),
          ],
          acciones: [
            if (hayFiltros)
              TextButton(
                onPressed: _limpiar,
                child: const Text('Limpiar filtros'),
              ),
          ],
        ),
        AsyncView(
          value: datos,
          onRetry: () => ref.invalidate(localesProvider(_filtro)),
          data: (pagina) => Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ListaResponsive<Local>(
                items: pagina.items,
                vacio: const EmptyState(
                  icono: Icons.storefront_outlined,
                  titulo: 'Sin locales',
                  mensaje: 'No hay locales que coincidan con esos criterios.',
                ),
                onTap: (l) => context.push('/admin/locales/${l.id}'),
                columnas: [
                  ColumnaLista(
                    titulo: 'Módulo',
                    celda: (l) => TextoCelda(l.modulo),
                  ),
                  ColumnaLista(
                    titulo: 'Nivel',
                    celda: (l) => TextoCelda(l.nivel),
                  ),
                  ColumnaLista(
                    titulo: 'Local',
                    principal: true,
                    celda: (l) => Text(
                      l.codigo,
                      style: const TextStyle(
                        fontFamily: 'monospace',
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  ColumnaLista(
                    titulo: 'Área (m²)',
                    celda: (l) =>
                        TextoCelda(l.areaM2 == null ? null : textoDe(l.areaM2)),
                  ),
                  ColumnaLista(
                    titulo: 'Med. energía',
                    celda: (l) => TextoCelda(l.medidorEnergia, mono: true),
                  ),
                  ColumnaLista(
                    titulo: 'Med. agua',
                    celda: (l) => TextoCelda(l.medidorAgua, mono: true),
                  ),
                  ColumnaLista(
                    titulo: 'Estado',
                    celda: (l) => EstadoLocalBadge(l.estado),
                  ),
                ],
                acciones: puedeDesactivar
                    ? (l) => Align(
                        alignment: Alignment.centerLeft,
                        child: OutlinedButton(
                          style: OutlinedButton.styleFrom(
                            foregroundColor: Theme.of(context)
                                .colorScheme
                                .error,
                          ),
                          onPressed: () => _desactivar(l),
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
                    estado: _filtro.estado,
                    modulo: _filtro.modulo,
                    nivel: _filtro.nivel,
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

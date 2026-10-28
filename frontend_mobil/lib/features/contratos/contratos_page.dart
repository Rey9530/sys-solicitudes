import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/format/fechas.dart';
import '../../core/format/montos.dart';
import '../../core/widgets/badges.dart';
import '../../core/widgets/campo_select.dart';
import '../../core/widgets/can.dart';
import '../../core/widgets/celdas.dart';
import '../../core/widgets/estados.dart';
import '../../core/widgets/filtros.dart';
import '../../core/widgets/lista_responsive.dart';
import '../../core/widgets/pagina.dart';
import '../../core/widgets/paginador.dart';
import '../inquilinos/inquilinos_providers.dart';
import '../locales/locales_providers.dart';
import 'contratos_modelos.dart';
import 'contratos_providers.dart';

/// `/admin/contratos` — listado con filtros local / inquilino / estado
/// (espejo de `admin/contratos/page.tsx`, `contratos-table.tsx` y
/// `contratos-filtros.tsx`).
class ContratosPage extends ConsumerStatefulWidget {
  const ContratosPage({super.key});

  @override
  ConsumerState<ContratosPage> createState() => _ContratosPageState();
}

class _ContratosPageState extends ConsumerState<ContratosPage> {
  FiltroContratos _filtro = (
    pagina: 1,
    localId: null,
    inquilinoId: null,
    estado: null,
  );

  void _filtrar({
    int pagina = 1,
    String? localId,
    String? inquilinoId,
    String? estado,
  }) => setState(
    () => _filtro = (
      pagina: pagina,
      localId: localId,
      inquilinoId: inquilinoId,
      estado: estado,
    ),
  );

  @override
  Widget build(BuildContext context) {
    final datos = ref.watch(contratosProvider(_filtro));
    final locales = ref.watch(opcionesLocalesProvider(false)).value ?? [];
    final inquilinos = ref.watch(opcionesInquilinosProvider).value ?? [];
    final f = _filtro;
    final hayFiltros =
        f.localId != null || f.inquilinoId != null || f.estado != null;

    return ContenidoPagina(
      onRefresh: () => recargar(ref, contratosProvider(_filtro).future),
      children: [
        EncabezadoPagina(
          titulo: 'Contratos',
          subtitulo: datos.value == null
              ? null
              : '${datos.value!.total} contratos.',
          acciones: [
            Can(
              permiso: 'contratos.importar',
              child: OutlinedButton.icon(
                key: const Key('contratos-importar'),
                onPressed: () => context.push('/admin/contratos/importar'),
                icon: const Icon(Icons.table_view_outlined),
                label: const Text('Importar Excel'),
              ),
            ),
            Can(
              permiso: 'contratos.crear',
              child: FilledButton.icon(
                key: const Key('contratos-nuevo'),
                onPressed: () => context.push('/admin/contratos/nuevo'),
                icon: const Icon(Icons.add),
                label: const Text('Nuevo contrato'),
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
                key: const Key('contratos-filtro-local'),
                label: 'Local',
                valor: f.localId,
                opcionVacia: 'Todos',
                opciones: [for (final l in locales) (l.id, l.codigo)],
                onChanged: (v) => _filtrar(
                  localId: v,
                  inquilinoId: f.inquilinoId,
                  estado: f.estado,
                ),
              ),
            ),
            CampoFiltro(
              ancho: 260,
              child: CampoSelect<String>(
                key: const Key('contratos-filtro-inquilino'),
                label: 'Inquilino',
                valor: f.inquilinoId,
                opcionVacia: 'Todos',
                opciones: [for (final i in inquilinos) (i.id, i.razonSocial)],
                onChanged: (v) => _filtrar(
                  localId: f.localId,
                  inquilinoId: v,
                  estado: f.estado,
                ),
              ),
            ),
            CampoFiltro(
              ancho: 180,
              child: CampoSelect<String>(
                key: const Key('contratos-filtro-estado'),
                label: 'Estado',
                valor: f.estado,
                opcionVacia: 'Todos',
                opciones: [for (final e in estadosContrato) (e, e)],
                onChanged: (v) => _filtrar(
                  localId: f.localId,
                  inquilinoId: f.inquilinoId,
                  estado: v,
                ),
              ),
            ),
          ],
          acciones: [
            if (hayFiltros)
              TextButton(
                onPressed: _filtrar,
                child: const Text('Limpiar filtros'),
              ),
          ],
        ),
        AsyncView(
          value: datos,
          onRetry: () => ref.invalidate(contratosProvider(_filtro)),
          data: (pagina) => Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TablaContratos(
                contratos: pagina.items,
                rutaBase: '/admin/contratos',
              ),
              Paginador(
                pagina: pagina.page,
                totalPaginas: pagina.totalPages,
                onCambiar: (p) => _filtrar(
                  pagina: p,
                  localId: f.localId,
                  inquilinoId: f.inquilinoId,
                  estado: f.estado,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Tabla de contratos (admin y "Mis contratos"). El inquilino no ve la
/// columna Inquilino.
class TablaContratos extends StatelessWidget {
  const TablaContratos({
    super.key,
    required this.contratos,
    required this.rutaBase,
    this.mostrarInquilino = true,
  });

  final List<Contrato> contratos;

  /// `/admin/contratos` o `/inquilino/contratos`.
  final String rutaBase;
  final bool mostrarInquilino;

  @override
  Widget build(BuildContext context) {
    return ListaResponsive<Contrato>(
      items: contratos,
      vacio: const EmptyState(
        icono: Icons.description_outlined,
        titulo: 'Sin contratos',
        mensaje: 'No hay contratos que coincidan con esos criterios.',
      ),
      onTap: (c) => context.push('$rutaBase/${c.id}'),
      columnas: [
        ColumnaLista(
          titulo: 'Local',
          principal: true,
          celda: (c) => Text(
            c.localCodigo ??
                c.localId.substring(0, c.localId.length.clamp(0, 8)),
            style: const TextStyle(
              fontFamily: 'monospace',
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        if (mostrarInquilino)
          ColumnaLista(
            titulo: 'Inquilino',
            celda: (c) => TextoCelda(c.inquilinoRazonSocial),
          ),
        ColumnaLista(
          titulo: 'Inicio',
          celda: (c) => TextoCelda(formatFechaDMY(c.fechaInicio)),
        ),
        ColumnaLista(
          titulo: 'Fin',
          celda: (c) => TextoCelda(
            c.fechaFin == null ? 'Indefinido' : formatFechaDMY(c.fechaFin),
          ),
        ),
        ColumnaLista(
          titulo: 'Canon',
          // Canon de arrendamiento si existe; si no, el monto mensual.
          celda: (c) => TextoCelda(
            c.cuotaArrendamiento != null
                ? formatMonto(c.cuotaArrendamiento, moneda: c.moneda)
                : c.montoMensual != null
                ? formatMonto(c.montoMensual, moneda: c.moneda)
                : null,
          ),
        ),
        ColumnaLista(
          titulo: 'Estado',
          celda: (c) => EstadoContratoBadge(c.estado),
        ),
      ],
    );
  }
}

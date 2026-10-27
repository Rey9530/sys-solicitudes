import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/widgets/campos.dart';
import '../../../core/widgets/estados.dart';
import '../../../core/widgets/pagina.dart';
import '../../../core/widgets/paginador.dart';
import '../comun/filtros.dart';
import '../comun/tabla_solicitudes.dart';
import '../solicitudes_modelos.dart';
import '../solicitudes_providers.dart';

/// "Mis solicitudes" del inquilino. Espejo de
/// `frontend/src/app/(inquilino)/inquilino/solicitudes/page.tsx`.
class MisSolicitudesPage extends ConsumerStatefulWidget {
  const MisSolicitudesPage({super.key});

  @override
  ConsumerState<MisSolicitudesPage> createState() => _MisSolicitudesState();
}

class _MisSolicitudesState extends ConsumerState<MisSolicitudesPage> {
  /// Filtro aplicado (el que se consulta).
  FiltroSolicitudes _filtro = const FiltroSolicitudes();

  // Valores del formulario (se aplican con "Filtrar").
  String? _estado;
  String? _tipo;
  String? _desde;
  String? _hasta;

  void _filtrar() => setState(
    () => _filtro = FiltroSolicitudes(
      estado: _estado,
      tipo: _tipo,
      fechaDesde: _desde,
      fechaHasta: _hasta,
    ),
  );

  @override
  Widget build(BuildContext context) {
    final provider = misSolicitudesProvider(_filtro);
    final datos = ref.watch(provider);
    final total = datos.value?.total;
    return Scaffold(
      body: ContenidoPagina(
        onRefresh: () async => ref.refresh(provider.future),
        children: [
          EncabezadoPagina(
            titulo: 'Mis solicitudes',
            subtitulo: total == null ? null : '$total solicitudes.',
            acciones: [
              FilledButton.icon(
                key: const Key('nueva-solicitud'),
                onPressed: () => context.push('/inquilino/solicitudes/nueva'),
                icon: const Icon(Icons.add),
                label: const Text('Nueva solicitud'),
              ),
            ],
          ),
          TarjetaFiltros(
            onFiltrar: _filtrar,
            campos: [
              CampoSelect<String>(
                key: const Key('filtro-estado'),
                label: 'Estado',
                valor: _estado,
                opciones: opcionesEstado('Todos'),
                onChanged: (v) => setState(() => _estado = v),
              ),
              CampoSelect<String>(
                key: const Key('filtro-tipo'),
                label: 'Tipo',
                valor: _tipo,
                opciones: opcionesTipo(),
                onChanged: (v) => setState(() => _tipo = v),
              ),
              CampoFecha(
                key: const Key('filtro-desde'),
                label: 'Desde',
                valorYmd: _desde,
                permitirVacio: true,
                onChanged: (v) => setState(() => _desde = v),
              ),
              CampoFecha(
                key: const Key('filtro-hasta'),
                label: 'Hasta',
                valorYmd: _hasta,
                permitirVacio: true,
                onChanged: (v) => setState(() => _hasta = v),
              ),
            ],
          ),
          AsyncView(
            value: datos,
            onRetry: () => ref.invalidate(provider),
            data: (p) => Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TablaSolicitudes(
                  solicitudes: p.items,
                  onAbrir: (s) =>
                      context.push('/inquilino/solicitudes/${s.id}'),
                ),
                Paginador(
                  pagina: p.page,
                  totalPaginas: p.totalPages,
                  onCambiar: (n) =>
                      setState(() => _filtro = _filtro.conPagina(n)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

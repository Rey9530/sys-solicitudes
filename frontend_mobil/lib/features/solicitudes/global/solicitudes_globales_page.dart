import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/descargas/descargar_y_compartir.dart';
import '../../../core/format/fechas.dart';
import '../../../core/plaza/plaza_seleccionada.dart';
import '../../../core/widgets/campo_select.dart';
import '../../../core/widgets/campos.dart';
import '../../../core/widgets/estados.dart';
import '../../../core/widgets/pagina.dart';
import '../../../core/widgets/paginador.dart';
import '../comun/filtros.dart';
import '../comun/tabla_solicitudes.dart';
import '../solicitudes_api.dart';
import '../solicitudes_modelos.dart';
import '../solicitudes_providers.dart';

/// Cada cuánto se recarga la vista global (igual que el web).
const intervaloGlobal = Duration(minutes: 2);

/// Solicitudes de todas las plazas (superadmin, solo lectura). Espejo de
/// `frontend/src/app/(admin-plataform)/superadmin/solicitudes/page.tsx`.
class SolicitudesGlobalesPage extends ConsumerStatefulWidget {
  const SolicitudesGlobalesPage({super.key});

  @override
  ConsumerState<SolicitudesGlobalesPage> createState() =>
      _SolicitudesGlobalesState();
}

class _SolicitudesGlobalesState extends ConsumerState<SolicitudesGlobalesPage> {
  FiltroGlobal _filtro = const FiltroGlobal();

  // Valores del formulario (se aplican con "Filtrar").
  final _buscar = TextEditingController();
  String? _estado;
  String? _tipo;
  String? _prioridad;
  String? _plazaId;
  String? _desde;
  String? _hasta;

  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(intervaloGlobal, (_) {
      if (!mounted) return;
      final ciclo = WidgetsBinding.instance.lifecycleState;
      if (ciclo != null && ciclo != AppLifecycleState.resumed) return;
      if (!(ModalRoute.of(context)?.isCurrent ?? true)) return;
      ref.invalidate(solicitudesGlobalesProvider(_filtro));
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _buscar.dispose();
    super.dispose();
  }

  void _filtrar() {
    final texto = _buscar.text.trim();
    setState(
      () => _filtro = FiltroGlobal(
        search: texto.isEmpty ? null : texto,
        estado: _estado,
        tipo: _tipo,
        prioridad: _prioridad,
        plazaId: _plazaId,
        fechaDesde: _desde,
        fechaHasta: _hasta,
      ),
    );
  }

  Future<void> _exportar() {
    final hoy = fechaPlazaHoy().replaceAll('-', '');
    final filtro = _filtro;
    return descargarYCompartir(
      context,
      descargar: () => exportarCsvGlobal(ref.read(apiClientProvider), filtro),
      nombreArchivo: 'solicitudes-plataforma-$hoy.csv',
      mimeType: 'text/csv',
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = solicitudesGlobalesProvider(_filtro);
    final datos = ref.watch(provider);
    final plazas = ref.watch(plazasProvider).value ?? const [];
    final total = datos.value?.total;
    return Scaffold(
      body: ContenidoPagina(
        onRefresh: () => recargar(ref, provider.future),
        children: [
          EncabezadoPagina(
            titulo: 'Solicitudes globales',
            subtitulo: total == null
                ? null
                : '$total resultados en todas las plazas · solo lectura · '
                      'sin acciones de workflow.',
            acciones: [
              const BadgeAutorefresco('2 min'),
              OutlinedButton.icon(
                key: const Key('exportar-csv'),
                onPressed: _exportar,
                icon: const Icon(Icons.download_outlined),
                label: const Text('Exportar CSV'),
              ),
            ],
          ),
          TarjetaFiltros(
            onFiltrar: _filtrar,
            campos: [
              TextField(
                key: const Key('filtro-buscar'),
                controller: _buscar,
                maxLength: 100,
                textInputAction: TextInputAction.search,
                onSubmitted: (_) => _filtrar(),
                decoration: const InputDecoration(
                  labelText: 'Buscar',
                  hintText: 'Código, título o local',
                  counterText: '',
                ),
              ),
              CampoSelect<String>(
                key: const Key('filtro-estado'),
                label: 'Estado',
                valor: _estado,
                opcionVacia: 'Todos los estados',
                opciones: opcionesEstado(),
                onChanged: (v) => setState(() => _estado = v),
              ),
              CampoSelect<String>(
                key: const Key('filtro-tipo'),
                label: 'Tipo',
                valor: _tipo,
                opcionVacia: 'Todos',
                opciones: opcionesTipo(),
                onChanged: (v) => setState(() => _tipo = v),
              ),
              CampoSelect<String>(
                key: const Key('filtro-prioridad'),
                label: 'Prioridad',
                valor: _prioridad,
                opcionVacia: 'Toda',
                opciones: opcionesPrioridad(),
                onChanged: (v) => setState(() => _prioridad = v),
              ),
              CampoSelect<String>(
                key: const Key('filtro-plaza'),
                label: 'Plaza',
                valor: _plazaId,
                opcionVacia: 'Todas las plazas',
                opciones: [for (final p in plazas) (p.id, p.nombreComercial)],
                onChanged: (v) => setState(() => _plazaId = v),
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
                  conSla: true,
                  conAsignado: true,
                  conPlaza: true,
                  onAbrir: (s) =>
                      context.push('/superadmin/solicitudes/${s.id}'),
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

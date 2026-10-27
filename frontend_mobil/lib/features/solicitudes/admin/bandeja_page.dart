import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/widgets/campo_select.dart';
import '../../../core/widgets/estados.dart';
import '../../../core/widgets/filtros.dart';
import '../../../core/widgets/pagina.dart';
import '../../../core/widgets/paginador.dart';
import '../comun/filtros.dart';
import '../comun/tabla_solicitudes.dart';
import '../solicitudes_modelos.dart';
import '../solicitudes_providers.dart';

/// Cada cuánto se recarga la bandeja mientras está visible (igual que el web).
const intervaloBandeja = Duration(seconds: 60);

/// Bandeja de solicitudes del admin. Espejo de
/// `frontend/src/app/(admin-plaza)/admin/solicitudes/page.tsx`.
class BandejaPage extends ConsumerStatefulWidget {
  const BandejaPage({super.key});

  @override
  ConsumerState<BandejaPage> createState() => _BandejaState();
}

class _BandejaState extends ConsumerState<BandejaPage> {
  FiltroBandeja _filtro = const FiltroBandeja();

  // Valores del formulario (se aplican con "Filtrar").
  String? _estado;
  String? _tipo;
  String? _prioridad;
  String _orden = 'fecha';

  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(intervaloBandeja, (_) => _autorefrescar());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  /// Solo recarga si la app está en primer plano y la bandeja es la pantalla
  /// visible (no con un detalle encima).
  void _autorefrescar() {
    if (!mounted) return;
    final ciclo = WidgetsBinding.instance.lifecycleState;
    if (ciclo != null && ciclo != AppLifecycleState.resumed) return;
    if (!(ModalRoute.of(context)?.isCurrent ?? true)) return;
    ref.invalidate(bandejaProvider(_filtro));
  }

  void _filtrar() => setState(
    () => _filtro = FiltroBandeja(
      estado: _estado,
      tipo: _tipo,
      prioridad: _prioridad,
      orden: _orden,
      asignadasAMi: _filtro.asignadasAMi,
    ),
  );

  @override
  Widget build(BuildContext context) {
    final provider = bandejaProvider(_filtro);
    final datos = ref.watch(provider);
    final total = datos.value?.total;
    final ordenTexto = _filtro.orden == 'prioridad'
        ? 'ordenadas por prioridad (A→F)'
        : 'ordenadas por fecha, más reciente primero';
    return Scaffold(
      body: ContenidoPagina(
        onRefresh: () => recargar(ref, provider.future),
        children: [
          EncabezadoPagina(
            titulo: 'Bandeja de solicitudes',
            subtitulo: total == null
                ? null
                : '$total resultados · $ordenTexto · semáforo SLA.',
            acciones: [
              const BadgeAutorefresco('60 s'),
              SegmentedButton<bool>(
                key: const Key('segmento-asignadas'),
                showSelectedIcon: false,
                segments: const [
                  ButtonSegment(value: false, label: Text('Todas')),
                  ButtonSegment(value: true, label: Text('Asignadas a mí')),
                ],
                selected: {_filtro.asignadasAMi},
                onSelectionChanged: (s) => setState(
                  () =>
                      _filtro = _filtro.copiar(page: 1, asignadasAMi: s.first),
                ),
              ),
            ],
          ),
          TarjetaFiltros(
            plegable: true,
            onFiltrar: _filtrar,
            campos: [
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
                key: const Key('filtro-orden'),
                label: 'Ordenar por',
                valor: _orden,
                opciones: const [
                  ('fecha', 'Fecha (más reciente primero)'),
                  ('prioridad', 'Prioridad (A→F)'),
                ],
                onChanged: (v) => setState(() => _orden = v ?? 'fecha'),
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
                  onAbrir: (s) => context.push('/admin/solicitudes/${s.id}'),
                ),
                Paginador(
                  pagina: p.page,
                  totalPaginas: p.totalPages,
                  onCambiar: (n) =>
                      setState(() => _filtro = _filtro.copiar(page: n)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

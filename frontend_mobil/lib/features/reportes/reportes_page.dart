import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_error.dart';
import '../../core/api/api_providers.dart';
import '../../core/descargas/descargar_y_compartir.dart';
import '../../core/format/fechas.dart';
import '../../core/theme/colores.dart';
import '../../core/widgets/avisos.dart';
import '../../core/widgets/badges.dart';
import '../../core/widgets/campos.dart';
import '../../core/widgets/can.dart';
import '../../core/widgets/pagina.dart';
import 'reportes_api.dart';
import 'reportes_providers.dart';
import 'widgets/rejilla_campos.dart';

/// `/admin/reportes`: generador de reportes con filtros por entidad,
/// previsualización (primeras 10 filas) y exportación CSV/XLSX/PDF
/// (`components/client/reportes-generator.tsx`). El archivo se descarga y se
/// abre la hoja de compartir del sistema.
class ReportesPage extends ConsumerStatefulWidget {
  const ReportesPage({super.key});

  @override
  ConsumerState<ReportesPage> createState() => _ReportesPageState();
}

class _ReportesPageState extends ConsumerState<ReportesPage> {
  String _entidad = 'solicitudes';
  String _formato = 'csv';

  /// Filtros de la entidad (solo los que tienen valor).
  Map<String, String> _filtros = {};
  final _busqueda = TextEditingController();
  PreviewReporte? _preview;
  String? _error;
  bool _cargando = false;

  @override
  void dispose() {
    _busqueda.dispose();
    super.dispose();
  }

  void _setFiltro(String clave, String? valor) {
    setState(() {
      final nuevos = {..._filtros};
      if (valor == null || valor.isEmpty) {
        nuevos.remove(clave);
      } else {
        nuevos[clave] = valor;
      }
      _filtros = nuevos;
    });
  }

  /// Cambiar de entidad borra los filtros y la previsualización.
  void _cambiarEntidad(String entidad) {
    _busqueda.clear();
    setState(() {
      _entidad = entidad;
      _filtros = {};
      _preview = null;
      _error = null;
    });
  }

  Future<void> _previsualizar() async {
    setState(() {
      _cargando = true;
      _error = null;
    });
    try {
      final r = await previsualizarReporte(
        ref.read(apiClientProvider),
        _entidad,
        _filtros,
      );
      if (mounted) setState(() => _preview = r);
    } on ApiError catch (e) {
      if (mounted) setState(() => _error = e.mensaje);
    } finally {
      if (mounted) setState(() => _cargando = false);
    }
  }

  Future<void> _generar(BuildContext botonContext) {
    final api = ref.read(apiClientProvider);
    final entidad = _entidad;
    final formato = _formato;
    final filtros = {..._filtros};
    final fecha = fechaPlazaHoy().replaceAll('-', '');
    return descargarYCompartir(
      botonContext,
      descargar: () => exportarReporte(api, entidad, formato, filtros),
      nombreArchivo: '$entidad-$fecha.$formato',
      mimeType: formatosReporte[formato]!,
    );
  }

  @override
  Widget build(BuildContext context) {
    final opciones = ref.watch(opcionesReporteProvider).value;
    return ContenidoPagina(
      children: [
        const EncabezadoPagina(
          titulo: 'Reportes',
          subtitulo:
              'Exporta solicitudes, locales e inquilinos a CSV, XLSX o PDF. '
              'Rango máximo: 12 meses.',
        ),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                RejillaCampos(
                  children: [
                    SelectorFiltro<String>(
                      etiqueta: 'Entidad',
                      textoTodos: null,
                      valor: _entidad,
                      opciones: entidadesReporte,
                      onChanged: (v) {
                        if (v != null && v != _entidad) _cambiarEntidad(v);
                      },
                    ),
                    ..._camposEntidad(opciones),
                    SelectorFiltro<String>(
                      etiqueta: 'Formato',
                      textoTodos: null,
                      valor: _formato,
                      opciones: [
                        for (final f in formatosReporte.keys)
                          (f, f.toUpperCase()),
                      ],
                      onChanged: (v) => setState(() => _formato = v ?? 'csv'),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    Can(
                      permiso: 'reportes.preview',
                      child: OutlinedButton(
                        key: const Key('reporte-previsualizar'),
                        onPressed: _cargando ? null : _previsualizar,
                        child: const Text('Previsualizar'),
                      ),
                    ),
                    Can(
                      permiso: 'reportes.exportar_$_formato',
                      child: Builder(
                        builder: (botonContext) => FilledButton(
                          key: const Key('reporte-generar'),
                          onPressed: () => _generar(botonContext),
                          child: const Text('Generar'),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        if (_error != null) ...[
          const SizedBox(height: 12),
          AvisoBanner(tono: Tono.danger, child: Text(_error!)),
        ],
        if (_cargando)
          const Padding(
            padding: EdgeInsets.all(24),
            child: Center(child: CircularProgressIndicator()),
          ),
        if (_preview != null) ...[
          const SizedBox(height: 12),
          _Previsualizacion(preview: _preview!),
        ],
        const SizedBox(height: 12),
        const _HistorialPlaceholder(),
      ],
    );
  }

  List<Widget> _camposEntidad(OpcionesReporte? o) {
    switch (_entidad) {
      case 'solicitudes':
        return [
          SelectorFiltro<String>(
            etiqueta: 'Estado',
            valor: _filtros['estado'],
            opciones: etiquetaEstadoSolicitud.entries
                .map((e) => (e.key, e.value))
                .toList(),
            onChanged: (v) => _setFiltro('estado', v),
          ),
          SelectorFiltro<String>(
            etiqueta: 'Tipo',
            valor: _filtros['tipo'],
            opciones: o?.tipos ?? const [],
            onChanged: (v) => _setFiltro('tipo', v),
          ),
          SelectorFiltro<String>(
            etiqueta: 'Local',
            valor: _filtros['localId'],
            opciones: o?.locales ?? const [],
            onChanged: (v) => _setFiltro('localId', v),
          ),
          SelectorFiltro<String>(
            etiqueta: 'Inquilino',
            valor: _filtros['inquilinoId'],
            opciones: o?.inquilinos ?? const [],
            onChanged: (v) => _setFiltro('inquilinoId', v),
          ),
          CampoFecha(
            label: 'Desde',
            valorYmd: _filtros['fechaDesde'],
            permitirVacio: true,
            onChanged: (v) => _setFiltro('fechaDesde', v),
          ),
          CampoFecha(
            label: 'Hasta',
            valorYmd: _filtros['fechaHasta'],
            permitirVacio: true,
            onChanged: (v) => _setFiltro('fechaHasta', v),
          ),
        ];
      case 'locales':
        return [
          SelectorFiltro<String>(
            etiqueta: 'Estado',
            valor: _filtros['estado'],
            opciones: etiquetaEstadoLocal.entries
                .map((e) => (e.key, e.value))
                .toList(),
            onChanged: (v) => _setFiltro('estado', v),
          ),
        ];
      default:
        return [
          TextField(
            key: const Key('reporte-buscar'),
            controller: _busqueda,
            maxLength: 120,
            decoration: const InputDecoration(
              labelText: 'Buscar',
              hintText: 'razón social…',
              counterText: '',
            ),
            onChanged: (v) => _setFiltro('search', v.trim()),
          ),
        ];
    }
  }
}

/// "Previsualización — primeros N de TOTAL registros": tabla con las claves de
/// la primera fila como cabeceras (scroll horizontal si no cabe).
class _Previsualizacion extends StatelessWidget {
  const _Previsualizacion({required this.preview});

  final PreviewReporte preview;

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    final filas = preview.filas;
    final cabeceras = filas.isEmpty ? <String>[] : filas.first.keys.toList();
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Previsualización — primeros ${filas.length} de '
              '${preview.total} registros',
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 10),
            if (filas.isEmpty)
              Text(
                'No hay registros con esos filtros.',
                style: TextStyle(color: c.text3),
              )
            else
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: DataTable(
                  headingRowHeight: 36,
                  dataRowMinHeight: 36,
                  dataRowMaxHeight: 56,
                  columnSpacing: 18,
                  horizontalMargin: 4,
                  headingTextStyle: TextStyle(
                    color: c.text3,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                  columns: [
                    for (final h in cabeceras) DataColumn(label: Text(h)),
                  ],
                  rows: [
                    for (final f in filas)
                      DataRow(
                        cells: [
                          for (final h in cabeceras)
                            DataCell(
                              ConstrainedBox(
                                constraints: const BoxConstraints(
                                  maxWidth: 240,
                                ),
                                child: Text(
                                  '${f[h] ?? ''}',
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(fontSize: 12.5),
                                ),
                              ),
                            ),
                        ],
                      ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _HistorialPlaceholder extends StatelessWidget {
  const _HistorialPlaceholder();

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Historial de reportes',
              style: TextStyle(fontWeight: FontWeight.w600, color: c.text2),
            ),
            const SizedBox(height: 4),
            Text(
              'Los reportes programados y el historial de generación quedan '
              'fuera de v1 (placeholder).',
              style: TextStyle(color: c.text3, fontSize: 13.5),
            ),
          ],
        ),
      ),
    );
  }
}

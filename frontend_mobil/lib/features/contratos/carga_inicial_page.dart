import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/adjuntos/adjuntos.dart';
import '../../core/api/api_providers.dart';
import '../../core/descargas/descargar_y_compartir.dart';
import '../../core/format/fechas.dart';
import '../../core/format/montos.dart';
import '../../core/theme/colores.dart';
import '../../core/widgets/avisos.dart';
import '../../core/widgets/badges.dart';
import '../../core/widgets/can.dart';
import '../../core/widgets/dialogos.dart';
import '../../core/widgets/estados.dart';
import '../../core/widgets/lista_responsive.dart';
import '../../core/widgets/pagina.dart';
import '../../core/widgets/pestanas.dart';
import '../inquilinos/inquilinos_providers.dart';
import '../locales/locales_providers.dart';
import 'contratos_api.dart';
import 'contratos_modelos.dart';
import 'contratos_providers.dart';

/// `/admin/contratos/importar` — carga inicial desde Excel (espejo de
/// `carga-inicial-importer.tsx`): elegir el `.xlsx`, ver la vista previa
/// (no guarda nada) y, al confirmar, reenviar el mismo archivo para crear
/// locales, inquilinos y contratos en una sola transacción.
class CargaInicialPage extends StatelessWidget {
  const CargaInicialPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const ContenidoPagina(
      children: [
        EncabezadoPagina(
          titulo: 'Carga inicial desde Excel',
          subtitulo:
              'Crea locales, inquilinos y contratos desde una plantilla, en un '
              'solo paso.',
          rutaVolver: '/admin/contratos',
        ),
        Can(
          permiso: 'contratos.importar',
          otherwise: Card(
            child: EmptyState(
              icono: Icons.block,
              titulo: 'Sin permiso',
              mensaje:
                  'Tu rol no tiene el permiso para importar la carga inicial.',
            ),
          ),
          child: _Importador(),
        ),
      ],
    );
  }
}

class _Importador extends ConsumerStatefulWidget {
  const _Importador();

  @override
  ConsumerState<_Importador> createState() => _ImportadorState();
}

class _ImportadorState extends ConsumerState<_Importador> {
  ArchivoElegido? _archivo;
  ResultadoAnalisisCarga? _resultado;
  bool _analizando = false;
  bool _importando = false;

  bool get _ocupado => _analizando || _importando;

  Future<void> _descargarPlantilla() => descargarYCompartir(
    context,
    descargar: () async =>
        (await rootBundle.load(plantillaCargaInicial)).buffer.asUint8List(),
    nombreArchivo: 'plantilla-carga-inicial.xlsx',
    mimeType: mimeXlsx,
  );

  Future<void> _elegir() async {
    final archivos = await ref
        .read(selectorArchivosProvider)
        .elegirArchivos(extensiones: const ['xlsx']);
    if (archivos.isEmpty || !mounted) return;
    final archivo = archivos.first;
    if (!archivo.nombre.toLowerCase().endsWith('.xlsx')) {
      mostrarError(
        context,
        '${archivo.nombre}: solo se aceptan archivos Excel .xlsx.',
      );
      return;
    }
    if (archivo.bytes.length > cargaInicialMaxBytes) {
      mostrarError(context, '${archivo.nombre}: supera el máximo de 5 MB.');
      return;
    }
    setState(() {
      _archivo = archivo;
      _resultado = null;
      _analizando = true;
    });
    try {
      final r = await analizarCargaInicial(
        ref.read(apiClientProvider),
        nombre: archivo.nombre,
        bytes: archivo.bytes,
      );
      if (mounted) setState(() => _resultado = r);
    } on Object catch (e) {
      if (mounted) mostrarError(context, e);
    } finally {
      if (mounted) setState(() => _analizando = false);
    }
  }

  Future<void> _importar() async {
    final archivo = _archivo;
    final t = _resultado?.totales;
    if (archivo == null || t == null) return;
    final omitidos = t.filasConError > 0 || t.contratosOmitidos > 0
        ? '\nNo se importan: ${t.filasConError} fila(s) con error y '
              '${t.contratosOmitidos} contrato(s) omitido(s).'
        : '';
    final ok = await confirmar(
      context,
      titulo: '¿Importar la carga inicial?',
      mensaje:
          'Se crearán ${t.localesCrear} locales, ${t.inquilinosCrear} '
          'inquilinos y ${t.contratosCrear} contratos.$omitidos\n'
          'La importación no se puede deshacer en bloque.',
      textoConfirmar: 'Sí, importar',
    );
    if (!ok || !mounted) return;
    setState(() => _importando = true);
    try {
      final r = await ejecutarCargaInicial(
        ref.read(apiClientProvider),
        nombre: archivo.nombre,
        bytes: archivo.bytes,
      );
      if (!mounted) return;
      setState(() => _resultado = r);
      final c = r.totales;
      mostrarExito(
        context,
        'Importación completada: ${c.localesCrear} locales, '
        '${c.inquilinosCrear} inquilinos y ${c.contratosCrear} contratos.',
      );
      ref.invalidate(contratosProvider);
      ref.invalidate(localesProvider);
      ref.invalidate(inquilinosProvider);
      // Filtros de Contratos (la lista sigue montada debajo de esta página).
      ref.invalidate(opcionesLocalesProvider);
      ref.invalidate(opcionesInquilinosProvider);
    } on Object catch (e) {
      if (mounted) mostrarError(context, e);
    } finally {
      if (mounted) setState(() => _importando = false);
    }
  }

  void _reiniciar() => setState(() {
    _archivo = null;
    _resultado = null;
  });

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    final negrita = const TextStyle(fontWeight: FontWeight.w600);
    final resultado = _resultado;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Seccion(
          titulo: '1 · Prepara el archivo',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text.rich(
                TextSpan(
                  children: [
                    const TextSpan(
                      text:
                          'Cada fila de la plantilla es un local con su '
                          'inquilino y su contrato. Columnas obligatorias: ',
                    ),
                    TextSpan(text: 'MODULO', style: negrita),
                    const TextSpan(text: ' y '),
                    TextSpan(text: 'LOCAL', style: negrita),
                    const TextSpan(
                      text: ' (forman el código del local, p. ej. K-1), ',
                    ),
                    TextSpan(text: 'RAZON SOCIAL', style: negrita),
                    const TextSpan(text: ' (o NOMBRE COMERCIAL) y '),
                    TextSpan(text: 'FECHA INICIO DE CONTRATO', style: negrita),
                    const TextSpan(text: '.'),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Sin fecha de fin el contrato queda indefinido. No se crean '
                'cuentas de usuario: dalas de alta después desde cada '
                'inquilino. Volver a importar el mismo archivo no duplica '
                'nada.',
                style: TextStyle(color: c.text3),
              ),
              const SizedBox(height: 8),
              Text(
                'La plantilla trae 3 filas de ejemplo (en amarillo): un local '
                'con contrato completo, el mismo inquilino en un segundo local '
                'con contrato indefinido y un local disponible. Se ignoran al '
                'importar, así que puedes escribir debajo o sobre ellas.',
                style: TextStyle(color: c.text3),
              ),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                key: const Key('carga-plantilla'),
                onPressed: _descargarPlantilla,
                icon: const Icon(Icons.download_outlined),
                label: const Text('Descargar plantilla con ejemplos'),
              ),
            ],
          ),
        ),
        Seccion(
          titulo: '2 · Sube el Excel y revisa la vista previa',
          child: Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: c.surface2,
              border: Border.all(color: c.borderStrong),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Column(
              children: [
                if (_analizando) ...[
                  const SizedBox(
                    width: 28,
                    height: 28,
                    child: CircularProgressIndicator(strokeWidth: 3),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    'Analizando ${_archivo?.nombre ?? ''}…',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: c.text3),
                  ),
                ] else ...[
                  Icon(Icons.table_view_outlined, size: 32, color: c.text3),
                  const SizedBox(height: 8),
                  if (_archivo != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Text(
                        _archivo!.nombre,
                        textAlign: TextAlign.center,
                        style: negrita,
                      ),
                    ),
                  FilledButton.tonalIcon(
                    key: const Key('carga-elegir'),
                    onPressed: _ocupado ? null : _elegir,
                    icon: const Icon(Icons.upload_file),
                    label: Text(
                      _archivo == null
                          ? 'Elige un archivo'
                          : 'Elige otro archivo',
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Solo .xlsx · máx. 5 MB',
                    style: TextStyle(color: c.textMuted, fontSize: 12),
                  ),
                ],
              ],
            ),
          ),
        ),
        if (resultado != null)
          _ResultadoCarga(
            resultado: resultado,
            importando: _importando,
            puedeImportar: !resultado.nadaQueCrear && !_ocupado,
            onImportar: _importar,
            onReiniciar: _reiniciar,
          ),
      ],
    );
  }
}

/// Vista previa (análisis) o resultado (ejecución).
class _ResultadoCarga extends StatelessWidget {
  const _ResultadoCarga({
    required this.resultado,
    required this.importando,
    required this.puedeImportar,
    required this.onImportar,
    required this.onReiniciar,
  });

  final ResultadoAnalisisCarga resultado;
  final bool importando;
  final bool puedeImportar;
  final VoidCallback onImportar;
  final VoidCallback onReiniciar;

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    final t = resultado.totales;
    final ejecutado = resultado.ejecutado;
    final nota = TextStyle(color: c.text3, fontSize: 13);
    List<FilaCarga> filas(String estado) =>
        resultado.filas.where((f) => f.estado == estado).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Acciones ARRIBA: con cientos de filas, abajo no se verían.
        Seccion(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (ejecutado)
                Row(
                  children: [
                    Icon(Icons.check_circle_outline, color: c.tono(Tono.ok).fg),
                    const SizedBox(width: 8),
                    const Expanded(
                      child: Text(
                        'Importación completada. Los datos ya están '
                        'disponibles en la plaza.',
                        style: TextStyle(fontWeight: FontWeight.w600),
                      ),
                    ),
                  ],
                )
              else
                Text.rich(
                  key: const Key('carga-resumen'),
                  TextSpan(
                    children: [
                      const TextSpan(text: 'Vista previa de '),
                      TextSpan(
                        text: resultado.archivo,
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      TextSpan(
                        text: ' (hoja «${resultado.hoja}», ${t.filas} filas): ',
                      ),
                      const TextSpan(
                        text: 'todavía no se ha guardado nada',
                        style: TextStyle(fontWeight: FontWeight.w600),
                      ),
                      const TextSpan(text: '.'),
                    ],
                  ),
                ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: ejecutado
                    ? [
                        OutlinedButton(
                          onPressed: () => context.go('/admin/contratos'),
                          child: const Text('Ver contratos'),
                        ),
                        OutlinedButton(
                          onPressed: () => context.go('/admin/locales'),
                          child: const Text('Ver locales'),
                        ),
                        OutlinedButton(
                          onPressed: () => context.go('/admin/inquilinos'),
                          child: const Text('Ver inquilinos'),
                        ),
                        OutlinedButton(
                          onPressed: onReiniciar,
                          child: const Text('Importar otro archivo'),
                        ),
                      ]
                    : [
                        OutlinedButton(
                          onPressed: importando ? null : onReiniciar,
                          child: const Text('Cancelar'),
                        ),
                        FilledButton.icon(
                          key: const Key('carga-importar'),
                          onPressed: puedeImportar ? onImportar : null,
                          icon: importando
                              ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Icon(Icons.table_view_outlined),
                          label: Text(importando ? 'Importando…' : 'Importar'),
                        ),
                      ],
              ),
            ],
          ),
        ),
        _Kpis(
          kpis: [
            (
              ejecutado ? 'Locales creados' : 'Locales a crear',
              t.localesCrear,
              Icons.storefront_outlined,
              Tono.info,
            ),
            (
              ejecutado ? 'Inquilinos creados' : 'Inquilinos a crear',
              t.inquilinosCrear,
              Icons.groups_outlined,
              Tono.violet,
            ),
            (
              ejecutado ? 'Contratos creados' : 'Contratos a crear',
              t.contratosCrear,
              Icons.description_outlined,
              Tono.ok,
            ),
            (
              'Filas con advertencia',
              t.filasConAdvertencia,
              Icons.warning_amber_outlined,
              Tono.warn,
            ),
            (
              'Filas con error',
              t.filasConError,
              Icons.cancel_outlined,
              Tono.danger,
            ),
          ],
        ),
        if (t.localesExistentes > 0 ||
            t.inquilinosExistentes > 0 ||
            t.contratosExistentes > 0)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(
              'Ya existían en la plaza y se reutilizan: '
              '${t.localesExistentes} locales, ${t.inquilinosExistentes} '
              'inquilinos y ${t.contratosExistentes} contratos.',
              style: nota,
            ),
          ),
        if (resultado.filasEjemplo.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(
              'Se ignoraron las filas de ejemplo de la plantilla '
              '(${resultado.filasEjemplo.join(', ')}): su COMENTARIOS empieza '
              'con «EJEMPLO».',
              style: nota,
            ),
          ),
        if (resultado.columnasFaltantes.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(
              'Columnas no encontradas (se toman como vacías): '
              '${resultado.columnasFaltantes.join(', ')}.',
              style: nota,
            ),
          ),
        const SizedBox(height: 6),
        Pestanas(
          pestanas: [
            Pestana(
              'Todas',
              () => _TablaFilas(filas: resultado.filas, ejecutado: ejecutado),
              contador: t.filas,
            ),
            Pestana(
              'Con advertencia',
              () => _TablaFilas(
                filas: filas('advertencia'),
                ejecutado: ejecutado,
              ),
              contador: t.filasConAdvertencia,
            ),
            Pestana(
              'Con error',
              () => _TablaFilas(filas: filas('error'), ejecutado: ejecutado),
              contador: t.filasConError,
            ),
          ],
        ),
      ],
    );
  }
}

/// Tarjetas de totales (2 columnas en teléfono, 3 en tablet, 5 si caben).
class _Kpis extends StatelessWidget {
  const _Kpis({required this.kpis});

  final List<(String, int, IconData, Tono)> kpis;

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final ancho = constraints.maxWidth;
          final columnas = ancho < 420 ? 2 : (ancho < 820 ? 3 : 5);
          const gap = 10.0;
          final anchoKpi = (ancho - gap * (columnas - 1)) / columnas;
          return Wrap(
            spacing: gap,
            runSpacing: gap,
            children: [
              for (final (etiqueta, valor, icono, tono) in kpis)
                SizedBox(
                  width: anchoKpi,
                  child: Card(
                    margin: EdgeInsets.zero,
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(icono, size: 20, color: c.tono(tono).fg),
                          const SizedBox(height: 6),
                          Text(
                            '$valor',
                            style: const TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          Text(
                            etiqueta,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(color: c.text3, fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

/// Filas del análisis. En la tabla cada celda es compacta (la fila mide como
/// máximo 72 px); tocar una fila abre todos sus mensajes.
class _TablaFilas extends StatelessWidget {
  const _TablaFilas({required this.filas, required this.ejecutado});

  final List<FilaCarga> filas;
  final bool ejecutado;

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    final chico = TextStyle(color: c.text3, fontSize: 12);
    Widget conBadge(String? texto, Widget badge, {bool mono = false}) => Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (texto != null)
          Text(
            texto,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(fontFamily: mono ? 'monospace' : null),
          ),
        const SizedBox(height: 3),
        badge,
      ],
    );
    return ListaResponsive<FilaCarga>(
      items: filas,
      vacio: Padding(
        padding: const EdgeInsets.all(16),
        child: Text('Sin filas en esta categoría.', style: chico),
      ),
      onTap: (f) => _verFila(context, f, ejecutado),
      columnas: [
        ColumnaLista(
          titulo: 'Fila',
          principal: true,
          celda: (f) => Text(
            'Fila ${f.fila}',
            style: const TextStyle(fontFamily: 'monospace'),
          ),
        ),
        ColumnaLista(
          titulo: 'Local',
          celda: (f) => f.local == null
              ? const Text('—')
              : conBadge(
                  f.local!.nombre,
                  AccionCargaBadge(entidad: f.local!, ejecutado: ejecutado),
                  mono: true,
                ),
        ),
        ColumnaLista(
          titulo: 'Inquilino',
          celda: (f) => f.inquilino == null
              ? const Text('—')
              : conBadge(
                  f.inquilino!.nombre,
                  AccionCargaBadge(entidad: f.inquilino!, ejecutado: ejecutado),
                ),
        ),
        ColumnaLista(
          titulo: 'Contrato',
          celda: (f) {
            final contrato = f.contrato;
            if (contrato == null) return const Text('—');
            return Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AccionCargaBadge(
                  entidad: EntidadCarga(accion: contrato.accion, nombre: ''),
                  ejecutado: ejecutado,
                ),
                if (contrato.fechaInicio != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 3),
                    child: Text(
                      'Desde ${formatFechaDMY(contrato.fechaInicio)}'
                      '${contrato.montoMensual == null ? '' : ' · ${formatMonto(contrato.montoMensual)}'}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: chico,
                    ),
                  ),
              ],
            );
          },
        ),
        ColumnaLista(
          titulo: 'Estado',
          celda: (f) => Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              EstadoFilaBadge(f.estado),
              if (f.mensajes.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 3),
                  child: Text(
                    f.mensajes.map((m) => m.texto).join(' · '),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: chico,
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Hoja con el detalle completo de una fila (todos los mensajes).
void _verFila(BuildContext context, FilaCarga f, bool ejecutado) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (context) {
      final c = ColoresPlazapp.of(context);
      return SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              spacing: 10,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                Text(
                  'Fila ${f.fila}',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                EstadoFilaBadge(f.estado),
              ],
            ),
            const SizedBox(height: 12),
            for (final (etiqueta, entidad) in [
              ('Local', f.local),
              ('Inquilino', f.inquilino),
            ])
              if (entidad != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Wrap(
                    spacing: 8,
                    runSpacing: 4,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Text('$etiqueta: ${entidad.nombre}'),
                      AccionCargaBadge(entidad: entidad, ejecutado: ejecutado),
                    ],
                  ),
                ),
            if (f.mensajes.isEmpty)
              Text('Sin mensajes.', style: TextStyle(color: c.text3))
            else
              for (final m in f.mensajes)
                Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Text(
                    '• ${m.texto}',
                    style: TextStyle(
                      color: m.nivel == 'info' ? c.text3 : c.text,
                    ),
                  ),
                ),
          ],
        ),
      );
    },
  );
}

/// Qué se hará con el local/inquilino/contrato de la fila.
class AccionCargaBadge extends StatelessWidget {
  const AccionCargaBadge({
    super.key,
    required this.entidad,
    required this.ejecutado,
  });

  final EntidadCarga entidad;
  final bool ejecutado;

  @override
  Widget build(BuildContext context) {
    final (texto, tono) = switch (entidad.accion) {
      'crear' => (ejecutado ? 'Creado' : 'Nuevo', Tono.info),
      'existente' => ('Ya existe', Tono.neutral),
      'repetido' => ('Igual a fila ${entidad.filaOrigen ?? '?'}', Tono.neutral),
      _ => ('No se crea', Tono.warn),
    };
    return BadgePlazapp(texto, tono, punto: false);
  }
}

/// OK / Advertencia / Error de una fila.
class EstadoFilaBadge extends StatelessWidget {
  const EstadoFilaBadge(this.estado, {super.key});

  final String estado;

  @override
  Widget build(BuildContext context) {
    final (texto, tono) = switch (estado) {
      'ok' => ('OK', Tono.ok),
      'advertencia' => ('Advertencia', Tono.warn),
      _ => ('Error', Tono.danger),
    };
    return BadgePlazapp(texto, tono);
  }
}

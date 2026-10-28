import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api/api_providers.dart';
import '../format/fechas.dart';
import '../theme/colores.dart';
import '../widgets/avisos.dart';
import '../widgets/dialogos.dart';
import 'adjuntos.dart';
import 'mime_permitidos.dart';

/// Lista de adjuntos con subir (archivo o foto), descargar y eliminar.
/// Equivalente a `AdjuntoUploader` del web. No hace scroll propio: va dentro
/// de `ContenidoPagina` (o de otra lista).
class AdjuntosSeccion extends ConsumerStatefulWidget {
  const AdjuntosSeccion({
    super.key,
    required this.adjuntos,
    required this.subir,
    required this.puedeSubir,
    this.eliminar,
    this.puedeEliminar = true,
    this.eliminable,
    this.maximo = maxAdjuntosSolicitud,
    this.soloExtensiones,
    this.alCambiar,
  });

  final List<Adjunto> adjuntos;

  /// Sube un archivo ya validado (nombre, contenido, MIME declarado).
  final Future<void> Function(String nombre, Uint8List bytes, String mime)
  subir;
  final bool puedeSubir;

  /// Si es null, se usa `DELETE /adjuntos/:id`.
  final Future<void> Function(Adjunto adjunto)? eliminar;
  final bool puedeEliminar;

  /// Criterio por adjunto, además de [puedeEliminar] (p. ej. el inquilino solo
  /// borra lo que él subió). Si es null, todos se pueden eliminar.
  final bool Function(Adjunto adjunto)? eliminable;
  final int maximo;

  /// Restringe los tipos (p. ej. [extensionesImagen] para locales).
  final List<String>? soloExtensiones;

  /// Se llama tras subir o eliminar (para recargar los datos).
  final VoidCallback? alCambiar;

  @override
  ConsumerState<AdjuntosSeccion> createState() => _AdjuntosSeccionState();
}

class _AdjuntosSeccionState extends ConsumerState<AdjuntosSeccion> {
  int _subiendo = 0;

  Future<void> _procesar(List<ArchivoElegido> archivos) async {
    final libres = widget.maximo - widget.adjuntos.length;
    if (archivos.length > libres) {
      mostrarError(context, 'Máximo ${widget.maximo} adjuntos.');
      archivos = archivos.take(libres).toList();
    }
    setState(() => _subiendo = archivos.length);
    var huboCambios = false;
    // Si la sección se desmonta a mitad (p. ej. se cambia de pestaña), el
    // bucle sigue: los archivos elegidos se suben igual, solo se omiten los
    // avisos y el contador.
    for (final a in archivos) {
      final mime = mimeParaArchivo(
        a.nombre,
        soloExtensiones: widget.soloExtensiones,
      );
      if (mime == null) {
        if (mounted) {
          mostrarError(context, 'Tipo de archivo no permitido: ${a.nombre}');
        }
      } else if (a.bytes.length > tamanoMaxAdjuntoBytes) {
        if (mounted) {
          mostrarError(context, 'El archivo supera el máximo de 50 MB.');
        }
      } else {
        try {
          await widget.subir(a.nombre, a.bytes, mime);
          huboCambios = true;
          if (mounted) mostrarExito(context, '${a.nombre} subido');
        } on Object catch (e) {
          if (mounted) {
            mostrarError(context, '${a.nombre}: ${e is Exception ? e : '$e'}');
          }
        }
      }
      if (mounted) setState(() => _subiendo--);
    }
    if (mounted) setState(() => _subiendo = 0);
    if (huboCambios) _avisarCambio();
  }

  /// Llama a [AdjuntosSeccion.alCambiar] aunque la sección ya no esté en
  /// pantalla (la página que la contiene sí lo está y debe recargar).
  void _avisarCambio() {
    try {
      widget.alCambiar?.call();
    } on StateError {
      // También se cerró la página que la contenía (su `ref` ya no sirve):
      // no hay nada que recargar.
    }
  }

  Future<void> _elegirArchivos() async {
    final archivos = await ref
        .read(selectorArchivosProvider)
        .elegirArchivos(
          extensiones: widget.soloExtensiones ?? mimePorExtension.keys.toList(),
        );
    if (archivos.isNotEmpty) await _procesar(archivos);
  }

  Future<void> _tomarFoto() async {
    final foto = await ref.read(selectorArchivosProvider).tomarFoto();
    if (foto != null) await _procesar([foto]);
  }

  Future<void> _descargar(Adjunto a) async {
    try {
      final url = await urlDescargaAdjunto(ref.read(apiClientProvider), a.id);
      await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    } on Object catch (e) {
      if (mounted) mostrarError(context, e);
    }
  }

  Future<void> _eliminar(Adjunto a) async {
    final ok = await confirmar(
      context,
      titulo: '¿Eliminar "${a.nombreOriginal}"?',
      mensaje: 'El archivo se moverá a cuarentena.',
      textoConfirmar: 'Sí, eliminar',
      destructiva: true,
    );
    if (!ok || !mounted) return;
    try {
      if (widget.eliminar != null) {
        await widget.eliminar!(a);
      } else {
        await eliminarAdjunto(ref.read(apiClientProvider), a.id);
      }
      if (!mounted) return;
      mostrarExito(context, 'Adjunto eliminado (movido a cuarentena)');
      widget.alCambiar?.call();
    } on Object catch (e) {
      if (mounted) mostrarError(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    final lleno = widget.adjuntos.length >= widget.maximo;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (widget.puedeSubir)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: c.surface2,
              border: Border.all(color: c.borderStrong),
              borderRadius: BorderRadius.circular(10),
            ),
            child: lleno
                ? Text(
                    'Máximo ${widget.maximo} adjuntos.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: c.text3),
                  )
                : Column(
                    children: [
                      Wrap(
                        alignment: WrapAlignment.center,
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          OutlinedButton.icon(
                            key: const Key('adjuntos-subir'),
                            onPressed: _subiendo > 0 ? null : _elegirArchivos,
                            icon: const Icon(Icons.upload_file),
                            label: const Text('Subir archivo'),
                          ),
                          OutlinedButton.icon(
                            key: const Key('adjuntos-foto'),
                            onPressed: _subiendo > 0 ? null : _tomarFoto,
                            icon: const Icon(Icons.photo_camera_outlined),
                            label: const Text('Tomar foto'),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _subiendo > 0
                            ? 'Subiendo $_subiendo archivo(s)…'
                            : 'Máx. 50 MB por archivo · '
                                  '${(widget.soloExtensiones ?? const ['PDF', 'imágenes', 'Office', 'DWG', 'video']).join(', ')}',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: c.text3, fontSize: 12),
                      ),
                    ],
                  ),
          ),
        const SizedBox(height: 10),
        if (widget.adjuntos.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Text(
              'Sin adjuntos todavía.',
              style: TextStyle(color: c.text3),
            ),
          ),
        for (final a in widget.adjuntos)
          Card(
            margin: const EdgeInsets.only(bottom: 8),
            child: ListTile(
              leading: Icon(_icono(a.mimeType), color: c.text3),
              title: Text(
                a.nombreOriginal,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              subtitle: Text(
                '${formatTamano(a.tamanoBytes)} · ${formatFechaHora(a.createdAt)}',
                style: TextStyle(color: c.text3, fontSize: 12),
              ),
              trailing: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(
                    tooltip: 'Descargar ${a.nombreOriginal}',
                    icon: const Icon(Icons.download_outlined),
                    onPressed: () => _descargar(a),
                  ),
                  if (widget.puedeEliminar &&
                      (widget.eliminable?.call(a) ?? true))
                    IconButton(
                      tooltip: 'Eliminar ${a.nombreOriginal}',
                      icon: Icon(
                        Icons.delete_outline,
                        color: c.tono(Tono.danger).fg,
                      ),
                      onPressed: () => _eliminar(a),
                    ),
                ],
              ),
            ),
          ),
      ],
    );
  }

  IconData _icono(String mime) {
    if (mime.startsWith('image/')) return Icons.image_outlined;
    if (mime.startsWith('video/')) return Icons.movie_outlined;
    if (mime == 'application/pdf') return Icons.picture_as_pdf_outlined;
    return Icons.insert_drive_file_outlined;
  }
}

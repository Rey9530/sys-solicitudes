import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../widgets/avisos.dart';

/// Descarga un archivo (PDF, CSV, XLSX, ICS), lo guarda en temporales y abre
/// la hoja de compartir del sistema (desde ahí se abre, se guarda en Archivos
/// o se envía). Equivale a las descargas del web.
Future<void> descargarYCompartir(
  BuildContext context, {
  required Future<Uint8List> Function() descargar,
  required String nombreArchivo,
  required String mimeType,
}) async {
  // En iPad la hoja de compartir necesita un punto de origen.
  final caja = context.findRenderObject() as RenderBox?;
  final origen = caja == null
      ? null
      : caja.localToGlobal(Offset.zero) & caja.size;
  mostrarExito(context, 'Descargando $nombreArchivo…');
  try {
    final bytes = await descargar();
    final dir = await getTemporaryDirectory();
    final archivo = File('${dir.path}/$nombreArchivo');
    await archivo.writeAsBytes(bytes, flush: true);
    await SharePlus.instance.share(
      ShareParams(
        files: [XFile(archivo.path, mimeType: mimeType, name: nombreArchivo)],
        sharePositionOrigin: origen,
      ),
    );
  } on Object catch (e) {
    if (context.mounted) mostrarError(context, e);
  }
}

import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../api/api_client.dart';
import '../format/texto.dart';

/// Adjunto de solicitud, local o contrato (`AdjuntoOutput`).
class Adjunto {
  const Adjunto({
    required this.id,
    required this.nombreOriginal,
    required this.mimeType,
    required this.tamanoBytes,
    required this.createdAt,
    this.usuarioSubioId,
  });

  factory Adjunto.fromJson(Map<String, dynamic> j) => Adjunto(
    id: j['id'] as String,
    nombreOriginal: decodificarHtml(j['nombreOriginal'] as String?),
    mimeType: j['mimeType'] as String? ?? '',
    tamanoBytes: (j['tamanoBytes'] as num?)?.toInt() ?? 0,
    createdAt: j['createdAt'] as String? ?? '',
    usuarioSubioId: j['usuarioSubioId'] as String?,
  );

  final String id;
  final String nombreOriginal;
  final String mimeType;
  final int tamanoBytes;
  final String createdAt;
  final String? usuarioSubioId;
}

/// URL pre-firmada (15 min) para descargar/ver un adjunto.
Future<String> urlDescargaAdjunto(ApiClient api, String adjuntoId) async {
  final r =
      await api.get('/adjuntos/$adjuntoId/download') as Map<String, dynamic>;
  return r['url'] as String;
}

/// Mueve el adjunto a cuarentena (soft delete).
Future<void> eliminarAdjunto(ApiClient api, String adjuntoId) =>
    api.delete('/adjuntos/$adjuntoId');

/// Archivo elegido por el usuario.
class ArchivoElegido {
  const ArchivoElegido(this.nombre, this.bytes);
  final String nombre;
  final Uint8List bytes;
}

/// Acceso a los selectores nativos (archivos y cámara). Es un provider para
/// poder reemplazarlo en las pruebas.
class SelectorArchivos {
  const SelectorArchivos();

  Future<List<ArchivoElegido>> elegirArchivos({
    List<String>? extensiones,
  }) async {
    final archivos = await FilePicker.pickFiles(
      type: extensiones == null ? FileType.any : FileType.custom,
      allowedExtensions: extensiones,
    );
    return [
      for (final f in archivos) ArchivoElegido(f.name, await f.readAsBytes()),
    ];
  }

  Future<ArchivoElegido?> tomarFoto() async {
    final foto = await ImagePicker().pickImage(
      source: ImageSource.camera,
      imageQuality: 85,
      maxWidth: 2560,
    );
    if (foto == null) return null;
    final nombre = foto.name.contains('.') ? foto.name : '${foto.name}.jpg';
    return ArchivoElegido(nombre, await foto.readAsBytes());
  }
}

final selectorArchivosProvider = Provider<SelectorArchivos>(
  (ref) => const SelectorArchivos(),
);

/// Lista cerrada de tipos de adjunto (`MIME_PERMITIDOS_DEFAULT` de
/// `packages/contracts/src/adjuntos`). El backend valida el MIME **declarado**
/// en el multipart, así que se deduce de la extensión con esta tabla (nunca
/// `application/octet-stream`).
const mimePorExtension = <String, String>{
  'pdf': 'application/pdf',
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'png': 'image/png',
  'webp': 'image/webp',
  'xls': 'application/vnd.ms-excel',
  'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'docx':
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'dwg': 'application/dwg',
  'mp4': 'video/mp4',
  'm4v': 'video/mp4',
  'mov': 'video/quicktime',
  'webm': 'video/webm',
};

/// Solo imágenes (adjuntos de local).
const extensionesImagen = ['jpg', 'jpeg', 'png', 'webp'];

/// Tope por archivo (default de plaza, T-V06). El backend aplica el de la plaza.
const tamanoMaxAdjuntoBytes = 50 * 1024 * 1024;

/// Máximo de adjuntos vivos por solicitud.
const maxAdjuntosSolicitud = 10;

/// MIME a declarar para [nombreArchivo], o `null` si el tipo no está permitido.
String? mimeParaArchivo(String nombreArchivo, {List<String>? soloExtensiones}) {
  final punto = nombreArchivo.lastIndexOf('.');
  if (punto < 0) return null;
  final ext = nombreArchivo.substring(punto + 1).toLowerCase();
  if (soloExtensiones != null && !soloExtensiones.contains(ext)) return null;
  return mimePorExtension[ext];
}

/// `1536` → `"1.5 KB"`.
String formatTamano(int bytes) {
  if (bytes < 1024) return '$bytes B';
  if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
  return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
}

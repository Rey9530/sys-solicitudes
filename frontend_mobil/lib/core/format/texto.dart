/// El backend guarda algunos textos con entidades HTML (`&amp;`), bug F4 de
/// `docs/08-auditoria-qa-y-mejoras.md`. Todo texto recibido pasa por aquí
/// antes de mostrarse.
String decodificarHtml(String? texto) {
  if (texto == null || texto.isEmpty) return '';
  return texto
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&quot;', '"')
      .replaceAll('&#39;', "'")
      .replaceAll('&#x27;', "'")
      .replaceAll('&#x2F;', '/')
      .replaceAll('&amp;', '&');
}

/// Iniciales del avatar: primera letra del primer y del último nombre.
String iniciales(String nombre) {
  final partes = nombre.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty);
  if (partes.isEmpty) return '?';
  final primera = partes.first[0];
  final ultima = partes.length > 1 ? partes.last[0] : '';
  return (primera + ultima).toUpperCase();
}

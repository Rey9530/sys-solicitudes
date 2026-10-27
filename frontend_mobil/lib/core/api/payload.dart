// Armado de payloads: el backend nunca recibe `''` en un campo opcional
// (bug B1-R3 del web). Usar siempre estas funciones en los `*_api.dart`.

/// Texto de formulario → valor del payload: recortado, `null` si queda vacío.
String? textoOpcional(String texto) {
  final t = texto.trim();
  return t.isEmpty ? null : t;
}

/// Altas: quita las claves `null` o con texto vacío y recorta los textos.
Map<String, Object?> omitirVacios(Map<String, Object?> datos) => {
  for (final MapEntry(:key, :value) in datos.entries)
    if (value != null && !(value is String && value.trim().isEmpty))
      key: value is String ? value.trim() : value,
};

/// Ediciones: un texto vacío va como `null` (borra el valor); el resto se
/// recorta.
Map<String, Object?> vaciosANull(Map<String, Object?> datos) => {
  for (final MapEntry(:key, :value) in datos.entries)
    key: value is String ? textoOpcional(value) : value,
};

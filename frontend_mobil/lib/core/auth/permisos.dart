/// Reglas de permisos del web (`frontend/src/lib/can.ts`):
/// - `'*'` (superadmin) pasa todo;
/// - [permiso] puede ser un código o una lista de códigos (basta uno, OR);
/// - una lista vacía de requeridos se deniega.
///
/// El backend vuelve a validar siempre; esto solo decide qué se muestra.
bool puedeCon(List<String> permisos, Object permiso) {
  if (permisos.contains('*')) return true;
  final requeridos = switch (permiso) {
    final String p => [p],
    final Iterable<String> l => l.toList(),
    _ => const <String>[],
  };
  if (requeridos.isEmpty) return false;
  return requeridos.any(permisos.contains);
}

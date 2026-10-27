import '../../core/api/api_client.dart';
import '../../core/api/paginado.dart';
import 'plazas_modelos.dart';

/// Plazas de la plataforma (solo superadmin).

/// Primeras 50 plazas, más recientes primero (como el web, sin paginar).
Future<List<Plaza>> listarPlazas(ApiClient api) async {
  final r = await api.get(
    '/plazas',
    query: {'page': 1, 'pageSize': 50},
  ) as Map<String, dynamic>;
  return Paginado.fromJson(r, Plaza.fromJson).items;
}

/// `CreatePlazaSchema`: crea la plaza con su configuración, roles de staff y
/// el administrador inicial.
Future<Plaza> crearPlaza(ApiClient api, Map<String, Object?> datos) async {
  final r = await api.post('/plazas', body: datos) as Map<String, dynamic>;
  return Plaza.fromJson(r);
}

/// Borrado lógico (`deleted_at`).
Future<void> desactivarPlaza(ApiClient api, String id) =>
    api.delete('/plazas/$id');

/// Slug a partir del nombre (`slugify` del web): minúsculas, sin acentos,
/// todo lo que no sea `[a-z0-9]` → `-`, máximo 32.
String slugDesdeNombre(String nombre) {
  const acentos = {
    'á': 'a',
    'à': 'a',
    'ä': 'a',
    'â': 'a',
    'ã': 'a',
    'é': 'e',
    'è': 'e',
    'ë': 'e',
    'ê': 'e',
    'í': 'i',
    'ì': 'i',
    'ï': 'i',
    'î': 'i',
    'ó': 'o',
    'ò': 'o',
    'ö': 'o',
    'ô': 'o',
    'õ': 'o',
    'ú': 'u',
    'ù': 'u',
    'ü': 'u',
    'û': 'u',
    'ñ': 'n',
    'ç': 'c',
  };
  final sinAcentos = nombre
      .toLowerCase()
      .split('')
      .map((ch) => acentos[ch] ?? ch)
      .join();
  final slug = sinAcentos
      .replaceAll(RegExp('[^a-z0-9]+'), '-')
      .replaceAll(RegExp(r'^-+|-+$'), '');
  return slug.length > 32 ? slug.substring(0, 32) : slug;
}

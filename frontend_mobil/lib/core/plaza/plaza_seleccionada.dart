import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api/api_providers.dart';
import '../auth/sesion.dart';
import '../auth/sesion_controller.dart';
import '../format/texto.dart';

/// Plaza mínima para el selector, el chip del topbar y el color de marca.
class PlazaResumen {
  const PlazaResumen({
    required this.id,
    required this.slug,
    required this.nombreComercial,
    this.colorPrimario,
    this.logoUrl,
  });

  factory PlazaResumen.fromJson(Map<String, dynamic> j) => PlazaResumen(
    id: j['id'] as String,
    slug: j['slug'] as String? ?? '',
    nombreComercial: decodificarHtml(j['nombreComercial'] as String?),
    colorPrimario: j['colorPrimario'] as String?,
    logoUrl: j['logoUrl'] as String?,
  );

  final String id;
  final String slug;
  final String nombreComercial;
  final String? colorPrimario;
  final String? logoUrl;
}

/// Plaza elegida por el superadmin (impersonación: header `x-plaza-id`).
/// Se guarda en el dispositivo como la cookie `sa_plaza` del web.
class PlazaSeleccionadaController extends Notifier<String?> {
  static const _clave = 'sa_plaza';

  @override
  String? build() {
    _cargar();
    return null;
  }

  Future<void> _cargar() async {
    final prefs = await SharedPreferences.getInstance();
    final guardada = prefs.getString(_clave);
    if (guardada != null && guardada != state) state = guardada;
  }

  Future<void> seleccionar(String? plazaId) async {
    state = plazaId;
    final prefs = await SharedPreferences.getInstance();
    if (plazaId == null) {
      await prefs.remove(_clave);
    } else {
      await prefs.setString(_clave, plazaId);
    }
  }
}

final plazaSeleccionadaProvider =
    NotifierProvider<PlazaSeleccionadaController, String?>(
      PlazaSeleccionadaController.new,
    );

/// Plazas para el selector del superadmin (`GET /plazas`).
final plazasProvider = FutureProvider.autoDispose<List<PlazaResumen>>((
  ref,
) async {
  final r =
      await ref
              .read(apiClientProvider)
              .get('/plazas', query: {'page': 1, 'pageSize': 100})
          as Map<String, dynamic>;
  return (r['items'] as List<dynamic>)
      .cast<Map<String, dynamic>>()
      .map(PlazaResumen.fromJson)
      .toList();
});

/// Plaza "actual" para el chip y el color de marca:
/// admin → su plaza; superadmin → la elegida; inquilino → ninguna (no tiene
/// endpoint para leerla, igual que en el web).
final plazaActualProvider = FutureProvider.autoDispose<PlazaResumen?>((
  ref,
) async {
  final sesion = ref.watch(sesionProvider).value;
  if (sesion == null) return null;
  final id = switch (sesion.rol) {
    Rol.adminPlaza => sesion.usuario.plazaId,
    Rol.superadmin => ref.watch(plazaSeleccionadaProvider),
    Rol.inquilino => null,
  };
  if (id == null) return null;
  final j = await ref.read(apiClientProvider).get('/plazas/$id');
  return PlazaResumen.fromJson(j as Map<String, dynamic>);
});

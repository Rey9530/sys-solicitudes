import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend_mobil/core/format/fechas.dart';
import 'package:http/http.dart' as http;

import '../../helpers/api_falsa.dart';
import '../../helpers/pantallas.dart';

/// JSON real capturado del backend local (`test/fixtures/solicitudes/`).
Object? fixture(String nombre) => jsonDecode(
  File('test/fixtures/solicitudes/$nombre.json').readAsStringSync(),
);

Map<String, dynamic> fixtureMapa(String nombre) =>
    fixture(nombre)! as Map<String, dynamic>;

Map<String, dynamic> _copia(Map<String, dynamic> m) =>
    jsonDecode(jsonEncode(m)) as Map<String, dynamic>;

// ── Textos largos (Review Focus 2 del plan) ─────────────────────────────────

/// Título de exactamente 120 caracteres (el máximo del backend).
final tituloLargo =
    ('Remodelación integral del local L-SOL-1 con cambio de piso, cielo '
            'falso, iluminación y fachada; incluye trabajos nocturnos y retiro '
            'de ripio y escombros del área común')
        .substring(0, 120);

const razonLarga =
    'Inversiones Comerciales y Distribuidora Centroamericana del Pacífico '
    'Sociedad Anónima de Capital Variable';
const codigoLargo = 'SOL-carga-qa-1234';
const nombreLargo = 'María Fernanda de los Ángeles Pérez Hernández de Martínez';
const ahoraPrueba = '2026-10-27T18:00:00.000Z';

/// IDs del fixture real.
const idSolicitud = '79ab5c1b-cc59-49bc-a53a-dcefdbd5ecb4';
const idCreador = '587022c9-83b0-4260-8205-bdc5ce3ba2ce';

/// Detalle real (`requerida_subsanacion`, con historial y comentario) con los
/// cambios pedidos. [largos] pone textos largos en todo lo visible.
Map<String, dynamic> detalle({
  String? estado,
  bool largos = false,
  Map<String, Object?> cambios = const {},
}) {
  final d = _copia(fixtureMapa('solicitud_detalle'));
  if (estado != null) d['estado'] = estado;
  if (largos) {
    d
      ..['codigo'] = codigoLargo
      ..['titulo'] = tituloLargo
      ..['descripcion'] = '$tituloLargo\n$tituloLargo'
      ..['localCodigo'] = 'L-SOL-CARGA-QA-0001'
      ..['inquilinoRazonSocial'] = razonLarga
      ..['categoriaNombre'] = 'Mantenimiento preventivo y correctivo de áreas'
      ..['subcategoriaNombre'] = 'Instalaciones eléctricas y de iluminación'
      ..['empresaNombre'] = razonLarga
      ..['empresaResponsable'] = nombreLargo
      ..['empresaEmail'] = 'coordinacion.operaciones.mantenimiento@empresa.com'
      ..['emergenciaContacto'] = nombreLargo
      ..['esEmergencia'] = true
      ..['adminAsignado'] = {
        'id': 'otro-admin',
        'nombre': nombreLargo,
        'email': 'otro@demo.com',
      }
      ..['usuarioCreador'] = {
        'id': idCreador,
        'nombre': nombreLargo,
        'email': 'inquilino@demo.com',
      }
      ..['camposExtra'] = {
        'area_afectada': tituloLargo,
        'requiere_ingreso_a_local': true,
        'asistentes_estimados': 2,
        'asistentes': [
          {'nombre': nombreLargo, 'documento': '01234567-8'},
          {'nombre': 'Técnico 2', 'documento': '98765432-1'},
        ],
        'clave_desconocida_muy_larga_del_backend': tituloLargo,
      }
      ..['adjuntos'] = [
        {
          'id': 'adj-1',
          'nombreOriginal':
              'fotografia-del-dano-en-el-cielo-falso-del-local-con-nombre-'
              'muy-largo.jpeg',
          'mimeType': 'image/jpeg',
          'tamanoBytes': 2048000,
          'usuarioSubioId': idCreador,
          'createdAt': ahoraPrueba,
        },
      ];
    (d['comentarios'] as List<dynamic>).add({
      'id': 'c-largo',
      'solicitudId': d['id'],
      'usuario': {'id': idCreador, 'nombre': nombreLargo, 'email': 'x@y.com'},
      'tipo': 'decision',
      'cuerpo': '$tituloLargo $tituloLargo',
      'createdAt': ahoraPrueba,
    });
  }
  d.addAll(cambios);
  return d;
}

/// Listado paginado real con el primer elemento con textos largos.
Map<String, dynamic> listado(String nombre, {Map<String, Object?>? primero}) {
  final l = _copia(fixtureMapa(nombre));
  final items = l['items'] as List<dynamic>;
  (items.first as Map<String, dynamic>)
    ..['codigo'] = codigoLargo
    ..['titulo'] = tituloLargo
    ..['localCodigo'] = 'L-SOL-CARGA-QA-0001'
    ..['slaStatus'] = 'amarillo'
    ..['adminAsignado'] = {
      'id': 'x',
      'nombre': nombreLargo,
      'email': 'x@demo.com',
    }
    ..['plaza'] = {
      'id': 'plaza-larga',
      'slug': 'plaza-larga',
      'nombreComercial': razonLarga,
    }
    ..addAll(primero ?? const {});
  l['totalPages'] = 8;
  return l;
}

// ── Montaje ─────────────────────────────────────────────────────────────────

/// Monta [pantalla] en un tamaño alto (todo el contenido queda construido).
Future<void> montar(
  WidgetTester tester,
  Widget Function() pantalla,
  List<Override> overrides, {
  Size tamano = const Size(1024, 2400),
}) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = tamano;
  addTearDown(tester.view.reset);
  // Desmonta lo anterior (ProviderScope y router nuevos en cada montaje).
  await tester.pumpWidget(const SizedBox.shrink());
  await tester.pumpWidget(envolver(pantalla, overrides: overrides));
  await tester.pumpAndSettle();
}

/// Peticiones capturadas con ese método y ruta (sin query).
List<http.Request> peticiones(String metodo, String ruta) => peticionesFalsas
    .where(
      (r) =>
          r.method == metodo && r.url.path.replaceFirst('/api/v1', '') == ruta,
    )
    .toList();

/// Fecha de pared de la plaza dentro de [dias] días.
String diaPlaza(int dias) => fechaPlazaHoy(dias: dias);

import 'package:go_router/go_router.dart';

import 'carga_inicial_page.dart';
import 'contrato_detalle_page.dart';
import 'contrato_form_page.dart';
import 'contratos_page.dart';
import 'mi_contrato_page.dart';
import 'mis_contratos_page.dart';

/// Rutas del módulo (mismas URLs que el web). `nuevo` e `importar` van antes
/// de `:id`.
List<RouteBase> rutasContratos() => [
  GoRoute(
    path: '/admin/contratos',
    builder: (context, state) => const ContratosPage(),
  ),
  GoRoute(
    path: '/admin/contratos/nuevo',
    builder: (context, state) => const ContratoFormPage(),
  ),
  GoRoute(
    path: '/admin/contratos/importar',
    builder: (context, state) => const CargaInicialPage(),
  ),
  GoRoute(
    path: '/admin/contratos/:id',
    builder: (context, state) =>
        ContratoDetallePage(id: state.pathParameters['id']!),
  ),
  GoRoute(
    path: '/inquilino/contratos',
    builder: (context, state) => const MisContratosPage(),
  ),
  GoRoute(
    path: '/inquilino/contratos/:id',
    builder: (context, state) =>
        MiContratoPage(id: state.pathParameters['id']!),
  ),
];

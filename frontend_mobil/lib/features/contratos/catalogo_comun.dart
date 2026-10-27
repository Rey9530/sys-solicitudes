import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/format/fechas.dart';
import '../../core/format/montos.dart';
import '../../core/theme/colores.dart';
import '../../core/widgets/badges.dart';
import '../../core/widgets/estados.dart';
import '../../core/widgets/lista_responsive.dart';
import '../solicitudes/solicitudes_modelos.dart';
import 'contratos_modelos.dart';

/// Piezas compartidas por las pantallas de locales, inquilinos y contratos
/// (payloads, validaciones y widgets pequeños).

// ── Números ─────────────────────────────────────────────────────────────────

/// `"1.5"` o `"1,5"` → `1.5`; vacío o inválido → `null`.
double? numeroDe(String texto) =>
    double.tryParse(texto.trim().replaceAll(',', '.'));

/// `"12"` → `12`; vacío o inválido → `null`.
int? enteroDe(String texto) => int.tryParse(texto.trim());

/// Texto que llega del backend → texto del campo (`null` → vacío).
String textoDe(Object? valor) => switch (valor) {
  null => '',
  final double d when d == d.roundToDouble() => d.toStringAsFixed(0),
  _ => '$valor',
};

// ── Validaciones ────────────────────────────────────────────────────────────

/// Número opcional dentro de un rango. Vacío es válido.
String? validarNumero(
  String? v, {
  double min = 0,
  required double max,
  bool entero = false,
  bool positivo = false,
}) {
  final texto = (v ?? '').trim();
  if (texto.isEmpty) return null;
  final n = numeroDe(texto);
  if (n == null) return 'Número inválido';
  if (entero && n != n.roundToDouble()) return 'Debe ser un número entero';
  if (positivo && n <= 0) return 'Debe ser mayor que 0';
  if (n < min || n > max) {
    return 'Debe estar entre ${textoDe(min)} y ${textoDe(max)}';
  }
  return null;
}

// ── Widgets ─────────────────────────────────────────────────────────────────

/// Mini-tarjetas de contratos de un local o inquilino (pestaña "Contratos").
class ContratosMini extends StatelessWidget {
  const ContratosMini({super.key, required this.contratos});

  final List<Contrato> contratos;

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    if (contratos.isEmpty) {
      return Text('Sin contratos todavía.', style: TextStyle(color: c.text3));
    }
    return Column(
      children: [
        for (final contrato in contratos)
          Card(
            margin: const EdgeInsets.only(bottom: 10),
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              onTap: () => context.push('/admin/contratos/${contrato.id}'),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${formatFechaDMY(contrato.fechaInicio)} → '
                            '${contrato.fechaFin == null ? 'indefinido' : formatFechaDMY(contrato.fechaFin)}',
                            style: const TextStyle(fontWeight: FontWeight.w600),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '${formatMonto(contrato.montoMensual, moneda: contrato.moneda)} / mes',
                            style: TextStyle(color: c.text3, fontSize: 13),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    EstadoContratoBadge(contrato.estado),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// Texto secundario de una celda (máximo 2 líneas: en tabla la fila mide
/// como máximo 72 px).
class TextoCelda extends StatelessWidget {
  const TextoCelda(this.texto, {super.key, this.mono = false});

  final String? texto;
  final bool mono;

  @override
  Widget build(BuildContext context) {
    final vacio = texto == null || texto!.isEmpty;
    return Text(
      vacio ? '—' : texto!,
      maxLines: 2,
      overflow: TextOverflow.ellipsis,
      style: TextStyle(
        color: ColoresPlazapp.of(context).text2,
        fontFamily: mono ? 'monospace' : null,
      ),
    );
  }
}

/// Solicitudes de un local o inquilino; tocar una abre su detalle de admin.
class ListaSolicitudesRelacionadas extends StatelessWidget {
  const ListaSolicitudesRelacionadas({super.key, required this.solicitudes});

  final List<SolicitudItem> solicitudes;

  @override
  Widget build(BuildContext context) {
    return ListaResponsive<SolicitudItem>(
      items: solicitudes,
      vacio: const EmptyState(
        icono: Icons.inbox_outlined,
        titulo: 'Sin solicitudes',
        mensaje: 'Todavía no hay solicitudes registradas.',
      ),
      onTap: (s) => context.push('/admin/solicitudes/${s.id}'),
      columnas: [
        ColumnaLista(
          titulo: 'Código',
          principal: true,
          celda: (s) => Text(
            s.codigo,
            style: const TextStyle(
              fontFamily: 'monospace',
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        ColumnaLista(titulo: 'Título', celda: (s) => TextoCelda(s.titulo)),
        ColumnaLista(
          titulo: 'Tipo',
          celda: (s) => BadgePlazapp(
            etiquetaTipoSolicitud[s.tipo] ?? s.tipo,
            Tono.neutral,
            punto: false,
          ),
        ),
        ColumnaLista(
          titulo: 'Estado',
          celda: (s) => EstadoSolicitudBadge(s.estado),
        ),
        ColumnaLista(
          titulo: 'Creada',
          celda: (s) => TextoCelda(formatFecha(s.createdAt)),
        ),
      ],
    );
  }
}

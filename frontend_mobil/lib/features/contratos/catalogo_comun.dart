import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/format/fechas.dart';
import '../../core/format/montos.dart';
import '../../core/theme/colores.dart';
import '../../core/widgets/badges.dart';
import '../../core/widgets/celdas.dart';
import '../../core/widgets/estados.dart';
import '../../core/widgets/lista_responsive.dart';
import '../solicitudes/solicitudes_modelos.dart';
import 'contratos_modelos.dart';

/// Widgets de contratos y solicitudes que también muestran los detalles de
/// locales e inquilinos.

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

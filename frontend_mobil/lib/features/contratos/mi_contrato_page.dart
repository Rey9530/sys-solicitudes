import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/format/fechas.dart';
import '../../core/format/montos.dart';
import '../../core/widgets/badges.dart';
import '../../core/widgets/campos.dart';
import '../../core/widgets/estados.dart';
import '../../core/widgets/pagina.dart';
import 'catalogo_comun.dart';
import 'contrato_detalle_page.dart';
import 'contratos_providers.dart';

/// `/inquilino/contratos/:id` — "Mi contrato" (espejo de
/// `inquilino/contratos/[id]/page.tsx`): datos básicos y el PDF firmado. A
/// diferencia del web, subir y descargar el PDF sí funciona (el backend lo
/// permite; el web lo bloqueaba por permisos, bug B1-R1).
class MiContratoPage extends ConsumerWidget {
  const MiContratoPage({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return AsyncView(
      value: ref.watch(contratoProvider(id)),
      onRetry: () => ref.invalidate(contratoProvider(id)),
      data: (c) => ContenidoPagina(
        onRefresh: () => recargar(ref, contratoProvider(id).future),
        children: [
          EncabezadoPagina(
            titulo: 'Local ${c.localCodigo ?? ''}',
            badges: [EstadoContratoBadge(c.estado)],
            rutaVolver: '/inquilino/contratos',
          ),
          Seccion(
            child: KeyValueGrid([
              ('Inicio', Text(formatFechaDMY(c.fechaInicio))),
              (
                'Fin',
                Text(
                  c.fechaFin == null
                      ? 'Indefinido'
                      : formatFechaDMY(c.fechaFin),
                ),
              ),
              (
                'Monto mensual',
                Text(
                  c.montoMensual == null
                      ? '—'
                      : formatMonto(c.montoMensual, moneda: c.moneda),
                ),
              ),
              ('Moneda', Text(c.moneda)),
              if ((c.condiciones ?? '').isNotEmpty)
                ('Condiciones', Text(c.condiciones!)),
            ]),
          ),
          Seccion(
            titulo: 'Contrato firmado (PDF)',
            child: AdjuntosContrato(contratoId: id, esInquilino: true),
          ),
        ],
      ),
    );
  }
}

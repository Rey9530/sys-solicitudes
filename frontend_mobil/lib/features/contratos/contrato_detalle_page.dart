import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/adjuntos/adjuntos_seccion.dart';
import '../../core/api/api_providers.dart';
import '../../core/auth/sesion_controller.dart';
import '../../core/format/fechas.dart';
import '../../core/format/montos.dart';
import '../../core/format/validaciones.dart';
import '../../core/theme/colores.dart';
import '../../core/widgets/avisos.dart';
import '../../core/widgets/badges.dart';
import '../../core/widgets/campos.dart';
import '../../core/widgets/can.dart';
import '../../core/widgets/estados.dart';
import '../../core/widgets/pagina.dart';
import '../inquilinos/inquilinos_providers.dart';
import '../locales/locales_providers.dart';
import 'cerrar_contrato_sheet.dart';
import 'contrato_form_page.dart';
import 'contratos_api.dart';
import 'contratos_modelos.dart';
import 'contratos_providers.dart';
import 'renovar_contrato_sheet.dart';

/// `/admin/contratos/:id` — detalle (espejo de `admin/contratos/[id]/page.tsx`):
/// términos, pagos con totales derivados, vigencia, notas, renovar, cerrar y
/// el PDF del contrato firmado.
class ContratoDetallePage extends ConsumerWidget {
  const ContratoDetallePage({super.key, required this.id});

  final String id;

  /// Tras renovar o cerrar: el contrato, su local y su inquilino cambiaron.
  void _despuesDeCambiar(WidgetRef ref) {
    ref.invalidate(contratoProvider(id));
    ref.invalidate(contratosProvider);
    ref.invalidate(localProvider);
    ref.invalidate(localesProvider);
    ref.invalidate(inquilinoProvider);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return AsyncView(
      value: ref.watch(contratoProvider(id)),
      onRetry: () => ref.invalidate(contratoProvider(id)),
      data: (c) {
        String monto(double? v) =>
            v == null ? '—' : formatMonto(v, moneda: c.moneda);
        return ContenidoPagina(
          onRefresh: () => recargar(ref, contratoProvider(id).future),
          children: [
            if (c.enVentanaT7)
              Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: AvisoBanner(
                  tono: Tono.danger,
                  child: Text(
                    'Este contrato vence en 7 días o menos '
                    '(${formatFechaDMY(c.fechaFin)}). Renueva o cierra.',
                  ),
                ),
              )
            else if (c.enVentanaT30)
              Padding(
                padding: const EdgeInsets.only(bottom: 14),
                child: AvisoBanner(
                  tono: Tono.warn,
                  child: Text(
                    'Este contrato vence en 30 días o menos '
                    '(${formatFechaDMY(c.fechaFin)}).',
                  ),
                ),
              ),
            EncabezadoPagina(
              titulo:
                  '${c.localCodigo ?? ''} · ${c.inquilinoRazonSocial ?? ''}',
              badges: [EstadoContratoBadge(c.estado)],
              rutaVolver: '/admin/contratos',
              acciones: [
                if (c.vigente) ...[
                  Can(
                    permiso: 'contratos.renovar',
                    child: FilledButton(
                      key: const Key('contrato-renovar'),
                      onPressed: () async {
                        final cambio = await mostrarRenovarContrato(
                          context,
                          contrato: c,
                        );
                        if (cambio && context.mounted) _despuesDeCambiar(ref);
                      },
                      child: const Text('Renovar contrato'),
                    ),
                  ),
                  Can(
                    permiso: 'contratos.cerrar',
                    child: OutlinedButton(
                      key: const Key('contrato-cerrar'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Theme.of(context).colorScheme.error,
                      ),
                      onPressed: () async {
                        final cambio = await mostrarCerrarContrato(
                          context,
                          contrato: c,
                        );
                        if (cambio && context.mounted) _despuesDeCambiar(ref);
                      },
                      child: const Text('Cerrar contrato'),
                    ),
                  ),
                ],
              ],
            ),
            Seccion(
              titulo: 'Términos contractuales',
              child: KeyValueGrid([
                ('Plazo (meses)', Text(c.plazoMeses?.toString() ?? '—')),
                (
                  'Período de gracia (días)',
                  Text(
                    c.periodoGraciaDias == null
                        ? '—'
                        : '${c.periodoGraciaDias} días',
                  ),
                ),
                (
                  'Área (medición real)',
                  Text(
                    c.areaMt2MedicionReal == null
                        ? '—'
                        : '${textoDe(c.areaMt2MedicionReal)} m²',
                  ),
                ),
                (
                  'Fecha entrega del local',
                  Text(formatFechaDMY(c.fechaEntregaLocal)),
                ),
                (
                  'Inicio de operaciones',
                  Text(formatFechaDMY(c.inicioOperaciones)),
                ),
                (
                  'Aviso de terminación',
                  Text(formatFechaDMY(c.avisoTerminacion)),
                ),
              ]),
            ),
            Seccion(
              titulo: 'Pagos',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  KeyValueGrid([
                    ('Monto mensual', Text(monto(c.montoMensual))),
                    ('Canon arrendamiento', Text(monto(c.cuotaArrendamiento))),
                    ('CAM', Text(monto(c.cuotaCam))),
                    ('Depósito de garantía', Text(monto(c.depositoGarantia))),
                    (
                      'Fecha pago del depósito',
                      Text(formatFechaDMY(c.fechaPagoDeposito)),
                    ),
                  ]),
                  const SizedBox(height: 14),
                  TotalesDerivados(
                    totalCanon: c.totalCanon,
                    totalCam: c.totalCam,
                    moneda: c.moneda,
                    conLetras: true,
                  ),
                ],
              ),
            ),
            Seccion(
              titulo: 'Vigencia y estado',
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
                  'Estado',
                  Align(
                    alignment: Alignment.centerLeft,
                    child: EstadoContratoBadge(c.estado),
                  ),
                ),
                ('Creado', Text(formatFecha(c.createdAt))),
                if (!c.vigente) ...[
                  ('Fin efectivo', Text(formatFechaDMY(c.fechaFinEfectiva))),
                  ('Motivo de cierre', Text(c.motivoFin ?? '—')),
                ],
              ]),
            ),
            Seccion(
              titulo: 'Notas',
              child: NotasContrato(contrato: c),
            ),
            Can(
              permiso: 'contratos.adjuntos.descargar',
              child: Seccion(
                titulo: 'Contrato firmado (PDF)',
                child: AdjuntosContrato(contratoId: id),
              ),
            ),
          ],
        );
      },
    );
  }
}

/// Condiciones generales y de incremento de canon.
class NotasContrato extends StatelessWidget {
  const NotasContrato({super.key, required this.contrato});

  final Contrato contrato;

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    final condiciones = contrato.condiciones;
    final incremento = contrato.condicionesIncrementoCanon;
    if ((condiciones ?? '').isEmpty && (incremento ?? '').isEmpty) {
      return Text('Sin notas registradas.', style: TextStyle(color: c.text3));
    }
    return KeyValueGrid(columnas: 1, [
      if ((condiciones ?? '').isNotEmpty)
        ('Condiciones generales', Text(condiciones!)),
      if ((incremento ?? '').isNotEmpty)
        ('Condiciones de incremento de canon', Text(incremento!)),
    ]);
  }
}

/// PDF del contrato firmado (espejo de `adjuntos-contrato.tsx`). Lo usan el
/// admin y el inquilino: el backend deja al inquilino subir y descargar en
/// sus contratos y borrar solo lo que él subió.
class AdjuntosContrato extends ConsumerWidget {
  const AdjuntosContrato({
    super.key,
    required this.contratoId,
    this.esInquilino = false,
  });

  final String contratoId;
  final bool esInquilino;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Fuera de los callbacks: la subida sigue aunque esta sección se desmonte.
    final api = ref.watch(apiClientProvider);
    final usuarioId = ref.watch(sesionProvider).value?.usuario.id;
    return AsyncView(
      value: ref.watch(adjuntosContratoProvider(contratoId)),
      onRetry: () => ref.invalidate(adjuntosContratoProvider(contratoId)),
      data: (adjuntos) => AdjuntosSeccion(
        adjuntos: adjuntos,
        // Sin tope de cantidad (el web no lo limita).
        maximo: 999,
        soloExtensiones: const ['pdf'],
        // El inquilino no tiene permisos granulares (lista vacía): el backend
        // decide por su rol.
        puedeSubir: esInquilino || puedeHacer(ref, 'contratos.adjuntos.subir'),
        puedeEliminar:
            esInquilino || puedeHacer(ref, 'contratos.adjuntos.eliminar'),
        // El backend solo deja borrar al admin o a quien subió el archivo.
        eliminable: esInquilino
            ? (a) => a.usuarioSubioId != null && a.usuarioSubioId == usuarioId
            : null,
        subir: (nombre, bytes, mime) =>
            subirAdjuntoContrato(api, contratoId, nombre, bytes, mime),
        alCambiar: () => ref.invalidate(adjuntosContratoProvider(contratoId)),
      ),
    );
  }
}

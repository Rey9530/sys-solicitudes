import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/format/fechas.dart';
import '../../../core/theme/colores.dart';
import '../../../core/widgets/avisos.dart';
import '../../../core/widgets/badges.dart';
import '../../../core/widgets/campos.dart';
import '../../../core/widgets/estados.dart';
import '../../../core/widgets/pagina.dart';
import '../solicitudes_modelos.dart';
import '../solicitudes_providers.dart';

/// Detalle cross-plaza del superadmin (solo lectura, sin acciones). Espejo de
/// `frontend/src/app/(admin-plataform)/superadmin/solicitudes/[id]/page.tsx`:
/// muestra Identificación, Descripción y Empresa ejecutante.
class SolicitudGlobalPage extends ConsumerWidget {
  const SolicitudGlobalPage({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final valor = ref.watch(solicitudGlobalProvider(id));
    return Scaffold(
      body: AsyncView(
        value: valor,
        onRetry: () => ref.invalidate(solicitudGlobalProvider(id)),
        data: (d) => _contenido(context, ref, d),
      ),
    );
  }

  Widget _contenido(BuildContext context, WidgetRef ref, SolicitudDetalle d) {
    final s = d.solicitud;
    final c = ColoresPlazapp.of(context);
    String o(String? v) => v == null || v.isEmpty ? '—' : v;
    Widget t(String? v) => Text(o(v));
    final plaza = s.plazaNombre ?? s.plazaId;
    return ContenidoPagina(
      onRefresh: () async => ref.refresh(solicitudGlobalProvider(id).future),
      children: [
        EncabezadoPagina(
          titulo: s.codigo,
          rutaVolver: '/superadmin/solicitudes',
          badges: [
            EstadoSolicitudBadge(s.estado),
            PrioridadBadge(s.prioridad),
            if (s.slaStatus != null) SlaSemaforo(s.slaStatus),
          ],
          subtitulo:
              '${s.titulo} · Local ${s.localCodigo ?? '—'} · '
              '${d.inquilinoRazonSocial ?? '—'}',
        ),
        Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child: AvisoBanner(
            tono: Tono.info,
            child: Text.rich(
              TextSpan(
                children: [
                  const TextSpan(
                    text: 'Vista de plataforma (superadmin):',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                  const TextSpan(
                    text:
                        ' solo lectura. Para operar esta solicitud, '
                        'selecciona la plaza ',
                  ),
                  TextSpan(
                    text: plaza,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  const TextSpan(text: ' en el selector de la barra superior.'),
                ],
              ),
            ),
          ),
        ),
        Seccion(
          titulo: 'Identificación',
          child: KeyValueGrid([
            ('Estado', t(etiquetaEstadoSolicitud[s.estado] ?? s.estado)),
            (
              'Plaza',
              Text.rich(
                TextSpan(
                  children: [
                    TextSpan(
                      text: o(s.plazaSlug),
                      style: const TextStyle(fontFamily: 'monospace'),
                    ),
                    TextSpan(text: ' · ${o(s.plazaNombre)}'),
                  ],
                ),
              ),
            ),
            (
              'Categoría / Subcategoría',
              t('${o(s.categoriaNombre)} / ${o(s.subcategoriaNombre)}'),
            ),
            ('Admin asignado', t(s.adminAsignado?.nombre)),
            (
              'Enviada',
              t(s.enviadaAt == null ? null : formatFecha(s.enviadaAt)),
            ),
            (
              'Decisión',
              t(s.decisionAt == null ? null : formatFecha(s.decisionAt)),
            ),
            ('Fecha Inicio', t(formatFechaDMY(s.fechaEventoInicio))),
            ('Hora Inicio', t(formatHora12(s.horaInicio))),
            ('Fecha Fin', t(formatFechaDMY(s.fechaEventoFin))),
            ('Hora Fin', t(formatHora12(s.horaFin))),
          ]),
        ),
        Seccion(
          titulo: 'Descripción',
          child: Text(s.descripcion, style: TextStyle(color: c.text2)),
        ),
        Seccion(
          titulo: 'Empresa ejecutante',
          child: KeyValueGrid([
            ('Empresa', t(s.empresaNombre)),
            ('Responsable', t(s.empresaResponsable)),
            ('Tel. empresa', t(s.empresaTelefono)),
            ('Email empresa', t(s.empresaEmail)),
          ]),
        ),
      ],
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/descargas/descargar_y_compartir.dart';
import '../../../core/format/fechas.dart';
import '../../../core/format/texto.dart';
import '../../../core/theme/colores.dart';
import '../../../core/widgets/badges.dart';
import '../../../core/widgets/campos.dart';
import '../solicitudes_api.dart';
import '../solicitudes_modelos.dart';
import 'detalle_layout.dart';

/// Pestaña "Detalle" (igual en admin e inquilino salvo el primer bloque):
/// descripción, datos generales, empresa ejecutante, contacto de emergencia
/// y datos específicos del tipo (`camposExtra`).
class DetalleCamposSolicitud extends StatelessWidget {
  const DetalleCamposSolicitud({
    super.key,
    required this.detalle,
    required this.vistaAdmin,
  });

  final SolicitudDetalle detalle;

  /// Admin: "Solicitante" y "Categoría / Subcategoría" juntos. Inquilino:
  /// "Categoría", "Subcategoría" y "Creada".
  final bool vistaAdmin;

  @override
  Widget build(BuildContext context) {
    final s = detalle.solicitud;
    final c = ColoresPlazapp.of(context);
    String o(String? v) => v == null || v.isEmpty ? '—' : v;
    Widget t(String? v) => Text(o(v));
    final extra = s.camposExtra.entries
        .where((e) => e.key != 'asistentes_estimados')
        .toList();
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(s.descripcion, style: TextStyle(color: c.text2)),
            const SizedBox(height: 18),
            KeyValueGrid([
              if (vistaAdmin) ...[
                (
                  'Solicitante',
                  t(
                    '${o(detalle.usuarioCreador?.nombre)} '
                    '(${o(detalle.inquilinoRazonSocial)})',
                  ),
                ),
                (
                  'Categoría / Subcategoría',
                  t('${o(s.categoriaNombre)} / ${o(s.subcategoriaNombre)}'),
                ),
              ] else ...[
                ('Categoría', t(s.categoriaNombre)),
                ('Subcategoría', t(s.subcategoriaNombre)),
                ('Creada', t(formatFecha(s.createdAt))),
              ],
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
            const TituloBloque('Empresa ejecutante'),
            KeyValueGrid([
              ('Empresa', t(s.empresaNombre)),
              ('Responsable', t(s.empresaResponsable)),
              ('Tel. empresa', t(s.empresaTelefono)),
              ('Email empresa', t(s.empresaEmail)),
            ]),
            const TituloBloque('Contacto de emergencia'),
            KeyValueGrid([
              ('Contacto', t(s.emergenciaContacto)),
              ('Tel. emerg.', t(s.emergenciaTelefono)),
              ('Modo emerg.', BadgeEmergencia(s.esEmergencia)),
            ]),
            const TituloBloque('Datos específicos'),
            if (extra.isEmpty)
              Text('—', style: TextStyle(color: c.textMuted))
            else
              KeyValueGrid([
                for (final e in extra)
                  (etiquetaCampoExtra[e.key] ?? e.key, _valorExtra(e, c)),
              ]),
          ],
        ),
      ),
    );
  }

  Widget _valorExtra(MapEntry<String, dynamic> e, ColoresPlazapp c) {
    final v = e.value;
    if (e.key == 'asistentes' && v is List) {
      if (v.isEmpty) return Text('—', style: TextStyle(color: c.textMuted));
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (final a in v.whereType<Map<String, dynamic>>())
            Text.rich(
              TextSpan(
                children: [
                  TextSpan(
                    text: _oGuion(a['nombre']),
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                  const TextSpan(text: ' · '),
                  TextSpan(
                    text: _oGuion(a['documento']),
                    style: TextStyle(color: c.text3),
                  ),
                ],
              ),
            ),
        ],
      );
    }
    return Text(formatValorExtra(v));
  }

  String _oGuion(Object? v) {
    final s = v is String ? decodificarHtml(v) : '';
    return s.isEmpty ? '—' : s;
  }
}

/// Valor de un campo extra como lo muestra el web: booleanos "Sí/No", fechas
/// civiles `DD-MM-YYYY`, números sin `.0` y `null` como "—".
String formatValorExtra(Object? v) {
  if (v == null) return '—';
  if (v is bool) return v ? 'Sí' : 'No';
  if (v is String) {
    if (RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(v)) return formatFechaDMY(v);
    return decodificarHtml(v);
  }
  if (v is double && v == v.truncateToDouble()) return '${v.toInt()}';
  return '$v';
}

/// "Sí · máx. 3/mes" (rojo) o "No".
class BadgeEmergencia extends StatelessWidget {
  const BadgeEmergencia(this.esEmergencia, {super.key});

  final bool esEmergencia;

  @override
  Widget build(BuildContext context) => Align(
    alignment: Alignment.centerLeft,
    child: esEmergencia
        ? const BadgePlazapp('Sí · máx. 3/mes', Tono.danger, punto: false)
        : const BadgePlazapp('No', Tono.neutral, punto: false),
  );
}

/// "Solicitud cerrada el dd/MM/yyyy." + resultado + comentario de cierre.
class BloqueCierre extends StatelessWidget {
  const BloqueCierre(this.s, {super.key, required this.color});

  final SolicitudItem s;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Solicitud cerrada'
          '${s.cerradaAt == null ? '' : ' el ${formatFecha(s.cerradaAt)}'}.',
          style: TextStyle(color: color),
        ),
        if (s.resultadoCierre != null)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: ResultadoCierreBadge(s.resultadoCierre!),
          ),
        if (s.cierreComentario != null && s.cierreComentario!.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Text(
              s.cierreComentario!,
              style: TextStyle(color: ColoresPlazapp.of(context).text),
            ),
          ),
      ],
    );
  }
}

/// "Descargar permiso (PDF)": se descarga y se abre la hoja de compartir.
class BotonPermisoPdf extends ConsumerWidget {
  const BotonPermisoPdf({super.key, required this.id, required this.codigo});

  final String id;
  final String codigo;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return OutlinedButton.icon(
      key: const Key('descargar-permiso'),
      onPressed: () => descargarYCompartir(
        context,
        descargar: () => pdfPermiso(ref.read(apiClientProvider), id),
        nombreArchivo: 'permiso-$codigo.pdf',
        mimeType: 'application/pdf',
      ),
      icon: const Icon(Icons.picture_as_pdf_outlined),
      label: const Text('Descargar permiso (PDF)'),
    );
  }
}

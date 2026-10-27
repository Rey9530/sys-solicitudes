import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/adjuntos/adjuntos.dart';
import '../../../../core/adjuntos/mime_permitidos.dart';
import '../../../../core/format/fechas.dart';
import '../../../../core/theme/colores.dart';
import '../../../../core/widgets/avisos.dart';
import '../../../../core/widgets/campos.dart';
import '../../comun/detalle_campos.dart';
import '../../comun/detalle_layout.dart';
import '../../solicitudes_modelos.dart';
import 'formulario_solicitud.dart';

/// Archivo elegido en el paso 3; se sube tras crear la solicitud.
class ArchivoPendiente {
  const ArchivoPendiente(this.nombre, this.bytes, this.mime);

  final String nombre;
  final Uint8List bytes;
  final String mime;
}

/// Etiquetas de `MIME_PERMITIDOS_DEFAULT` (mensaje de tipo no permitido).
const _etiquetasMime =
    'PDF, JPG, PNG, WebP, XLS, XLSX, DOCX, DWG, MP4, MOV, WebM';

/// Paso 3 · "Adjuntos y revisión". Los adjuntos solo aparecen al crear (en
/// edición se gestionan desde el detalle).
class PasoRevision extends StatelessWidget {
  const PasoRevision({
    super.key,
    required this.form,
    required this.datos,
    required this.archivos,
    required this.onArchivos,
    required this.conAdjuntos,
  });

  final FormularioSolicitud form;
  final DatosWizard datos;
  final List<ArchivoPendiente> archivos;
  final ValueChanged<List<ArchivoPendiente>> onArchivos;
  final bool conAdjuntos;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (conAdjuntos) ...[
          AdjuntosPendientes(archivos: archivos, onCambio: onArchivos),
          const SizedBox(height: 16),
        ],
        _Resumen(form: form, datos: datos),
      ],
    );
  }
}

/// Selección local de adjuntos (máx. 10, 50 MB, tipos de la lista del web).
class AdjuntosPendientes extends ConsumerWidget {
  const AdjuntosPendientes({
    super.key,
    required this.archivos,
    required this.onCambio,
  });

  final List<ArchivoPendiente> archivos;
  final ValueChanged<List<ArchivoPendiente>> onCambio;

  void _agregar(BuildContext context, List<ArchivoElegido> elegidos) {
    final nuevos = [...archivos];
    for (final a in elegidos) {
      final mime = mimeParaArchivo(a.nombre);
      if (mime == null) {
        mostrarError(
          context,
          '"${a.nombre}" no es un tipo permitido ($_etiquetasMime).',
        );
      } else if (a.bytes.length > tamanoMaxAdjuntoBytes) {
        mostrarError(context, '"${a.nombre}" excede 50 MB.');
      } else if (nuevos.length < maxAdjuntosSolicitud) {
        nuevos.add(ArchivoPendiente(a.nombre, a.bytes, mime));
      }
    }
    onCambio(nuevos);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = ColoresPlazapp.of(context);
    final lleno = archivos.length >= maxAdjuntosSolicitud;
    final restantes = maxAdjuntosSolicitud - archivos.length;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                const Expanded(
                  child: Text(
                    'Adjuntos',
                    style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                  ),
                ),
                Text(
                  '${archivos.length} / $maxAdjuntosSolicitud',
                  style: TextStyle(color: c.text3, fontSize: 12),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: c.surface2,
                border: Border.all(color: c.borderStrong),
                borderRadius: BorderRadius.circular(10),
              ),
              child: lleno
                  ? Text(
                      'Has alcanzado el máximo de $maxAdjuntosSolicitud '
                      'adjuntos.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: c.text2),
                    )
                  : Column(
                      children: [
                        Wrap(
                          alignment: WrapAlignment.center,
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            OutlinedButton.icon(
                              key: const Key('wz-adjuntos-subir'),
                              onPressed: () async {
                                final elegidos = await ref
                                    .read(selectorArchivosProvider)
                                    .elegirArchivos(
                                      extensiones: mimePorExtension.keys
                                          .toList(),
                                    );
                                if (context.mounted && elegidos.isNotEmpty) {
                                  _agregar(context, elegidos);
                                }
                              },
                              icon: const Icon(Icons.upload_file),
                              label: const Text('Subir archivo'),
                            ),
                            OutlinedButton.icon(
                              key: const Key('wz-adjuntos-foto'),
                              onPressed: () async {
                                final foto = await ref
                                    .read(selectorArchivosProvider)
                                    .tomarFoto();
                                if (context.mounted && foto != null) {
                                  _agregar(context, [foto]);
                                }
                              },
                              icon: const Icon(Icons.photo_camera_outlined),
                              label: const Text('Tomar foto'),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          '$_etiquetasMime · máx. 50 MB por archivo · '
                          '$restantes restantes',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: c.text3, fontSize: 12),
                        ),
                      ],
                    ),
            ),
            const SizedBox(height: 10),
            for (var i = 0; i < archivos.length; i++)
              Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  leading: Icon(_icono(archivos[i].mime), color: c.text3),
                  title: Text(
                    archivos[i].nombre,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  subtitle: Text(
                    '${archivos[i].mime} · '
                    '${formatTamano(archivos[i].bytes.length)}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(color: c.text3, fontSize: 12),
                  ),
                  trailing: IconButton(
                    tooltip: 'Quitar ${archivos[i].nombre}',
                    icon: const Icon(Icons.close),
                    onPressed: () => onCambio([...archivos]..removeAt(i)),
                  ),
                ),
              ),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.info_outline, size: 14, color: c.text3),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    'Los adjuntos son opcionales. Se subirán al bucket de la '
                    'plaza al enviar la solicitud (modo borrador: solo al '
                    'enviar).',
                    style: TextStyle(color: c.text3, fontSize: 12),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  IconData _icono(String mime) {
    if (mime.startsWith('image/')) return Icons.image_outlined;
    if (mime.startsWith('video/')) return Icons.movie_outlined;
    return Icons.description_outlined;
  }
}

/// Tarjeta "Revisión · Verifica antes de enviar".
class _Resumen extends StatelessWidget {
  const _Resumen({required this.form, required this.datos});

  final FormularioSolicitud form;
  final DatosWizard datos;

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    Widget t(Object? v) {
      final s = v?.toString() ?? '';
      return Text(s.isEmpty ? '—' : s);
    }

    String? fechaHora(String? f, String? h) => f == null
        ? null
        : '${formatFechaDMY(f)} ${h == null ? '' : formatHora12(h)}'.trim();

    final categoria = datos.categorias
        .where((x) => x.id == form.categoriaId)
        .firstOrNull;
    final subcategoria = categoria?.subcategorias
        .where((x) => x.id == form.subcategoriaId)
        .firstOrNull;
    final tipo =
        datos.tipos.where((x) => x.codigo == form.tipo).firstOrNull?.etiqueta ??
        etiquetaTipoSolicitud[form.tipo] ??
        form.tipo;
    final local = datos.locales.where((x) => x.id == form.localId).firstOrNull;
    final n = form.numAsistentes;

    final datosTipo = <(String, Widget)>[
      if (form.tipo == 'mantenimiento') ...[
        if (form.areaAfectada.isNotEmpty)
          ('Área afectada', t(form.areaAfectada)),
        (
          'Requiere ingreso al local',
          t(form.requiereIngresoALocal ? 'Sí' : 'No'),
        ),
      ],
      if (form.tipo == 'remodelacion') ...[
        if (form.fechaInicioEstimada != null)
          (
            'Fecha inicio estimada',
            t(formatFechaDMY(form.fechaInicioEstimada)),
          ),
        if (form.duracionDias.isNotEmpty)
          ('Duración (días)', t(form.duracionDias)),
        if (form.empresaConstructora.isNotEmpty)
          ('Empresa constructora', t(form.empresaConstructora)),
        if (form.montoPresupuesto.isNotEmpty)
          ('Monto presupuesto (USD)', t(form.montoPresupuesto)),
      ],
    ];

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Wrap(
              alignment: WrapAlignment.spaceBetween,
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: 8,
              children: [
                const Text(
                  'Revisión',
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                ),
                Text(
                  'Verifica antes de enviar',
                  style: TextStyle(color: c.text3, fontSize: 12),
                ),
              ],
            ),
            const TituloBloque('Identificación'),
            KeyValueGrid([
              ('Tipo', t(tipo)),
              ('Local', t(local?.codigo)),
              ('Título', t(form.titulo)),
              ('Descripción', t(form.descripcion)),
              ('Categoría', t(categoria?.nombre)),
              ('Subcategoría', t(subcategoria?.nombre)),
            ]),
            const TituloBloque('Empresa ejecutante'),
            KeyValueGrid([
              ('Empresa', t(form.empresaNombre)),
              ('Responsable', t(form.empresaResponsable)),
              ('Tel. empresa', t(form.empresaTelefono)),
              ('Email empresa', t(form.empresaEmail)),
            ]),
            const TituloBloque('Contacto de emergencia'),
            KeyValueGrid([
              ('Contacto', t(form.emergenciaContacto)),
              ('Tel. emerg.', t(form.emergenciaTelefono)),
              ('Modo emerg.', BadgeEmergencia(form.esEmergencia)),
            ]),
            const TituloBloque('Fechas del permiso'),
            KeyValueGrid([
              ('Inicio', t(fechaHora(form.fechaInicio, form.horaInicio))),
              ('Fin', t(fechaHora(form.fechaFin, form.horaFin))),
            ]),
            const TituloBloque('Personal'),
            KeyValueGrid([
              ('Cantidad', t(n > 0 ? n : null)),
              if (n > 0)
                (
                  'Detalle',
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      for (var i = 0; i < n; i++)
                        Text(
                          '${i + 1}. '
                          '${_o(form.asistentes[i]?.nombre, 'Persona ${i + 1}')}'
                          ' · ${_o(form.asistentes[i]?.documento, 's/doc')}',
                        ),
                    ],
                  ),
                ),
            ]),
            const TituloBloque('Datos del tipo'),
            if (datosTipo.isEmpty)
              Text('—', style: TextStyle(color: c.textMuted))
            else
              KeyValueGrid(datosTipo),
          ],
        ),
      ),
    );
  }

  String _o(String? v, String vacio) =>
      v == null || v.trim().isEmpty ? vacio : v.trim();
}

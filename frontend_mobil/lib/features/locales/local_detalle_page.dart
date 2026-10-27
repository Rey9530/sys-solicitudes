import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/adjuntos/adjuntos_seccion.dart';
import '../../core/adjuntos/mime_permitidos.dart';
import '../../core/api/api_providers.dart';
import '../../core/format/fechas.dart';
import '../../core/theme/colores.dart';
import '../../core/widgets/avisos.dart';
import '../../core/widgets/badges.dart';
import '../../core/widgets/campo_select.dart';
import '../../core/widgets/can.dart';
import '../../core/widgets/estados.dart';
import '../../core/widgets/filtros.dart';
import '../../core/widgets/pagina.dart';
import '../../core/widgets/paginador.dart';
import '../contratos/catalogo_comun.dart';
import 'local_form_page.dart';
import 'locales_api.dart';
import 'locales_modelos.dart';
import 'locales_providers.dart';

/// `/admin/locales/:id` — detalle con pestañas Datos / Contratos / Adjuntos /
/// Solicitudes (espejo de `admin/locales/[id]/page.tsx`).
class LocalDetallePage extends ConsumerWidget {
  const LocalDetallePage({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final datos = ref.watch(localProvider(id));
    final verAdjuntos = puedeHacer(ref, 'locales.adjuntos.descargar');
    final adjuntos = verAdjuntos
        ? ref.watch(adjuntosLocalProvider(id)).value
        : null;
    final c = ColoresPlazapp.of(context);
    return AsyncView(
      value: datos,
      onRetry: () => ref.invalidate(localProvider(id)),
      data: (detalle) {
        final local = detalle.local;
        return ContenidoPagina(
          onRefresh: () => recargar(ref, localProvider(id).future),
          children: [
            EncabezadoPagina(
              titulo:
                  '${local.codigo}${local.modulo == null ? '' : ' · Módulo ${local.modulo}'}',
              badges: [EstadoLocalBadge(local.estado)],
              rutaVolver: '/admin/locales',
            ),
            PestanasInline(
              pestanas: [
                Pestana(
                  'Datos',
                  _EditarLocalForm(
                    key: ValueKey(local.updatedAt),
                    detalle: detalle,
                  ),
                ),
                Pestana(
                  'Contratos',
                  ContratosMini(contratos: detalle.historicoContratos),
                  contador: detalle.historicoContratos.length,
                ),
                if (verAdjuntos)
                  Pestana(
                    'Adjuntos',
                    _AdjuntosLocal(id: id),
                    contador: adjuntos?.length,
                  ),
                if (puedeHacer(ref, 'solicitudes.bandeja.ver'))
                  Pestana('Solicitudes', _SolicitudesLocal(localId: id)),
              ],
            ),
            const SizedBox(height: 16),
            Text(
              'Creado: ${formatFecha(local.createdAt)} · '
              'Actualizado: ${formatFecha(local.updatedAt)}',
              style: TextStyle(color: c.text3, fontSize: 12.5),
            ),
          ],
        );
      },
    );
  }
}

/// Pestaña "Datos" (espejo de `editar-local-form.tsx`).
class _EditarLocalForm extends ConsumerStatefulWidget {
  const _EditarLocalForm({super.key, required this.detalle});

  final LocalDetalle detalle;

  @override
  ConsumerState<_EditarLocalForm> createState() => _EditarLocalFormState();
}

class _EditarLocalFormState extends ConsumerState<_EditarLocalForm> {
  final _form = GlobalKey<FormState>();
  late final _modulo = TextEditingController(text: _local.modulo ?? '');
  late final _nivel = TextEditingController(text: _local.nivel ?? '');
  late final _area = TextEditingController(text: textoDe(_local.areaM2));
  late final _energia = TextEditingController(
    text: _local.medidorEnergia ?? '',
  );
  late final _agua = TextEditingController(text: _local.medidorAgua ?? '');
  late String? _estado = estadosLocalSinContrato.contains(_local.estado)
      ? _local.estado
      : null;
  bool _enviando = false;

  Local get _local => widget.detalle.local;
  bool get _conVigente => widget.detalle.contratoVigente != null;

  @override
  void dispose() {
    for (final c in [_modulo, _nivel, _area, _energia, _agua]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _guardar() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _enviando = true);
    try {
      await actualizarLocal(
        ref.read(apiClientProvider),
        _local.id,
        cuerpoEditarLocal(
          modulo: _modulo.text,
          nivel: _nivel.text,
          area: _area.text,
          medidorEnergia: _energia.text,
          medidorAgua: _agua.text,
          // Con contrato vigente el estado no se envía (select deshabilitado).
          estado: _conVigente ? null : _estado,
        ),
      );
      if (!mounted) return;
      mostrarExito(context, 'Local actualizado');
      ref.invalidate(localProvider(_local.id));
      ref.invalidate(localesProvider);
    } on Object catch (e) {
      if (mounted) mostrarError(context, e);
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _form,
      child: Seccion(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: RejillaCampos(
                maxColumnas: 2,
                children: [
                  TextFormField(
                    key: const Key('editar-local-modulo'),
                    controller: _modulo,
                    textCapitalization: TextCapitalization.characters,
                    inputFormatters: [LengthLimitingTextInputFormatter(20)],
                    decoration: const InputDecoration(
                      labelText: 'Módulo',
                      hintText: 'A',
                    ),
                  ),
                  TextFormField(
                    key: const Key('editar-local-nivel'),
                    controller: _nivel,
                    inputFormatters: [LengthLimitingTextInputFormatter(10)],
                    decoration: const InputDecoration(
                      labelText: 'Nivel',
                      hintText: '1',
                    ),
                  ),
                  TextFormField(
                    initialValue: _local.codigo,
                    enabled: false,
                    decoration: const InputDecoration(
                      labelText: 'Local',
                      helperText: 'El local es inmutable.',
                    ),
                  ),
                  if (_conVigente)
                    CampoSelect<String>(
                      key: const Key('editar-local-estado'),
                      label: 'Estado',
                      valor: 'alquilado',
                      opciones: const [('alquilado', 'alquilado')],
                      // Solo lectura.
                      enabled: false,
                      onChanged: (_) {},
                      ayuda: 'Con contrato vigente el estado se gestiona desde contratos.',
                    )
                  else
                    CampoSelect<String>(
                      key: const Key('editar-local-estado'),
                      label: 'Estado',
                      valor: _estado,
                      opciones: [
                        for (final e in estadosLocalSinContrato)
                          (e, estadoLocalCrudo(e)),
                      ],
                      onChanged: (v) => setState(() => _estado = v),
                    ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: TextFormField(
                key: const Key('editar-local-area'),
                controller: _area,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                validator: validarAreaLocal,
                decoration: const InputDecoration(labelText: 'Área (m²)'),
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: RejillaCampos(
                maxColumnas: 2,
                children: [
                  TextFormField(
                    key: const Key('editar-local-energia'),
                    controller: _energia,
                    keyboardType: TextInputType.text,
                    inputFormatters: formatoMedidor,
                    validator: validarMedidor,
                    decoration: const InputDecoration(
                      labelText: 'Medidor energía',
                    ),
                  ),
                  TextFormField(
                    key: const Key('editar-local-agua'),
                    controller: _agua,
                    keyboardType: TextInputType.text,
                    inputFormatters: formatoMedidor,
                    validator: validarMedidor,
                    decoration: const InputDecoration(
                      labelText: 'Medidor agua',
                    ),
                  ),
                ],
              ),
            ),
            Align(
              alignment: Alignment.centerRight,
              child: Can(
                permiso: 'locales.editar',
                child: FilledButton(
                  key: const Key('editar-local-guardar'),
                  onPressed: _enviando ? null : _guardar,
                  child: Text(_enviando ? 'Guardando…' : 'Guardar cambios'),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Pestaña "Adjuntos": solo imágenes (jpeg, png, webp).
class _AdjuntosLocal extends ConsumerWidget {
  const _AdjuntosLocal({required this.id});

  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final adjuntos = ref.watch(adjuntosLocalProvider(id));
    // Fuera de los callbacks: la subida sigue aunque esta pestaña se desmonte.
    final api = ref.watch(apiClientProvider);
    return AsyncView(
      value: adjuntos,
      onRetry: () => ref.invalidate(adjuntosLocalProvider(id)),
      data: (lista) => AdjuntosSeccion(
        adjuntos: lista,
        // Sin tope de cantidad en locales (el web no lo limita).
        maximo: 999,
        soloExtensiones: extensionesImagen,
        puedeSubir: puedeHacer(ref, 'locales.adjuntos.subir'),
        puedeEliminar: puedeHacer(ref, 'locales.adjuntos.eliminar'),
        subir: (nombre, bytes, mime) =>
            subirAdjuntoLocal(api, id, nombre, bytes, mime),
        alCambiar: () => ref.invalidate(adjuntosLocalProvider(id)),
      ),
    );
  }
}

/// Pestaña "Solicitudes": solicitudes del local (`GET /solicitudes?localId=`).
class _SolicitudesLocal extends ConsumerStatefulWidget {
  const _SolicitudesLocal({required this.localId});

  final String localId;

  @override
  ConsumerState<_SolicitudesLocal> createState() => _SolicitudesLocalState();
}

class _SolicitudesLocalState extends ConsumerState<_SolicitudesLocal> {
  int _pagina = 1;

  @override
  Widget build(BuildContext context) {
    final clave = (widget.localId, _pagina);
    return AsyncView(
      value: ref.watch(solicitudesLocalProvider(clave)),
      onRetry: () => ref.invalidate(solicitudesLocalProvider(clave)),
      data: (pagina) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ListaSolicitudesRelacionadas(solicitudes: pagina.items),
          Paginador(
            pagina: pagina.page,
            totalPaginas: pagina.totalPages,
            onCambiar: (p) => setState(() => _pagina = p),
          ),
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_providers.dart';
import '../../core/auth/sesion_controller.dart';
import '../../core/theme/colores.dart';
import '../../core/widgets/avisos.dart';
import '../../core/widgets/dialogos.dart';
import '../../core/widgets/estados.dart';
import '../../core/widgets/pagina.dart';
import 'categorias_api.dart';
import 'categorias_modelos.dart';
import 'categorias_providers.dart';
import '../../core/api/payload.dart';

const _rutaListado = '/admin/catalogos/tipos-solicitud';

/// `/admin/catalogos/tipos-solicitud/:id` — editar etiqueta, descripción y
/// orden, y activar/desactivar. Espejo de `tipos-solicitud/[id]/page.tsx` +
/// `tipo-solicitud-form.tsx`.
///
/// "Guardar cambios" envía **solo** los campos cambiados (corrige B2-R13: el
/// web reenviaba `activo` y revertía el botón Activar/Desactivar).
class TipoSolicitudPage extends ConsumerWidget {
  const TipoSolicitudPage({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final datos = ref.watch(tipoSolicitudProvider(id));
    return AsyncView(
      value: datos,
      onRetry: () => ref.invalidate(tipoSolicitudProvider(id)),
      data: (tipo) => ContenidoPagina(
        onRefresh: () => recargar(ref, tipoSolicitudProvider(id).future),
        children: [
          EncabezadoPagina(
            titulo: tipo.etiqueta,
            subtitulo:
                'Código: ${tipo.codigo} · '
                '${tipo.activo ? 'Activo' : 'Inactivo'} · orden ${tipo.orden}',
            rutaVolver: _rutaListado,
          ),
          if (tipo.codigo == 'otro') ...[
            const AvisoBanner(
              tono: Tono.info,
              child: Text.rich(
                TextSpan(
                  children: [
                    TextSpan(
                      text: 'Tipo «otro»\n',
                      style: TextStyle(fontWeight: FontWeight.w600),
                    ),
                    TextSpan(
                      text:
                          'Es el fallback del flujo de solicitudes (no requiere '
                          'categoría/subcategoría). Por diseño, ',
                    ),
                    TextSpan(
                      text: 'nunca se puede desactivar',
                      style: TextStyle(fontWeight: FontWeight.w600),
                    ),
                    TextSpan(
                      text:
                          ': el backend rechaza el cambio con TIPO_INMUTABLE.',
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 14),
          ],
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: _TipoForm(key: ValueKey(tipo.id), tipo: tipo),
            ),
          ),
        ],
      ),
    );
  }
}

class _TipoForm extends ConsumerStatefulWidget {
  const _TipoForm({super.key, required this.tipo});

  final TipoSolicitudConfig tipo;

  @override
  ConsumerState<_TipoForm> createState() => _TipoFormState();
}

class _TipoFormState extends ConsumerState<_TipoForm> {
  final _form = GlobalKey<FormState>();
  late final _etiqueta = TextEditingController(text: widget.tipo.etiqueta);
  late final _descripcion = TextEditingController(
    text: widget.tipo.descripcion,
  );
  late final _orden = TextEditingController(text: '${widget.tipo.orden}');
  bool _guardando = false;
  bool _cambiandoEstado = false;

  @override
  void initState() {
    super.initState();
    for (final c in [_etiqueta, _descripcion, _orden]) {
      c.addListener(() => setState(() {}));
    }
  }

  @override
  void dispose() {
    _etiqueta.dispose();
    _descripcion.dispose();
    _orden.dispose();
    super.dispose();
  }

  /// Campos que difieren del tipo cargado (lo único que se envía).
  Map<String, Object?> get _cambios {
    final tipo = widget.tipo;
    final etiqueta = _etiqueta.text.trim();
    final descripcion = textoOpcional(_descripcion.text);
    final orden = int.tryParse(_orden.text.trim());
    return {
      if (etiqueta != tipo.etiqueta) 'etiqueta': etiqueta,
      if (descripcion != tipo.descripcion) 'descripcion': descripcion,
      if (orden != null && orden != tipo.orden) 'orden': orden,
    };
  }

  void _invalidar() {
    ref.invalidate(tipoSolicitudProvider(widget.tipo.id));
    ref.invalidate(tiposSolicitudProvider);
  }

  Future<void> _guardar() async {
    if (!_form.currentState!.validate()) return;
    final cambios = _cambios;
    if (cambios.isEmpty) return;
    setState(() => _guardando = true);
    try {
      await actualizarTipoSolicitud(
        ref.read(apiClientProvider),
        widget.tipo.id,
        cambios,
      );
      if (!mounted) return;
      mostrarExito(context, 'Tipo de solicitud actualizado');
      _invalidar();
    } catch (e) {
      if (mounted) mostrarError(context, e);
    } finally {
      if (mounted) setState(() => _guardando = false);
    }
  }

  Future<void> _alternarEstado() async {
    final tipo = widget.tipo;
    final activar = !tipo.activo;
    final ok = await confirmar(
      context,
      titulo: activar
          ? '¿Activar el tipo «${tipo.etiqueta}»?'
          : '¿Desactivar el tipo «${tipo.etiqueta}»?',
      mensaje: activar
          ? 'Volverá a aparecer en el wizard y en los filtros de reportes.'
          : 'Ya no aparecerá en el wizard ni en los filtros. Las solicitudes '
                'existentes NO se modifican.',
      textoConfirmar: activar ? 'Sí, activar' : 'Sí, desactivar',
      destructiva: !activar,
    );
    if (!ok || !mounted) return;
    setState(() => _cambiandoEstado = true);
    try {
      await actualizarTipoSolicitud(ref.read(apiClientProvider), tipo.id, {
        'activo': activar,
      });
      if (!mounted) return;
      mostrarExito(context, activar ? 'Tipo activado' : 'Tipo desactivado');
      _invalidar();
    } catch (e) {
      // TIPO_INMUTABLE / TIPO_CON_SOLICITUDES_ACTIVAS traen su detalle.
      if (mounted) mostrarError(context, e);
    } finally {
      if (mounted) setState(() => _cambiandoEstado = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    final tipo = widget.tipo;
    final puede =
        ref.watch(sesionProvider).value?.puede('tipos_solicitud.editar') ??
        false;
    final esOtro = tipo.codigo == 'otro';
    final error = Theme.of(context).colorScheme.error;

    return Form(
      key: _form,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextFormField(
            key: const Key('tipo-etiqueta'),
            controller: _etiqueta,
            enabled: puede,
            maxLength: 80,
            decoration: const InputDecoration(
              labelText: 'Etiqueta visible *',
              helperText:
                  'Es lo que ven los inquilinos en el wizard y los admins en '
                  'los reportes.',
              helperMaxLines: 3,
            ),
            validator: (v) =>
                (v ?? '').trim().isEmpty ? 'Este campo es obligatorio.' : null,
          ),
          const SizedBox(height: 8),
          TextFormField(
            key: const Key('tipo-descripcion'),
            controller: _descripcion,
            enabled: puede,
            minLines: 3,
            maxLines: 5,
            maxLength: 500,
            decoration: const InputDecoration(labelText: 'Descripción'),
          ),
          const SizedBox(height: 8),
          TextFormField(
            key: const Key('tipo-orden'),
            controller: _orden,
            enabled: puede,
            keyboardType: TextInputType.number,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            decoration: const InputDecoration(
              labelText: 'Orden',
              helperText:
                  'Posición en el selector del wizard y en los filtros. '
                  'Menor = primero.',
              helperMaxLines: 3,
            ),
            validator: (v) {
              final n = int.tryParse((v ?? '').trim());
              return n == null || n < 0 || n > 99
                  ? 'Debe ser un número entre 0 y 99.'
                  : null;
            },
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: c.surface2,
              border: Border.all(color: c.border),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Wrap(
              alignment: WrapAlignment.spaceBetween,
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: 12,
              runSpacing: 8,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text(
                      'Estado',
                      style: TextStyle(fontWeight: FontWeight.w600),
                    ),
                    Text(
                      tipo.activo
                          ? 'Visible en el wizard y en los filtros.'
                          : 'Oculto del wizard y de los filtros.',
                      style: TextStyle(color: c.text3, fontSize: 12.5),
                    ),
                  ],
                ),
                if (puede)
                  OutlinedButton(
                    key: const Key('tipo-estado'),
                    style: tipo.activo
                        ? OutlinedButton.styleFrom(foregroundColor: error)
                        : null,
                    onPressed: _cambiandoEstado || (esOtro && tipo.activo)
                        ? null
                        : _alternarEstado,
                    child: Text(
                      _cambiandoEstado
                          ? 'Guardando…'
                          : tipo.activo
                          ? 'Desactivar'
                          : 'Activar',
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Wrap(
            alignment: WrapAlignment.end,
            spacing: 8,
            runSpacing: 8,
            children: [
              OutlinedButton(
                onPressed: () =>
                    context.canPop() ? context.pop() : context.go(_rutaListado),
                child: const Text('Cancelar'),
              ),
              if (puede)
                FilledButton(
                  key: const Key('tipo-guardar'),
                  onPressed: _guardando || _cambios.isEmpty ? null : _guardar,
                  child: Text(_guardando ? 'Guardando…' : 'Guardar cambios'),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

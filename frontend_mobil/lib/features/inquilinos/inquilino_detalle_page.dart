import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_providers.dart';
import '../../core/theme/colores.dart';
import '../../core/widgets/avisos.dart';
import '../../core/widgets/can.dart';
import '../../core/widgets/dialogos.dart';
import '../../core/widgets/estados.dart';
import '../../core/widgets/filtros.dart';
import '../../core/widgets/pagina.dart';
import '../contratos/catalogo_comun.dart';
import 'inquilino_campos.dart';
import 'inquilinos_api.dart';
import 'inquilinos_modelos.dart';
import 'inquilinos_providers.dart';
import 'usuarios_inquilino_tab.dart';

/// `/admin/inquilinos/:id` — detalle con pestañas Datos / Contratos /
/// Usuarios / Solicitudes (espejo de `admin/inquilinos/[id]/page.tsx`).
class InquilinoDetallePage extends ConsumerWidget {
  const InquilinoDetallePage({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final datos = ref.watch(inquilinoProvider(id));
    final usuarios = ref.watch(usuariosInquilinoProvider(id)).value;
    return AsyncView(
      value: datos,
      onRetry: () => ref.invalidate(inquilinoProvider(id)),
      data: (detalle) {
        final inquilino = detalle.inquilino;
        return ContenidoPagina(
          onRefresh: () => recargar(ref, inquilinoProvider(id).future),
          children: [
            EncabezadoPagina(
              titulo: inquilino.razonSocial,
              subtitulo: inquilino.identificacion == null
                  ? null
                  : 'ID: ${inquilino.identificacion}',
              rutaVolver: '/admin/inquilinos',
              acciones: [
                Can(
                  permiso: 'inquilinos.alta_usuario',
                  child: OutlinedButton.icon(
                    key: const Key('inquilino-alta-usuario'),
                    onPressed: () =>
                        mostrarAltaUsuario(context, inquilino: inquilino),
                    icon: const Icon(Icons.person_add_alt_outlined),
                    label: const Text('Alta rápida de usuario'),
                  ),
                ),
              ],
            ),
            PestanasInline(
              pestanas: [
                Pestana(
                  'Datos',
                  _EditarInquilinoForm(
                    key: ValueKey(detalle),
                    detalle: detalle,
                  ),
                ),
                Pestana(
                  'Contratos',
                  ContratosMini(contratos: detalle.historicoContratos),
                  contador: detalle.historicoContratos.length,
                ),
                Pestana(
                  'Usuarios',
                  UsuariosInquilinoTab(inquilinoId: id),
                  contador: usuarios?.length,
                ),
                if (puedeHacer(ref, 'solicitudes.bandeja.ver'))
                  Pestana('Solicitudes', _SolicitudesInquilino(id: id)),
              ],
            ),
          ],
        );
      },
    );
  }
}

/// Pestaña "Datos" (espejo de `editar-inquilino-form.tsx`): razón social e
/// identificación inmutables; un campo vaciado se envía `null`.
class _EditarInquilinoForm extends ConsumerStatefulWidget {
  const _EditarInquilinoForm({super.key, required this.detalle});

  final InquilinoDetalle detalle;

  @override
  ConsumerState<_EditarInquilinoForm> createState() =>
      _EditarInquilinoFormState();
}

class _EditarInquilinoFormState extends ConsumerState<_EditarInquilinoForm> {
  final _form = GlobalKey<FormState>();
  late final _c = controladoresInquilino(_inquilino);
  late String? _tipoCliente = _inquilino.tipoCliente;
  bool _enviando = false;
  bool _desactivando = false;

  Inquilino get _inquilino => widget.detalle.inquilino;

  @override
  void dispose() {
    for (final c in _c.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _guardar() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _enviando = true);
    try {
      await actualizarInquilino(
        ref.read(apiClientProvider),
        _inquilino.id,
        cuerpoEditarInquilino(valoresDe(_c), tipoCliente: _tipoCliente),
      );
      if (!mounted) return;
      mostrarExito(context, 'Inquilino actualizado');
      ref.invalidate(inquilinoProvider(_inquilino.id));
      ref.invalidate(inquilinosProvider);
    } on Object catch (e) {
      if (mounted) mostrarError(context, e);
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  Future<void> _desactivar() async {
    final ok = await confirmar(
      context,
      titulo: '¿Desactivar a "${_inquilino.razonSocial}"?',
      mensaje:
          'El inquilino no podrá ser usado en nuevos contratos, pero sus datos '
          'y contratos históricos se conservan.',
      textoConfirmar: 'Sí, desactivar',
      destructiva: true,
    );
    if (!ok || !mounted) return;
    setState(() => _desactivando = true);
    try {
      await desactivarInquilino(ref.read(apiClientProvider), _inquilino.id);
      if (!mounted) return;
      mostrarExito(context, 'Inquilino desactivado');
      ref.invalidate(inquilinosProvider);
      context.canPop() ? context.pop() : context.go('/admin/inquilinos');
    } on Object catch (e) {
      if (mounted) mostrarError(context, e);
    } finally {
      if (mounted) setState(() => _desactivando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    final conVigente = widget.detalle.tieneVigente;
    return Form(
      key: _form,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Seccion(
            titulo: 'Identidad (inmutable)',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: RejillaCampos(
                    maxColumnas: 2,
                    children: [
                      TextFormField(
                        initialValue: _inquilino.razonSocial,
                        enabled: false,
                        decoration: const InputDecoration(
                          labelText: 'Razón social',
                        ),
                      ),
                      TextFormField(
                        initialValue: _inquilino.identificacion ?? '—',
                        enabled: false,
                        decoration: const InputDecoration(
                          labelText: 'Identificación (NIT)',
                        ),
                      ),
                    ],
                  ),
                ),
                Text(
                  'Razón social e identificación son inmutables tras la '
                  'creación. Para cambiarlas, desactive el inquilino y cree '
                  'uno nuevo.',
                  style: TextStyle(color: c.text3, fontSize: 12.5),
                ),
              ],
            ),
          ),
          Seccion(
            titulo: 'Datos adicionales',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: RejillaCampos(
                    maxColumnas: 2,
                    children: textosInquilino(const [
                      campoNombreComercial,
                      campoNrc,
                    ], _c),
                  ),
                ),
                CampoTextoInquilino(
                  campo: campoRepresentante,
                  controlador: _c['representanteLegal']!,
                ),
              ],
            ),
          ),
          SeccionesInquilino(
            controladores: _c,
            tipoCliente: _tipoCliente,
            onTipoCliente: (v) => setState(() => _tipoCliente = v),
          ),
          Wrap(
            alignment: WrapAlignment.spaceBetween,
            spacing: 8,
            runSpacing: 8,
            children: [
              Can(
                permiso: 'inquilinos.deshabilitar',
                child: Tooltip(
                  message: conVigente
                      ? 'No se puede desactivar con contrato vigente'
                      : '',
                  child: OutlinedButton(
                    key: const Key('inquilino-desactivar'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Theme.of(context).colorScheme.error,
                    ),
                    onPressed: conVigente || _desactivando ? null : _desactivar,
                    child: Text(_desactivando ? 'Desactivando…' : 'Desactivar'),
                  ),
                ),
              ),
              Can(
                permiso: 'inquilinos.editar',
                child: FilledButton(
                  key: const Key('inquilino-guardar'),
                  onPressed: _enviando ? null : _guardar,
                  child: Text(_enviando ? 'Guardando…' : 'Guardar cambios'),
                ),
              ),
            ],
          ),
          if (conVigente)
            Can(
              permiso: 'inquilinos.deshabilitar',
              child: Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  'El botón «Desactivar» está deshabilitado porque tiene '
                  'contratos vigentes.',
                  style: TextStyle(color: c.text3, fontSize: 12.5),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Pestaña "Solicitudes": las del inquilino en sus locales.
class _SolicitudesInquilino extends ConsumerWidget {
  const _SolicitudesInquilino({required this.id});

  final String id;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return AsyncView(
      value: ref.watch(solicitudesInquilinoProvider(id)),
      onRetry: () => ref.invalidate(solicitudesInquilinoProvider(id)),
      data: (lista) => ListaSolicitudesRelacionadas(solicitudes: lista),
    );
  }
}

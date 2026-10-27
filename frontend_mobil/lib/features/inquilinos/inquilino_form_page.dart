import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_error.dart';
import '../../core/api/api_providers.dart';
import '../../core/widgets/avisos.dart';
import '../../core/widgets/can.dart';
import '../../core/widgets/filtros.dart';
import '../../core/widgets/pagina.dart';
import 'inquilino_campos.dart';
import 'inquilinos_api.dart';
import 'inquilinos_providers.dart';

/// `/admin/inquilinos/nuevo` — crear inquilino (espejo de
/// `nuevo-inquilino-form.tsx`). Solo la razón social es obligatoria; los
/// campos vacíos no se envían.
class InquilinoFormPage extends ConsumerStatefulWidget {
  const InquilinoFormPage({super.key});

  @override
  ConsumerState<InquilinoFormPage> createState() => _InquilinoFormPageState();
}

class _InquilinoFormPageState extends ConsumerState<InquilinoFormPage> {
  final _form = GlobalKey<FormState>();
  final _c = controladoresInquilino();
  String? _tipoCliente;
  bool _enviando = false;
  String? _errorIdentificacion;

  @override
  void dispose() {
    for (final c in _c.values) {
      c.dispose();
    }
    super.dispose();
  }

  void _volver() =>
      context.canPop() ? context.pop() : context.go('/admin/inquilinos');

  Future<void> _crear() async {
    setState(() => _errorIdentificacion = null);
    if (!_form.currentState!.validate()) return;
    setState(() => _enviando = true);
    try {
      await crearInquilino(
        ref.read(apiClientProvider),
        cuerpoNuevoInquilino(valoresDe(_c), tipoCliente: _tipoCliente),
      );
      if (!mounted) return;
      mostrarExito(context, 'Inquilino creado');
      ref.invalidate(inquilinosProvider);
      _volver();
    } on ApiError catch (e) {
      if (!mounted) return;
      if (e.code == 'INQUILINO_IDENTIFICACION_DUPLICADA') {
        setState(() => _errorIdentificacion = e.mensaje);
      }
      mostrarError(context, e);
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ContenidoPagina(
      children: [
        const EncabezadoPagina(
          titulo: 'Nuevo inquilino',
          subtitulo: 'Razón social e identificación son inmutables tras crear.',
          rutaVolver: '/admin/inquilinos',
        ),
        Form(
          key: _form,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Seccion(
                titulo: 'Identidad',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: RejillaCampos(
                        maxColumnas: 2,
                        children: [
                          ...textosInquilino(const [
                            campoRazonSocial,
                            campoNombreComercial,
                          ], _c),
                          CampoTextoInquilino(
                            campo: campoIdentificacion,
                            controlador: _c['identificacion']!,
                            errorText: _errorIdentificacion,
                          ),
                          CampoTextoInquilino(
                            campo: campoNrc,
                            controlador: _c['numeroNrc']!,
                          ),
                        ],
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
                alignment: WrapAlignment.end,
                spacing: 8,
                runSpacing: 8,
                children: [
                  OutlinedButton(
                    onPressed: _volver,
                    child: const Text('Cancelar'),
                  ),
                  Can(
                    permiso: 'inquilinos.crear',
                    child: FilledButton(
                      key: const Key('inquilino-crear'),
                      onPressed: _enviando ? null : _crear,
                      child: Text(_enviando ? 'Creando…' : 'Crear inquilino'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}

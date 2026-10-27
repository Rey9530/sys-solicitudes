import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_error.dart';
import '../../core/api/api_providers.dart';
import '../../core/format/fechas.dart';
import '../../core/format/montos.dart';
import '../../core/format/validaciones.dart';
import '../../core/theme/colores.dart';
import '../../core/widgets/avisos.dart';
import '../../core/widgets/campos.dart';
import '../../core/widgets/filtros.dart';
import 'cerrar_contrato_sheet.dart';
import 'contrato_form_page.dart';
import 'contratos_api.dart';
import 'contratos_modelos.dart';

/// Abre "Renovar contrato" (espejo de `renovar-contrato-dialog.tsx`): cierra
/// el actual con motivo «renovado» y crea uno nuevo vigente con los mismos
/// términos. Devuelve `true` si se renovó.
Future<bool> mostrarRenovarContrato(
  BuildContext context, {
  required Contrato contrato,
}) async {
  final r = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => _RenovarContratoSheet(contrato: contrato),
  );
  return r ?? false;
}

class _RenovarContratoSheet extends ConsumerStatefulWidget {
  const _RenovarContratoSheet({required this.contrato});

  final Contrato contrato;

  @override
  ConsumerState<_RenovarContratoSheet> createState() =>
      _RenovarContratoSheetState();
}

class _RenovarContratoSheetState extends ConsumerState<_RenovarContratoSheet> {
  final _form = GlobalKey<FormState>();
  late final _monto = TextEditingController(
    text: textoDe(widget.contrato.montoMensual),
  );
  String? _inicio;
  String? _fin;
  String? _errorInicio;
  String? _errorFin;
  String? _errorGeneral;
  bool _enviando = false;

  @override
  void dispose() {
    _monto.dispose();
    super.dispose();
  }

  Future<void> _renovar() async {
    setState(() {
      _errorGeneral = null;
      _errorInicio = _inicio == null ? 'Requerida' : null;
      _errorFin =
          _inicio != null && _fin != null && _fin!.compareTo(_inicio!) < 0
          ? 'Debe ser igual o posterior a la nueva fecha de inicio.'
          : null;
    });
    final formOk = _form.currentState!.validate();
    if (!formOk || _errorInicio != null || _errorFin != null) return;
    setState(() => _enviando = true);
    final navigator = Navigator.of(context);
    try {
      await renovarContrato(
        ref.read(apiClientProvider),
        widget.contrato.id,
        cuerpoRenovarContrato(
          nuevaFechaInicio: _inicio!,
          nuevaFechaFin: _fin,
          nuevoMonto: _monto.text,
        ),
      );
      if (!mounted) return;
      mostrarExito(context, 'Contrato renovado');
      navigator.pop(true);
    } on ApiError catch (e) {
      if (!mounted) return;
      if (e.code == 'CONTRATO_OVERLAP') {
        setState(() => _errorGeneral = e.mensaje);
      } else {
        mostrarError(context, e);
      }
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    final contrato = widget.contrato;
    final monto = numeroDe(_monto.text) ?? contrato.montoMensual;
    return HojaFormulario(
      titulo: 'Renovar contrato',
      descripcion:
          'El contrato actual se cierra con motivo «renovado» y se crea uno '
          'nuevo vigente. Se mantienen los términos contractuales (canon, CAM, '
          'depósito, etc.) del contrato actual.',
      child: Form(
        key: _form,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: RejillaCampos(
                maxColumnas: 2,
                children: [
                  CampoFecha(
                    key: const Key('renovar-inicio'),
                    label: 'Nueva fecha de inicio *',
                    valorYmd: _inicio,
                    primera: primeraFechaContrato,
                    ultima: ultimaFechaContrato,
                    errorText: _errorInicio,
                    onChanged: (v) => setState(() => _inicio = v),
                  ),
                  CampoFecha(
                    key: const Key('renovar-fin'),
                    label: 'Nueva fecha de fin',
                    valorYmd: _fin,
                    primera: primeraFechaContrato,
                    ultima: ultimaFechaContrato,
                    permitirVacio: true,
                    errorText: _errorFin,
                    onChanged: (v) => setState(() => _fin = v),
                  ),
                ],
              ),
            ),
            TextFormField(
              key: const Key('renovar-monto'),
              controller: _monto,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              onChanged: (_) => setState(() {}),
              validator: (v) => validarNumero(v, max: 1000000000),
              decoration: const InputDecoration(
                labelText: 'Nuevo monto mensual',
              ),
            ),
            if (_inicio != null) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: c.surface3,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'PREVIEW DEL NUEVO CONTRATO',
                      style: TextStyle(
                        color: c.text3,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${formatFechaDMY(_inicio)} → '
                      '${_fin == null ? 'indefinido' : formatFechaDMY(_fin)} · '
                      '${formatMonto(monto, moneda: contrato.moneda)} / mes',
                    ),
                  ],
                ),
              ),
            ],
            if (_errorGeneral != null) ...[
              const SizedBox(height: 12),
              AvisoBanner(tono: Tono.danger, child: Text(_errorGeneral!)),
            ],
            const SizedBox(height: 16),
            FilledButton(
              key: const Key('renovar-confirmar'),
              onPressed: _enviando ? null : _renovar,
              child: Text(_enviando ? 'Renovando…' : 'Renovar'),
            ),
          ],
        ),
      ),
    );
  }
}

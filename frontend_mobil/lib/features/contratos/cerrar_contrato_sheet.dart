import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_error.dart';
import '../../core/api/api_providers.dart';
import '../../core/format/fechas.dart';
import '../../core/theme/colores.dart';
import '../../core/widgets/avisos.dart';
import '../../core/widgets/campo_select.dart';
import '../../core/widgets/campos.dart';
import 'contrato_form_page.dart';
import 'contratos_api.dart';
import 'contratos_modelos.dart';

/// Abre "Cerrar contrato" (espejo de `cerrar-contrato-dialog.tsx`). El propio
/// formulario es la confirmación. Devuelve `true` si se cerró.
Future<bool> mostrarCerrarContrato(
  BuildContext context, {
  required Contrato contrato,
}) async {
  final r = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (_) => _CerrarContratoSheet(contrato: contrato),
  );
  return r ?? false;
}

class _CerrarContratoSheet extends ConsumerStatefulWidget {
  const _CerrarContratoSheet({required this.contrato});

  final Contrato contrato;

  @override
  ConsumerState<_CerrarContratoSheet> createState() =>
      _CerrarContratoSheetState();
}

class _CerrarContratoSheetState extends ConsumerState<_CerrarContratoSheet> {
  final _form = GlobalKey<FormState>();
  final _motivo = TextEditingController();
  String _estado = 'finalizado';
  String? _fechaFinEfectiva;
  String? _errorFecha;
  bool _enviando = false;

  @override
  void dispose() {
    _motivo.dispose();
    super.dispose();
  }

  Future<void> _cerrar() async {
    setState(() => _errorFecha = null);
    if (!_form.currentState!.validate()) return;
    setState(() => _enviando = true);
    final navigator = Navigator.of(context);
    try {
      await cerrarContrato(
        ref.read(apiClientProvider),
        widget.contrato.id,
        cuerpoCerrarContrato(
          motivo: _motivo.text,
          estado: _estado,
          fechaFinEfectiva: _fechaFinEfectiva,
        ),
      );
      if (!mounted) return;
      mostrarExito(
        context,
        'Contrato cerrado; el local quedó disponible si no hay otros vigentes',
      );
      navigator.pop(true);
    } on ApiError catch (e) {
      if (!mounted) return;
      if (e.code == 'INVALID_DATE') {
        setState(() => _errorFecha = e.mensaje);
      } else {
        mostrarError(context, e);
      }
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.contrato;
    final error = Theme.of(context).colorScheme.error;
    return HojaFormulario(
      titulo: 'Cerrar contrato',
      descripcion:
          '${formatFechaDMY(c.fechaInicio)} → '
          '${c.fechaFin == null ? 'indefinido' : formatFechaDMY(c.fechaFin)}. '
          'Esta acción no se puede deshacer.',
      child: Form(
        key: _form,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            CampoSelect<String>(
              key: const Key('cerrar-estado'),
              label: 'Tipo de cierre',
              valor: _estado,
              opciones: const [
                ('finalizado', 'Finalizado (fin normal)'),
                ('cancelado', 'Cancelado (terminación anticipada)'),
              ],
              onChanged: (v) => setState(() => _estado = v ?? 'finalizado'),
            ),
            const SizedBox(height: 12),
            TextFormField(
              key: const Key('cerrar-motivo'),
              controller: _motivo,
              inputFormatters: [LengthLimitingTextInputFormatter(500)],
              validator: (v) =>
                  (v ?? '').trim().isEmpty ? 'Motivo requerido' : null,
              decoration: const InputDecoration(labelText: 'Motivo *'),
            ),
            const SizedBox(height: 12),
            CampoFecha(
              key: const Key('cerrar-fecha'),
              label: 'Fecha de fin efectiva (default: hoy)',
              valorYmd: _fechaFinEfectiva,
              primera: primeraFechaContrato,
              ultima: ultimaFechaContrato,
              permitirVacio: true,
              errorText: _errorFecha,
              onChanged: (v) => setState(() => _fechaFinEfectiva = v),
            ),
            const SizedBox(height: 16),
            FilledButton(
              key: const Key('cerrar-confirmar'),
              style: FilledButton.styleFrom(backgroundColor: error),
              onPressed: _enviando ? null : _cerrar,
              child: Text(_enviando ? 'Cerrando…' : 'Cerrar contrato'),
            ),
          ],
        ),
      ),
    );
  }
}

/// Contenido de una hoja inferior con formulario: título, descripción y
/// scroll que respeta el teclado.
class HojaFormulario extends StatelessWidget {
  const HojaFormulario({
    super.key,
    required this.titulo,
    required this.child,
    this.descripcion,
  });

  final String titulo;
  final String? descripcion;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 560),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  titulo,
                  style: Theme.of(context).textTheme.titleLarge
                      ?.copyWith(fontWeight: FontWeight.w600),
                ),
                if (descripcion != null) ...[
                  const SizedBox(height: 6),
                  Text(descripcion!, style: TextStyle(color: c.text3)),
                ],
                const SizedBox(height: 16),
                child,
              ],
            ),
          ),
        ),
      ),
    );
  }
}

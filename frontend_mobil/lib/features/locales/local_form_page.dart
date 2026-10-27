import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_error.dart';
import '../../core/api/api_providers.dart';
import '../../core/widgets/avisos.dart';
import '../../core/widgets/can.dart';
import '../../core/widgets/pagina.dart';
import '../contratos/catalogo_comun.dart';
import 'locales_api.dart';
import 'locales_providers.dart';

/// Medidores: dígitos y guiones (`18-622259-1`).
final _regexMedidor = RegExp(r'^[0-9]+(-[0-9]+)*$');

/// Filtro de los campos de medidor: solo dígitos y guiones. Van con teclado
/// de texto porque el numérico del iPhone no tiene guion.
final formatoMedidor = [FilteringTextInputFormatter.allow(RegExp('[0-9-]'))];

String? validarMedidor(String? v) {
  final texto = (v ?? '').trim();
  if (texto.isEmpty) return null;
  if (texto.length > 20) return 'Máximo 20 caracteres';
  return _regexMedidor.hasMatch(texto) ? null : 'Solo dígitos y guiones';
}

String? validarAreaLocal(String? v) =>
    validarNumero(v, max: 1000000, positivo: true);

/// `/admin/locales/nuevo` — crear local (espejo de `nuevo-local-form.tsx`).
///
/// Módulo y nivel son opcionales en el backend: el web los marca con "*" por
/// error (bug B1-R4), aquí no.
class LocalFormPage extends ConsumerStatefulWidget {
  const LocalFormPage({super.key});

  @override
  ConsumerState<LocalFormPage> createState() => _LocalFormPageState();
}

class _LocalFormPageState extends ConsumerState<LocalFormPage> {
  final _form = GlobalKey<FormState>();
  final _modulo = TextEditingController();
  final _nivel = TextEditingController();
  final _codigo = TextEditingController();
  final _area = TextEditingController();
  final _energia = TextEditingController();
  final _agua = TextEditingController();
  bool _enviando = false;
  String? _errorCodigo;

  @override
  void dispose() {
    for (final c in [_modulo, _nivel, _codigo, _area, _energia, _agua]) {
      c.dispose();
    }
    super.dispose();
  }

  String? _validarCodigo(String? v) {
    final codigo = (v ?? '').trim().toUpperCase();
    if (codigo.isEmpty) return 'Requerido';
    if (codigo.length > 16) return 'Máximo 16 caracteres';
    if (!RegExp(r'^[A-Z0-9-]+$').hasMatch(codigo)) {
      return 'El local solo puede contener mayúsculas, dígitos y guiones';
    }
    return null;
  }

  Future<void> _crear() async {
    setState(() => _errorCodigo = null);
    if (!_form.currentState!.validate()) return;
    setState(() => _enviando = true);
    try {
      await crearLocal(
        ref.read(apiClientProvider),
        cuerpoNuevoLocal(
          codigo: _codigo.text,
          modulo: _modulo.text,
          nivel: _nivel.text,
          area: _area.text,
          medidorEnergia: _energia.text,
          medidorAgua: _agua.text,
        ),
      );
      if (!mounted) return;
      mostrarExito(context, 'Local creado');
      ref.invalidate(localesProvider);
      context.canPop() ? context.pop() : context.go('/admin/locales');
    } on ApiError catch (e) {
      if (!mounted) return;
      if (e.code == 'LOCAL_CODIGO_DUPLICADO') {
        setState(() => _errorCodigo = e.mensaje);
      } else {
        mostrarError(context, e);
      }
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ContenidoPagina(
      children: [
        const EncabezadoPagina(
          titulo: 'Nuevo local',
          subtitulo: 'Se crea en estado «disponible».',
          rutaVolver: '/admin/locales',
        ),
        Form(
          key: _form,
          child: Seccion(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                FilaCampos(
                  children: [
                    TextFormField(
                      key: const Key('local-modulo'),
                      controller: _modulo,
                      textCapitalization: TextCapitalization.characters,
                      inputFormatters: [LengthLimitingTextInputFormatter(20)],
                      decoration: const InputDecoration(
                        labelText: 'Módulo',
                        hintText: 'A',
                      ),
                    ),
                    TextFormField(
                      key: const Key('local-nivel'),
                      controller: _nivel,
                      inputFormatters: [LengthLimitingTextInputFormatter(10)],
                      decoration: const InputDecoration(
                        labelText: 'Nivel',
                        hintText: '1',
                      ),
                    ),
                  ],
                ),
                FilaCampos(
                  children: [
                    TextFormField(
                      key: const Key('local-codigo'),
                      controller: _codigo,
                      textCapitalization: TextCapitalization.characters,
                      validator: _validarCodigo,
                      decoration: InputDecoration(
                        labelText: 'Local *',
                        hintText: 'L-101',
                        errorText: _errorCodigo,
                      ),
                    ),
                    TextFormField(
                      key: const Key('local-area'),
                      controller: _area,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      validator: validarAreaLocal,
                      decoration: const InputDecoration(labelText: 'Área (m²)'),
                    ),
                  ],
                ),
                FilaCampos(
                  children: [
                    TextFormField(
                      key: const Key('local-energia'),
                      controller: _energia,
                      keyboardType: TextInputType.text,
                      inputFormatters: formatoMedidor,
                      validator: validarMedidor,
                      decoration: const InputDecoration(
                        labelText: 'Medidor energía',
                        hintText: '10456050',
                      ),
                    ),
                    TextFormField(
                      key: const Key('local-agua'),
                      controller: _agua,
                      keyboardType: TextInputType.text,
                      inputFormatters: formatoMedidor,
                      validator: validarMedidor,
                      decoration: const InputDecoration(
                        labelText: 'Medidor agua',
                        hintText: '9999999',
                      ),
                    ),
                  ],
                ),
                Wrap(
                  alignment: WrapAlignment.end,
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    OutlinedButton(
                      onPressed: () => context.canPop()
                          ? context.pop()
                          : context.go('/admin/locales'),
                      child: const Text('Cancelar'),
                    ),
                    Can(
                      permiso: 'locales.crear',
                      child: FilledButton(
                        key: const Key('local-crear'),
                        onPressed: _enviando ? null : _crear,
                        child: Text(_enviando ? 'Creando…' : 'Crear local'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

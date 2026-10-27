import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_error.dart';
import '../../core/api/api_providers.dart';
import '../../core/format/montos.dart';
import '../../core/format/validaciones.dart';
import '../../core/theme/colores.dart';
import '../../core/widgets/avisos.dart';
import '../../core/widgets/campo_select.dart';
import '../../core/widgets/campos.dart';
import '../../core/widgets/can.dart';
import '../../core/widgets/filtros.dart';
import '../../core/widgets/pagina.dart';
import '../inquilinos/inquilinos_providers.dart';
import '../locales/locales_providers.dart';
import 'contratos_api.dart';
import 'contratos_modelos.dart';
import 'contratos_providers.dart';

/// Primera fecha seleccionable en los contratos (hay contratos antiguos).
final primeraFechaContrato = DateTime.utc(2000);

/// Última fecha seleccionable: el backend no pone tope (contratos largos o
/// con avisos lejanos), así que no se usa el tope de `CampoFecha` (+5 años).
final ultimaFechaContrato = DateTime.utc(2100, 12, 31);

/// `/admin/contratos/nuevo` — crear contrato (espejo de
/// `nuevo-contrato-form.tsx`). El monto mensual no se edita: se calcula como
/// `área × canon + área × CAM`.
class ContratoFormPage extends ConsumerStatefulWidget {
  const ContratoFormPage({super.key});

  @override
  ConsumerState<ContratoFormPage> createState() => _ContratoFormPageState();
}

class _ContratoFormPageState extends ConsumerState<ContratoFormPage> {
  final _form = GlobalKey<FormState>();

  /// Campos de texto por clave de la API.
  final _t = {
    for (final k in [
      'plazoMeses',
      'periodoGraciaDias',
      'areaMt2MedicionReal',
      'cuotaArrendamiento',
      'cuotaCam',
      'depositoGarantia',
      'condiciones',
      'condicionesIncrementoCanon',
    ])
      k: TextEditingController(),
  };
  final _moneda = TextEditingController(text: 'USD');
  late final _monto = TextEditingController(text: _montoTexto);

  /// Fechas opcionales (`YYYY-MM-DD`) por clave de la API.
  final _fechas = <String, String?>{
    'fechaEntregaLocal': null,
    'inicioOperaciones': null,
    'avisoTerminacion': null,
    'fechaPagoDeposito': null,
  };
  String? _localId;
  String? _inquilinoId;
  String? _fechaInicio;
  String? _fechaFin;
  String? _errorInicio;
  String? _errorFin;
  String? _errorAviso;
  String? _errorGeneral;
  bool _enviando = false;

  @override
  void initState() {
    super.initState();
    for (final k in ['areaMt2MedicionReal', 'cuotaArrendamiento', 'cuotaCam']) {
      _t[k]!.addListener(_recalcular);
    }
  }

  @override
  void dispose() {
    for (final c in [..._t.values, _moneda, _monto]) {
      c.dispose();
    }
    super.dispose();
  }

  double _valor(String clave) => numeroDe(_t[clave]!.text) ?? 0;
  double get _area => _valor('areaMt2MedicionReal');
  double get _canon => _valor('cuotaArrendamiento');
  double get _cam => _valor('cuotaCam');
  double get _montoMensual =>
      montoCalculado(area: _area, canon: _canon, cam: _cam);
  String get _montoTexto => _montoMensual.toStringAsFixed(2);

  void _recalcular() => setState(() => _monto.text = _montoTexto);

  /// Validaciones de fechas de `CreateContratoSchema` (los `CampoFecha` no son
  /// campos de `Form`).
  bool _validarFechas() {
    final aviso = _fechas['avisoTerminacion'];
    setState(() {
      _errorInicio = _fechaInicio == null ? 'Requerida' : null;
      _errorFin =
          _fechaInicio != null &&
              _fechaFin != null &&
              _fechaFin!.compareTo(_fechaInicio!) < 0
          ? 'Debe ser igual o posterior a la fecha de inicio.'
          : null;
      _errorAviso =
          aviso != null && _fechaFin != null && aviso.compareTo(_fechaFin!) > 0
          ? 'Debe ser anterior o igual a la fecha de fin.'
          : null;
    });
    return _errorInicio == null && _errorFin == null && _errorAviso == null;
  }

  void _volver() =>
      context.canPop() ? context.pop() : context.go('/admin/contratos');

  Future<void> _crear() async {
    setState(() => _errorGeneral = null);
    final formOk = _form.currentState!.validate();
    if (!_validarFechas() || !formOk) return;
    setState(() => _enviando = true);
    try {
      await crearContrato(
        ref.read(apiClientProvider),
        cuerpoNuevoContrato(
          localId: _localId!,
          inquilinoId: _inquilinoId!,
          fechaInicio: _fechaInicio!,
          fechaFin: _fechaFin,
          montoMensual: _montoMensual,
          moneda: _moneda.text,
          textos: {for (final e in _t.entries) e.key: e.value.text},
          fechas: _fechas,
        ),
      );
      if (!mounted) return;
      mostrarExito(context, 'Contrato creado; el local pasó a «alquilado»');
      ref.invalidate(contratosProvider);
      ref.invalidate(opcionesLocalesProvider);
      ref.invalidate(localesProvider);
      _volver();
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

  Widget _numero(
    String clave,
    String etiqueta, {
    required double max,
    bool entero = false,
    double min = 0,
  }) => TextFormField(
    key: Key('contrato-$clave'),
    controller: _t[clave],
    keyboardType: TextInputType.numberWithOptions(decimal: !entero),
    validator: (v) => validarNumero(v, min: min, max: max, entero: entero),
    decoration: InputDecoration(labelText: etiqueta),
  );

  Widget _fecha(String clave, String etiqueta, {String? error}) => CampoFecha(
    key: Key('contrato-$clave'),
    label: etiqueta,
    valorYmd: _fechas[clave],
    primera: primeraFechaContrato,
    ultima: ultimaFechaContrato,
    permitirVacio: true,
    errorText: error,
    onChanged: (v) => setState(() => _fechas[clave] = v),
  );

  @override
  Widget build(BuildContext context) {
    final locales = ref.watch(opcionesLocalesProvider(true));
    final inquilinos = ref.watch(opcionesInquilinosProvider).value ?? [];
    final c = ColoresPlazapp.of(context);
    final moneda = _moneda.text.trim().isEmpty ? 'USD' : _moneda.text.trim();
    final totalCanon = _area * _canon;
    final totalCam = _area * _cam;

    return ContenidoPagina(
      children: [
        const EncabezadoPagina(
          titulo: 'Nuevo contrato',
          subtitulo:
              'El local pasa a «alquilado» automáticamente. Sin fecha de fin = '
              'indefinido.',
          rutaVolver: '/admin/contratos',
        ),
        Form(
          key: _form,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Seccion(
                titulo: 'Local e inquilino',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    CampoSelect<String>(
                      key: const Key('contrato-localId'),
                      label: 'Local (solo disponibles) *',
                      hint: 'Selecciona un local…',
                      valor: _localId,
                      opciones: [
                        for (final l in locales.value ?? [])
                          (
                            l.id,
                            '${l.codigo}${l.modulo == null ? '' : ' · Módulo ${l.modulo}'}',
                          ),
                      ],
                      validator: (v) =>
                          v == null ? 'Selecciona un local' : null,
                      onChanged: (v) => setState(() => _localId = v),
                    ),
                    if (locales.hasValue && locales.value!.isEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Text(
                          'No hay locales disponibles.',
                          style: TextStyle(
                            color: c.tono(Tono.warn).fg,
                            fontSize: 12.5,
                          ),
                        ),
                      ),
                    const SizedBox(height: 12),
                    CampoSelect<String>(
                      key: const Key('contrato-inquilinoId'),
                      label: 'Inquilino *',
                      hint: 'Selecciona un inquilino…',
                      valor: _inquilinoId,
                      opciones: [
                        for (final i in inquilinos) (i.id, i.razonSocial),
                      ],
                      validator: (v) =>
                          v == null ? 'Selecciona un inquilino' : null,
                      onChanged: (v) => setState(() => _inquilinoId = v),
                    ),
                  ],
                ),
              ),
              Seccion(
                titulo: 'Vigencia',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: RejillaCampos(
                        maxColumnas: 2,
                        children: [
                          CampoFecha(
                            key: const Key('contrato-fechaInicio'),
                            label: 'Fecha de inicio *',
                            valorYmd: _fechaInicio,
                            primera: primeraFechaContrato,
                            ultima: ultimaFechaContrato,
                            errorText: _errorInicio,
                            onChanged: (v) => setState(() => _fechaInicio = v),
                          ),
                          CampoFecha(
                            key: const Key('contrato-fechaFin'),
                            label: 'Fecha de fin (vacío = indefinido)',
                            valorYmd: _fechaFin,
                            primera: primeraFechaContrato,
                            ultima: ultimaFechaContrato,
                            permitirVacio: true,
                            errorText: _errorFin,
                            onChanged: (v) => setState(() => _fechaFin = v),
                          ),
                          _numero(
                            'plazoMeses',
                            'Plazo (meses)',
                            min: 1,
                            max: 1200,
                            entero: true,
                          ),
                          _numero(
                            'periodoGraciaDias',
                            'Período de gracia (días)',
                            max: 3650,
                            entero: true,
                          ),
                          _fecha(
                            'fechaEntregaLocal',
                            'Fecha de entrega del local',
                          ),
                          _fecha('inicioOperaciones', 'Inicio de operaciones'),
                        ],
                      ),
                    ),
                    _fecha(
                      'avisoTerminacion',
                      'Aviso de terminación',
                      error: _errorAviso,
                    ),
                  ],
                ),
              ),
              Seccion(
                titulo: 'Pagos',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: RejillaCampos(
                        maxColumnas: 2,
                        children: [
                          TextFormField(
                            key: const Key('contrato-montoMensual'),
                            controller: _monto,
                            readOnly: true,
                            validator: (_) => _montoMensual > 1000000000
                                ? 'Debe estar entre 0 y 1000000000'
                                : null,
                            decoration: const InputDecoration(
                              labelText: 'Monto mensual',
                              helperText: '(calculado automáticamente)',
                              suffixIcon: Icon(Icons.lock_outline, size: 18),
                            ),
                          ),
                          TextFormField(
                            key: const Key('contrato-moneda'),
                            controller: _moneda,
                            textCapitalization: TextCapitalization.characters,
                            inputFormatters: [
                              LengthLimitingTextInputFormatter(3),
                            ],
                            onChanged: (_) => setState(() {}),
                            validator: (v) =>
                                RegExp(r'^[A-Z]{3}$')
                                    .hasMatch((v ?? '').trim().toUpperCase())
                                ? null
                                : 'Moneda debe ser código ISO 4217 (3 letras '
                                      'mayúsculas)',
                            decoration: const InputDecoration(
                              labelText: 'Moneda (ISO 4217)',
                            ),
                          ),
                          _numero(
                            'areaMt2MedicionReal',
                            'Área m² (medición real)',
                            max: 1000000,
                          ),
                          _numero(
                            'cuotaArrendamiento',
                            'Canon arrendamiento',
                            max: 1000000000,
                          ),
                          _numero('cuotaCam', 'CAM', max: 1000000000),
                          _numero(
                            'depositoGarantia',
                            'Depósito de garantía',
                            max: 1000000000,
                          ),
                        ],
                      ),
                    ),
                    _fecha('fechaPagoDeposito', 'Fecha de pago del depósito'),
                    const SizedBox(height: 12),
                    TotalesDerivados(
                      totalCanon: totalCanon,
                      totalCam: totalCam,
                      moneda: moneda,
                    ),
                  ],
                ),
              ),
              Seccion(
                titulo: 'Notas',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextFormField(
                      key: const Key('contrato-condiciones'),
                      controller: _t['condiciones'],
                      minLines: 2,
                      maxLines: 5,
                      inputFormatters: [LengthLimitingTextInputFormatter(4000)],
                      decoration: const InputDecoration(
                        labelText: 'Condiciones generales',
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      key: const Key('contrato-condicionesIncrementoCanon'),
                      controller: _t['condicionesIncrementoCanon'],
                      minLines: 2,
                      maxLines: 5,
                      inputFormatters: [LengthLimitingTextInputFormatter(4000)],
                      decoration: const InputDecoration(
                        labelText: 'Condiciones de incremento de canon',
                        hintText: 'ej. Incremento anual según IPC',
                      ),
                    ),
                  ],
                ),
              ),
              if (_errorGeneral != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: AvisoBanner(
                    tono: Tono.danger,
                    child: Text(_errorGeneral!),
                  ),
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
                    permiso: 'contratos.crear',
                    child: FilledButton(
                      key: const Key('contrato-crear'),
                      onPressed: _enviando ? null : _crear,
                      child: Text(_enviando ? 'Creando…' : 'Crear contrato'),
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

/// Caja "Totales derivados" (Y/Z/AA del Excel; no se guardan).
class TotalesDerivados extends StatelessWidget {
  const TotalesDerivados({
    super.key,
    required this.totalCanon,
    required this.totalCam,
    required this.moneda,
    this.conLetras = false,
  });

  final double totalCanon;
  final double totalCam;
  final String moneda;

  /// En el detalle el web añade la columna del Excel: "(Y)", "(Z)", "(AA)".
  final bool conLetras;

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    Widget linea(
      String etiqueta,
      double valor,
      String formula, {
      bool b = false,
    }) => Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Text.rich(
        TextSpan(
          children: [
            TextSpan(
              text: '$etiqueta: ',
              style: TextStyle(color: c.text3),
            ),
            TextSpan(
              text: formatMonto(valor, moneda: moneda),
              style: TextStyle(
                fontFamily: 'monospace',
                fontWeight: b ? FontWeight.w700 : FontWeight.w500,
              ),
            ),
            TextSpan(
              text: ' ($formula)',
              style: TextStyle(color: c.text3),
            ),
          ],
        ),
      ),
    );
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: c.surface3,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'TOTALES DERIVADOS',
            style: TextStyle(
              color: c.text3,
              fontSize: 11,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.5,
            ),
          ),
          linea(
            conLetras ? 'Total canon (Y)' : 'Total canon',
            totalCanon,
            'área × canon',
          ),
          linea(
            conLetras ? 'Total CAM (Z)' : 'Total CAM',
            totalCam,
            'área × CAM',
          ),
          linea(
            conLetras ? 'Total (AA)' : 'Total',
            totalCanon + totalCam,
            'área × canon + área × CAM',
            b: true,
          ),
        ],
      ),
    );
  }
}

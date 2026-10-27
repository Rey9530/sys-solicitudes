import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/adjuntos/adjuntos.dart';
import '../../core/api/api_providers.dart';
import '../../core/auth/sesion_controller.dart';
import '../../core/plaza/plaza_seleccionada.dart';
import '../../core/theme/colores.dart';
import '../../core/widgets/avisos.dart';
import '../../core/widgets/can.dart';
import '../../core/widgets/pagina.dart';
import '../auth/auth_api.dart';
import '../solicitudes/solicitudes_modelos.dart';
import 'configuracion_api.dart';
import 'configuracion_modelos.dart';
import 'configuracion_providers.dart';
import 'widgets/selector_color.dart';

/// `/admin/configuracion`: datos generales, branding (color y logo), SLA,
/// adjuntos y calendario de la plaza (`components/client/configuracion-form.tsx`).
///
/// Cada pestaña guarda por separado y su botón exige su permiso
/// (`configuracion.editar_*`). Solo para el admin de plaza: el superadmin no
/// tiene plaza en su sesión y el backend le niega `/configuracion` (B2-R3).
class ConfiguracionPage extends ConsumerWidget {
  const ConfiguracionPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final plazaId = ref.watch(sesionProvider).value?.usuario.plazaId;
    if (plazaId == null) {
      return const ContenidoPagina(
        children: [
          AvisoBanner(
            tono: Tono.danger,
            child: Text('Esta pantalla requiere una plaza asignada.'),
          ),
        ],
      );
    }
    final datos = ref.watch(configuracionProvider(plazaId));
    return ContenidoPagina(
      // Espera los datos nuevos (si solo invalidara, el indicador se iría
      // antes de tenerlos).
      onRefresh: () => ref.refresh(configuracionProvider(plazaId).future),
      children: [
        EncabezadoPagina(
          titulo: 'Configuración',
          subtitulo: datos.value == null
              ? null
              : 'Datos generales, branding, SLA, adjuntos y calendario de '
                    '${datos.value!.plaza.nombreComercial}.',
        ),
        datos.when(
          loading: () => const Padding(
            padding: EdgeInsets.all(40),
            child: Center(child: CircularProgressIndicator()),
          ),
          error: (_, _) => Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const AvisoBanner(
                tono: Tono.danger,
                child: Text('No se pudo cargar la configuración.'),
              ),
              const SizedBox(height: 10),
              OutlinedButton.icon(
                onPressed: () => ref.invalidate(configuracionProvider(plazaId)),
                icon: const Icon(Icons.refresh),
                label: const Text('Reintentar'),
              ),
            ],
          ),
          data: (d) => FormularioConfiguracion(datos: d),
        ),
      ],
    );
  }
}

/// Las cinco pestañas del formulario. Los valores editados viven en el
/// `State`; al guardar se recargan los datos sin perder lo escrito.
class FormularioConfiguracion extends ConsumerStatefulWidget {
  const FormularioConfiguracion({super.key, required this.datos});

  final DatosConfiguracion datos;

  @override
  ConsumerState<FormularioConfiguracion> createState() =>
      _FormularioConfiguracionState();
}

class _FormularioConfiguracionState
    extends ConsumerState<FormularioConfiguracion>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 5, vsync: this)
    ..addListener(() => setState(() {}));
  bool _guardando = false;

  // General
  final _formGeneral = GlobalKey<FormState>();
  late final _nombre = TextEditingController(
    text: widget.datos.plaza.nombreComercial,
  );
  late final _email = TextEditingController(
    text: widget.datos.plaza.emailContacto ?? '',
  );
  late final _telefono = TextEditingController(
    text: widget.datos.plaza.telefonoContacto ?? '',
  );

  // Branding
  late String _color = widget.datos.plaza.colorPrimario;

  // SLA
  final _formSla = GlobalKey<FormState>();
  late final Map<String, TextEditingController> _dias = {
    for (final t in tiposSla)
      t: TextEditingController(
        text: _numero(widget.datos.configuracion.slaDiasPorTipo[t] ?? 0),
      ),
  };
  late final Map<String, TextEditingController> _mult = {
    for (final p in prioridadesSla)
      p: TextEditingController(
        text: _numero(
          widget.datos.configuracion.slaMultiplicadorPorPrioridad[p] ?? 1,
        ),
      ),
  };

  // Adjuntos (solo los MIME seleccionables: un alias legacy guardado haría
  // fallar el PATCH con MIME_NO_PERMITIDO, B2-R17).
  late final Set<String> _mimes = widget.datos.configuracion.mimeTypesPermitidos
      .where((m) => mimesConfigurables.any((c) => c.$1 == m))
      .toSet();
  late final _tamanio = TextEditingController(
    text: '${widget.datos.configuracion.tamanioMaxArchivoMb}',
  );
  String? _errorTamanio;

  // Calendario
  late bool _hitos = widget.datos.configuracion.calendarMostrarHitosContrato;

  @override
  void dispose() {
    _tabs.dispose();
    for (final c in [
      _nombre,
      _email,
      _telefono,
      _tamanio,
      ..._dias.values,
      ..._mult.values,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  String get _plazaId => widget.datos.plaza.id;

  /// Ejecuta un guardado: aviso de éxito, recarga de los datos (y del color de
  /// marca si cambió la plaza) o el error del backend.
  Future<void> _guardar(
    Future<void> Function() accion,
    String mensajeOk, {
    bool cambiaPlaza = false,
  }) async {
    setState(() => _guardando = true);
    try {
      await accion();
      if (!mounted) return;
      mostrarExito(context, mensajeOk);
      ref.invalidate(configuracionProvider(_plazaId));
      if (cambiaPlaza) ref.invalidate(plazaActualProvider);
    } on Object catch (e) {
      if (mounted) mostrarError(context, e);
    } finally {
      if (mounted) setState(() => _guardando = false);
    }
  }

  void _guardarGeneral() {
    if (!_formGeneral.currentState!.validate()) return;
    final email = _email.text.trim();
    final telefono = _telefono.text.trim();
    _guardar(
      () => actualizarPlaza(ref.read(apiClientProvider), _plazaId, {
        'nombreComercial': _nombre.text.trim(),
        'emailContacto': email.isEmpty ? null : email.toLowerCase(),
        'telefonoContacto': telefono.isEmpty ? null : telefono,
      }),
      'Datos generales guardados.',
      cambiaPlaza: true,
    );
  }

  void _guardarColor() => _guardar(
    () => actualizarPlaza(ref.read(apiClientProvider), _plazaId, {
      'colorPrimario': _color.trim(),
    }),
    'Branding guardado.',
    cambiaPlaza: true,
  );

  Future<void> _elegirLogo() async {
    final api = ref.read(apiClientProvider);
    final List<ArchivoElegido> archivos;
    try {
      archivos = await ref
          .read(selectorArchivosProvider)
          .elegirArchivos(extensiones: const ['png', 'svg']);
    } on Object catch (e) {
      if (mounted) mostrarError(context, e);
      return;
    }
    if (archivos.isEmpty || !mounted) return;
    final archivo = archivos.first;
    final nombre = archivo.nombre.toLowerCase();
    final mime = nombre.endsWith('.png')
        ? 'image/png'
        : nombre.endsWith('.svg')
        ? 'image/svg+xml'
        : null;
    if (mime == null) {
      mostrarError(context, 'Selecciona un archivo PNG o SVG.');
      return;
    }
    if (archivo.bytes.length > 2 * 1024 * 1024) {
      mostrarError(context, 'El logo no puede superar 2 MB.');
      return;
    }
    await _guardar(
      () => subirLogo(
        api,
        _plazaId,
        nombreArchivo: archivo.nombre,
        contenido: archivo.bytes,
        mimeType: mime,
      ),
      'Logo actualizado.',
      cambiaPlaza: true,
    );
  }

  void _guardarSla() {
    if (!_formSla.currentState!.validate()) return;
    _guardar(
      () => actualizarConfiguracion(ref.read(apiClientProvider), {
        'slaDiasPorTipo': {
          for (final t in tiposSla) t: _leerNumero(_dias[t]!.text)!,
        },
        'slaMultiplicadorPorPrioridad': {
          for (final p in prioridadesSla) p: _leerNumero(_mult[p]!.text)!,
        },
      }),
      'SLA guardado.',
    );
  }

  void _guardarAdjuntos() {
    final mb = int.tryParse(_tamanio.text.trim());
    if (mb == null || mb < 1) {
      setState(
        () => _errorTamanio = 'El tamaño máximo debe ser un entero ≥ 1 MB.',
      );
      return;
    }
    setState(() => _errorTamanio = null);
    if (_mimes.isEmpty) {
      mostrarError(
        context,
        'Debe haber al menos un tipo de archivo permitido.',
      );
      return;
    }
    _guardar(
      () => actualizarConfiguracion(ref.read(apiClientProvider), {
        // En el orden de la lista (como los checkboxes).
        'mimeTypesPermitidos': [
          for (final (m, _) in mimesConfigurables)
            if (_mimes.contains(m)) m,
        ],
        'tamanioMaxArchivoMb': mb,
      }),
      'Adjuntos guardados.',
    );
  }

  void _guardarCalendario() => _guardar(
    () => actualizarConfiguracion(ref.read(apiClientProvider), {
      'calendarMostrarHitosContrato': _hitos,
    }),
    'Calendario guardado.',
  );

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    final pestana = switch (_tabs.index) {
      0 => _general(),
      1 => _branding(),
      2 => _sla(),
      3 => _adjuntos(),
      _ => _calendario(),
    };
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          decoration: BoxDecoration(
            border: Border(bottom: BorderSide(color: c.border)),
          ),
          child: TabBar(
            controller: _tabs,
            isScrollable: true,
            tabAlignment: TabAlignment.start,
            tabs: const [
              Tab(text: 'General'),
              Tab(text: 'Branding'),
              Tab(text: 'SLA'),
              Tab(text: 'Adjuntos'),
              Tab(text: 'Calendario'),
            ],
          ),
        ),
        const SizedBox(height: 14),
        Card(
          child: Padding(padding: const EdgeInsets.all(16), child: pestana),
        ),
      ],
    );
  }

  Widget _botonGuardar(String permiso, String texto, VoidCallback? accion) =>
      Align(
        alignment: Alignment.centerLeft,
        child: Can(
          permiso: permiso,
          child: FilledButton(
            key: Key('guardar-$permiso'),
            onPressed: _guardando ? null : accion,
            child: Text(texto),
          ),
        ),
      );

  Widget _general() {
    return Form(
      key: _formGeneral,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextFormField(
            controller: _nombre,
            maxLength: 120,
            decoration: const InputDecoration(
              labelText: 'Nombre comercial',
              counterText: '',
            ),
            validator: (v) =>
                (v ?? '').trim().isEmpty ? 'Este campo es obligatorio.' : null,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(labelText: 'Email de contacto'),
            validator: (v) => (v ?? '').trim().isEmpty ? null : validarEmail(v),
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _telefono,
            keyboardType: TextInputType.phone,
            maxLength: 40,
            decoration: const InputDecoration(
              labelText: 'Teléfono',
              counterText: '',
            ),
          ),
          const SizedBox(height: 12),
          TextFormField(
            initialValue: 'America/El_Salvador',
            enabled: false,
            decoration: const InputDecoration(
              labelText: 'Zona horaria',
              helperText: 'Fija para todas las plazas en v1 (decisión T-V08).',
              helperMaxLines: 3,
            ),
          ),
          const SizedBox(height: 16),
          _botonGuardar(
            'configuracion.editar_general',
            'Guardar',
            _guardarGeneral,
          ),
        ],
      ),
    );
  }

  Widget _branding() {
    final c = ColoresPlazapp.of(context);
    final logo = widget.datos.plaza.logoUrl;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SelectorColor(
          valor: _color,
          onChanged: (v) => setState(() => _color = v),
        ),
        const SizedBox(height: 16),
        _botonGuardar(
          'configuracion.editar_branding',
          'Guardar color',
          esHexValido(_color) ? _guardarColor : null,
        ),
        const SizedBox(height: 20),
        Text(
          'Logo (PNG/SVG, máx 2 MB)',
          style: TextStyle(color: c.text3, fontSize: 12.5),
        ),
        const SizedBox(height: 8),
        if (logo != null)
          Align(
            alignment: Alignment.centerLeft,
            child: Container(
              height: 56,
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                border: Border.all(color: c.border),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Image.network(
                logo,
                fit: BoxFit.contain,
                // SVG o URL vencida: no se puede previsualizar.
                errorBuilder: (_, _, _) => Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: Icon(Icons.image_outlined, color: c.text3),
                ),
              ),
            ),
          ),
        const SizedBox(height: 8),
        Align(
          alignment: Alignment.centerLeft,
          child: Can(
            permiso: 'configuracion.editar_branding',
            child: OutlinedButton.icon(
              key: const Key('elegir-logo'),
              onPressed: _guardando ? null : _elegirLogo,
              icon: const Icon(Icons.upload_outlined, size: 18),
              label: const Text('Elegir logo'),
            ),
          ),
        ),
      ],
    );
  }

  Widget _sla() {
    final c = ColoresPlazapp.of(context);
    String? validar(String? v) {
      final n = _leerNumero(v ?? '');
      return n == null || n < 0 ? 'Debe ser un número ≥ 0.' : null;
    }

    Widget campo(String etiqueta, TextEditingController ctrl, String sufijo) =>
        TextFormField(
          controller: ctrl,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: InputDecoration(labelText: etiqueta, suffixText: sufijo),
          validator: validar,
          onChanged: (_) => setState(() {}),
        );

    return Form(
      key: _formSla,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          LayoutBuilder(
            builder: (context, constraints) {
              final dias = Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const _Subtitulo('Días por tipo'),
                  for (final t in tiposSla) ...[
                    campo(etiquetaTipoSolicitud[t] ?? t, _dias[t]!, 'días'),
                    const SizedBox(height: 10),
                  ],
                ],
              );
              final mult = Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const _Subtitulo('Multiplicador por prioridad'),
                  for (final p in prioridadesSla) ...[
                    campo('Prioridad $p', _mult[p]!, '×'),
                    const SizedBox(height: 10),
                  ],
                ],
              );
              if (constraints.maxWidth < 560) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [dias, const SizedBox(height: 8), mult],
                );
              }
              return Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(child: dias),
                  const SizedBox(width: 16),
                  Expanded(child: mult),
                ],
              );
            },
          ),
          const SizedBox(height: 8),
          const _Subtitulo('Preview del semáforo (días totales)'),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Table(
              defaultColumnWidth: const IntrinsicColumnWidth(),
              defaultVerticalAlignment: TableCellVerticalAlignment.middle,
              children: [
                TableRow(
                  decoration: BoxDecoration(
                    border: Border(bottom: BorderSide(color: c.border)),
                  ),
                  children: [
                    _celdaCabecera('Tipo'),
                    for (final p in prioridadesSla) _celdaCabecera(p),
                  ],
                ),
                for (final t in tiposSla)
                  TableRow(
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(4, 8, 12, 8),
                        child: Text(etiquetaTipoSolicitud[t] ?? t),
                      ),
                      for (final p in prioridadesSla)
                        Padding(
                          padding: const EdgeInsets.all(4),
                          child: _CeldaSla(dias: _diasSla(t, p)),
                        ),
                    ],
                  ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          _botonGuardar('configuracion.editar_sla', 'Guardar SLA', _guardarSla),
        ],
      ),
    );
  }

  Widget _celdaCabecera(String texto) => Padding(
    padding: const EdgeInsets.fromLTRB(4, 6, 12, 6),
    child: Text(
      texto,
      style: TextStyle(
        color: ColoresPlazapp.of(context).text3,
        fontWeight: FontWeight.w600,
        fontSize: 12,
      ),
    ),
  );

  /// `round(días × multiplicador, 1)` con los valores escritos (inválido = 0).
  double _diasSla(String tipo, String prioridad) {
    final d = _leerNumero(_dias[tipo]!.text) ?? 0;
    final m = _leerNumero(_mult[prioridad]!.text) ?? 0;
    return (d * m * 10).round() / 10;
  }

  Widget _adjuntos() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const _Subtitulo('Tipos permitidos'),
        for (final (mime, etiqueta) in mimesConfigurables)
          CheckboxListTile(
            dense: true,
            contentPadding: EdgeInsets.zero,
            controlAffinity: ListTileControlAffinity.leading,
            value: _mimes.contains(mime),
            title: Text(etiqueta),
            subtitle: Text('($mime)'),
            onChanged: (v) => setState(() {
              if (v ?? false) {
                _mimes.add(mime);
              } else {
                _mimes.remove(mime);
              }
            }),
          ),
        const SizedBox(height: 12),
        TextField(
          key: const Key('tamanio-max'),
          controller: _tamanio,
          keyboardType: TextInputType.number,
          decoration: InputDecoration(
            labelText: 'Tamaño máximo por archivo (MB)',
            errorText: _errorTamanio,
            errorMaxLines: 2,
          ),
        ),
        const SizedBox(height: 16),
        _botonGuardar(
          'configuracion.editar_adjuntos',
          'Guardar adjuntos',
          _guardarAdjuntos,
        ),
      ],
    );
  }

  Widget _calendario() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        CheckboxListTile(
          contentPadding: EdgeInsets.zero,
          controlAffinity: ListTileControlAffinity.leading,
          value: _hitos,
          title: const Text('Mostrar hitos contractuales en el calendario'),
          onChanged: (v) => setState(() => _hitos = v ?? false),
        ),
        const SizedBox(height: 12),
        _botonGuardar(
          'configuracion.editar_calendario',
          'Guardar calendario',
          _guardarCalendario,
        ),
      ],
    );
  }
}

/// `5.0` → `"5"`, `0.5` → `"0.5"`.
String _numero(double v) =>
    v == v.roundToDouble() ? v.toInt().toString() : v.toString();

/// Número escrito por el usuario (acepta coma decimal) o `null`.
double? _leerNumero(String texto) =>
    double.tryParse(texto.trim().replaceAll(',', '.'));

class _Subtitulo extends StatelessWidget {
  const _Subtitulo(this.texto);
  final String texto;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: Text(texto, style: const TextStyle(fontWeight: FontWeight.w600)),
  );
}

/// Celda del preview: rojo ≤ 3 días, ámbar ≤ 7, verde > 7 (solo visual).
class _CeldaSla extends StatelessWidget {
  const _CeldaSla({required this.dias});

  final double dias;

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    final color = dias <= 3
        ? c.slaRojo
        : dias <= 7
        ? c.slaAmbar
        : c.slaVerde;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        '${_numero(dias)}d',
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w600,
          fontSize: 12.5,
        ),
      ),
    );
  }
}

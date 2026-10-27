import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/theme/colores.dart';
import '../../../core/widgets/avisos.dart';
import '../../../core/widgets/estados.dart';
import '../../../core/widgets/pagina.dart';
import '../solicitudes_api.dart';
import '../solicitudes_modelos.dart';
import '../solicitudes_providers.dart';
import 'wizard/formulario_solicitud.dart';
import 'wizard/paso_detalles.dart';
import 'wizard/paso_revision.dart';
import 'wizard/paso_tipo.dart';

/// Nueva solicitud (wizard de 3 pasos) y edición. Espejo de
/// `frontend/src/components/client/solicitud-wizard.tsx` y de las páginas
/// `inquilino/solicitudes/nueva` y `[id]/editar`.
///
/// Sin [solicitudId] crea (acepta el prefill del calendario); con
/// [solicitudId] edita, solo en `borrador` o `requerida_subsanacion`.
class WizardSolicitudPage extends ConsumerWidget {
  const WizardSolicitudPage({
    super.key,
    this.solicitudId,
    this.prefill = const PrefillWizard(),
  });

  final String? solicitudId;
  final PrefillWizard prefill;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final datos = ref.watch(datosWizardProvider);
    final id = solicitudId;
    final Widget cuerpo;
    if (id == null) {
      cuerpo = AsyncView(
        value: datos,
        onRetry: () => ref.invalidate(datosWizardProvider),
        data: (d) => _Wizard(datos: d, prefill: prefill),
      );
    } else {
      final solicitud = ref.watch(solicitudProvider(id));
      cuerpo = AsyncView(
        value: solicitud,
        onRetry: () => ref.invalidate(solicitudProvider(id)),
        data: (s) {
          final estado = s.solicitud.estado;
          if (estado != 'borrador' && estado != 'requerida_subsanacion') {
            return _NoEditable(id: id);
          }
          return AsyncView(
            value: datos,
            onRetry: () => ref.invalidate(datosWizardProvider),
            data: (d) => _Wizard(datos: d, solicitud: s.solicitud),
          );
        },
      );
    }
    return Scaffold(body: cuerpo);
  }
}

/// Fuera de `borrador`/`requerida_subsanacion` no se edita: vuelve al detalle
/// (el web redirige).
class _NoEditable extends StatefulWidget {
  const _NoEditable({required this.id});

  final String id;

  @override
  State<_NoEditable> createState() => _NoEditableState();
}

class _NoEditableState extends State<_NoEditable> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.replace('/inquilino/solicitudes/${widget.id}');
    });
  }

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}

const _pasos = ['Tipo y categoría', 'Detalles', 'Adjuntos y revisión'];

class _Wizard extends ConsumerStatefulWidget {
  const _Wizard({
    required this.datos,
    this.solicitud,
    this.prefill = const PrefillWizard(),
  });

  final DatosWizard datos;
  final SolicitudItem? solicitud;
  final PrefillWizard prefill;

  @override
  ConsumerState<_Wizard> createState() => _WizardState();
}

class _WizardState extends ConsumerState<_Wizard> {
  late final FormularioSolicitud _form = widget.solicitud == null
      ? FormularioSolicitud.nuevo(widget.datos, widget.prefill)
      : FormularioSolicitud.desdeSolicitud(widget.solicitud!);

  /// Momento de elaboración: congelado al abrir el wizard (como el web).
  final DateTime _momento = DateTime.now();
  int _paso = 1;
  bool _enviando = false;
  List<ArchivoPendiente> _archivos = const [];

  bool get _edicion => widget.solicitud != null;

  void _refrescar() => setState(() {});

  String? _validar(int paso) =>
      paso == 1 ? _form.validarPaso1() : _form.validarPaso2(_momento);

  void _siguiente() {
    final error = _validar(_paso);
    if (error != null) {
      mostrarError(context, error);
      return;
    }
    setState(() => _paso = (_paso + 1).clamp(1, 3));
  }

  Future<void> _guardar({required bool enviarAhora}) async {
    final error = _validar(1) ?? _validar(2);
    if (error != null) {
      mostrarError(context, error);
      return;
    }
    setState(() => _enviando = true);
    final api = ref.read(apiClientProvider);
    // Se toma antes de los await: si se sale del wizard mientras guarda,
    // `ref` ya no se puede usar y la lista igual debe recargarse.
    final contenedor = ProviderScope.containerOf(context, listen: false);
    final payload = _form.payload();
    String id;
    String codigo;
    // Adjuntos que no se pudieron subir: se avisan juntos al final (cada
    // aviso tapa al anterior).
    final fallidos = <String>[];
    try {
      if (_edicion) {
        id = widget.solicitud!.id;
        codigo = widget.solicitud!.codigo;
        await actualizarSolicitud(api, id, payload);
      } else {
        final creada = await crearSolicitud(api, payload);
        id = creada.id;
        codigo = creada.codigo;
        for (final a in _archivos) {
          try {
            await subirAdjuntoSolicitud(api, id, a.nombre, a.bytes, a.mime);
          } on Object {
            fallidos.add(a.nombre);
          }
        }
      }
    } on Object catch (e) {
      if (mounted) {
        setState(() => _enviando = false);
        mostrarError(context, e);
      }
      return;
    }

    if (enviarAhora) {
      try {
        await enviar(api, id);
      } on Object catch (e) {
        _invalidar(contenedor, id);
        if (!mounted) return;
        setState(() => _enviando = false);
        final sinSubir = fallidos.isEmpty
            ? ''
            : '\nTampoco se subieron: ${fallidos.join(', ')}';
        mostrarError(
          context,
          'Guardada como borrador, pero no se pudo enviar: $e$sinSubir',
        );
        _irAlDetalle(id);
        return;
      }
    }
    _invalidar(contenedor, id);
    if (!mounted) return;
    setState(() => _enviando = false);
    final numero = codigo.isEmpty ? '' : ' $codigo';
    final hecho = enviarAhora
        ? 'Solicitud$numero enviada'
        : 'Borrador$numero guardado';
    if (fallidos.isEmpty) {
      mostrarExito(
        context,
        enviarAhora ? '$hecho: quedó en cola de asignación' : hecho,
      );
    } else {
      mostrarError(
        context,
        '$hecho, pero no se subieron: ${fallidos.join(', ')}',
      );
    }
    _irAlDetalle(id);
  }

  /// Recarga la lista y el detalle de [id].
  void _invalidar(ProviderContainer contenedor, String id) {
    contenedor.invalidate(misSolicitudesProvider);
    contenedor.invalidate(solicitudProvider(id));
  }

  /// Al crear, el detalle reemplaza al wizard (atrás vuelve a la lista); al
  /// editar, se vuelve al detalle del que se vino.
  void _irAlDetalle(String id) {
    final ruta = '/inquilino/solicitudes/$id';
    if (_edicion) {
      context.canPop() ? context.pop() : context.go(ruta);
    } else {
      context.pushReplacement(ruta);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.solicitud;
    final localId = _form.localId;
    final duplicados = localId == null
        ? const <SolicitudItem>[]
        : (ref
                      .watch(
                        duplicadosProvider((
                          localId: localId,
                          tipo: _form.tipo,
                        )),
                      )
                      .value ??
                  const <SolicitudItem>[])
              .where((d) => d.id != s?.id)
              .toList();

    return ContenidoPagina(
      // Una lista nueva por paso: al avanzar o retroceder se vuelve arriba.
      key: ValueKey('wizard-paso-$_paso'),
      children: [
        EncabezadoPagina(
          titulo: s == null ? 'Nueva solicitud' : 'Editar ${s.codigo}',
          subtitulo: s == null
              ? 'Se guarda como borrador hasta que la envíes; al enviarla '
                    'entra a la cola de asignación.'
              : 'Puedes editar la solicitud (incluido el local) mientras '
                    'esté en borrador o requiera subsanación.',
          rutaVolver: s == null
              ? '/inquilino/solicitudes'
              : '/inquilino/solicitudes/${s.id}',
        ),
        _Pasos(paso: _paso),
        const SizedBox(height: 14),
        if (duplicados.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: AvisoBanner(
              tono: Tono.warn,
              child: Text(
                'Ya existe una solicitud reciente similar: '
                '${duplicados.map((d) => d.codigo).join(', ')}. Puedes '
                'continuar de todas formas.',
              ),
            ),
          ),
        if (_paso == 3)
          PasoRevision(
            form: _form,
            datos: widget.datos,
            archivos: _archivos,
            conAdjuntos: !_edicion,
            onArchivos: (l) => setState(() => _archivos = l),
          )
        else
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: _paso == 1
                  ? PasoTipo(
                      form: _form,
                      datos: widget.datos,
                      onCambio: _refrescar,
                    )
                  : PasoDetalles(
                      form: _form,
                      datos: widget.datos,
                      momento: _momento,
                      onCambio: _refrescar,
                    ),
            ),
          ),
        const SizedBox(height: 16),
        Wrap(
          alignment: WrapAlignment.spaceBetween,
          spacing: 8,
          runSpacing: 8,
          children: [
            OutlinedButton(
              key: const Key('wizard-atras'),
              onPressed: _paso == 1 || _enviando
                  ? null
                  : () => setState(() => _paso--),
              child: const Text('Atrás'),
            ),
            if (_paso < 3)
              FilledButton(
                key: const Key('wizard-siguiente'),
                onPressed: _siguiente,
                child: const Text('Siguiente'),
              )
            else
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  OutlinedButton(
                    key: const Key('wizard-guardar'),
                    onPressed: _enviando
                        ? null
                        : () => _guardar(enviarAhora: false),
                    child: Text(
                      _edicion ? 'Guardar cambios' : 'Guardar borrador',
                    ),
                  ),
                  if (!_edicion)
                    FilledButton(
                      key: const Key('wizard-enviar'),
                      onPressed: _enviando
                          ? null
                          : () => _guardar(enviarAhora: true),
                      child: Text(_enviando ? 'Enviando…' : 'Enviar ahora'),
                    ),
                ],
              ),
          ],
        ),
      ],
    );
  }
}

/// Indicador de pasos (stepper del web).
class _Pasos extends StatelessWidget {
  const _Pasos({required this.paso});

  final int paso;

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    final primario = Theme.of(context).colorScheme.primary;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < _pasos.length; i++)
          Expanded(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 26,
                  height: 26,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: paso >= i + 1 ? primario : c.surface3,
                  ),
                  child: paso > i + 1
                      ? const Icon(Icons.check, size: 15, color: Colors.white)
                      : Text(
                          '${i + 1}',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: paso == i + 1 ? Colors.white : c.text3,
                          ),
                        ),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _pasos[i],
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 12.5,
                          fontWeight: FontWeight.w600,
                          color: paso == i + 1 ? c.text : c.text3,
                        ),
                      ),
                      Text(
                        'Paso ${i + 1}',
                        style: TextStyle(fontSize: 11, color: c.textMuted),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

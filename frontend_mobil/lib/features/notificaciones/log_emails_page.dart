import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_providers.dart';
import '../../core/format/fechas.dart';
import '../../core/theme/colores.dart';
import '../../core/widgets/avisos.dart';
import '../../core/widgets/badges.dart';
import '../../core/widgets/campos.dart';
import '../../core/widgets/can.dart';
import '../../core/widgets/dialogos.dart';
import '../../core/widgets/estados.dart';
import '../../core/widgets/lista_responsive.dart';
import '../../core/widgets/pagina.dart';
import '../../core/widgets/paginador.dart';
import '../reportes/widgets/rejilla_campos.dart';
import 'notificaciones_api.dart';
import 'notificaciones_modelos.dart';
import 'notificaciones_providers.dart';

/// `/admin/notificaciones`: log de emails transaccionales (ver, reintentar
/// fallidos) y desuscripciones (resetear). Espeja
/// `app/(admin-plaza)/admin/notificaciones/page.tsx`.
///
/// A diferencia del web, los botones sin permiso se ocultan (C-R14) y
/// "Resetear" pide confirmación.
class LogEmailsPage extends ConsumerStatefulWidget {
  const LogEmailsPage({super.key});

  @override
  ConsumerState<LogEmailsPage> createState() => _LogEmailsPageState();
}

class _LogEmailsPageState extends ConsumerState<LogEmailsPage> {
  // Filtros (vacío = sin filtro). Cambiar un filtro vuelve a la página 1.
  int _pagina = 1;
  String? _estado;
  String? _plantilla;
  String? _destinatarioFiltro;
  String? _desde;
  String? _hasta;
  final _destinatario = TextEditingController();
  bool _ocupado = false;

  FiltrosEmailLog get _f => (
    pagina: _pagina,
    estado: _estado,
    plantilla: _plantilla,
    destinatario: _destinatarioFiltro,
    desde: _desde,
    hasta: _hasta,
  );

  @override
  void dispose() {
    _destinatario.dispose();
    super.dispose();
  }

  bool get _hayFiltros =>
      _estado != null ||
      _plantilla != null ||
      _destinatarioFiltro != null ||
      _desde != null ||
      _hasta != null;

  void _aplicarDestinatario() {
    final v = _destinatario.text.trim();
    final nuevo = v.isEmpty ? null : v;
    if (nuevo == _destinatarioFiltro) return;
    setState(() {
      _destinatarioFiltro = nuevo;
      _pagina = 1;
    });
  }

  void _limpiar() {
    _destinatario.clear();
    setState(() {
      _estado = _plantilla = _destinatarioFiltro = _desde = _hasta = null;
      _pagina = 1;
    });
  }

  Future<void> _ver(EmailLog email) async {
    setState(() => _ocupado = true);
    try {
      final preview = await previewEmail(ref.read(apiClientProvider), email.id);
      if (!mounted) return;
      await showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        showDragHandle: true,
        builder: (_) =>
            VistaEmail(destinatario: email.destinatario, preview: preview),
      );
    } on Object catch (e) {
      if (mounted) mostrarError(context, e);
    } finally {
      if (mounted) setState(() => _ocupado = false);
    }
  }

  Future<void> _reintentar(EmailLog email) async {
    setState(() => _ocupado = true);
    try {
      await reintentarEmail(ref.read(apiClientProvider), email.id);
      ref.invalidate(emailLogProvider);
    } on Object catch (e) {
      if (mounted) mostrarError(context, e);
    } finally {
      if (mounted) setState(() => _ocupado = false);
    }
  }

  Future<void> _resetear(Desuscripcion d) async {
    final ok = await confirmar(
      context,
      titulo: '¿Resetear la desuscripción de ${d.email}?',
      mensaje: 'Volverá a recibir los emails de la plantilla "${d.plantilla}".',
      textoConfirmar: 'Sí, resetear',
      destructiva: true,
    );
    if (!ok || !mounted) return;
    setState(() => _ocupado = true);
    try {
      await resetearDesuscripcion(ref.read(apiClientProvider), d.id);
      ref.invalidate(desuscripcionesProvider);
    } on Object catch (e) {
      if (mounted) mostrarError(context, e);
    } finally {
      if (mounted) setState(() => _ocupado = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final log = ref.watch(emailLogProvider(_f));
    final c = ColoresPlazapp.of(context);
    final total = log.value?.total;

    return ContenidoPagina(
      onRefresh: () async {
        ref.invalidate(emailLogProvider);
        ref.invalidate(desuscripcionesProvider);
      },
      children: [
        EncabezadoPagina(
          titulo: 'Notificaciones',
          subtitulo: total == null
              ? null
              : '$total emails en el log. Los fallidos se pueden reintentar '
                    'manualmente.',
        ),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                RejillaCampos(
                  children: [
                    SelectorFiltro<String>(
                      etiqueta: 'Estado',
                      valor: _estado,
                      opciones: [for (final e in estadosEmailLog) (e, e)],
                      onChanged: (v) => setState(() {
                        _estado = v;
                        _pagina = 1;
                      }),
                    ),
                    SelectorFiltro<String>(
                      etiqueta: 'Plantilla',
                      textoTodos: 'Todas',
                      valor: _plantilla,
                      opciones: [for (final p in plantillasEmail) (p, p)],
                      onChanged: (v) => setState(() {
                        _plantilla = v;
                        _pagina = 1;
                      }),
                    ),
                    Focus(
                      onFocusChange: (tiene) {
                        if (!tiene) _aplicarDestinatario();
                      },
                      child: TextField(
                        key: const Key('filtro-destinatario'),
                        controller: _destinatario,
                        keyboardType: TextInputType.emailAddress,
                        textInputAction: TextInputAction.search,
                        decoration: InputDecoration(
                          labelText: 'Destinatario',
                          hintText: 'email@…',
                          suffixIcon: IconButton(
                            tooltip: 'Buscar',
                            icon: const Icon(Icons.search),
                            onPressed: _aplicarDestinatario,
                          ),
                        ),
                        onSubmitted: (_) => _aplicarDestinatario(),
                      ),
                    ),
                    CampoFecha(
                      label: 'Desde',
                      valorYmd: _desde,
                      permitirVacio: true,
                      onChanged: (v) => setState(() {
                        _desde = v;
                        _pagina = 1;
                      }),
                    ),
                    CampoFecha(
                      label: 'Hasta',
                      valorYmd: _hasta,
                      permitirVacio: true,
                      onChanged: (v) => setState(() {
                        _hasta = v;
                        _pagina = 1;
                      }),
                    ),
                  ],
                ),
                if (_hayFiltros) ...[
                  const SizedBox(height: 8),
                  TextButton(onPressed: _limpiar, child: const Text('Limpiar')),
                ],
              ],
            ),
          ),
        ),
        const SizedBox(height: 14),
        AsyncView(
          value: log,
          onRetry: () => ref.invalidate(emailLogProvider(_f)),
          data: (p) => Column(
            children: [
              ListaResponsive<EmailLog>(
                items: p.items,
                vacio: const EmptyState(
                  icono: Icons.mail_outline,
                  titulo: 'Sin emails',
                  mensaje: 'No hay emails con esos criterios.',
                ),
                columnas: [
                  ColumnaLista(
                    titulo: 'Destinatario',
                    principal: true,
                    celda: (e) => Text(e.destinatario, softWrap: true),
                  ),
                  ColumnaLista(
                    titulo: 'Solicitud',
                    celda: (e) => Text(
                      e.solicitudCodigo ?? '—',
                      style: const TextStyle(fontFamily: 'monospace'),
                    ),
                  ),
                  ColumnaLista(
                    titulo: 'Plantilla',
                    celda: (e) => Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.mail_outline, size: 14, color: c.textMuted),
                        const SizedBox(width: 6),
                        Flexible(
                          child: Text(
                            e.plantilla,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontFamily: 'monospace',
                              fontSize: 12.5,
                              color: c.text2,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  ColumnaLista(
                    titulo: 'Estado',
                    celda: (e) {
                      final badge = BadgePlazapp(e.estado, switch (e.estado) {
                        'enviado' => Tono.ok,
                        'fallido' => Tono.danger,
                        _ => Tono.warn,
                      });
                      // Como el `title` del web: el último error al mantener
                      // presionado.
                      return e.lastError == null
                          ? badge
                          : Tooltip(message: e.lastError, child: badge);
                    },
                  ),
                  ColumnaLista(
                    titulo: 'Reintentos',
                    celda: (e) => Text('${e.reintentos}'),
                  ),
                  ColumnaLista(
                    titulo: 'Creado',
                    celda: (e) => Text(formatFechaHora(e.createdAt)),
                  ),
                  ColumnaLista(
                    titulo: 'Enviado',
                    celda: (e) => Text(formatFechaHora(e.sentAt)),
                  ),
                ],
                acciones: (e) => Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    Can(
                      permiso: 'notificaciones.ver_preview',
                      child: OutlinedButton.icon(
                        onPressed: _ocupado ? null : () => _ver(e),
                        icon: const Icon(Icons.visibility_outlined, size: 18),
                        label: const Text('Ver'),
                      ),
                    ),
                    if (e.reintentable)
                      Can(
                        permiso: 'notificaciones.reintentar',
                        child: OutlinedButton.icon(
                          onPressed: _ocupado ? null : () => _reintentar(e),
                          icon: const Icon(Icons.refresh, size: 18),
                          label: const Text('Reintentar'),
                        ),
                      ),
                  ],
                ),
              ),
              Paginador(
                pagina: p.page,
                totalPaginas: p.totalPages,
                onCambiar: (n) => setState(() => _pagina = n),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        Text(
          'Desuscripciones',
          style: Theme.of(context).textTheme.titleMedium
              ?.copyWith(fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 4),
        Text(
          'Direcciones que pidieron no recibir un tipo de email. Resetear '
          'vuelve a habilitarlo.',
          style: TextStyle(color: c.text3, fontSize: 13.5),
        ),
        const SizedBox(height: 10),
        Can(
          permiso: 'notificaciones.gestionar_desuscripciones',
          otherwise: Text(
            'No hay desuscripciones registradas.',
            style: TextStyle(color: c.text3),
          ),
          child: _Desuscripciones(ocupado: _ocupado, onResetear: _resetear),
        ),
      ],
    );
  }
}

class _Desuscripciones extends ConsumerWidget {
  const _Desuscripciones({required this.ocupado, required this.onResetear});

  final bool ocupado;
  final ValueChanged<Desuscripcion> onResetear;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = ColoresPlazapp.of(context);
    return AsyncView(
      value: ref.watch(desuscripcionesProvider),
      onRetry: () => ref.invalidate(desuscripcionesProvider),
      data: (lista) {
        if (lista.isEmpty) {
          return Text(
            'No hay desuscripciones registradas.',
            style: TextStyle(color: c.text3),
          );
        }
        return Card(
          child: Column(
            children: [
              for (final (i, d) in lista.indexed) ...[
                if (i > 0) Divider(height: 1, color: c.border),
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 10,
                  ),
                  child: Wrap(
                    alignment: WrapAlignment.spaceBetween,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    spacing: 8,
                    runSpacing: 6,
                    children: [
                      Text.rich(
                        TextSpan(
                          children: [
                            TextSpan(
                              text: d.email,
                              style: const TextStyle(
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            TextSpan(
                              text: ' · ${d.plantilla} ',
                              style: TextStyle(color: c.text3),
                            ),
                            TextSpan(
                              text:
                                  '(${d.createdAt.length >= 10 ? d.createdAt.substring(0, 10) : d.createdAt})',
                              style: TextStyle(
                                color: c.textMuted,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                      ),
                      OutlinedButton(
                        onPressed: ocupado ? null : () => onResetear(d),
                        child: const Text('Resetear'),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}

/// Contenido de un email ("Ver"): asunto, destinatario y el HTML convertido a
/// texto legible.
class VistaEmail extends StatelessWidget {
  const VistaEmail({
    super.key,
    required this.destinatario,
    required this.preview,
  });

  final String destinatario;
  final EmailPreview preview;

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    return SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.85,
        ),
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                preview.subject,
                style: Theme.of(context).textTheme.titleMedium
                    ?.copyWith(fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 4),
              Text(
                'Para: $destinatario',
                style: TextStyle(color: c.text3, fontSize: 12.5),
              ),
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: c.surface2,
                  border: Border.all(color: c.border),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: SelectableText(
                  htmlATexto(preview.html),
                  style: TextStyle(color: c.text, height: 1.5),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

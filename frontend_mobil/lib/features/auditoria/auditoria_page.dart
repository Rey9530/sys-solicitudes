import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/format/fechas.dart';
import '../../core/theme/colores.dart';
import '../../core/widgets/badges.dart';
import '../../core/widgets/campo_select.dart';
import '../../core/widgets/campos.dart';
import '../../core/widgets/estados.dart';
import '../../core/widgets/filtros.dart';
import '../../core/widgets/lista_responsive.dart';
import '../../core/widgets/pagina.dart';
import '../../core/widgets/paginador.dart';
import 'auditoria_api.dart';
import 'auditoria_modelos.dart';
import 'auditoria_providers.dart';

/// `/admin/auditoria`: quién hizo qué y cuándo en la plaza (solo lectura).
/// Espeja `app/(admin-plaza)/admin/auditoria/page.tsx` y
/// `components/client/auditoria-{filtros,tabla}.tsx`.
class AuditoriaPage extends ConsumerStatefulWidget {
  const AuditoriaPage({super.key});

  @override
  ConsumerState<AuditoriaPage> createState() => _AuditoriaPageState();
}

class _AuditoriaPageState extends ConsumerState<AuditoriaPage> {
  // Filtros aplicados (los que se envían al backend).
  FiltrosAuditoria _f = (
    pagina: 1,
    accion: null,
    entidadTipo: null,
    desde: null,
    hasta: null,
  );

  // Valores en edición: se aplican con "Filtrar" o Enter.
  final _accion = TextEditingController();
  String? _entidadTipo;
  String? _desde;
  String? _hasta;

  @override
  void dispose() {
    _accion.dispose();
    super.dispose();
  }

  bool get _hayFiltros =>
      _f.accion != null ||
      _f.entidadTipo != null ||
      _f.desde != null ||
      _f.hasta != null;

  void _filtrar() {
    final accion = _accion.text.trim();
    setState(
      () => _f = (
        pagina: 1,
        accion: accion.isEmpty ? null : accion,
        entidadTipo: _entidadTipo,
        desde: _desde,
        hasta: _hasta,
      ),
    );
  }

  void _limpiar() {
    _accion.clear();
    setState(() {
      _entidadTipo = _desde = _hasta = null;
      _f = (
        pagina: 1,
        accion: null,
        entidadTipo: null,
        desde: null,
        hasta: null,
      );
    });
  }

  void _irAPagina(int n) => setState(
    () => _f = (
      pagina: n,
      accion: _f.accion,
      entidadTipo: _f.entidadTipo,
      desde: _f.desde,
      hasta: _f.hasta,
    ),
  );

  Future<void> _verDetalle(RegistroAuditoria r) async {
    final ruta = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (_) => DetalleAuditoria(registro: r),
    );
    if (ruta != null && mounted) await context.push(ruta);
  }

  @override
  Widget build(BuildContext context) {
    final lista = ref.watch(auditoriaProvider(_f));
    final c = ColoresPlazapp.of(context);
    final total = lista.value?.total;
    return ContenidoPagina(
      onRefresh: () => recargar(ref, auditoriaProvider(_f).future),
      children: [
        EncabezadoPagina(
          titulo: 'Auditoría',
          subtitulo: total == null
              ? null
              : '$total eventos · quién hizo qué y cuándo en la plaza.',
        ),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                RejillaCampos(
                  children: [
                    TextField(
                      key: const Key('filtro-accion'),
                      controller: _accion,
                      textInputAction: TextInputAction.search,
                      decoration: const InputDecoration(
                        labelText: 'Acción',
                        hintText: 'ej. local.update',
                      ),
                      onSubmitted: (_) => _filtrar(),
                    ),
                    CampoSelect<String>(
                      label: 'Tipo de entidad',
                      opcionVacia: 'Todos',
                      valor: _entidadTipo,
                      opciones: [for (final t in tiposEntidadAuditoria) (t, t)],
                      onChanged: (v) => setState(() => _entidadTipo = v),
                    ),
                    CampoFecha(
                      label: 'Desde',
                      valorYmd: _desde,
                      permitirVacio: true,
                      onChanged: (v) => setState(() => _desde = v),
                    ),
                    CampoFecha(
                      label: 'Hasta',
                      valorYmd: _hasta,
                      permitirVacio: true,
                      onChanged: (v) => setState(() => _hasta = v),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    FilledButton.icon(
                      key: const Key('auditoria-filtrar'),
                      onPressed: _filtrar,
                      icon: const Icon(Icons.search, size: 18),
                      label: const Text('Filtrar'),
                    ),
                    if (_hayFiltros)
                      TextButton(
                        onPressed: _limpiar,
                        child: const Text('Limpiar'),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 14),
        AsyncView(
          value: lista,
          onRetry: () => ref.invalidate(auditoriaProvider(_f)),
          data: (p) => Column(
            children: [
              ListaResponsive<RegistroAuditoria>(
                items: p.items,
                vacio: const EmptyState(
                  icono: Icons.receipt_long_outlined,
                  titulo: 'Sin eventos',
                  mensaje:
                      'No hay eventos de auditoría que coincidan con esos '
                      'filtros.',
                ),
                onTap: _verDetalle,
                columnas: [
                  ColumnaLista(
                    titulo: 'Fecha y hora',
                    principal: true,
                    celda: (r) => Text(formatFechaHora(r.createdAt)),
                  ),
                  ColumnaLista(
                    titulo: 'Usuario',
                    celda: (r) => r.usuarioNombre == null
                        ? Text('sistema', style: TextStyle(color: c.text3))
                        : Text(r.usuarioNombre!),
                  ),
                  ColumnaLista(
                    titulo: 'Acción',
                    celda: (r) => BadgePlazapp(r.accion, tonoAccion(r.accion)),
                  ),
                  ColumnaLista(
                    titulo: 'Entidad',
                    celda: (r) => Text(
                      r.entidadId == null
                          ? r.entidadTipo
                          : '${r.entidadTipo}: ${idCorto(r.entidadId!)}',
                      style: TextStyle(color: c.text3),
                    ),
                  ),
                ],
                acciones: (r) => TextButton(
                  onPressed: () => _verDetalle(r),
                  child: const Text('Detalle'),
                ),
              ),
              Paginador(
                pagina: p.page,
                totalPaginas: p.totalPages,
                onCambiar: _irAPagina,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// `dd/MM/yyyy h:mm:ss am` en hora de la plaza (subtítulo del detalle).
String _fechaConSegundos(String iso) {
  final fecha = DateTime.tryParse(iso);
  if (fecha == null) return '—';
  final d = aHoraPlaza(fecha);
  final hora = hora12(d.hour, d.minute);
  final segundos = d.second.toString().padLeft(2, '0');
  // "2:05 pm" → "2:05:09 pm"
  final conSegundos = hora.replaceFirst(' ', ':$segundos ');
  return '${DateFormat('dd/MM/yyyy').format(d)} $conSegundos';
}

/// Detalle de una entrada (modal "Detalle" del web): acción, entidad, quién,
/// metadatos y los cambios (antes/después). Al tocar "Ver detalle" cierra la
/// hoja devolviendo la ruta de la entidad.
class DetalleAuditoria extends StatelessWidget {
  const DetalleAuditoria({super.key, required this.registro});

  final RegistroAuditoria registro;

  @override
  Widget build(BuildContext context) {
    final r = registro;
    final c = ColoresPlazapp.of(context);
    final ruta = rutaEntidadAuditada(r);
    final quien = r.usuarioNombre != null
        ? '${r.usuarioNombre} <${r.usuarioEmail ?? ''}>'
        : r.usuarioId != null
        ? 'usuario eliminado (id ${idCorto(r.usuarioId!)})'
        : 'acción del sistema';

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
              Wrap(
                spacing: 8,
                runSpacing: 6,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  BadgePlazapp(r.accion, tonoAccion(r.accion)),
                  Text(
                    r.entidadId == null
                        ? r.entidadTipo
                        : '${r.entidadTipo}: ${idCorto(r.entidadId!)}',
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 16,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                '${_fechaConSegundos(r.createdAt)} · $quien',
                style: TextStyle(color: c.text3, fontSize: 13),
              ),
              const SizedBox(height: 16),
              KeyValueGrid([
                (
                  'Entidad',
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        r.entidadId == null
                            ? r.entidadTipo
                            : '${r.entidadTipo} · ${idCorto(r.entidadId!)}…',
                      ),
                      if (ruta != null)
                        TextButton.icon(
                          style: TextButton.styleFrom(padding: EdgeInsets.zero),
                          onPressed: () => Navigator.of(context).pop(ruta),
                          icon: const Icon(Icons.open_in_new, size: 16),
                          label: const Text('Ver detalle'),
                        ),
                    ],
                  ),
                ),
                (
                  'Plaza',
                  r.plazaId == null
                      ? const Text(
                          'plataforma',
                          style: TextStyle(fontStyle: FontStyle.italic),
                        )
                      : Text('${idCorto(r.plazaId!)}…'),
                ),
                if (r.ip != null) ('IP', Text(r.ip!)),
                if (r.userAgent != null) ('User-Agent', Text(r.userAgent!)),
                if (r.requestId != null) ('Request ID', Text(r.requestId!)),
              ]),
              const SizedBox(height: 18),
              _Cambios(antes: r.antes, despues: r.despues),
            ],
          ),
        ),
      ),
    );
  }
}

/// Diferencias antes/después (`DiffView` del web).
class _Cambios extends StatelessWidget {
  const _Cambios({required this.antes, required this.despues});

  final Object? antes;
  final Object? despues;

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    if (antes == null && despues == null) {
      return Text(
        'Esta entrada no tiene payload persistido (decorador omitirBody).',
        style: TextStyle(color: c.text3, fontSize: 13),
      );
    }
    if (antes == null || despues == null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _Titulo(antes == null ? 'Después' : 'Antes'),
          _Codigo(const JsonEncoder.withIndent('  ').convert(antes ?? despues)),
        ],
      );
    }
    final a = antes is Map<String, dynamic>
        ? antes! as Map<String, dynamic>
        : const <String, dynamic>{};
    final d = despues is Map<String, dynamic>
        ? despues! as Map<String, dynamic>
        : const <String, dynamic>{};
    final claves = {...a.keys, ...d.keys}.toList()..sort();
    String valor(Map<String, dynamic> m, String k) =>
        m.containsKey(k) ? jsonEncode(m[k]) : '—';
    final cambio = c.tono(Tono.warn);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const _Titulo('Cambios'),
        for (final k in claves)
          Builder(
            builder: (context) {
              final av = valor(a, k);
              final dv = valor(d, k);
              final cambiado = av != dv;
              return Container(
                margin: const EdgeInsets.only(bottom: 6),
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: cambiado ? cambio.bg : c.surface2,
                  border: Border.all(color: cambiado ? cambio.bd : c.border),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      k,
                      style: const TextStyle(
                        fontFamily: 'monospace',
                        fontWeight: FontWeight.w700,
                        fontSize: 12.5,
                      ),
                    ),
                    const SizedBox(height: 4),
                    _ParValor(etiqueta: 'Antes', valor: av),
                    _ParValor(etiqueta: 'Después', valor: dv),
                  ],
                ),
              );
            },
          ),
      ],
    );
  }
}

class _ParValor extends StatelessWidget {
  const _ParValor({required this.etiqueta, required this.valor});

  final String etiqueta;
  final String valor;

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    return Padding(
      padding: const EdgeInsets.only(top: 2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 64,
            child: Text(
              etiqueta,
              style: TextStyle(color: c.text3, fontSize: 12),
            ),
          ),
          Expanded(
            child: SelectableText(
              valor,
              style: const TextStyle(fontFamily: 'monospace', fontSize: 12),
            ),
          ),
        ],
      ),
    );
  }
}

class _Titulo extends StatelessWidget {
  const _Titulo(this.texto);
  final String texto;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Text(
      texto,
      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
    ),
  );
}

class _Codigo extends StatelessWidget {
  const _Codigo(this.texto);
  final String texto;

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: c.surface2,
        border: Border.all(color: c.border),
        borderRadius: BorderRadius.circular(8),
      ),
      child: SelectableText(
        texto,
        style: const TextStyle(fontFamily: 'monospace', fontSize: 12),
      ),
    );
  }
}

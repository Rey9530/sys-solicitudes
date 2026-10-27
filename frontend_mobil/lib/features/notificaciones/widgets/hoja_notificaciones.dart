import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_error.dart';
import '../../../core/api/api_providers.dart';
import '../../../core/format/fechas.dart';
import '../../../core/theme/colores.dart';
import '../campana_api.dart';
import '../campana_providers.dart';
import '../notificaciones_modelos.dart';

/// Icono y tono de cada tipo de notificación (tabla `TIPO_META` del web, con
/// el equivalente Material de cada icono lucide).
(IconData, Tono) iconoDeNotificacion(String tipo) => switch (tipo) {
  'solicitud_asignada' => (Icons.how_to_reg_outlined, Tono.info),
  'solicitud_nueva_supervisor' => (Icons.group_outlined, Tono.info),
  'solicitud_reasignada' => (Icons.swap_horiz, Tono.info),
  'solicitud_desasignada' => (Icons.swap_horiz, Tono.neutral),
  'solicitud_en_revision' => (Icons.visibility_outlined, Tono.info),
  'solicitud_aprobada' => (Icons.check_circle_outline, Tono.ok),
  'solicitud_rechazada' => (Icons.cancel_outlined, Tono.danger),
  'solicitud_subsanacion' => (Icons.build_outlined, Tono.warn),
  'solicitud_cerrada' => (Icons.flag_outlined, Tono.violet),
  'solicitud_pausada' => (Icons.pause_circle_outline, Tono.warn),
  'solicitud_reanudada' => (Icons.play_circle_outline, Tono.info),
  'solicitud_liberada' => (Icons.replay, Tono.neutral),
  'solicitud_cancelada' => (Icons.block, Tono.neutral),
  'solicitud_reenviada' => (Icons.send_outlined, Tono.info),
  'comentario_nuevo' => (Icons.chat_bubble_outline, Tono.violet),
  'contrato_por_vencer' => (Icons.assignment_late_outlined, Tono.warn),
  _ => (Icons.notifications_none_outlined, Tono.neutral),
};

/// Contenido de la hoja de la campana (popover `notif-menu` del web): las 20
/// notificaciones más recientes, "Marcar todas como leídas" y, al tocar una,
/// cierra la hoja devolviéndola (quien abrió la hoja la marca y navega).
class HojaNotificaciones extends ConsumerStatefulWidget {
  const HojaNotificaciones({super.key, this.alMarcarTodas});

  /// Marca todas en el backend (la campana lo usa para su contador
  /// optimista). Sin valor, llama directo a la API.
  final Future<void> Function()? alMarcarTodas;

  @override
  ConsumerState<HojaNotificaciones> createState() => _HojaNotificacionesState();
}

class _HojaNotificacionesState extends ConsumerState<HojaNotificaciones> {
  /// Optimista: tras "Marcar todas" la lista se pinta leída sin esperar.
  bool _todasLeidas = false;

  void _marcarTodas() {
    setState(() => _todasLeidas = true);
    final marcar =
        widget.alMarcarTodas ??
        () => marcarTodasLeidas(ref.read(apiClientProvider));
    unawaited(marcar().catchError((Object _) {}));
  }

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    final bandeja = ref.watch(bandejaNotificacionesProvider);
    final datos = bandeja.value;
    final noLeidas = _todasLeidas ? 0 : (datos?.noLeidas ?? 0);

    final Widget cuerpo = bandeja.when(
      loading: () => _Aviso(texto: 'Cargando…', color: c.text3),
      error: (e, _) => _Aviso(
        icono: Icons.notifications_off_outlined,
        texto: e is ApiError
            ? e.mensaje
            : 'No se pudieron cargar las notificaciones.',
        color: c.text3,
      ),
      data: (b) => b.items.isEmpty
          ? _Aviso(
              icono: Icons.inbox_outlined,
              texto: 'No tienes notificaciones',
              color: c.text3,
            )
          : ListView.separated(
              shrinkWrap: true,
              padding: const EdgeInsets.only(bottom: 12),
              itemCount: b.items.length,
              separatorBuilder: (_, _) => Divider(height: 1, color: c.border),
              itemBuilder: (_, i) {
                final n = b.items[i];
                return _ItemNotificacion(
                  notificacion: n,
                  leida: n.leida || _todasLeidas,
                  onTap: () => Navigator.of(context).pop(n),
                );
              },
            ),
    );

    return SafeArea(
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.8,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
              child: Wrap(
                alignment: WrapAlignment.spaceBetween,
                crossAxisAlignment: WrapCrossAlignment.center,
                spacing: 8,
                runSpacing: 6,
                children: [
                  Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Notificaciones',
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: 16,
                        ),
                      ),
                      Text(
                        noLeidas > 0 ? '$noLeidas sin leer' : 'Estás al día',
                        style: TextStyle(color: c.text3, fontSize: 12.5),
                      ),
                    ],
                  ),
                  if (noLeidas > 0)
                    TextButton.icon(
                      key: const Key('marcar-todas'),
                      onPressed: _marcarTodas,
                      icon: const Icon(Icons.done_all, size: 18),
                      label: const Text('Marcar todas como leídas'),
                    ),
                ],
              ),
            ),
            Divider(height: 1, color: c.border),
            Flexible(child: cuerpo),
          ],
        ),
      ),
    );
  }
}

class _Aviso extends StatelessWidget {
  const _Aviso({required this.texto, required this.color, this.icono});

  final String texto;
  final Color color;
  final IconData? icono;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icono != null) ...[
            Icon(icono, color: color, size: 28),
            const SizedBox(height: 8),
          ],
          Text(
            texto,
            textAlign: TextAlign.center,
            style: TextStyle(color: color),
          ),
        ],
      ),
    );
  }
}

class _ItemNotificacion extends StatelessWidget {
  const _ItemNotificacion({
    required this.notificacion,
    required this.leida,
    required this.onTap,
  });

  final NotificacionInApp notificacion;
  final bool leida;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    final (icono, tono) = iconoDeNotificacion(notificacion.tipo);
    final t = c.tono(tono);
    final primario = Theme.of(context).colorScheme.primary;
    final fecha = DateTime.tryParse(notificacion.createdAt);
    return Material(
      color: leida ? Colors.transparent : primario.withValues(alpha: 0.06),
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: t.bg,
                  border: Border.all(color: t.bd),
                  borderRadius: BorderRadius.circular(9),
                ),
                child: Icon(icono, size: 18, color: t.fg),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      notificacion.titulo,
                      style: TextStyle(
                        fontWeight: leida ? FontWeight.w500 : FontWeight.w700,
                        color: c.text,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      notificacion.mensaje,
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: c.text2, fontSize: 13),
                    ),
                    const SizedBox(height: 4),
                    if (fecha != null)
                      Tooltip(
                        message: formatFechaHora(notificacion.createdAt),
                        child: Text(
                          tiempoRelativo(fecha),
                          style: TextStyle(color: c.textMuted, fontSize: 12),
                        ),
                      ),
                  ],
                ),
              ),
              if (!leida)
                Padding(
                  padding: const EdgeInsets.only(left: 8, top: 4),
                  child: Semantics(
                    label: 'Sin leer',
                    child: Container(
                      width: 8,
                      height: 8,
                      decoration: BoxDecoration(
                        color: primario,
                        shape: BoxShape.circle,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

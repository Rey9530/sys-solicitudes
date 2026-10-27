import 'package:flutter/material.dart';

import '../../../core/format/fechas.dart';
import '../../../core/format/texto.dart';
import '../../../core/theme/colores.dart';
import '../../../core/widgets/badges.dart';
import '../../../core/widgets/estados.dart';
import '../../../core/widgets/lista_responsive.dart';
import '../solicitudes_modelos.dart';

/// Listado de solicitudes compartido (`SolicitudesTable` del web): tarjetas
/// en teléfono con el código como título, tabla cuando cabe.
class TablaSolicitudes extends StatelessWidget {
  const TablaSolicitudes({
    super.key,
    required this.solicitudes,
    required this.onAbrir,
    this.conSla = false,
    this.conAsignado = false,
    this.conPlaza = false,
  });

  final List<SolicitudItem> solicitudes;
  final void Function(SolicitudItem s) onAbrir;
  final bool conSla;
  final bool conAsignado;
  final bool conPlaza;

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    final atenuado = TextStyle(color: c.text3);
    return ListaResponsive<SolicitudItem>(
      items: solicitudes,
      onTap: onAbrir,
      vacio: const EmptyState(
        icono: Icons.inbox_outlined,
        titulo: 'Sin solicitudes',
        mensaje: 'No hay solicitudes que coincidan con esos criterios.',
      ),
      columnas: [
        ColumnaLista(
          titulo: 'Código',
          principal: true,
          celda: (s) => CodigoSolicitud(s.codigo),
        ),
        ColumnaLista(
          titulo: 'Tipo',
          celda: (s) => BadgePlazapp(
            etiquetaTipoSolicitud[s.tipo] ?? s.tipo,
            Tono.neutral,
            punto: false,
          ),
        ),
        ColumnaLista(
          titulo: 'Título',
          celda: (s) =>
              Text(s.titulo, maxLines: 2, overflow: TextOverflow.ellipsis),
        ),
        ColumnaLista(
          titulo: 'Local',
          celda: (s) => Text(
            s.localCodigo ?? '—',
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontFamily: 'monospace', fontSize: 12.5),
          ),
        ),
        if (conPlaza)
          ColumnaLista(
            titulo: 'Plaza',
            celda: (s) => Text(
              s.plazaNombre ?? '—',
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: atenuado,
            ),
          ),
        ColumnaLista(
          titulo: 'Estado',
          celda: (s) => EstadoSolicitudBadge(s.estado),
        ),
        ColumnaLista(
          titulo: 'Prioridad',
          celda: (s) => PrioridadBadge(s.prioridad),
        ),
        if (conSla)
          ColumnaLista(titulo: 'SLA', celda: (s) => SlaSemaforo(s.slaStatus)),
        if (conAsignado)
          ColumnaLista(
            titulo: 'Asignada a',
            celda: (s) => s.adminAsignado == null
                ? Text('—', style: TextStyle(color: c.textMuted))
                : PersonaConAvatar(s.adminAsignado!.nombre),
          ),
        ColumnaLista(
          titulo: 'Enviada',
          celda: (s) => Text(
            s.enviadaAt == null ? '—' : formatFecha(s.enviadaAt),
            style: atenuado,
          ),
        ),
        ColumnaLista(
          titulo: 'Decisión',
          celda: (s) => Text(
            s.decisionAt == null ? '—' : formatFecha(s.decisionAt),
            style: atenuado,
          ),
        ),
      ],
    );
  }
}

/// Código `SOL-…` en monoespaciada y color primario.
class CodigoSolicitud extends StatelessWidget {
  const CodigoSolicitud(this.codigo, {super.key});

  final String codigo;

  @override
  Widget build(BuildContext context) => Text(
    codigo,
    overflow: TextOverflow.ellipsis,
    style: TextStyle(
      fontFamily: 'monospace',
      fontWeight: FontWeight.w600,
      color: Theme.of(context).colorScheme.primary,
    ),
  );
}

/// Avatar con iniciales + nombre (se recorta si no cabe).
class PersonaConAvatar extends StatelessWidget {
  const PersonaConAvatar(this.nombre, {super.key});

  final String nombre;

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        AvatarIniciales(nombre),
        const SizedBox(width: 8),
        Flexible(
          child: Text(
            nombre,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(color: c.text2),
          ),
        ),
      ],
    );
  }
}

/// Círculo con las iniciales del nombre.
class AvatarIniciales extends StatelessWidget {
  const AvatarIniciales(this.nombre, {super.key});

  final String nombre;

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    return CircleAvatar(
      radius: 12,
      backgroundColor: c.surface3,
      child: Text(
        iniciales(nombre),
        style: TextStyle(
          fontSize: 9.5,
          fontWeight: FontWeight.w700,
          color: c.text2,
        ),
      ),
    );
  }
}

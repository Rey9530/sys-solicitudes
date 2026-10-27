import 'package:flutter/material.dart';

import '../../../core/theme/colores.dart';
import '../../../core/widgets/campo_select.dart';
import '../solicitudes_modelos.dart';

/// Diálogos del panel de decisión que no son un simple `pedirTexto`.
/// Cerrar el diálogo o pulsar "Cancelar" devuelve `null` (no se hace nada).

/// Resultado del diálogo "Cerrar solicitud".
typedef CierreElegido = ({String resultado, String? comentario});

/// "Cerrar solicitud": resultado obligatorio; comentario obligatorio si el
/// resultado no es `exitoso` (opcional, pero se envía, si es `exitoso`).
Future<CierreElegido?> pedirCierre(BuildContext context) =>
    showDialog<CierreElegido>(
      context: context,
      builder: (_) => const _DialogoCierre(),
    );

class _DialogoCierre extends StatefulWidget {
  const _DialogoCierre();

  @override
  State<_DialogoCierre> createState() => _DialogoCierreState();
}

class _DialogoCierreState extends State<_DialogoCierre> {
  String? _resultado;
  final _comentario = TextEditingController();

  @override
  void dispose() {
    _comentario.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final requiere = _resultado != null && _resultado != 'exitoso';
    final texto = _comentario.text.trim();
    final comentarioOk = !requiere || texto.isNotEmpty;
    final habilitado = _resultado != null && comentarioOk;
    return AlertDialog(
      title: const Text('Cerrar solicitud'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Registra el resultado de la actividad. Esta acción es terminal: '
              'no se puede reabrir.',
            ),
            const SizedBox(height: 14),
            CampoSelect<String>(
              key: const Key('cierre-resultado'),
              label: 'Resultado',
              valor: _resultado,
              opcionVacia: 'Selecciona resultado…',
              opciones: [
                for (final e in opcionesResultadoCierre.entries)
                  (e.key, e.value),
              ],
              onChanged: (v) => setState(() => _resultado = v),
            ),
            const SizedBox(height: 14),
            TextField(
              key: const Key('cierre-comentario'),
              controller: _comentario,
              minLines: 3,
              maxLines: 6,
              maxLength: 4000,
              onChanged: (_) => setState(() {}),
              decoration: InputDecoration(
                labelText:
                    'Comentario ${requiere ? '(obligatorio)' : '(opcional)'}',
                hintText: 'Detalle del resultado, evidencia o motivo…',
                errorText: requiere && !comentarioOk
                    ? 'El comentario es obligatorio cuando el cierre no es '
                          'exitoso.'
                    : null,
                errorMaxLines: 3,
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          key: const Key('cierre-confirmar'),
          onPressed: habilitado
              ? () => Navigator.of(context).pop((
                  resultado: _resultado!,
                  comentario: texto.isEmpty ? null : texto,
                ))
              : null,
          child: const Text('Cerrar solicitud'),
        ),
      ],
    );
  }
}

/// Resultado del diálogo "Reasignar solicitud".
typedef ReasignacionElegida = ({String responsableId, String? motivo});

/// "Reasignar solicitud": admin de plaza con staff activo (sin el asignado
/// actual) + motivo opcional.
Future<ReasignacionElegida?> pedirReasignacion(
  BuildContext context,
  List<AdminOpcion> admins,
) => showDialog<ReasignacionElegida>(
  context: context,
  builder: (_) => _DialogoReasignar(admins: admins),
);

class _DialogoReasignar extends StatefulWidget {
  const _DialogoReasignar({required this.admins});

  final List<AdminOpcion> admins;

  @override
  State<_DialogoReasignar> createState() => _DialogoReasignarState();
}

class _DialogoReasignarState extends State<_DialogoReasignar> {
  String? _seleccion;
  final _motivo = TextEditingController();

  @override
  void dispose() {
    _motivo.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    return AlertDialog(
      title: const Text('Reasignar solicitud'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'El nuevo responsable debe ser un admin de plaza con rol de '
              'staff activo (SC-6).',
              style: TextStyle(color: c.text2),
            ),
            const SizedBox(height: 14),
            CampoSelect<String>(
              key: const Key('reasignar-admin'),
              label: 'Administrador',
              valor: _seleccion,
              opcionVacia: 'Selecciona administrador…',
              opciones: [
                for (final a in widget.admins)
                  (a.id, '${a.nombre} (${a.email})'),
              ],
              onChanged: (v) => setState(() => _seleccion = v),
            ),
            const SizedBox(height: 14),
            TextField(
              key: const Key('reasignar-motivo'),
              controller: _motivo,
              maxLength: 1000,
              decoration: const InputDecoration(hintText: 'Motivo (opcional)'),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          key: const Key('reasignar-confirmar'),
          onPressed: _seleccion == null
              ? null
              : () {
                  final motivo = _motivo.text.trim();
                  Navigator.of(context).pop((
                    responsableId: _seleccion!,
                    motivo: motivo.isEmpty ? null : motivo,
                  ));
                },
          child: const Text('Reasignar'),
        ),
      ],
    );
  }
}

import 'package:flutter/material.dart';

import '../../../core/format/fechas.dart';
import '../../../core/theme/colores.dart';
import '../../../core/widgets/avisos.dart';
import '../../../core/widgets/badges.dart';
import '../../../core/widgets/can.dart';
import '../solicitudes_modelos.dart';
import 'tabla_solicitudes.dart';

/// Pestaña "Comentarios": lista (más antiguo primero) + caja para comentar.
/// No hay comentarios internos: el inquilino ve también los del staff.
class ComentariosTab extends StatefulWidget {
  const ComentariosTab({
    super.key,
    required this.comentarios,
    required this.hint,
    required this.comentar,
    this.permiso,
  });

  final List<Comentario> comentarios;

  /// "Comentario para el inquilino…" (admin) / "Escribe un comentario…".
  final String hint;

  /// Envía el comentario y recarga el detalle. Lanza `ApiError` si falla.
  final Future<void> Function(String cuerpo) comentar;

  /// Permiso que exige el botón "Comentar" (admin). El inquilino no tiene
  /// permisos granulares: `null`.
  final String? permiso;

  @override
  State<ComentariosTab> createState() => _ComentariosTabState();
}

class _ComentariosTabState extends State<ComentariosTab> {
  final _texto = TextEditingController();
  bool _enviando = false;

  @override
  void dispose() {
    _texto.dispose();
    super.dispose();
  }

  Future<void> _enviar() async {
    final cuerpo = _texto.text.trim();
    if (cuerpo.isEmpty || _enviando) return;
    setState(() => _enviando = true);
    try {
      await widget.comentar(cuerpo);
      if (!mounted) return;
      _texto.clear();
      mostrarExito(context, 'Comentario agregado');
    } on Object catch (e) {
      if (mounted) mostrarError(context, e);
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    final boton = ValueListenableBuilder(
      valueListenable: _texto,
      builder: (context, valor, _) => FilledButton(
        key: const Key('comentar'),
        onPressed: _enviando || valor.text.trim().isEmpty ? null : _enviar,
        child: const Text('Comentar'),
      ),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (widget.comentarios.isEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: Text('Sin comentarios.', style: TextStyle(color: c.text3)),
          ),
        for (final com in widget.comentarios)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: 8,
                      runSpacing: 6,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        AvatarIniciales(com.usuario?.nombre ?? 'Sistema'),
                        Text(
                          com.usuario?.nombre ?? 'Sistema',
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 13,
                          ),
                        ),
                        if (com.tipo != 'general')
                          BadgePlazapp(com.tipo, Tono.warn, punto: false),
                        Text(
                          formatFecha(com.createdAt),
                          style: TextStyle(color: c.text3, fontSize: 12),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      com.cuerpo,
                      style: TextStyle(color: c.text2, fontSize: 14),
                    ),
                  ],
                ),
              ),
            ),
          ),
        TextField(
          key: const Key('comentario-texto'),
          controller: _texto,
          minLines: 2,
          maxLines: 5,
          maxLength: 4000,
          decoration: InputDecoration(hintText: widget.hint),
        ),
        const SizedBox(height: 6),
        Align(
          alignment: Alignment.centerRight,
          child: widget.permiso == null
              ? boton
              : Can(permiso: widget.permiso!, child: boton),
        ),
      ],
    );
  }
}

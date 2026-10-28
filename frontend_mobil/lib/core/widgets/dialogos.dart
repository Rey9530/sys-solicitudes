import 'package:flutter/material.dart';

/// Confirmación de una decisión (equivalente a `confirmAction` del web).
/// Devuelve `true` solo si se pulsó el botón afirmativo. En acciones
/// destructivas el foco inicial queda en "Cancelar".
Future<bool> confirmar(
  BuildContext context, {
  required String titulo,
  String? mensaje,
  required String textoConfirmar,
  bool destructiva = false,
}) async {
  final r = await showDialog<bool>(
    context: context,
    builder: (dialogo) {
      final error = Theme.of(dialogo).colorScheme.error;
      return AlertDialog(
        icon: Icon(
          destructiva ? Icons.warning_amber_rounded : Icons.help_outline,
          color: destructiva ? error : null,
        ),
        title: Text(titulo, textAlign: TextAlign.center),
        content: mensaje == null
            ? null
            : Text(mensaje, textAlign: TextAlign.center),
        actions: [
          TextButton(
            autofocus: destructiva,
            onPressed: () => Navigator.of(dialogo).pop(false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            style: destructiva
                ? FilledButton.styleFrom(backgroundColor: error)
                : null,
            onPressed: () => Navigator.of(dialogo).pop(true),
            child: Text(textoConfirmar),
          ),
        ],
      );
    },
  );
  return r ?? false;
}

/// Pide un texto (motivo, comentario). Devuelve `null` si se canceló —quien
/// llama DEBE abortar— o el texto recortado (`''` si se dejó vacío y no es
/// obligatorio). Equivalente a `promptAction` del web.
Future<String?> pedirTexto(
  BuildContext context, {
  required String titulo,
  String? mensaje,
  String? hint,
  required String textoConfirmar,
  bool obligatorio = false,
  bool destructiva = false,
  int maxLength = 1000,
}) {
  return showDialog<String>(
    context: context,
    builder: (_) => _DialogoTexto(
      titulo: titulo,
      mensaje: mensaje,
      hint: hint,
      textoConfirmar: textoConfirmar,
      obligatorio: obligatorio,
      destructiva: destructiva,
      maxLength: maxLength,
    ),
  );
}

class _DialogoTexto extends StatefulWidget {
  const _DialogoTexto({
    required this.titulo,
    required this.mensaje,
    required this.hint,
    required this.textoConfirmar,
    required this.obligatorio,
    required this.destructiva,
    required this.maxLength,
  });

  final String titulo;
  final String? mensaje;
  final String? hint;
  final String textoConfirmar;
  final bool obligatorio;
  final bool destructiva;
  final int maxLength;

  @override
  State<_DialogoTexto> createState() => _DialogoTextoState();
}

class _DialogoTextoState extends State<_DialogoTexto> {
  final _texto = TextEditingController();

  @override
  void dispose() {
    _texto.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final error = Theme.of(context).colorScheme.error;
    return AlertDialog(
      title: Text(widget.titulo),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (widget.mensaje != null) ...[
              Text(widget.mensaje!),
              const SizedBox(height: 12),
            ],
            TextField(
              key: const Key('dialogo-texto'),
              controller: _texto,
              autofocus: true,
              minLines: 3,
              maxLines: 5,
              maxLength: widget.maxLength,
              decoration: InputDecoration(hintText: widget.hint),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Volver'),
        ),
        ValueListenableBuilder(
          valueListenable: _texto,
          builder: (context, valor, _) {
            final vacio = valor.text.trim().isEmpty;
            return FilledButton(
              key: const Key('dialogo-confirmar'),
              style: widget.destructiva
                  ? FilledButton.styleFrom(backgroundColor: error)
                  : null,
              onPressed: widget.obligatorio && vacio
                  ? null
                  : () => Navigator.of(context).pop(_texto.text.trim()),
              child: Text(widget.textoConfirmar),
            );
          },
        ),
      ],
    );
  }
}

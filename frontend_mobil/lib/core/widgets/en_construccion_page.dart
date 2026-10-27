import 'package:flutter/material.dart';

/// Marcador temporal de una ruta cuyo módulo aún no se implementa.
class EnConstruccionPage extends StatelessWidget {
  const EnConstruccionPage({super.key, required this.titulo});

  final String titulo;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Text('$titulo\n(en construcción)', textAlign: TextAlign.center),
      ),
    );
  }
}

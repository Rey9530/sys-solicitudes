import 'package:flutter/material.dart';

import '../theme/colores.dart';

/// Lo que ve el superadmin en una pantalla de plaza sin haber elegido plaza
/// (mismo texto que el web).
class SeleccionaPlazaPage extends StatelessWidget {
  const SeleccionaPlazaPage({super.key});

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 440),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.apartment_outlined, size: 40, color: c.text3),
              const SizedBox(height: 12),
              Text(
                'Selecciona una plaza para operar',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 6),
              Text(
                'Usa el selector de plaza en la barra superior para elegir sobre '
                'qué plaza quieres ver y operar (Solicitudes, Locales, '
                'Contratos, etc.).',
                textAlign: TextAlign.center,
                style: TextStyle(color: c.text3),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

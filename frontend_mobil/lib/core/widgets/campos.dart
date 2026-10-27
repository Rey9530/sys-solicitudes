import 'package:flutter/material.dart';

import '../format/fechas.dart';

/// Campo de fecha civil: muestra `DD-MM-YYYY`, entrega `YYYY-MM-DD`.
class CampoFecha extends StatelessWidget {
  const CampoFecha({
    super.key,
    required this.label,
    required this.valorYmd,
    required this.onChanged,
    this.primera,
    this.ultima,
    this.permitirVacio = false,
    this.errorText,
    this.enabled = true,
  });

  final String label;
  final String? valorYmd;
  final ValueChanged<String?> onChanged;
  final DateTime? primera;
  final DateTime? ultima;
  final bool permitirVacio;
  final String? errorText;
  final bool enabled;

  Future<void> _elegir(BuildContext context) async {
    final hoy = ahoraEnPlaza();
    final inicio = primera ?? DateTime.utc(2020);
    final fin = ultima ?? DateTime.utc(hoy.year + 5, 12, 31);
    var actual = valorYmd == null
        ? hoy
        : DateTime.parse('${valorYmd}T00:00:00Z');
    if (actual.isBefore(inicio)) actual = inicio;
    if (actual.isAfter(fin)) actual = fin;
    final elegida = await showDatePicker(
      context: context,
      initialDate: actual,
      firstDate: inicio,
      lastDate: fin,
      locale: const Locale('es'),
    );
    if (elegida != null) onChanged(ymd(elegida));
  }

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: enabled ? () => _elegir(context) : null,
      borderRadius: BorderRadius.circular(7),
      child: InputDecorator(
        isEmpty: valorYmd == null,
        decoration: InputDecoration(
          labelText: label,
          errorText: errorText,
          enabled: enabled,
          suffixIcon: permitirVacio && valorYmd != null && enabled
              ? IconButton(
                  tooltip: 'Quitar fecha',
                  icon: const Icon(Icons.clear),
                  onPressed: () => onChanged(null),
                )
              : const Icon(Icons.calendar_today_outlined, size: 18),
        ),
        child: Text(valorYmd == null ? '' : formatFechaDMY(valorYmd)),
      ),
    );
  }
}

/// Campo de hora: muestra 12 h (`2:00 pm`), entrega `HH:mm`.
class CampoHora extends StatelessWidget {
  const CampoHora({
    super.key,
    required this.label,
    required this.valorHhmm,
    required this.onChanged,
    this.errorText,
  });

  final String label;
  final String? valorHhmm;
  final ValueChanged<String?> onChanged;
  final String? errorText;

  Future<void> _elegir(BuildContext context) async {
    final partes = (valorHhmm ?? '09:00').split(':');
    final elegida = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(
        hour: int.tryParse(partes[0]) ?? 9,
        minute: int.tryParse(partes.length > 1 ? partes[1] : '0') ?? 0,
      ),
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context).copyWith(alwaysUse24HourFormat: false),
        child: child!,
      ),
    );
    if (elegida == null) return;
    onChanged(
      '${elegida.hour.toString().padLeft(2, '0')}:${elegida.minute.toString().padLeft(2, '0')}',
    );
  }

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => _elegir(context),
      borderRadius: BorderRadius.circular(7),
      child: InputDecorator(
        isEmpty: valorHhmm == null,
        decoration: InputDecoration(
          labelText: label,
          errorText: errorText,
          suffixIcon: const Icon(Icons.schedule, size: 18),
        ),
        child: Text(valorHhmm == null ? '' : formatHora12(valorHhmm)),
      ),
    );
  }
}

/// Pares etiqueta/valor del detalle (`<dl>` del web): 2 columnas salvo en
/// pantallas muy angostas.
class KeyValueGrid extends StatelessWidget {
  const KeyValueGrid(this.pares, {super.key, this.columnas});

  final List<(String, Widget)> pares;

  /// Fuerza el número de columnas (por defecto 1 si < 340 px, si no 2).
  final int? columnas;

  @override
  Widget build(BuildContext context) {
    final estiloEtiqueta = TextStyle(
      color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.55),
      fontSize: 10.5,
      fontWeight: FontWeight.w600,
      letterSpacing: 0.5,
    );
    return LayoutBuilder(
      builder: (context, constraints) {
        final cols = columnas ?? (constraints.maxWidth < 340 ? 1 : 2);
        const gap = 16.0;
        final ancho = (constraints.maxWidth - gap * (cols - 1)) / cols;
        return Wrap(
          spacing: gap,
          runSpacing: 14,
          children: [
            for (final (etiqueta, valor) in pares)
              SizedBox(
                width: ancho,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(etiqueta.toUpperCase(), style: estiloEtiqueta),
                    const SizedBox(height: 3),
                    DefaultTextStyle.merge(
                      style: const TextStyle(fontSize: 14),
                      child: valor,
                    ),
                  ],
                ),
              ),
          ],
        );
      },
    );
  }
}

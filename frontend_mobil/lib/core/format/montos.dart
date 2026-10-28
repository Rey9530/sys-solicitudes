import 'package:intl/intl.dart';

final _numero = NumberFormat('#,##0.00', 'en_US');

/// `1250` → `"USD 1,250.00"` (mismo formato que el web).
String formatMonto(num? valor, {String moneda = 'USD'}) {
  if (valor == null) return '—';
  return '$moneda ${_numero.format(valor)}';
}

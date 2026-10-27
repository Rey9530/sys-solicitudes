import '../../core/format/texto.dart';

/// Plaza comercial (`PlazaOutput`). `logoUrl` es una URL pre-firmada que
/// vence a los 15 min (se vuelve a pedir la plaza para renovarla).
class Plaza {
  const Plaza({
    required this.id,
    required this.slug,
    required this.nombreComercial,
    required this.colorPrimario,
    required this.createdAt,
    this.emailContacto,
    this.telefonoContacto,
    this.logoUrl,
  });

  factory Plaza.fromJson(Map<String, dynamic> j) => Plaza(
    id: j['id'] as String,
    slug: j['slug'] as String? ?? '',
    nombreComercial: decodificarHtml(j['nombreComercial'] as String?),
    colorPrimario: j['colorPrimario'] as String? ?? '#2563eb',
    createdAt: j['createdAt'] as String? ?? '',
    emailContacto: j['emailContacto'] as String?,
    telefonoContacto: j['telefonoContacto'] as String?,
    logoUrl: j['logoUrl'] as String?,
  );

  final String id;
  final String slug;
  final String nombreComercial;
  final String colorPrimario;
  final String createdAt;
  final String? emailContacto;
  final String? telefonoContacto;
  final String? logoUrl;
}

/// Roles de staff que puede tener el administrador inicial de una plaza.
const rolesAdminInicial = <(String, String)>[
  ('admin', 'Administrador del sistema'),
  ('supervisor', 'Supervisor'),
  ('ingeniero', 'Ingeniero'),
  ('tecnico', 'Técnico'),
];

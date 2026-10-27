import 'package:flutter/material.dart';

import '../../comun/filtros.dart';
import '../../solicitudes_modelos.dart';
import 'formulario_solicitud.dart';

/// Paso 1 · "Tipo y categoría". Cambiar el tipo vacía categoría y
/// subcategoría; cambiar la categoría vacía la subcategoría. La prioridad la
/// hereda el backend de la subcategoría.
class PasoTipo extends StatelessWidget {
  const PasoTipo({
    super.key,
    required this.form,
    required this.datos,
    required this.onCambio,
  });

  final FormularioSolicitud form;
  final DatosWizard datos;
  final VoidCallback onCambio;

  @override
  Widget build(BuildContext context) {
    // Sin catálogo de tipos (falló la carga) se ofrecen los 4 tipos base.
    final tipos = datos.tipos.isNotEmpty
        ? datos.tipos
        : [
            for (final e in etiquetaTipoSolicitud.entries)
              TipoSolicitudOpcion(codigo: e.key, etiqueta: e.value),
          ];
    final subcategorias =
        datos.categorias
            .where((c) => c.id == form.categoriaId)
            .firstOrNull
            ?.subcategorias ??
        const <SubcategoriaOpcion>[];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        CampoSelect<String>(
          key: const Key('wz-tipo'),
          label: 'Tipo de solicitud *',
          valor: form.tipo,
          opciones: [for (final t in tipos) (t.codigo, t.etiqueta)],
          onChanged: (v) {
            if (v == null || v == form.tipo) return;
            form.cambiarTipo(v);
            onCambio();
          },
        ),
        const SizedBox(height: 14),
        CampoSelect<String>(
          key: const Key('wz-categoria'),
          label: 'Categoría *',
          valor: form.categoriaId,
          opciones: [
            (null, 'Selecciona…'),
            for (final c in datos.categorias) (c.id, c.nombre),
          ],
          onChanged: (v) {
            form.cambiarCategoria(v);
            onCambio();
          },
        ),
        const SizedBox(height: 14),
        CampoSelect<String>(
          key: const Key('wz-subcategoria'),
          label: 'Subcategoría *',
          valor: form.subcategoriaId,
          enabled: form.categoriaId != null,
          opciones: [
            (null, 'Selecciona…'),
            for (final s in subcategorias)
              (s.id, '${s.nombre} (prioridad ${s.prioridad})'),
          ],
          onChanged: (v) {
            form.subcategoriaId = v;
            onCambio();
          },
        ),
      ],
    );
  }
}

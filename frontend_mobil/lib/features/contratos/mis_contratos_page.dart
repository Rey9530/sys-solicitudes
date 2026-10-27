import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/widgets/estados.dart';
import '../../core/widgets/pagina.dart';
import 'catalogo_comun.dart';
import 'contratos_page.dart';
import 'contratos_providers.dart';

/// `/inquilino/contratos` — "Mis contratos" (espejo de
/// `inquilino/contratos/page.tsx`). El backend filtra por el inquilino del
/// token. Sin paginador: los primeros 50, como el web.
class MisContratosPage extends ConsumerWidget {
  const MisContratosPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final datos = ref.watch(misContratosProvider);
    return ContenidoPagina(
      onRefresh: () => recargar(ref, misContratosProvider.future),
      children: [
        EncabezadoPagina(
          titulo: 'Mis contratos',
          subtitulo: datos.value == null
              ? null
              : '${datos.value!.total} contratos asociados a tu cuenta.',
        ),
        AsyncView(
          value: datos,
          onRetry: () => ref.invalidate(misContratosProvider),
          data: (pagina) => TablaContratos(
            contratos: pagina.items,
            rutaBase: '/inquilino/contratos',
            mostrarInquilino: false,
          ),
        ),
      ],
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_providers.dart';
import '../../core/format/fechas.dart';
import '../../core/plaza/plaza_seleccionada.dart';
import '../../core/theme/colores.dart';
import '../../core/widgets/avisos.dart';
import '../../core/widgets/dialogos.dart';
import '../../core/widgets/estados.dart';
import '../../core/widgets/lista_responsive.dart';
import '../../core/widgets/pagina.dart';
import 'nueva_plaza_sheet.dart';
import 'plazas_api.dart';
import 'plazas_modelos.dart';
import 'plazas_providers.dart';

/// `/superadmin/plazas` (home del superadmin): tenants de la plataforma con
/// "Nueva plaza", "Entrar" (impersonar: elige la plaza y abre su dashboard) y
/// "Desactivar". Espeja `components/client/plazas-table.tsx`.
class PlazasPage extends ConsumerStatefulWidget {
  const PlazasPage({super.key});

  @override
  ConsumerState<PlazasPage> createState() => _PlazasPageState();
}

class _PlazasPageState extends ConsumerState<PlazasPage> {
  String? _desactivando;

  void _recargar() {
    ref.invalidate(listaPlazasProvider);
    // El selector de plaza de la barra superior usa su propia lista.
    ref.invalidate(plazasProvider);
  }

  Future<void> _nueva() async {
    if (await mostrarNuevaPlaza(context)) _recargar();
  }

  /// "Entrar": igual que elegirla en el selector (se guarda como `sa_plaza`).
  Future<void> _entrar(Plaza p) async {
    await ref.read(plazaSeleccionadaProvider.notifier).seleccionar(p.id);
    if (mounted) context.go('/admin/dashboard');
  }

  Future<void> _desactivar(Plaza p) async {
    final ok = await confirmar(
      context,
      titulo: '¿Desactivar la plaza "${p.nombreComercial}"?',
      mensaje:
          'Ningún usuario de la plaza podrá iniciar sesión. Los datos y el '
          'historial se conservan.',
      textoConfirmar: 'Sí, desactivar',
      destructiva: true,
    );
    if (!ok || !mounted) return;
    setState(() => _desactivando = p.id);
    try {
      await desactivarPlaza(ref.read(apiClientProvider), p.id);
      // Si era la plaza elegida, se vuelve a la vista global.
      if (ref.read(plazaSeleccionadaProvider) == p.id) {
        await ref.read(plazaSeleccionadaProvider.notifier).seleccionar(null);
      }
      if (!mounted) return;
      mostrarExito(context, 'Plaza desactivada');
      _recargar();
    } on Object catch (e) {
      if (mounted) mostrarError(context, e);
    } finally {
      if (mounted) setState(() => _desactivando = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    return ContenidoPagina(
      onRefresh: () async => _recargar(),
      children: [
        EncabezadoPagina(
          titulo: 'Plazas',
          subtitulo: 'Gestiona los tenants de la plataforma.',
          acciones: [
            FilledButton.icon(
              key: const Key('nueva-plaza'),
              onPressed: _nueva,
              icon: const Icon(Icons.add, size: 18),
              label: const Text('Nueva plaza'),
            ),
          ],
        ),
        AsyncView(
          value: ref.watch(listaPlazasProvider),
          onRetry: () => ref.invalidate(listaPlazasProvider),
          data: (plazas) => ListaResponsive<Plaza>(
            items: plazas,
            vacio: const EmptyState(
              icono: Icons.apartment_outlined,
              titulo: 'Sin plazas',
              mensaje: 'Aún no hay plazas registradas.',
            ),
            columnas: [
              ColumnaLista(
                titulo: 'Plaza',
                principal: true,
                celda: (p) => Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 10,
                      height: 10,
                      decoration: BoxDecoration(
                        color: colorDesdeHex(p.colorPrimario),
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Flexible(child: Text(p.nombreComercial)),
                  ],
                ),
              ),
              ColumnaLista(
                titulo: 'Slug',
                celda: (p) => Text(
                  p.slug,
                  style: TextStyle(
                    fontFamily: 'monospace',
                    fontSize: 12.5,
                    color: c.text3,
                  ),
                ),
              ),
              ColumnaLista(
                titulo: 'Contacto',
                celda: (p) => Text(
                  p.emailContacto ?? '—',
                  style: TextStyle(color: c.text3),
                ),
              ),
              ColumnaLista(
                titulo: 'Creada',
                celda: (p) => Text(
                  formatFecha(p.createdAt),
                  style: TextStyle(color: c.text3),
                ),
              ),
            ],
            acciones: (p) => Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                OutlinedButton(
                  key: Key('entrar-${p.id}'),
                  onPressed: () => _entrar(p),
                  child: const Text('Entrar'),
                ),
                FilledButton(
                  key: Key('desactivar-${p.id}'),
                  style: FilledButton.styleFrom(
                    backgroundColor: Theme.of(context).colorScheme.error,
                  ),
                  onPressed: _desactivando == p.id
                      ? null
                      : () => _desactivar(p),
                  child: Text(
                    _desactivando == p.id ? 'Desactivando…' : 'Desactivar',
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

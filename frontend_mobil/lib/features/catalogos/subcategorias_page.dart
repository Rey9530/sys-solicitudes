import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_error.dart';
import '../../core/api/api_providers.dart';
import '../../core/api/payload.dart';
import '../../core/theme/colores.dart';
import '../../core/widgets/avisos.dart';
import '../../core/widgets/badges.dart';
import '../../core/widgets/can.dart';
import '../../core/widgets/dialogos.dart';
import '../../core/widgets/estados.dart';
import '../../core/widgets/lista_responsive.dart';
import '../../core/widgets/pagina.dart';
import 'catalogos_widgets.dart';
import 'categorias_api.dart';
import 'categorias_modelos.dart';
import 'categorias_providers.dart';

/// `/admin/categorias/:id/subcategorias` — crear, editar, cambiar
/// responsable, gestionar supervisores (máx. 5) y desactivar.
/// Espejo de `categorias/[id]/subcategorias/page.tsx` +
/// `subcategorias-manager.tsx`.
class SubcategoriasPage extends ConsumerStatefulWidget {
  const SubcategoriasPage({super.key, required this.categoriaId});

  final String categoriaId;

  @override
  ConsumerState<SubcategoriasPage> createState() => _SubcategoriasPageState();
}

class _SubcategoriasPageState extends ConsumerState<SubcategoriasPage> {
  String? _desactivando;

  String get _catId => widget.categoriaId;

  /// Tras un cambio: recarga la lista y el detalle de la categoría.
  void _recargar() {
    ref.invalidate(subcategoriasProvider(_catId));
    ref.invalidate(categoriaProvider(_catId));
  }

  Future<void> _abrir(Widget dialogo) async {
    final cambio = await showDialog<bool>(
      context: context,
      builder: (_) => dialogo,
    );
    // `null` = se cerró tocando fuera (los supervisores pudieron cambiar).
    if (cambio != false) _recargar();
  }

  Future<void> _desactivar(Subcategoria s) async {
    final ok = await confirmar(
      context,
      titulo: '¿Desactivar la subcategoría "${s.nombre}"?',
      textoConfirmar: 'Sí, desactivar',
      destructiva: true,
    );
    if (!ok || !mounted) return;
    setState(() => _desactivando = s.id);
    try {
      await desactivarSubcategoria(ref.read(apiClientProvider), _catId, s.id);
      if (!mounted) return;
      mostrarExito(context, 'Subcategoría desactivada');
      _recargar();
    } catch (e) {
      if (mounted) mostrarError(context, e);
    } finally {
      if (mounted) setState(() => _desactivando = null);
    }
  }

  /// [staff] es `null` mientras carga: los diálogos que eligen personas se
  /// abren cuando ya hay opciones (si no, quedarían vacíos).
  Widget _acciones(Subcategoria s, List<PersonaStaff>? staff) {
    return Wrap(
      spacing: 4,
      runSpacing: 4,
      children: [
        Can(
          permiso: 'subcategorias.editar',
          child: TextButton(
            // Editar no elige personas (el responsable tiene su diálogo).
            onPressed: () => _abrir(
              _SubcategoriaFormDialog(
                categoriaId: _catId,
                sub: s,
                staff: staff ?? const [],
              ),
            ),
            child: const Text('Editar'),
          ),
        ),
        Can(
          permiso: 'subcategorias.asignar_responsable',
          child: TextButton(
            onPressed: staff == null
                ? null
                : () => _abrir(
                    _ResponsableDialog(
                      categoriaId: _catId,
                      sub: s,
                      staff: staff,
                    ),
                  ),
            child: const Text('Responsable'),
          ),
        ),
        Can(
          permiso: 'subcategorias.gestionar_supervisores',
          child: TextButton(
            onPressed: staff == null
                ? null
                : () => _abrir(
                    SupervisoresDialog(
                      categoriaId: _catId,
                      sub: s,
                      staff: staff,
                    ),
                  ),
            child: const Text('Supervisores'),
          ),
        ),
        if (s.activo)
          Can(
            permiso: 'subcategorias.deshabilitar',
            child: TextButton(
              style: TextButton.styleFrom(
                foregroundColor: Theme.of(context).colorScheme.error,
              ),
              onPressed: _desactivando == s.id ? null : () => _desactivar(s),
              child: const Text('Desactivar'),
            ),
          ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final categoria = ref.watch(categoriaProvider(_catId));
    final subs = ref.watch(subcategoriasProvider(_catId));
    // `null` mientras carga. Si falla (p. ej. sin `usuarios_plaza.listar`) el
    // provider da una lista vacía: los selectores quedan vacíos, igual que en
    // el web.
    final staff = ref.watch(staffElegibleProvider).value;
    final c = ColoresPlazapp.of(context);

    return AsyncView(
      value: categoria,
      onRetry: () => ref.invalidate(categoriaProvider(_catId)),
      data: (cat) => ContenidoPagina(
        onRefresh: () {
          ref.invalidate(staffElegibleProvider);
          return recargar(ref, subcategoriasProvider(_catId).future);
        },
        children: [
          EncabezadoPagina(
            titulo: 'Subcategorías de ${cat.nombre}',
            subtitulo:
                '${subs.value?.total ?? '…'} subcategoría(s) · cada una con 1 '
                'responsable y hasta $maxSupervisores supervisores.',
            rutaVolver: '/admin/categorias/${cat.id}',
            acciones: [
              Can(
                permiso: 'subcategorias.crear',
                child: FilledButton.icon(
                  onPressed: staff == null
                      ? null
                      : () => _abrir(
                          _SubcategoriaFormDialog(
                            categoriaId: _catId,
                            staff: staff,
                          ),
                        ),
                  icon: const Icon(Icons.add),
                  label: const Text('Nueva subcategoría'),
                ),
              ),
            ],
          ),
          AsyncView(
            value: subs,
            onRetry: () => ref.invalidate(subcategoriasProvider(_catId)),
            data: (p) => ListaResponsive<Subcategoria>(
              items: p.items,
              vacio: Padding(
                padding: const EdgeInsets.all(20),
                child: Text(
                  'No hay subcategorías. Crea la primera.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: c.text3),
                ),
              ),
              columnas: [
                ColumnaLista(
                  titulo: 'Nombre',
                  principal: true,
                  celda: (s) => Text(s.nombre),
                ),
                ColumnaLista(
                  titulo: 'Prioridad',
                  celda: (s) => PrioridadBadge(s.prioridad),
                ),
                ColumnaLista(
                  titulo: 'Responsable',
                  celda: (s) => TextoCelda(s.responsable?.nombre),
                ),
                ColumnaLista(
                  titulo: 'Supervisores',
                  celda: (s) => ContadorSupervisores(s.supervisores.length),
                ),
                ColumnaLista(
                  titulo: 'Estado',
                  celda: (s) => BadgeActivo(s.activo, femenino: true),
                ),
              ],
              acciones: (s) => _acciones(s, staff),
            ),
          ),
        ],
      ),
    );
  }
}

/// Contador `n/5` de supervisores (rojo al llegar al tope).
class ContadorSupervisores extends StatelessWidget {
  const ContadorSupervisores(this.cantidad, {super.key});

  final int cantidad;

  @override
  Widget build(BuildContext context) => BadgePlazapp(
    '$cantidad/$maxSupervisores',
    cantidad >= maxSupervisores ? Tono.danger : Tono.neutral,
    punto: false,
  );
}

/// Selector de un admin de plaza (`Nombre (email)`).
class _SelectorStaff extends StatelessWidget {
  const _SelectorStaff({
    required this.staff,
    required this.valor,
    required this.onChanged,
    this.label,
    this.hint,
    this.errorText,
    this.enabled = true,
  });

  final List<PersonaStaff> staff;
  final String? valor;
  final ValueChanged<String?> onChanged;
  final String? label;
  final String? hint;
  final String? errorText;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    // El valor debe existir entre las opciones (si el responsable actual ya
    // no es elegible, se muestra vacío).
    final valido = staff.any((u) => u.id == valor) ? valor : null;
    return DropdownButtonFormField<String>(
      key: ValueKey('staff-$valido-${staff.length}-$enabled'),
      initialValue: valido,
      isExpanded: true,
      hint: hint == null ? null : Text(hint!),
      decoration: InputDecoration(labelText: label, errorText: errorText),
      items: [
        for (final u in staff)
          DropdownMenuItem(
            value: u.id,
            child: Text(u.etiqueta, overflow: TextOverflow.ellipsis),
          ),
      ],
      onChanged: enabled ? onChanged : null,
    );
  }
}

/// Contenido de diálogo con ancho máximo y scroll (los diálogos del web).
Widget _cuerpoDialogo(List<Widget> children) => SizedBox(
  width: 480,
  child: Column(
    mainAxisSize: MainAxisSize.min,
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: children,
  ),
);

Widget _descripcionDialogo(BuildContext context, String texto) => Padding(
  padding: const EdgeInsets.only(bottom: 12),
  child: Text(texto, style: TextStyle(color: ColoresPlazapp.of(context).text3)),
);

// ── Crear / editar ──────────────────────────────────────────────────────────

class _SubcategoriaFormDialog extends ConsumerStatefulWidget {
  const _SubcategoriaFormDialog({
    required this.categoriaId,
    required this.staff,
    this.sub,
  });

  final String categoriaId;
  final List<PersonaStaff> staff;
  final Subcategoria? sub;

  @override
  ConsumerState<_SubcategoriaFormDialog> createState() =>
      _SubcategoriaFormDialogState();
}

class _SubcategoriaFormDialogState
    extends ConsumerState<_SubcategoriaFormDialog> {
  final _form = GlobalKey<FormState>();
  late final _nombre = TextEditingController(text: widget.sub?.nombre);
  late final _descripcion = TextEditingController(
    text: widget.sub?.descripcion,
  );
  late String _prioridad = widget.sub?.prioridad ?? 'B';
  String? _responsableId;
  String? _errorResponsable;
  ApiError? _error;
  bool _guardando = false;

  @override
  void dispose() {
    _nombre.dispose();
    _descripcion.dispose();
    super.dispose();
  }

  Future<void> _guardar() async {
    final valido = _form.currentState!.validate();
    final sub = widget.sub;
    setState(
      () => _errorResponsable = sub == null && _responsableId == null
          ? 'Selecciona un responsable.'
          : null,
    );
    if (!valido || _errorResponsable != null) return;
    setState(() {
      _guardando = true;
      _error = null;
    });
    final api = ref.read(apiClientProvider);
    try {
      if (sub == null) {
        await crearSubcategoria(
          api,
          widget.categoriaId,
          nombre: _nombre.text.trim(),
          descripcion: textoOpcional(_descripcion.text),
          prioridad: _prioridad,
          responsableId: _responsableId!,
        );
      } else {
        await actualizarSubcategoria(
          api,
          widget.categoriaId,
          sub.id,
          nombre: _nombre.text.trim(),
          descripcion: textoOpcional(_descripcion.text),
          prioridad: _prioridad,
        );
      }
      if (!mounted) return;
      mostrarExito(
        context,
        sub == null ? 'Subcategoría creada' : 'Subcategoría actualizada',
      );
      Navigator.of(context).pop(true);
    } on ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        _guardando = false;
        if (e.code == 'RESPONSABLE_INVALIDO') {
          _errorResponsable = e.mensaje;
        } else {
          _error = e;
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final sub = widget.sub;
    return AlertDialog(
      scrollable: true,
      title: Text(sub == null ? 'Nueva subcategoría' : 'Editar ${sub.nombre}'),
      content: Form(
        key: _form,
        child: _cuerpoDialogo([
          _descripcionDialogo(
            context,
            'La prioridad se hereda a las solicitudes nuevas (S-FS-Prioridad).',
          ),
          if (_error != null) ...[
            AvisoBanner(tono: Tono.danger, child: Text(_error!.mensaje)),
            const SizedBox(height: 12),
          ],
          TextFormField(
            key: const Key('sub-nombre'),
            controller: _nombre,
            maxLength: 80,
            decoration: const InputDecoration(labelText: 'Nombre *'),
            validator: (v) =>
                (v ?? '').trim().isEmpty ? 'Este campo es obligatorio.' : null,
          ),
          const SizedBox(height: 4),
          TextFormField(
            controller: _descripcion,
            minLines: 2,
            maxLines: 4,
            maxLength: 500,
            decoration: const InputDecoration(labelText: 'Descripción'),
          ),
          const SizedBox(height: 4),
          DropdownButtonFormField<String>(
            initialValue: _prioridad,
            decoration: const InputDecoration(
              labelText: 'Prioridad por defecto',
            ),
            items: [
              for (final p in prioridadesSubcategoria)
                DropdownMenuItem(value: p, child: Text(p)),
            ],
            onChanged: (v) => setState(() => _prioridad = v ?? _prioridad),
          ),
          if (sub == null) ...[
            const SizedBox(height: 12),
            _SelectorStaff(
              staff: widget.staff,
              valor: _responsableId,
              label: 'Responsable *',
              hint: 'Selecciona…',
              errorText: _errorResponsable,
              onChanged: (v) => setState(() {
                _responsableId = v;
                _errorResponsable = null;
              }),
            ),
          ],
        ]),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          key: const Key('sub-guardar'),
          onPressed: _guardando ? null : _guardar,
          child: Text(_guardando ? 'Guardando…' : 'Guardar'),
        ),
      ],
    );
  }
}

// ── Responsable ─────────────────────────────────────────────────────────────

class _ResponsableDialog extends ConsumerStatefulWidget {
  const _ResponsableDialog({
    required this.categoriaId,
    required this.sub,
    required this.staff,
  });

  final String categoriaId;
  final Subcategoria sub;
  final List<PersonaStaff> staff;

  @override
  ConsumerState<_ResponsableDialog> createState() => _ResponsableDialogState();
}

class _ResponsableDialogState extends ConsumerState<_ResponsableDialog> {
  late String? _responsableId = widget.sub.responsableId;
  ApiError? _error;
  bool _guardando = false;

  Future<void> _guardar() async {
    setState(() {
      _guardando = true;
      _error = null;
    });
    try {
      await cambiarResponsable(
        ref.read(apiClientProvider),
        widget.categoriaId,
        widget.sub.id,
        _responsableId!,
      );
      if (!mounted) return;
      mostrarExito(context, 'Responsable actualizado');
      Navigator.of(context).pop(true);
    } on ApiError catch (e) {
      if (mounted) {
        setState(() {
          _guardando = false;
          _error = e;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final sinCambio =
        _responsableId == null || _responsableId == widget.sub.responsableId;
    return AlertDialog(
      scrollable: true,
      title: Text('Responsable de ${widget.sub.nombre}'),
      content: _cuerpoDialogo([
        _descripcionDialogo(
          context,
          'Debe ser un admin de plaza con rol de staff activo (SC-6).',
        ),
        if (_error != null) ...[
          AvisoBanner(tono: Tono.danger, child: Text(_error!.mensaje)),
          const SizedBox(height: 12),
        ],
        _SelectorStaff(
          staff: widget.staff,
          valor: _responsableId,
          hint: 'Selecciona…',
          onChanged: (v) => setState(() => _responsableId = v),
        ),
      ]),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: const Text('Cancelar'),
        ),
        FilledButton(
          onPressed: _guardando || sinCambio ? null : _guardar,
          child: Text(_guardando ? 'Guardando…' : 'Cambiar responsable'),
        ),
      ],
    );
  }
}

// ── Supervisores ────────────────────────────────────────────────────────────

/// Diálogo de supervisores (máx. 5). A diferencia del web (B2-R14), la lista
/// se actualiza con la respuesta del backend tras agregar o quitar.
class SupervisoresDialog extends ConsumerStatefulWidget {
  const SupervisoresDialog({
    super.key,
    required this.categoriaId,
    required this.sub,
    required this.staff,
  });

  final String categoriaId;
  final Subcategoria sub;
  final List<PersonaStaff> staff;

  @override
  ConsumerState<SupervisoresDialog> createState() => _SupervisoresDialogState();
}

class _SupervisoresDialogState extends ConsumerState<SupervisoresDialog> {
  late Subcategoria _sub = widget.sub;
  String? _seleccion;
  bool _pendiente = false;
  bool _cambio = false;

  Future<void> _ejecutar(
    Future<Subcategoria> Function() accion,
    String exito,
  ) async {
    setState(() => _pendiente = true);
    try {
      final actualizada = await accion();
      if (!mounted) return;
      setState(() {
        _sub = actualizada;
        _seleccion = null;
        _cambio = true;
      });
      mostrarExito(context, exito);
    } catch (e) {
      if (mounted) mostrarError(context, e);
    } finally {
      if (mounted) setState(() => _pendiente = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final api = ref.read(apiClientProvider);
    final c = ColoresPlazapp.of(context);
    final alLimite = _sub.supervisores.length >= maxSupervisores;
    final disponibles = widget.staff
        .where((u) => !_sub.supervisores.any((s) => s.id == u.id))
        .toList();
    final bloqueado = alLimite || disponibles.isEmpty;

    return AlertDialog(
      scrollable: true,
      title: Wrap(
        spacing: 8,
        runSpacing: 4,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          Text('Supervisores de ${_sub.nombre}'),
          ContadorSupervisores(_sub.supervisores.length),
        ],
      ),
      content: _cuerpoDialogo([
        _descripcionDialogo(
          context,
          'Reciben notificación de cada solicitud nueva de la subcategoría.',
        ),
        if (_sub.supervisores.isEmpty)
          Text('Sin supervisores.', style: TextStyle(color: c.text3))
        else
          for (final s in _sub.supervisores)
            Row(
              children: [
                Expanded(
                  child: Text(
                    s.etiqueta,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                TextButton(
                  style: TextButton.styleFrom(
                    foregroundColor: Theme.of(context).colorScheme.error,
                  ),
                  onPressed: _pendiente
                      ? null
                      : () => _ejecutar(
                          () => quitarSupervisor(
                            api,
                            widget.categoriaId,
                            _sub.id,
                            s.id,
                          ),
                          'Supervisor quitado',
                        ),
                  child: const Text('Quitar'),
                ),
              ],
            ),
        const SizedBox(height: 12),
        _SelectorStaff(
          staff: bloqueado ? const [] : disponibles,
          valor: _seleccion,
          enabled: !bloqueado,
          hint: alLimite ? 'Límite de 5 alcanzado' : 'Agregar supervisor…',
          onChanged: (v) => setState(() => _seleccion = v),
        ),
        const SizedBox(height: 8),
        Align(
          alignment: Alignment.centerRight,
          child: FilledButton(
            key: const Key('supervisor-agregar'),
            onPressed: _pendiente || _seleccion == null || alLimite
                ? null
                : () => _ejecutar(
                    () => agregarSupervisor(
                      api,
                      widget.categoriaId,
                      _sub.id,
                      _seleccion!,
                    ),
                    'Supervisor agregado',
                  ),
            child: const Text('Agregar'),
          ),
        ),
      ]),
      actions: [
        OutlinedButton(
          onPressed: () => Navigator.of(context).pop(_cambio),
          child: const Text('Cerrar'),
        ),
      ],
    );
  }
}

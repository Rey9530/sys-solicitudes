import 'package:flutter/material.dart';

import '../theme/colores.dart';

/// Una pestaña de [Pestanas]. [contenido] se construye solo cuando la
/// pestaña está activa; [contador] es el número junto a la etiqueta (como el
/// `count` de `Tabs` del web).
class Pestana {
  const Pestana(this.etiqueta, this.contenido, {this.contador});

  final String etiqueta;
  final Widget Function() contenido;
  final int? contador;
}

/// Pestañas que pintan solo el contenido de la activa, dentro del scroll de la
/// página (sin altura fija, a diferencia de `TabBarView`). Si cambia la
/// cantidad de pestañas (p. ej. por permisos) se conserva la elegida.
class Pestanas extends StatefulWidget {
  const Pestanas({super.key, required this.pestanas});

  final List<Pestana> pestanas;

  @override
  State<Pestanas> createState() => _PestanasState();
}

class _PestanasState extends State<Pestanas> with TickerProviderStateMixin {
  late TabController _control = _crear(0);

  TabController _crear(int indice) => TabController(
    length: widget.pestanas.length,
    initialIndex: indice.clamp(0, widget.pestanas.length - 1),
    vsync: this,
  )..addListener(() => setState(() {}));

  @override
  void didUpdateWidget(Pestanas oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.pestanas.length != widget.pestanas.length) {
      final indice = _control.index;
      _control.dispose();
      _control = _crear(indice);
    }
  }

  @override
  void dispose() {
    _control.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TabBar(
          controller: _control,
          isScrollable: true,
          tabAlignment: TabAlignment.start,
          tabs: [
            for (final p in widget.pestanas)
              p.contador == null
                  ? Tab(text: p.etiqueta)
                  : Tab(
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(p.etiqueta),
                          const SizedBox(width: 6),
                          _Contador(p.contador!),
                        ],
                      ),
                    ),
          ],
        ),
        const SizedBox(height: 14),
        widget.pestanas[_control.index].contenido(),
      ],
    );
  }
}

class _Contador extends StatelessWidget {
  const _Contador(this.valor);

  final int valor;

  @override
  Widget build(BuildContext context) {
    final c = ColoresPlazapp.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 1),
      decoration: BoxDecoration(
        color: c.surface3,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text('$valor', style: TextStyle(fontSize: 11.5, color: c.text2)),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/widgets/pagina.dart';
import '../contratos/catalogo_comun.dart';
import 'inquilinos_modelos.dart';

/// Campos del formulario de inquilino compartidos por el alta y la edición
/// (espejo de `nuevo-inquilino-form.tsx` y `editar-inquilino-form.tsx`).

enum TipoCampoInquilino { texto, email, telefono, multilinea }

/// Un campo de texto: clave de la API, etiqueta y largo máximo
/// (`CreateInquilinoSchema`).
class CampoInquilino {
  const CampoInquilino(
    this.clave,
    this.etiqueta,
    this.maximo, {
    this.tipo = TipoCampoInquilino.texto,
  });

  final String clave;
  final String etiqueta;
  final int maximo;
  final TipoCampoInquilino tipo;
}

const campoRazonSocial = CampoInquilino('razonSocial', 'Razón social *', 160);
const campoNombreComercial = CampoInquilino(
  'nombreComercial',
  'Nombre comercial',
  160,
);
const campoIdentificacion = CampoInquilino(
  'identificacion',
  'Identificación (NIT)',
  40,
);
const campoNrc = CampoInquilino('numeroNrc', 'Número de NRC', 40);
const campoRepresentante = CampoInquilino(
  'representanteLegal',
  'Representante legal',
  160,
);

const _canales = [
  CampoInquilino(
    'numeroTelefono',
    'Número de teléfono',
    40,
    tipo: TipoCampoInquilino.telefono,
  ),
  CampoInquilino(
    'correoRecepcionDte',
    'Correo de recepción DTE',
    160,
    tipo: TipoCampoInquilino.email,
  ),
];

List<CampoInquilino> _contacto(int n) => [
  CampoInquilino('contacto${n}Nombre', 'Nombre', 120),
  CampoInquilino('contacto${n}Cargo', 'Cargo', 80),
  CampoInquilino(
    'contacto${n}Email',
    'Email',
    160,
    tipo: TipoCampoInquilino.email,
  ),
  CampoInquilino(
    'contacto${n}Telefono',
    'Teléfono',
    40,
    tipo: TipoCampoInquilino.telefono,
  ),
];

/// Controladores de todos los campos de texto (incluye razón social e
/// identificación), con los valores iniciales de [inquilino].
Map<String, TextEditingController> controladoresInquilino([
  Inquilino? inquilino,
]) => {
  'razonSocial': TextEditingController(text: inquilino?.razonSocial),
  'identificacion': TextEditingController(text: inquilino?.identificacion),
  for (final k in camposTextoInquilino)
    k: TextEditingController(text: inquilino?.campos[k]),
};

/// Valores actuales de los controladores.
Map<String, String> valoresDe(Map<String, TextEditingController> c) => {
  for (final MapEntry(:key, :value) in c.entries) key: value.text,
};

/// Un campo de texto del inquilino.
class CampoTextoInquilino extends StatelessWidget {
  const CampoTextoInquilino({
    super.key,
    required this.campo,
    required this.controlador,
    this.enabled = true,
    this.errorText,
  });

  final CampoInquilino campo;
  final TextEditingController controlador;
  final bool enabled;

  /// Error del backend asociado al campo (p. ej. identificación duplicada).
  final String? errorText;

  @override
  Widget build(BuildContext context) {
    final multilinea = campo.tipo == TipoCampoInquilino.multilinea;
    return TextFormField(
      key: Key('inquilino-${campo.clave}'),
      controller: controlador,
      enabled: enabled,
      minLines: multilinea ? 2 : 1,
      maxLines: multilinea ? 5 : 1,
      keyboardType: switch (campo.tipo) {
        TipoCampoInquilino.email => TextInputType.emailAddress,
        TipoCampoInquilino.telefono => TextInputType.phone,
        TipoCampoInquilino.multilinea => TextInputType.multiline,
        TipoCampoInquilino.texto => TextInputType.text,
      },
      inputFormatters: [LengthLimitingTextInputFormatter(campo.maximo)],
      validator: switch (campo.tipo) {
        TipoCampoInquilino.email => validarEmailOpcional,
        _ when campo.clave == 'razonSocial' => (
          v,
        ) => (v ?? '').trim().isEmpty ? 'Requerido' : null,
        _ => null,
      },
      decoration: InputDecoration(
        labelText: campo.etiqueta,
        errorText: errorText,
      ),
    );
  }
}

/// Campos de dos en dos (una columna en teléfono).
class ParesDeCampos extends StatelessWidget {
  const ParesDeCampos({
    super.key,
    required this.campos,
    required this.controladores,
  });

  final List<CampoInquilino> campos;
  final Map<String, TextEditingController> controladores;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < campos.length; i += 2)
          FilaCampos(
            children: [
              for (final campo in campos.skip(i).take(2))
                CampoTextoInquilino(
                  campo: campo,
                  controlador: controladores[campo.clave]!,
                ),
            ],
          ),
      ],
    );
  }
}

/// Secciones comunes al alta y la edición: canales, contactos,
/// clasificación y otros.
class SeccionesInquilino extends StatelessWidget {
  const SeccionesInquilino({
    super.key,
    required this.controladores,
    required this.tipoCliente,
    required this.onTipoCliente,
  });

  final Map<String, TextEditingController> controladores;
  final String? tipoCliente;
  final ValueChanged<String?> onTipoCliente;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Seccion(
          titulo: 'Canales del inquilino',
          child: ParesDeCampos(campos: _canales, controladores: controladores),
        ),
        Seccion(
          titulo: 'Contacto 1',
          child: ParesDeCampos(
            campos: _contacto(1),
            controladores: controladores,
          ),
        ),
        Seccion(
          titulo: 'Contacto 2 (opcional)',
          child: ParesDeCampos(
            campos: _contacto(2),
            controladores: controladores,
          ),
        ),
        Seccion(
          titulo: 'Clasificación',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              FilaCampos(
                children: [
                  CampoSeleccion<String>(
                    key: const Key('inquilino-tipoCliente'),
                    etiqueta: 'Tipo de cliente',
                    valor: tipoCliente,
                    opciones: const [
                      (null, '— Sin clasificar —'),
                      ...tiposCliente,
                    ],
                    onChanged: onTipoCliente,
                  ),
                  CampoTextoInquilino(
                    campo: const CampoInquilino(
                      'giroAutorizado',
                      'Giro autorizado',
                      160,
                    ),
                    controlador: controladores['giroAutorizado']!,
                  ),
                ],
              ),
              ParesDeCampos(
                campos: const [
                  CampoInquilino('categoria', 'Categoría', 120),
                  CampoInquilino('subcategoria', 'Subcategoría', 120),
                ],
                controladores: controladores,
              ),
            ],
          ),
        ),
        Seccion(
          titulo: 'Otros',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              CampoTextoInquilino(
                campo: const CampoInquilino(
                  'direccion',
                  'Dirección',
                  300,
                  tipo: TipoCampoInquilino.multilinea,
                ),
                controlador: controladores['direccion']!,
              ),
              const SizedBox(height: 12),
              CampoTextoInquilino(
                campo: const CampoInquilino(
                  'comentarios',
                  'Comentarios',
                  2000,
                  tipo: TipoCampoInquilino.multilinea,
                ),
                controlador: controladores['comentarios']!,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

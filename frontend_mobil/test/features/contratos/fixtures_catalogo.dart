/// Fixtures de locales, inquilinos y contratos con la forma real del backend
/// (capturada de `GET /locales`, `/inquilinos`, `/contratos`, …) y textos
/// largos para el barrido responsive.
library;

const razonLarga =
    'Comercializadora Internacional de Productos y Servicios Electrónicos '
    'del Pacífico Centroamericano &amp; Asociados, S.A. de C.V.';
const razonLargaDecodificada =
    'Comercializadora Internacional de Productos y Servicios Electrónicos '
    'del Pacífico Centroamericano & Asociados, S.A. de C.V.';
const codigoLargo = 'K-29-ISLA-1234AB';
const plazaId = '1531e155-8ab5-466c-aff9-70e96d2135a5';

Map<String, Object?> paginado(
  List<Map<String, Object?>> items, {
  int? total,
  int page = 1,
  int totalPages = 1,
}) => {
  'items': items,
  'total': total ?? items.length,
  'page': page,
  'pageSize': 20,
  'totalPages': totalPages,
};

Map<String, Object?> localJson({
  String id = 'loc-1',
  String codigo = codigoLargo,
  String? modulo = 'NORTE-PONIENTE',
  String estado = 'disponible',
}) => {
  'id': id,
  'plazaId': plazaId,
  'codigo': codigo,
  'modulo': modulo,
  'nivel': '2',
  'areaM2': 93.37,
  'medidorEnergia': '96700456-12345',
  'medidorAgua': '18-622259-1',
  'estado': estado,
  'createdAt': '2026-09-16T20:00:47.289Z',
  'updatedAt': '2026-09-16T20:00:47.289Z',
  'deletedAt': null,
};

Map<String, Object?> contratoJson({
  String id = 'con-1',
  String estado = 'vigente',
  String localId = 'loc-1',
  String inquilinoId = 'inq-1',
  String? fechaFin = '2027-07-28',
  bool t7 = false,
  bool t30 = false,
}) => {
  'id': id,
  'plazaId': plazaId,
  'localId': localId,
  'inquilinoId': inquilinoId,
  'fechaInicio': '2026-07-01',
  'fechaFin': fechaFin,
  'montoMensual': 1250,
  'moneda': 'USD',
  'condiciones': 'Contrato demo generado por seed (solo dev). $razonLarga',
  'estado': estado,
  'fechaFinEfectiva': estado == 'vigente' ? null : '2026-10-01',
  'motivoFin': estado == 'vigente' ? null : 'renovado',
  'plazoMeses': 12,
  'areaMt2MedicionReal': 50,
  'cuotaArrendamiento': 20,
  'cuotaCam': 4.5,
  'depositoGarantia': 2500,
  'fechaPagoDeposito': '2026-06-15',
  'fechaEntregaLocal': '2026-06-20',
  'periodoGraciaDias': 30,
  'inicioOperaciones': '2026-07-15',
  'avisoTerminacion': '2027-05-28',
  'condicionesIncrementoCanon': 'Incremento anual según IPC',
  'createdAt': '2026-08-11T17:44:59.831Z',
  'updatedAt': '2026-08-11T17:44:59.831Z',
  'localCodigo': codigoLargo,
  'inquilinoRazonSocial': razonLarga,
  'enVentanaT30': t30,
  'enVentanaT7': t7,
};

Map<String, Object?> localDetalleJson({bool conVigente = true}) => {
  ...localJson(estado: conVigente ? 'alquilado' : 'en_mantenimiento'),
  'contratoVigente': conVigente ? contratoJson() : null,
  'historicoContratos': [
    if (conVigente) contratoJson(),
    contratoJson(id: 'con-0', estado: 'finalizado', fechaFin: null),
  ],
};

Map<String, Object?> inquilinoJson({
  String id = 'inq-1',
  String razonSocial = razonLarga,
}) => {
  'id': id,
  'plazaId': plazaId,
  'razonSocial': razonSocial,
  'identificacion': '0614-050101-001-1',
  'nombreComercial': 'BANCO MUNICIPAL DE COMERCIO Y DESARROLLO REGIONAL',
  'representanteLegal': 'José Luis Méndez Hernández',
  'numeroNrc': null,
  'correoRecepcionDte': 'dte@ejemplo.com',
  'numeroTelefono': null,
  'direccion': 'San Salvador, El Salvador',
  'contacto1Nombre': 'María Pérez',
  'contacto1Cargo': null,
  'contacto1Email': 'maria@ejemplo.com',
  'contacto1Telefono': '+503 7000-0001',
  'contacto2Nombre': null,
  'contacto2Cargo': null,
  'contacto2Email': null,
  'contacto2Telefono': null,
  'tipoCliente': 'grande',
  'giroAutorizado': 'Banco',
  'categoria': 'SERVICIOS',
  'subcategoria': 'BANCO',
  'comentarios': 'Importado del formato Excel (Hoja 2).',
  'createdAt': '2026-09-16T20:00:47.289Z',
  'updatedAt': '2026-09-16T20:00:47.289Z',
  'deletedAt': null,
};

Map<String, Object?> inquilinoDetalleJson({bool conVigente = true}) => {
  ...inquilinoJson(),
  'contratosVigentes': [if (conVigente) contratoJson()],
  'historicoContratos': [
    if (conVigente) contratoJson(),
    contratoJson(id: 'con-0', estado: 'cancelado', localId: 'loc-2'),
  ],
};

Map<String, Object?> usuarioJson({
  String id = 'usr-1',
  bool activo = true,
  bool emailInvalido = false,
}) => {
  'id': id,
  'email': 'usuario.con.un.correo.bastante.largo@tiendasolcentroamerica.com',
  'nombre': 'María Fernanda de los Ángeles Pérez Rodríguez',
  'telefono': null,
  'rol': 'inquilino',
  'rolStaffId': null,
  'inquilinoId': 'inq-1',
  'plazaId': plazaId,
  'emailInvalido': emailInvalido,
  'lastLoginAt': activo ? '2026-10-27T20:31:59.136Z' : null,
  'createdAt': '2026-08-11T17:45:00.054Z',
  'deletedAt': activo ? null : '2026-10-01T10:00:00.000Z',
  'rolStaffActivo': null,
  'rolStaffNombre': null,
};

Map<String, Object?> solicitudJson({
  String id = 'sol-1',
  String inquilinoId = 'inq-1',
  String createdAt = '2026-10-27T19:49:03.659Z',
}) => {
  'id': id,
  'plazaId': plazaId,
  'localId': 'loc-1',
  'inquilinoId': inquilinoId,
  'usuarioCreadorId': 'usr-1',
  'codigo': 'SOL-carga-qa-1234',
  'tipo': 'remodelacion',
  'prioridad': 'B',
  'titulo':
      'Remodelación integral del local con cambio de piso, cielo falso, '
      'iluminación y fachada; incluye trabajos nocturnos y retiro de ripio',
  'descripcion': 'x',
  'estado': 'requerida_subsanacion',
  'camposExtra': <String, Object?>{},
  'empresaNombre': '',
  'empresaResponsable': '',
  'empresaTelefono': '',
  'empresaEmail': '',
  'emergenciaContacto': '',
  'emergenciaTelefono': '',
  'esEmergencia': false,
  'createdAt': createdAt,
  'updatedAt': createdAt,
  'localCodigo': codigoLargo,
};

/// `CargaInicialResultado` (forma de `packages/contracts/src/importacion`).
Map<String, Object?> resultadoCargaJson({String modo = 'analisis'}) => {
  'modo': modo,
  'archivo': 'carga-inicial-plaza-norte-octubre-2026-version-final.xlsx',
  'hoja': 'INFORMACION A LLENAR',
  'columnasFaltantes': ['MEDIDOR AGUA', 'TOTAL CAM'],
  'filasEjemplo': [3, 4, 5],
  'totales': {
    'filas': 3,
    'filasOk': 1,
    'filasConAdvertencia': 1,
    'filasConError': 1,
    'locales': {'crear': 2, 'existentes': 1},
    'inquilinos': {'crear': 1, 'existentes': 0},
    'contratos': {'crear': 1, 'existentes': 0, 'omitidos': 1},
  },
  'filas': [
    {
      'fila': 6,
      'local': {'accion': 'crear', 'filaOrigen': null, 'codigo': codigoLargo},
      'inquilino': {
        'accion': 'crear',
        'filaOrigen': null,
        'razonSocial': razonLarga,
      },
      'contrato': {
        'accion': 'crear',
        'fechaInicio': '2026-07-01',
        'montoMensual': 1225,
      },
      'estado': 'ok',
      'mensajes': [
        {'nivel': 'info', 'texto': 'El contrato ya venció: se crea vigente.'},
      ],
    },
    {
      'fila': 7,
      'local': {'accion': 'crear', 'filaOrigen': null, 'codigo': 'K-30'},
      'inquilino': {
        'accion': 'repetido',
        'filaOrigen': 6,
        'razonSocial': razonLarga,
      },
      'contrato': {
        'accion': 'omitido',
        'fechaInicio': null,
        'montoMensual': null,
      },
      'estado': 'advertencia',
      'mensajes': [
        {
          'nivel': 'advertencia',
          'texto':
              'Sin FECHA INICIO DE CONTRATO: no se crea el contrato de esta '
              'fila. Revisa la columna y vuelve a importar el archivo.',
        },
        {
          'nivel': 'advertencia',
          'texto': 'CORREO CONTACTO inválido: se descarta.',
        },
      ],
    },
    {
      'fila': 8,
      'local': {'accion': 'existente', 'filaOrigen': null, 'codigo': 'K-1'},
      'inquilino': null,
      'contrato': null,
      'estado': 'error',
      'mensajes': [
        {
          'nivel': 'advertencia',
          'texto': 'Falta RAZON SOCIAL y NOMBRE COMERCIAL.',
        },
      ],
    },
  ],
};

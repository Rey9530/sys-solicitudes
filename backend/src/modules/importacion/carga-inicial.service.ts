import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import type {
  Prisma,
  contrato as ContratoModel,
  inquilino as InquilinoModel,
  local as LocalModel,
  local_estado as LocalEstado,
} from '@prisma/client';
import type { ZodType } from 'zod';
import {
  CARGA_INICIAL_COLUMNAS,
  CreateContratoSchema,
  CreateInquilinoSchema,
  CreateLocalSchema,
  type CargaInicialAccion,
  type CargaInicialCampo,
  type CargaInicialFila,
  type CargaInicialFilaEstado,
  type CargaInicialMensaje,
  type CargaInicialResultado,
  type CargaInicialTotales,
  type CreateContratoInput,
  type CreateInquilinoInput,
  type CreateLocalInput,
} from '@app/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { contratoToOutput } from '../contratos/contrato.mapper';
import { localToOutput } from '../locales/local.mapper';
import { inquilinoToOutput } from '../inquilinos/inquilino.mapper';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import {
  esCeldaVacia,
  leerExcelCargaInicial,
  leerFecha,
  leerNumero,
  leerTexto,
  type ArchivoExcel,
  type ExcelLeido,
  type FilaCruda,
} from './carga-inicial.parser';

export interface RequestMeta {
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

/** Placeholder para validar el contrato con `CreateContratoSchema` antes de tener ids. */
const UUID_PROVISIONAL = '00000000-0000-0000-0000-000000000000';
/** La ejecución crea cientos de filas en una sola transacción (default de Prisma: 5 s). */
const TX_OPTIONS = { timeout: 60_000, maxWait: 10_000 };

const ENCABEZADOS = Object.fromEntries(
  CARGA_INICIAL_COLUMNAS.map((c) => [c.campo, c.encabezado]),
) as Record<CargaInicialCampo, string>;

/** Clave del schema Zod → columna del Excel (para los mensajes). */
const ETIQUETAS_LOCAL: Record<keyof CreateLocalInput, string> = {
  codigo: ENCABEZADOS.local,
  modulo: ENCABEZADOS.modulo,
  nivel: ENCABEZADOS.nivel,
  areaM2: ENCABEZADOS.area,
  medidorEnergia: ENCABEZADOS.medidorEnergia,
  medidorAgua: ENCABEZADOS.medidorAgua,
};

const ETIQUETAS_INQUILINO: Partial<Record<keyof CreateInquilinoInput, string>> = {
  razonSocial: ENCABEZADOS.razonSocial,
  identificacion: ENCABEZADOS.nit,
  nombreComercial: ENCABEZADOS.nombreComercial,
  representanteLegal: ENCABEZADOS.representanteLegal,
  numeroNrc: ENCABEZADOS.nrc,
  correoRecepcionDte: ENCABEZADOS.correoDte,
  numeroTelefono: ENCABEZADOS.telefono,
  contacto1Nombre: ENCABEZADOS.contacto1Nombre,
  contacto1Cargo: `${ENCABEZADOS.contacto1Cargo} (contacto 1)`,
  contacto1Email: ENCABEZADOS.contacto1Email,
  contacto1Telefono: ENCABEZADOS.contacto1Telefono,
  contacto2Nombre: ENCABEZADOS.contacto2Nombre,
  contacto2Cargo: `${ENCABEZADOS.contacto2Cargo} (contacto 2)`,
  contacto2Email: ENCABEZADOS.contacto2Email,
  contacto2Telefono: ENCABEZADOS.contacto2Telefono,
  tipoCliente: ENCABEZADOS.tipoCliente,
  giroAutorizado: ENCABEZADOS.giroAutorizado,
  categoria: ENCABEZADOS.categoria,
  subcategoria: ENCABEZADOS.subcategoria,
};

const ETIQUETAS_CONTRATO: Partial<Record<keyof CreateContratoInput, string>> = {
  fechaInicio: ENCABEZADOS.fechaInicio,
  fechaFin: ENCABEZADOS.fechaFin,
  montoMensual: ENCABEZADOS.total,
  condiciones: ENCABEZADOS.comentarios,
  plazoMeses: ENCABEZADOS.plazoAnios,
  areaMt2MedicionReal: ENCABEZADOS.areaReal,
  cuotaArrendamiento: ENCABEZADOS.cuotaArrendamiento,
  cuotaCam: ENCABEZADOS.cuotaCam,
  depositoGarantia: ENCABEZADOS.deposito,
  fechaPagoDeposito: ENCABEZADOS.fechaPagoDeposito,
  fechaEntregaLocal: ENCABEZADOS.fechaEntregaLocal,
  periodoGraciaDias: ENCABEZADOS.periodoGracia,
  inicioOperaciones: ENCABEZADOS.inicioOperaciones,
  avisoTerminacion: ENCABEZADOS.avisoTerminacion,
  condicionesIncrementoCanon: ENCABEZADOS.condicionesIncremento,
};

/** Columnas cuyo contenido indica que la fila trae un contrato (COMENTARIOS no cuenta). */
const CAMPOS_CONTRATO = CARGA_INICIAL_COLUMNAS.filter(
  (c) => c.grupo === 'contrato' && c.campo !== 'comentarios',
).map((c) => c.campo);

const ESTADO_LOCAL_TEXTO: Partial<Record<LocalEstado, string>> = {
  en_mantenimiento: 'en mantenimiento',
  fuera_de_servicio: 'fuera de servicio',
};

// ─────────────────────────────────────────────────────────────────────────────
// Tipos internos del plan

type ContratoDatos = CreateContratoInput;

/** Lo que se pudo leer de una fila, antes de compararlo con la BD. */
interface Borrador {
  fila: number;
  mensajes: CargaInicialMensaje[];
  local: CreateLocalInput | null;
  inquilino: { datos: CreateInquilinoInput; claveNit: string | null; claveRazon: string } | null;
  /** `null` = la fila no trae contrato. */
  contrato: {
    datos: ContratoDatos | null;
    fechaInicio: string | null;
    montoMensual: number | null;
  } | null;
  comentarios: string | null;
}

interface InquilinoNuevo {
  filaOrigen: number;
  datos: CreateInquilinoInput;
  nombresComerciales: string[];
  comentarios: string[];
  id: string | null;
}

type RefInquilino =
  | { tipo: 'existente'; id: string }
  | { tipo: 'eliminado' }
  | { tipo: 'nuevo'; nuevo: InquilinoNuevo };

interface FilaPlan {
  fila: number;
  mensajes: CargaInicialMensaje[];
  local: {
    codigo: string;
    accion: CargaInicialAccion;
    filaOrigen: number | null;
    id: string | null;
    datos: CreateLocalInput | null;
  } | null;
  inquilino: {
    razonSocial: string;
    accion: CargaInicialAccion;
    filaOrigen: number | null;
    ref: RefInquilino | null;
  } | null;
  contrato: {
    accion: CargaInicialAccion;
    fechaInicio: string | null;
    montoMensual: number | null;
    datos: ContratoDatos | null;
  } | null;
}

interface Plan {
  filas: FilaPlan[];
  inquilinosNuevos: InquilinoNuevo[];
}

interface Creados {
  locales: LocalModel[];
  inquilinos: InquilinoModel[];
  contratos: ContratoModel[];
}

const adv = (texto: string): CargaInicialMensaje => ({ nivel: 'advertencia', texto });
const info = (texto: string): CargaInicialMensaje => ({ nivel: 'info', texto });

/**
 * Carga inicial desde Excel (PLANIFICACION/18): crea locales, inquilinos y
 * contratos de una plantilla en un solo paso.
 *
 * - `analizar` arma el plan por fila sin escribir nada.
 * - `ejecutar` vuelve a armar el plan (stateless: el navegador reenvía el
 *   archivo) y crea todo lo válido en UNA transacción: si algo inesperado
 *   falla, no se escribe nada (D4).
 * - Idempotente (D5): locales por código, inquilinos por NIT o razón social
 *   normalizada y contratos vigentes iguales se reutilizan en lugar de duplicarse.
 * - No crea cuentas de usuario ni envía correos (D7).
 */
@Injectable()
export class CargaInicialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async analizar(archivo: ArchivoExcel, actor: AuthenticatedUser): Promise<CargaInicialResultado> {
    const plazaId = this.requirePlaza(actor);
    const excel = await leerExcelCargaInicial(archivo);
    const borradores = excel.filas.map((f) => this.leerFila(f));
    const plan = await this.prisma.withTenant(plazaId, (tx) => this.construirPlan(tx, borradores));
    return this.resultado('analisis', archivo, excel, plan);
  }

  async ejecutar(
    archivo: ArchivoExcel,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<CargaInicialResultado> {
    const plazaId = this.requirePlaza(actor);
    const excel = await leerExcelCargaInicial(archivo);
    const borradores = excel.filas.map((f) => this.leerFila(f));

    const { plan, creados } = await this.prisma
      .withTenant(
        plazaId,
        async (tx) => {
          const plan = await this.construirPlan(tx, borradores);
          const creados = await this.aplicarPlan(tx, plazaId, plan);
          return { plan, creados };
        },
        TX_OPTIONS,
      )
      .catch((err: unknown) => {
        this.rethrowConflicto(err);
        throw err;
      });

    const resultado = this.resultado('ejecucion', archivo, excel, plan);
    await this.auditar(creados, resultado, plazaId, actor, meta);
    return resultado;
  }

  // ── Lectura de una fila (sin BD) ─────────────────────────────────────────────

  private leerFila({ fila, celdas }: FilaCruda): Borrador {
    const mensajes: CargaInicialMensaje[] = [];
    const local = this.leerLocal(celdas, mensajes);
    const inquilino = this.leerInquilino(celdas, mensajes);
    const traeContrato = CAMPOS_CONTRATO.some((campo) => !esCeldaVacia(celdas[campo] ?? null));

    // Si LOCAL o RAZÓN SOCIAL vinieron pero no son válidos, leerLocal/leerInquilino ya avisaron.
    if (!leerTexto(celdas.local)) {
      mensajes.push(adv(`Sin ${ENCABEZADOS.local}: no se crea el local ni su contrato.`));
    }
    if (!leerTexto(celdas.razonSocial) && !leerTexto(celdas.nombreComercial) && traeContrato) {
      mensajes.push(
        adv(
          `Sin ${ENCABEZADOS.razonSocial} ni ${ENCABEZADOS.nombreComercial}: no se crea inquilino ni contrato.`,
        ),
      );
    }

    let contrato: Borrador['contrato'] = null;
    if (traeContrato) {
      contrato =
        local && inquilino
          ? this.leerContrato(celdas, mensajes)
          : { datos: null, fechaInicio: null, montoMensual: null };
    }
    return {
      fila,
      mensajes,
      local,
      inquilino,
      contrato,
      comentarios: leerTexto(celdas.comentarios),
    };
  }

  private leerLocal(
    c: FilaCruda['celdas'],
    mensajes: CargaInicialMensaje[],
  ): CreateLocalInput | null {
    const local = leerTexto(c.local);
    if (!local) return null;
    const modulo = leerTexto(c.modulo);
    const codigo = construirCodigoLocal(modulo, local);

    const datos: Record<string, unknown> = {
      codigo,
      modulo: modulo ?? undefined,
      nivel: leerTexto(c.nivel) ?? undefined,
      medidorEnergia: leerTexto(c.medidorEnergia) ?? undefined,
      medidorAgua: leerTexto(c.medidorAgua) ?? undefined,
    };
    const area = this.leerNumeroCampo(c, 'area', mensajes);
    if (area !== null && area > 0) datos.areaM2 = redondear(area);

    const r = parsearTolerante(CreateLocalSchema, datos, ETIQUETAS_LOCAL, ['codigo'], mensajes);
    if ('error' in r) {
      mensajes.push(
        adv(
          `El ${ENCABEZADOS.local} "${local}" genera el código "${codigo}", que no es válido ` +
            '(máximo 16 caracteres: letras, dígitos y guiones): no se crea el local ni su contrato.',
        ),
      );
      return null;
    }
    return r.data;
  }

  private leerInquilino(
    c: FilaCruda['celdas'],
    mensajes: CargaInicialMensaje[],
  ): Borrador['inquilino'] {
    const nombreComercial = leerTexto(c.nombreComercial);
    let razonSocial = leerTexto(c.razonSocial);
    if (!razonSocial && nombreComercial) {
      razonSocial = nombreComercial;
      mensajes.push(
        adv(
          `Sin ${ENCABEZADOS.razonSocial}: se usa el ${ENCABEZADOS.nombreComercial} como razón social.`,
        ),
      );
    }
    if (!razonSocial) return null;

    const texto = (campo: CargaInicialCampo): string | undefined =>
      leerTexto(c[campo]) ?? undefined;
    const datos: Record<string, unknown> = {
      razonSocial,
      identificacion: texto('nit'),
      nombreComercial: nombreComercial ?? undefined,
      representanteLegal: texto('representanteLegal'),
      numeroNrc: texto('nrc'),
      correoRecepcionDte: texto('correoDte'),
      numeroTelefono: texto('telefono'),
      contacto1Nombre: texto('contacto1Nombre'),
      contacto1Cargo: texto('contacto1Cargo'),
      contacto1Email: texto('contacto1Email'),
      contacto1Telefono: texto('contacto1Telefono'),
      contacto2Nombre: texto('contacto2Nombre'),
      contacto2Cargo: texto('contacto2Cargo'),
      contacto2Email: texto('contacto2Email'),
      contacto2Telefono: texto('contacto2Telefono'),
      tipoCliente: texto('tipoCliente')?.toLowerCase(),
      giroAutorizado: texto('giroAutorizado'),
      categoria: texto('categoria'),
      subcategoria: texto('subcategoria'),
    };
    const r = parsearTolerante(
      CreateInquilinoSchema,
      datos,
      ETIQUETAS_INQUILINO,
      ['razonSocial'],
      mensajes,
    );
    if ('error' in r) {
      mensajes.push(
        adv(
          `${ENCABEZADOS.razonSocial} no válida (máximo 160 caracteres): no se crea el inquilino ni su contrato.`,
        ),
      );
      return null;
    }
    return {
      datos: r.data,
      claveNit: r.data.identificacion ? normalizarClave(r.data.identificacion) : null,
      claveRazon: normalizarClave(r.data.razonSocial),
    };
  }

  private leerContrato(
    c: FilaCruda['celdas'],
    mensajes: CargaInicialMensaje[],
  ): NonNullable<Borrador['contrato']> {
    const fechaInicio = leerFecha(c.fechaInicio);
    if (fechaInicio.invalido) {
      mensajes.push(
        adv(
          `${ENCABEZADOS.fechaInicio} no válida (${mostrar(c.fechaInicio)}): no se crea el contrato.`,
        ),
      );
    } else if (!fechaInicio.valor) {
      mensajes.push(adv(`Sin ${ENCABEZADOS.fechaInicio}: no se crea el contrato.`));
    }

    const numero = (campo: CargaInicialCampo) => this.leerNumeroCampo(c, campo, mensajes);
    const fecha = (campo: CargaInicialCampo) => this.leerFechaCampo(c, campo, mensajes);

    const total = numero('total');
    const totalCanon = numero('totalCanon');
    const totalCam = numero('totalCam');
    const areaReal = numero('areaReal');
    const cuota = numero('cuotaArrendamiento');
    const cuotaCam = numero('cuotaCam');
    const plazoAnios = numero('plazoAnios');

    // TOTAL manda (AG ya incluye los incrementos); luego AG+AH; luego área × cuotas.
    let montoMensual: number | null = total;
    if (montoMensual === null && (totalCanon !== null || totalCam !== null)) {
      montoMensual = (totalCanon ?? 0) + (totalCam ?? 0);
    }
    if (montoMensual === null && areaReal !== null && (cuota !== null || cuotaCam !== null)) {
      montoMensual = areaReal * ((cuota ?? 0) + (cuotaCam ?? 0));
    }
    if (montoMensual !== null) montoMensual = redondear(montoMensual);

    if (!fechaInicio.valor) {
      return { datos: null, fechaInicio: null, montoMensual };
    }
    if (montoMensual === null) {
      montoMensual = 0;
      mensajes.push(info(`Sin ${ENCABEZADOS.total} ni cuotas: el monto mensual queda en 0.`));
    }

    const datos: Record<string, unknown> = {
      localId: UUID_PROVISIONAL,
      inquilinoId: UUID_PROVISIONAL,
      fechaInicio: fechaInicio.valor,
      // D2: sin FECHA FIN ni VENCIMIENTO el contrato es indefinido.
      fechaFin: fecha('fechaFin') ?? fecha('vencimiento'),
      montoMensual,
      moneda: 'USD',
      condiciones: leerTexto(c.comentarios) ?? undefined,
      plazoMeses: plazoAnios !== null && plazoAnios > 0 ? Math.round(plazoAnios * 12) : null,
      areaMt2MedicionReal: redondearONull(areaReal),
      cuotaArrendamiento: redondearONull(cuota),
      cuotaCam: redondearONull(cuotaCam),
      depositoGarantia: redondearONull(numero('deposito')),
      fechaPagoDeposito: fecha('fechaPagoDeposito'),
      fechaEntregaLocal: fecha('fechaEntregaLocal'),
      periodoGraciaDias: numero('periodoGracia'),
      inicioOperaciones: fecha('inicioOperaciones'),
      avisoTerminacion: fecha('avisoTerminacion'),
      condicionesIncrementoCanon: leerTexto(c.condicionesIncremento),
    };
    const r = parsearTolerante(
      CreateContratoSchema,
      datos,
      ETIQUETAS_CONTRATO,
      ['localId', 'inquilinoId', 'fechaInicio', 'montoMensual'],
      mensajes,
    );
    if ('error' in r) {
      mensajes.push(adv(`${r.error} no válido: no se crea el contrato.`));
      return { datos: null, fechaInicio: fechaInicio.valor, montoMensual };
    }
    if (r.data.fechaFin && r.data.fechaFin < hoyIso()) {
      mensajes.push(
        info(
          `El contrato venció el ${r.data.fechaFin}; se crea vigente: ciérralo o renuévalo si corresponde.`,
        ),
      );
    }
    return { datos: r.data, fechaInicio: fechaInicio.valor, montoMensual };
  }

  private leerNumeroCampo(
    c: FilaCruda['celdas'],
    campo: CargaInicialCampo,
    mensajes: CargaInicialMensaje[],
  ): number | null {
    const r = leerNumero(c[campo]);
    if (r.invalido) {
      mensajes.push(adv(`${ENCABEZADOS[campo]} no es un número (${mostrar(c[campo])}): se omite.`));
    }
    return r.valor;
  }

  private leerFechaCampo(
    c: FilaCruda['celdas'],
    campo: CargaInicialCampo,
    mensajes: CargaInicialMensaje[],
  ): string | null {
    const r = leerFecha(c[campo]);
    if (r.invalido) {
      mensajes.push(
        adv(`${ENCABEZADOS[campo]} no es una fecha válida (${mostrar(c[campo])}): se omite.`),
      );
    }
    return r.valor;
  }

  // ── Plan contra la BD (solo lecturas) ────────────────────────────────────────

  private async construirPlan(tx: Prisma.TransactionClient, borradores: Borrador[]): Promise<Plan> {
    const codigos = [...new Set(borradores.flatMap((b) => (b.local ? [b.local.codigo] : [])))];
    const localesDb = await tx.local.findMany({
      where: { codigo: { in: codigos } },
      select: { id: true, codigo: true, estado: true, deleted_at: true },
    });
    const inquilinosDb = await tx.inquilino.findMany({
      select: { id: true, razon_social: true, identificacion: true, deleted_at: true },
    });
    const vigentesDb = await tx.contrato.findMany({
      where: {
        estado: 'vigente',
        local_id: { in: localesDb.filter((l) => !l.deleted_at).map((l) => l.id) },
      },
      select: { local_id: true, inquilino_id: true, fecha_inicio: true },
    });

    const localPorCodigo = new Map(localesDb.map((l) => [l.codigo, l]));
    const vigentesPorLocal = new Map<string, { inquilinoId: string; fechaInicio: string }[]>();
    for (const v of vigentesDb) {
      const lista = vigentesPorLocal.get(v.local_id) ?? [];
      lista.push({
        inquilinoId: v.inquilino_id,
        fechaInicio: v.fecha_inicio.toISOString().slice(0, 10),
      });
      vigentesPorLocal.set(v.local_id, lista);
    }
    const registro = new RegistroInquilinos(inquilinosDb);
    const filaDeCodigo = new Map<string, number>();

    const filas = borradores.map((b): FilaPlan => {
      const mensajes = [...b.mensajes];

      // Local
      let local: FilaPlan['local'] = null;
      let estadoLocal: LocalEstado | null = null;
      if (b.local) {
        const codigo = b.local.codigo;
        const previa = filaDeCodigo.get(codigo);
        const db = localPorCodigo.get(codigo);
        if (previa !== undefined) {
          local = { codigo, accion: 'omitido', filaOrigen: previa, id: null, datos: null };
          mensajes.push(
            adv(
              `El local ${codigo} ya aparece en la fila ${previa}: se ignoran el local y el contrato de esta fila.`,
            ),
          );
        } else if (db?.deleted_at) {
          filaDeCodigo.set(codigo, b.fila);
          local = { codigo, accion: 'omitido', filaOrigen: null, id: null, datos: null };
          mensajes.push(
            adv(
              `El código ${codigo} pertenece a un local eliminado: no se crea el local ni su contrato.`,
            ),
          );
        } else if (db) {
          filaDeCodigo.set(codigo, b.fila);
          local = { codigo, accion: 'existente', filaOrigen: null, id: db.id, datos: null };
          estadoLocal = db.estado;
        } else {
          filaDeCodigo.set(codigo, b.fila);
          local = { codigo, accion: 'crear', filaOrigen: null, id: null, datos: b.local };
        }
      }

      // Inquilino
      let inquilino: FilaPlan['inquilino'] = null;
      if (b.inquilino) {
        const r = registro.resolver(b.inquilino, b.fila);
        inquilino = { razonSocial: b.inquilino.datos.razonSocial, ...r };
        if (r.accion === 'omitido') {
          mensajes.push(
            adv(
              `El inquilino "${b.inquilino.datos.razonSocial}" está deshabilitado en la plaza: ` +
                'no se reactiva ni se le asigna contrato.',
            ),
          );
        }
      }

      // Contrato
      let contrato: FilaPlan['contrato'] = null;
      if (b.contrato) {
        const base = { fechaInicio: b.contrato.fechaInicio, montoMensual: b.contrato.montoMensual };
        const datos = b.contrato.datos;
        const inquilinoRef = inquilino?.ref;
        let accion: CargaInicialAccion = 'omitido';
        if (
          datos &&
          local &&
          local.accion !== 'omitido' &&
          inquilinoRef &&
          inquilinoRef.tipo !== 'eliminado'
        ) {
          accion = 'crear';
          if (local.accion === 'existente' && local.id) {
            const vigentes = vigentesPorLocal.get(local.id) ?? [];
            const textoEstado = estadoLocal ? ESTADO_LOCAL_TEXTO[estadoLocal] : undefined;
            if (textoEstado) {
              accion = 'omitido';
              mensajes.push(
                adv(`El local ${local.codigo} está ${textoEstado}: no se crea el contrato.`),
              );
            } else if (
              inquilinoRef.tipo === 'existente' &&
              vigentes.some(
                (v) => v.inquilinoId === inquilinoRef.id && v.fechaInicio === datos.fechaInicio,
              )
            ) {
              accion = 'existente';
            } else if (vigentes.length > 0) {
              accion = 'omitido';
              mensajes.push(
                adv(
                  `El local ${local.codigo} ya tiene un contrato vigente: no se crea el contrato.`,
                ),
              );
            }
          }
        }
        contrato = { accion, ...base, datos: accion === 'crear' ? datos : null };
      }

      // COMENTARIOS: van al contrato; si la fila no genera contrato, al inquilino nuevo.
      const conContrato = contrato?.accion === 'crear' || contrato?.accion === 'existente';
      if (b.comentarios && !conContrato && inquilino?.ref?.tipo === 'nuevo') {
        inquilino.ref.nuevo.comentarios.push(b.comentarios);
      }

      return { fila: b.fila, mensajes, local, inquilino, contrato };
    });

    const inquilinosNuevos = registro.nuevos;
    for (const n of inquilinosNuevos) {
      const nombres = n.nombresComerciales.join(' / ');
      n.datos.nombreComercial = nombres ? nombres.slice(0, 160) : undefined;
      const comentarios = n.comentarios.join('\n');
      n.datos.comentarios = comentarios ? comentarios.slice(0, 2000) : undefined;
    }
    return { filas, inquilinosNuevos };
  }

  // ── Escritura (dentro de la transacción de `ejecutar`) ────────────────────────

  private async aplicarPlan(
    tx: Prisma.TransactionClient,
    plazaId: string,
    plan: Plan,
  ): Promise<Creados> {
    const creados: Creados = { locales: [], inquilinos: [], contratos: [] };

    for (const f of plan.filas) {
      if (f.local?.accion !== 'crear' || !f.local.datos) continue;
      const d = f.local.datos;
      const local = await tx.local.create({
        data: {
          plaza_id: plazaId,
          codigo: d.codigo,
          modulo: d.modulo ?? null,
          nivel: d.nivel ?? null,
          area_m2: d.areaM2 ?? null,
          medidor_energia: d.medidorEnergia ?? null,
          medidor_agua: d.medidorAgua ?? null,
        },
      });
      f.local.id = local.id;
      creados.locales.push(local);
    }

    for (const n of plan.inquilinosNuevos) {
      const d = n.datos;
      const inquilino = await tx.inquilino.create({
        data: {
          plaza_id: plazaId,
          razon_social: d.razonSocial,
          identificacion: d.identificacion ?? null,
          nombre_comercial: d.nombreComercial ?? null,
          representante_legal: d.representanteLegal ?? null,
          numero_nrc: d.numeroNrc ?? null,
          correo_recepcion_dte: d.correoRecepcionDte ?? null,
          numero_telefono: d.numeroTelefono ?? null,
          direccion: d.direccion ?? null,
          contacto1_nombre: d.contacto1Nombre ?? null,
          contacto1_cargo: d.contacto1Cargo ?? null,
          contacto1_email: d.contacto1Email ?? null,
          contacto1_telefono: d.contacto1Telefono ?? null,
          contacto2_nombre: d.contacto2Nombre ?? null,
          contacto2_cargo: d.contacto2Cargo ?? null,
          contacto2_email: d.contacto2Email ?? null,
          contacto2_telefono: d.contacto2Telefono ?? null,
          tipo_cliente: d.tipoCliente ?? null,
          giro_autorizado: d.giroAutorizado ?? null,
          categoria: d.categoria ?? null,
          subcategoria: d.subcategoria ?? null,
          comentarios: d.comentarios ?? null,
        },
      });
      n.id = inquilino.id;
      creados.inquilinos.push(inquilino);
    }

    const localesAlquilados: string[] = [];
    for (const f of plan.filas) {
      const d = f.contrato?.accion === 'crear' ? f.contrato.datos : null;
      if (!d) continue;
      const localId = f.local?.id;
      const ref = f.inquilino?.ref;
      const inquilinoId =
        ref?.tipo === 'existente' ? ref.id : ref?.tipo === 'nuevo' ? ref.nuevo.id : null;
      if (!localId || !inquilinoId) {
        throw new Error(`Carga inicial: fila ${f.fila} sin local o inquilino resuelto.`);
      }
      const contrato = await tx.contrato.create({
        data: {
          plaza_id: plazaId,
          local_id: localId,
          inquilino_id: inquilinoId,
          fecha_inicio: new Date(d.fechaInicio),
          fecha_fin: d.fechaFin ? new Date(d.fechaFin) : null,
          monto_mensual: d.montoMensual,
          moneda: d.moneda,
          condiciones: d.condiciones ?? null,
          plazo_meses: d.plazoMeses ?? null,
          area_mt2_medicion_real: d.areaMt2MedicionReal ?? null,
          cuota_arrendamiento: d.cuotaArrendamiento ?? null,
          cuota_cam: d.cuotaCam ?? null,
          deposito_garantia: d.depositoGarantia ?? null,
          fecha_pago_deposito: d.fechaPagoDeposito ? new Date(d.fechaPagoDeposito) : null,
          fecha_entrega_local: d.fechaEntregaLocal ? new Date(d.fechaEntregaLocal) : null,
          periodo_gracia_dias: d.periodoGraciaDias ?? null,
          inicio_operaciones: d.inicioOperaciones ? new Date(d.inicioOperaciones) : null,
          aviso_terminacion: d.avisoTerminacion ? new Date(d.avisoTerminacion) : null,
          condiciones_incremento_canon: d.condicionesIncrementoCanon ?? null,
        },
      });
      creados.contratos.push(contrato);
      localesAlquilados.push(localId);
    }
    // RI-2: el local con contrato vigente pasa a alquilado en la MISMA transacción.
    if (localesAlquilados.length > 0) {
      await tx.local.updateMany({
        where: { id: { in: localesAlquilados } },
        data: { estado: 'alquilado' },
      });
    }
    return creados;
  }

  private async auditar(
    creados: Creados,
    resultado: CargaInicialResultado,
    plazaId: string,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<void> {
    const base = { plazaId, usuarioId: actor.sub, ...meta };
    for (const l of creados.locales) {
      await this.auditoria.record({
        ...base,
        accion: 'local.create',
        entidadTipo: 'local',
        entidadId: l.id,
        despues: localToOutput(l),
      });
    }
    for (const i of creados.inquilinos) {
      await this.auditoria.record({
        ...base,
        accion: 'inquilino.create',
        entidadTipo: 'inquilino',
        entidadId: i.id,
        despues: inquilinoToOutput(i),
      });
    }
    for (const c of creados.contratos) {
      await this.auditoria.record({
        ...base,
        accion: 'contrato.create',
        entidadTipo: 'contrato',
        entidadId: c.id,
        despues: contratoToOutput(c),
      });
    }
    await this.auditoria.record({
      ...base,
      accion: 'carga_inicial.ejecutar',
      entidadTipo: 'plaza',
      entidadId: plazaId,
      despues: { archivo: resultado.archivo, hoja: resultado.hoja, totales: resultado.totales },
    });
  }

  // ── Resultado ────────────────────────────────────────────────────────────────

  private resultado(
    modo: CargaInicialResultado['modo'],
    archivo: ArchivoExcel,
    excel: ExcelLeido,
    plan: Plan,
  ): CargaInicialResultado {
    const filas = plan.filas.map((f): CargaInicialFila => {
      const algoUtil =
        (f.local && f.local.accion !== 'omitido') ||
        (f.inquilino && f.inquilino.accion !== 'omitido');
      const estado: CargaInicialFilaEstado = !algoUtil
        ? 'error'
        : f.mensajes.some((m) => m.nivel === 'advertencia')
          ? 'advertencia'
          : 'ok';
      return {
        fila: f.fila,
        local: f.local && {
          codigo: f.local.codigo,
          accion: f.local.accion,
          filaOrigen: f.local.filaOrigen,
        },
        inquilino: f.inquilino && {
          razonSocial: f.inquilino.razonSocial,
          accion: f.inquilino.accion,
          filaOrigen: f.inquilino.filaOrigen,
        },
        contrato: f.contrato && {
          accion: f.contrato.accion,
          fechaInicio: f.contrato.fechaInicio,
          montoMensual: f.contrato.montoMensual,
        },
        estado,
        mensajes: f.mensajes,
      };
    });

    const contar = (pred: (f: CargaInicialFila) => boolean) => filas.filter(pred).length;
    const inquilinosExistentes = new Set(
      plan.filas.flatMap((f) =>
        f.inquilino?.ref?.tipo === 'existente' ? [f.inquilino.ref.id] : [],
      ),
    );
    const totales: CargaInicialTotales = {
      filas: filas.length,
      filasOk: contar((f) => f.estado === 'ok'),
      filasConAdvertencia: contar((f) => f.estado === 'advertencia'),
      filasConError: contar((f) => f.estado === 'error'),
      locales: {
        crear: contar((f) => f.local?.accion === 'crear'),
        existentes: contar((f) => f.local?.accion === 'existente'),
      },
      inquilinos: {
        crear: plan.inquilinosNuevos.length,
        existentes: inquilinosExistentes.size,
      },
      contratos: {
        crear: contar((f) => f.contrato?.accion === 'crear'),
        existentes: contar((f) => f.contrato?.accion === 'existente'),
        omitidos: contar((f) => f.contrato?.accion === 'omitido'),
      },
    };

    return {
      modo,
      archivo: archivo.originalname,
      hoja: excel.hoja,
      columnasFaltantes: excel.columnasFaltantes,
      filasEjemplo: excel.filasEjemplo,
      totales,
      filas,
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private requirePlaza(actor: AuthenticatedUser): string {
    if (!actor.plazaId) {
      throw new ForbiddenException({
        code: 'PLAZA_SCOPE_VIOLATION',
        title: 'Acceso denegado',
        message: 'Esta operación requiere un usuario con plaza asignada.',
      });
    }
    return actor.plazaId;
  }

  /**
   * El plan ya descarta solapamientos y duplicados; si aun así la BD los
   * rechaza es porque otro usuario cambió los datos entre el análisis y la
   * escritura. La transacción ya hizo rollback: no se creó nada.
   */
  private rethrowConflicto(err: unknown): void {
    const e = err as { code?: string; message?: string };
    const overlap = (e?.message ?? '').includes('CONTRATO_OVERLAP');
    if (overlap || e?.code === 'P2002') {
      throw new ConflictException({
        code: overlap ? 'CONTRATO_OVERLAP' : 'IMPORTACION_CONFLICTO',
        title: 'Conflicto con el estado actual',
        message:
          'Los datos de la plaza cambiaron durante la importación y no se creó nada. ' +
          'Vuelve a analizar el archivo.',
      });
    }
  }
}

/**
 * Resuelve el inquilino de cada fila contra la BD y contra las filas
 * anteriores del archivo: primero por NIT y luego por razón social
 * normalizada (D5/D6). Un inquilino deshabilitado no se reactiva.
 */
class RegistroInquilinos {
  readonly nuevos: InquilinoNuevo[] = [];
  private readonly porNit = new Map<string, RefInquilino>();
  private readonly porRazon = new Map<string, RefInquilino>();

  constructor(
    db: {
      id: string;
      razon_social: string;
      identificacion: string | null;
      deleted_at: Date | null;
    }[],
  ) {
    for (const i of db) {
      const ref: RefInquilino = i.deleted_at
        ? { tipo: 'eliminado' }
        : { tipo: 'existente', id: i.id };
      if (i.identificacion) this.registrar(this.porNit, normalizarClave(i.identificacion), ref);
      this.registrar(this.porRazon, normalizarClave(i.razon_social), ref);
    }
  }

  resolver(
    b: NonNullable<Borrador['inquilino']>,
    fila: number,
  ): { accion: CargaInicialAccion; filaOrigen: number | null; ref: RefInquilino | null } {
    const ref =
      (b.claveNit ? this.porNit.get(b.claveNit) : undefined) ?? this.porRazon.get(b.claveRazon);

    if (!ref) {
      const nuevo: InquilinoNuevo = {
        filaOrigen: fila,
        datos: { ...b.datos },
        nombresComerciales: b.datos.nombreComercial ? [b.datos.nombreComercial] : [],
        comentarios: [],
        id: null,
      };
      const refNuevo: RefInquilino = { tipo: 'nuevo', nuevo };
      if (b.claveNit) this.porNit.set(b.claveNit, refNuevo);
      this.porRazon.set(b.claveRazon, refNuevo);
      this.nuevos.push(nuevo);
      return { accion: 'crear', filaOrigen: null, ref: refNuevo };
    }
    if (ref.tipo === 'eliminado') return { accion: 'omitido', filaOrigen: null, ref: null };
    if (ref.tipo === 'existente') return { accion: 'existente', filaOrigen: null, ref };

    // Mismo inquilino que una fila anterior: completa los datos que aquella no traía.
    const { nuevo } = ref;
    const datos = nuevo.datos as Record<string, unknown>;
    for (const [clave, valor] of Object.entries(b.datos)) {
      if (datos[clave] === undefined && valor !== undefined) datos[clave] = valor;
    }
    if (b.datos.nombreComercial && !nuevo.nombresComerciales.includes(b.datos.nombreComercial)) {
      nuevo.nombresComerciales.push(b.datos.nombreComercial);
    }
    if (b.claveNit && !this.porNit.has(b.claveNit)) this.porNit.set(b.claveNit, ref);
    return { accion: 'repetido', filaOrigen: nuevo.filaOrigen, ref };
  }

  /** Un inquilino activo tiene prioridad sobre uno deshabilitado con la misma clave. */
  private registrar(mapa: Map<string, RefInquilino>, clave: string, ref: RefInquilino): void {
    const actual = mapa.get(clave);
    if (!actual || (actual.tipo === 'eliminado' && ref.tipo !== 'eliminado')) mapa.set(clave, ref);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Funciones puras

/**
 * D1: código del local = `MODULO-LOCAL` en mayúsculas, sin acentos y con lo no
 * alfanumérico convertido en guion ("K" + "29 Isla 1" → "K-29-ISLA-1"). Si
 * LOCAL ya empieza por el módulo ("B" + "B-12") no se duplica el prefijo.
 */
export function construirCodigoLocal(modulo: string | null, local: string): string {
  const slug = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  const l = slug(local);
  const m = modulo ? slug(modulo) : '';
  if (!m || l === m || l.startsWith(`${m}-`)) return l;
  return `${m}-${l}`;
}

/** Clave de comparación: sin acentos, mayúsculas y solo alfanuméricos. */
function normalizarClave(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * Valida `datos` con `schema`. Un campo opcional inválido se descarta con una
 * advertencia y se reintenta; si el inválido es obligatorio devuelve `error`
 * con la columna afectada.
 */
function parsearTolerante<T>(
  schema: ZodType<T>,
  datos: Record<string, unknown>,
  etiquetas: Partial<Record<string, string>>,
  obligatorios: readonly string[],
  mensajes: CargaInicialMensaje[],
): { data: T } | { error: string } {
  const pendientes = { ...datos };
  for (let intento = 0; intento <= Object.keys(datos).length; intento++) {
    const r = schema.safeParse(pendientes);
    if (r.success) return { data: r.data };
    const descartados = new Set<string>();
    for (const issue of r.error.issues) {
      const clave = String(issue.path[0] ?? '');
      const etiqueta = etiquetas[clave] ?? clave;
      if (obligatorios.includes(clave) || !(clave in pendientes)) return { error: etiqueta };
      if (descartados.has(clave)) continue;
      descartados.add(clave);
      // `custom` = refine entre campos (p. ej. FECHA FIN anterior a FECHA INICIO).
      const motivo =
        issue.code === 'custom' ? 'no es coherente con la fecha de inicio/fin' : 'no válido';
      mensajes.push(adv(`${etiqueta} ${motivo} (${mostrar(pendientes[clave])}): se omite.`));
      delete pendientes[clave];
    }
  }
  return { error: 'Datos' };
}

/** 2 decimales, como las columnas DECIMAL(…, 2) (quita el ruido de punto flotante de Excel). */
function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}

function redondearONull(n: number | null): number | null {
  return n === null ? null : redondear(n);
}

function hoyIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Valor de celda legible para un mensaje (recortado). */
function mostrar(valor: unknown): string {
  const texto = valor instanceof Date ? valor.toISOString().slice(0, 10) : String(valor ?? '');
  return texto.length > 40 ? `${texto.slice(0, 40)}…` : texto;
}

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, contrato as ContratoModel } from '@prisma/client';
import type {
  CreateContratoInput,
  UpdateContratoInput,
  CerrarContratoInput,
  RenovarContratoInput,
  ListContratosQuery,
  ContratoOutput,
  ContratoListItem,
  ContratoDetailOutput,
} from '@app/contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { contratoToOutput, toIsoDate } from './contrato.mapper';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';

export interface RequestMeta {
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

type ContratoConRelaciones = ContratoModel & {
  local?: { codigo: string } | null;
  inquilino?: { razon_social: string } | null;
};

/**
 * CRUD de contratos (T-054) + cierre/renovación (T-055).
 *
 * Reglas (RN-CO-1..RN-CO-5):
 *  - Estado inicial siempre `vigente`. El trigger tg_contrato_no_overlap (T-050)
 *    rechaza solapamientos → se mapea a 409 CONTRATO_OVERLAP.
 *  - Crear contrato vigente → `local.estado = 'alquilado'` (misma transacción).
 *  - Cerrar el último vigente del local → `local.estado = 'disponible'`.
 *  - PATCH solo permite monto_mensual/condiciones; cambiar fechas/local/inquilino
 *    requiere cerrar y crear uno nuevo (decisión UX).
 *  - Renovar = cerrar (`motivo_fin: 'renovado'`) + crear nuevo, misma transacción.
 *    Se cierra ANTES de insertar para no disparar un falso overlap del trigger.
 */
@Injectable()
export class ContratosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  // ── Crear (admin_plaza / superadmin con plaza) ────────────────────────────────
  async create(
    dto: CreateContratoInput,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<ContratoOutput> {
    const plazaId = this.requirePlaza(actor);

    const contrato = await this.prisma
      .withTenant(plazaId, async (tx) => {
        const local = await tx.local.findFirst({
          where: { id: dto.localId, deleted_at: null },
        });
        if (!local) this.throwNotFound('LOCAL_NOT_FOUND', 'El local no existe.');
        const inquilino = await tx.inquilino.findFirst({
          where: { id: dto.inquilinoId, deleted_at: null },
        });
        if (!inquilino) this.throwNotFound('INQUILINO_NOT_FOUND', 'El inquilino no existe.');

        const contrato = await tx.contrato.create({
          data: {
            plaza_id: plazaId,
            local_id: dto.localId,
            inquilino_id: dto.inquilinoId,
            fecha_inicio: new Date(dto.fechaInicio),
            fecha_fin: dto.fechaFin ? new Date(dto.fechaFin) : null,
            monto_mensual: dto.montoMensual,
            moneda: dto.moneda,
            condiciones: dto.condiciones ?? null,
            // ── Campos nuevos Excel Hoja 2 U-AK (T-V14+) ──────────────────────
            plazo_meses: dto.plazoMeses ?? null,
            area_mt2_medicion_real: dto.areaMt2MedicionReal ?? null,
            cuota_arrendamiento: dto.cuotaArrendamiento ?? null,
            cuota_cam: dto.cuotaCam ?? null,
            deposito_garantia: dto.depositoGarantia ?? null,
            fecha_pago_deposito: dto.fechaPagoDeposito ? new Date(dto.fechaPagoDeposito) : null,
            fecha_entrega_local: dto.fechaEntregaLocal ? new Date(dto.fechaEntregaLocal) : null,
            periodo_gracia_dias: dto.periodoGraciaDias ?? null,
            inicio_operaciones: dto.inicioOperaciones ? new Date(dto.inicioOperaciones) : null,
            aviso_terminacion: dto.avisoTerminacion ? new Date(dto.avisoTerminacion) : null,
            condiciones_incremento_canon: dto.condicionesIncrementoCanon ?? null,
          },
        });
        // RI-2: el local pasa a alquilado en la MISMA transacción.
        await tx.local.update({ where: { id: dto.localId }, data: { estado: 'alquilado' } });
        return contrato;
      })
      .catch((err: unknown) => {
        this.rethrowOverlap(err);
        throw err;
      });

    await this.auditoria.record({
      accion: 'contrato.create',
      entidadTipo: 'contrato',
      entidadId: contrato.id,
      plazaId,
      usuarioId: actor.sub,
      despues: contratoToOutput(contrato),
      ...meta,
    });
    return contratoToOutput(contrato);
  }

  // ── Listar (inquilino: forzado a los suyos) ───────────────────────────────────
  async findAll(
    query: ListContratosQuery,
    actor: AuthenticatedUser,
  ): Promise<Paginated<ContratoListItem>> {
    const plazaId = this.requirePlaza(actor);
    const { page, pageSize, localId, inquilinoId, estado } = query;

    const where: Prisma.contratoWhereInput = {
      ...(localId ? { local_id: localId } : {}),
      ...(estado ? { estado } : {}),
      // Inquilino: SIEMPRE sus contratos; se ignora cualquier inquilinoId del query.
      ...(actor.rol === 'inquilino'
        ? { inquilino_id: this.requireInquilino(actor) }
        : inquilinoId
          ? { inquilino_id: inquilinoId }
          : {}),
    };

    const { items, total } = await this.prisma.withTenant(plazaId, async (tx) => {
      const [items, total] = await Promise.all([
        tx.contrato.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { fecha_inicio: 'desc' },
          include: {
            local: { select: { codigo: true } },
            inquilino: { select: { razon_social: true } },
          },
        }),
        tx.contrato.count({ where }),
      ]);
      return { items, total };
    });

    return {
      items: items.map((c) => this.toListItem(c)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // ── Detalle + flags de ventana de vencimiento ─────────────────────────────────
  async findOne(id: string, actor: AuthenticatedUser): Promise<ContratoDetailOutput> {
    const plazaId = this.requirePlaza(actor);

    const contrato = await this.prisma.withTenant(plazaId, (tx) =>
      tx.contrato.findFirst({
        where: { id },
        include: {
          local: { select: { codigo: true } },
          inquilino: { select: { razon_social: true } },
        },
      }),
    );
    const found = this.assertFound(contrato);
    this.assertInquilinoScope(found, actor);

    return this.toDetail(found);
  }

  // ── Actualizar (solo monto y condiciones) ─────────────────────────────────────
  async update(
    id: string,
    dto: UpdateContratoInput,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<ContratoOutput> {
    const plazaId = this.requirePlaza(actor);

    const { before, updated } = await this.prisma.withTenant(plazaId, async (tx) => {
      const before = this.assertFound(await tx.contrato.findFirst({ where: { id } }));
      const updated = await tx.contrato.update({
        where: { id },
        data: {
          ...(dto.montoMensual !== undefined ? { monto_mensual: dto.montoMensual } : {}),
          ...(dto.condiciones !== undefined ? { condiciones: dto.condiciones } : {}),
        },
      });
      return { before, updated };
    });

    await this.auditoria.record({
      accion: 'contrato.update',
      entidadTipo: 'contrato',
      entidadId: id,
      plazaId,
      usuarioId: actor.sub,
      antes: contratoToOutput(before),
      despues: contratoToOutput(updated),
      ...meta,
    });
    return contratoToOutput(updated);
  }

  // ── Cerrar (T-055): vigente → finalizado | cancelado ──────────────────────────
  async cerrar(
    id: string,
    dto: CerrarContratoInput,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<ContratoOutput> {
    const plazaId = this.requirePlaza(actor);

    const { before, updated } = await this.prisma.withTenant(plazaId, async (tx) => {
      const before = this.assertFound(await tx.contrato.findFirst({ where: { id } }));
      const updated = await this.cerrarEnTx(tx, before, dto);
      return { before, updated };
    });

    await this.auditoria.record({
      accion: 'contrato.cerrar',
      entidadTipo: 'contrato',
      entidadId: id,
      plazaId,
      usuarioId: actor.sub,
      antes: contratoToOutput(before),
      despues: contratoToOutput(updated),
      ...meta,
    });
    return contratoToOutput(updated);
  }

  // ── Renovar (T-055): cerrar actual + crear nuevo, misma transacción ───────────
  async renovar(
    id: string,
    dto: RenovarContratoInput,
    actor: AuthenticatedUser,
    meta: RequestMeta,
  ): Promise<{ cerrado: ContratoOutput; nuevo: ContratoOutput }> {
    const plazaId = this.requirePlaza(actor);

    const { before, cerrado, nuevo } = await this.prisma
      .withTenant(plazaId, async (tx) => {
        const before = this.assertFound(await tx.contrato.findFirst({ where: { id } }));

        // 1) Cerrar el vigente PRIMERO (sale de la verificación del trigger).
        const cerrado = await this.cerrarEnTx(tx, before, {
          motivoFin: 'renovado',
          estado: 'finalizado',
        });

        // 2) Crear el nuevo contrato vigente (mismo local e inquilino).
        const nuevo = await tx.contrato.create({
          data: {
            plaza_id: plazaId,
            local_id: before.local_id,
            inquilino_id: before.inquilino_id,
            fecha_inicio: new Date(dto.nuevaFechaInicio),
            fecha_fin: dto.nuevaFechaFin ? new Date(dto.nuevaFechaFin) : null,
            monto_mensual: dto.nuevoMontoMensual ?? before.monto_mensual,
            moneda: before.moneda,
            condiciones: before.condiciones,
            // Heredar campos contractuales Excel (T-V14+) — se mantienen al renovar.
            plazo_meses: before.plazo_meses,
            area_mt2_medicion_real: before.area_mt2_medicion_real,
            cuota_arrendamiento: before.cuota_arrendamiento,
            cuota_cam: before.cuota_cam,
            deposito_garantia: before.deposito_garantia,
            fecha_pago_deposito: before.fecha_pago_deposito,
            fecha_entrega_local: before.fecha_entrega_local,
            periodo_gracia_dias: before.periodo_gracia_dias,
            inicio_operaciones: before.inicio_operaciones,
            aviso_terminacion: before.aviso_terminacion,
            condiciones_incremento_canon: before.condiciones_incremento_canon,
          },
        });
        // El local sigue/queda alquilado.
        await tx.local.update({
          where: { id: before.local_id },
          data: { estado: 'alquilado' },
        });
        return { before, cerrado, nuevo };
      })
      .catch((err: unknown) => {
        this.rethrowOverlap(err);
        throw err;
      });

    await this.auditoria.record({
      accion: 'contrato.renovar',
      entidadTipo: 'contrato',
      entidadId: id,
      plazaId,
      usuarioId: actor.sub,
      antes: contratoToOutput(before),
      despues: { cerrado: contratoToOutput(cerrado), nuevo: contratoToOutput(nuevo) },
      ...meta,
    });
    return { cerrado: contratoToOutput(cerrado), nuevo: contratoToOutput(nuevo) };
  }

  // ── Helpers de transición ─────────────────────────────────────────────────────
  /** Cierra un contrato dentro de una transacción y libera el local si aplica. */
  private async cerrarEnTx(
    tx: Prisma.TransactionClient,
    contrato: ContratoModel,
    dto: CerrarContratoInput,
  ): Promise<ContratoModel> {
    if (contrato.estado !== 'vigente') {
      throw new BadRequestException({
        code: 'INVALID_STATE_TRANSITION',
        title: 'Solicitud inválida',
        message: `No se puede cerrar un contrato en estado "${contrato.estado}".`,
      });
    }
    if (dto.fechaFinEfectiva && new Date(dto.fechaFinEfectiva) < contrato.fecha_inicio) {
      throw new BadRequestException({
        code: 'INVALID_DATE',
        title: 'Solicitud inválida',
        message: `La fecha de fin efectiva (${dto.fechaFinEfectiva}) no puede ser anterior al inicio del contrato (${toIsoDate(contrato.fecha_inicio)}).`,
      });
    }

    const updated = await tx.contrato.update({
      where: { id: contrato.id },
      data: {
        estado: dto.estado ?? 'finalizado',
        motivo_fin: dto.motivoFin,
        fecha_fin_efectiva: dto.fechaFinEfectiva ? new Date(dto.fechaFinEfectiva) : new Date(),
      },
    });

    // Si era el último vigente del local, vuelve a disponible.
    const otroVigente = await tx.contrato.findFirst({
      where: { local_id: contrato.local_id, estado: 'vigente', id: { not: contrato.id } },
    });
    if (!otroVigente) {
      await tx.local.update({
        where: { id: contrato.local_id },
        data: { estado: 'disponible' },
      });
    }
    return updated;
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

  private requireInquilino(actor: AuthenticatedUser): string {
    if (!actor.inquilinoId) {
      throw new ForbiddenException({
        code: 'INQUILINO_SCOPE_VIOLATION',
        title: 'Acceso denegado',
        message: 'El usuario inquilino no tiene inquilino asociado.',
      });
    }
    return actor.inquilinoId;
  }

  /** Inquilino solo accede a contratos propios (defensa además del filtro). */
  private assertInquilinoScope(contrato: ContratoModel, actor: AuthenticatedUser): void {
    if (actor.rol === 'inquilino' && contrato.inquilino_id !== this.requireInquilino(actor)) {
      this.throwNotFound('CONTRATO_NOT_FOUND', 'El contrato no existe.');
    }
  }

  private assertFound<T extends ContratoModel>(contrato: T | null): T {
    if (!contrato) {
      this.throwNotFound('CONTRATO_NOT_FOUND', 'El contrato no existe.');
    }
    return contrato;
  }

  private throwNotFound(code: string, message: string): never {
    throw new NotFoundException({ code, title: 'Recurso no encontrado', message });
  }

  /**
   * El RAISE EXCEPTION 'CONTRATO_OVERLAP...' del trigger (T-050) llega vía
   * @prisma/adapter-pg con el texto en `message` → 409 de dominio.
   */
  private rethrowOverlap(err: unknown): void {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('CONTRATO_OVERLAP')) {
      throw new ConflictException({
        code: 'CONTRATO_OVERLAP',
        title: 'Conflicto con el estado actual',
        message: 'Ya existe un contrato vigente solapado para ese local en esas fechas.',
      });
    }
  }

  private toListItem(c: ContratoConRelaciones): ContratoListItem {
    return {
      ...contratoToOutput(c),
      localCodigo: c.local?.codigo ?? null,
      inquilinoRazonSocial: c.inquilino?.razon_social ?? null,
    };
  }

  private toDetail(c: ContratoConRelaciones): ContratoDetailOutput {
    const hoy = new Date();
    const hoyUtc = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate());
    const diasParaVencer =
      c.estado === 'vigente' && c.fecha_fin
        ? Math.round((c.fecha_fin.getTime() - hoyUtc) / 86_400_000)
        : null;
    return {
      ...this.toListItem(c),
      enVentanaT30: diasParaVencer !== null && diasParaVencer <= 30 && diasParaVencer > 7,
      enVentanaT7: diasParaVencer !== null && diasParaVencer <= 7 && diasParaVencer >= 0,
    };
  }
}

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Ip,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CreateContratoSchema,
  UpdateContratoSchema,
  CerrarContratoSchema,
  RenovarContratoSchema,
  ListContratosQuerySchema,
  type CreateContratoInput,
  type UpdateContratoInput,
  type CerrarContratoInput,
  type RenovarContratoInput,
  type ListContratosQuery,
} from '@app/contracts';
import { ContratosService, type RequestMeta } from './contratos.service';
import { VencimientoAlertCron } from './cron/vencimiento-alert.cron';
import { AdjuntosService, type UploadedPdf } from '../adjuntos/adjuntos.service';

/** Límite duro del interceptor; el límite real por plaza se valida en el service. */
const ADJUNTO_HARD_LIMIT_BYTES = 100 * 1024 * 1024;
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SkipAuditoria } from '../../common/decorators/auditable.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';

@ApiTags('contratos')
@ApiBearerAuth()
@Controller('contratos')
export class ContratosController {
  constructor(
    private readonly service: ContratosService,
    private readonly vencimientoCron: VencimientoAlertCron,
    private readonly adjuntos: AdjuntosService,
  ) {}

  @Post('cron/test-alertas')
  @Roles('admin_plaza', 'superadmin')
  // T-161: consistencia con los 3 crons dev de `aprobaciones` (T-150) que ya
  // llevan @SkipAuditoria(). Endpoints dev no deben dejar rastro en el log.
  @SkipAuditoria()
  @ApiOperation({ summary: 'Ejecuta manualmente las alertas T-30/T-7 (solo dev, T-056).' })
  testAlertas() {
    // Gate dev-only: en producción la ruta no existe (404).
    if (process.env.NODE_ENV === 'production') {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        title: 'Recurso no encontrado',
        message: 'Ruta no disponible.',
      });
    }
    return this.vencimientoCron.ejecutarAlertas();
  }

  @Post()
  @Roles('admin_plaza', 'superadmin')
  @ApiOperation({ summary: 'Crear contrato vigente (trigger anti-solapamiento; local → alquilado).' })
  create(
    @Body(new ZodValidationPipe(CreateContratoSchema)) body: CreateContratoInput,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    return this.service.create(body, user, this.meta(ip, userAgent, requestId));
  }

  @Get()
  @Roles('admin_plaza', 'superadmin', 'inquilino')
  @ApiOperation({ summary: 'Listar contratos (inquilino: solo los suyos).' })
  findAll(
    @Query(new ZodValidationPipe(ListContratosQuerySchema)) query: ListContratosQuery,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findAll(query, user);
  }

  @Get(':id')
  @Roles('admin_plaza', 'superadmin', 'inquilino')
  @ApiOperation({ summary: 'Detalle de contrato + flags de ventana T-30/T-7.' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.findOne(id, user);
  }

  @Patch(':id')
  @Roles('admin_plaza', 'superadmin')
  @ApiOperation({ summary: 'Editar contrato (solo monto y condiciones; fechas/local/inquilino no).' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateContratoSchema)) body: UpdateContratoInput,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    return this.service.update(id, body, user, this.meta(ip, userAgent, requestId));
  }

  @Post(':id/cerrar')
  @Roles('admin_plaza', 'superadmin')
  @ApiOperation({ summary: 'Cerrar contrato (vigente → finalizado/cancelado; libera el local).' })
  cerrar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(CerrarContratoSchema)) body: CerrarContratoInput,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    return this.service.cerrar(id, body, user, this.meta(ip, userAgent, requestId));
  }

  @Post(':id/renovar')
  @Roles('admin_plaza', 'superadmin')
  @ApiOperation({ summary: 'Renovar contrato (cierra el actual y crea uno nuevo, misma tx).' })
  renovar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(RenovarContratoSchema)) body: RenovarContratoInput,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    return this.service.renovar(id, body, user, this.meta(ip, userAgent, requestId));
  }

  // ── Adjuntos del contrato (T-062) ─────────────────────────────────────────────

  @Post(':id/adjuntos')
  @Roles('admin_plaza', 'superadmin', 'inquilino')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: ADJUNTO_HARD_LIMIT_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Subir PDF de contrato firmado (inquilino: solo sus contratos).' })
  uploadAdjunto(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: UploadedPdf | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    if (!file) {
      throw new BadRequestException({
        code: 'ADJUNTO_REQUERIDO',
        title: 'Solicitud inválida',
        message: 'Falta el archivo (campo "file").',
      });
    }
    return this.adjuntos.uploadContratoAdjunto(
      id,
      file,
      user,
      this.meta(ip, userAgent, requestId),
    );
  }

  @Get(':id/adjuntos')
  @Roles('admin_plaza', 'superadmin', 'inquilino')
  @ApiOperation({ summary: 'Listar adjuntos del contrato.' })
  listAdjuntos(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.adjuntos.listContratoAdjuntos(id, user);
  }

  private meta(
    ip: string,
    userAgent: string | undefined,
    requestId: string | undefined,
  ): RequestMeta {
    return { ip: ip || null, userAgent: userAgent ?? null, requestId: requestId ?? null };
  }
}

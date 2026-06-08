import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Ip,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CreateSolicitudSchema,
  UpdateSolicitudSchema,
  ListSolicitudesQuerySchema,
  DuplicadosQuerySchema,
  CancelarSolicitudSchema,
  CreateComentarioSchema,
  UpdatePrioridadSchema,
  type CreateSolicitudInput,
  type UpdateSolicitudInput,
  type ListSolicitudesQuery,
  type DuplicadosQuery,
  type CancelarSolicitudInput,
  type CreateComentarioInput,
  type UpdatePrioridadInput,
} from '@app/contracts';
import { SolicitudesService, type RequestMeta } from './solicitudes.service';
import {
  AdjuntosService,
  type UploadedFile as UploadedFileType,
} from '../adjuntos/adjuntos.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';

/** Límite duro del interceptor; el límite real por plaza se valida en el service. */
const ADJUNTO_HARD_LIMIT_BYTES = 100 * 1024 * 1024;

@ApiTags('solicitudes')
@ApiBearerAuth()
@Controller('solicitudes')
export class SolicitudesController {
  constructor(
    private readonly service: SolicitudesService,
    private readonly adjuntos: AdjuntosService,
  ) {}

  // ── Rutas estáticas ANTES de :id ──────────────────────────────────────────────

  @Get('duplicados')
  @Roles('admin_plaza', 'superadmin', 'inquilino')
  @ApiOperation({ summary: 'Heurística de duplicados: mismo local+tipo en 30 días (T-090).' })
  duplicados(
    @Query(new ZodValidationPipe(DuplicadosQuerySchema)) query: DuplicadosQuery,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findDuplicados(query, user);
  }

  // ── CRUD (T-080) ──────────────────────────────────────────────────────────────

  @Post()
  @Roles('inquilino')
  @ApiOperation({ summary: 'Crear solicitud en borrador (prioridad heredada, código SOL-).' })
  create(
    @Body(new ZodValidationPipe(CreateSolicitudSchema)) body: CreateSolicitudInput,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    return this.service.create(body, user, this.meta(ip, userAgent, requestId));
  }

  @Get()
  @Roles('admin_plaza', 'superadmin', 'inquilino')
  @ApiOperation({ summary: 'Listar solicitudes (inquilino: solo las suyas).' })
  findAll(
    @Query(new ZodValidationPipe(ListSolicitudesQuerySchema)) query: ListSolicitudesQuery,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findAll(query, user);
  }

  @Get(':id')
  @Roles('admin_plaza', 'superadmin', 'inquilino')
  @ApiOperation({ summary: 'Detalle + adjuntos + comentarios + historial.' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.findOne(id, user);
  }

  @Patch(':id')
  @Roles('inquilino')
  @ApiOperation({ summary: 'Editar (solo en borrador/requerida_subsanacion; S-FS-F).' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateSolicitudSchema)) body: UpdateSolicitudInput,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    return this.service.update(id, body, user, this.meta(ip, userAgent, requestId));
  }

  // ── Transiciones del inquilino (T-081, T-082, T-083) ──────────────────────────

  @Post(':id/enviar')
  @Roles('inquilino')
  // T-149: 10 req/min — frena ráfagas de envíos (cada envío encola emails).
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Enviar: borrador → enviada (T-V03: el cron asigna a los 15 min).',
  })
  enviar(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    return this.service.enviar(id, user, this.meta(ip, userAgent, requestId));
  }

  @Post(':id/cancelar')
  @Roles('admin_plaza', 'superadmin', 'inquilino')
  @ApiOperation({ summary: 'Cancelar cualquier estado no terminal (sin email).' })
  cancelar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(CancelarSolicitudSchema)) body: CancelarSolicitudInput,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    return this.service.cancelar(id, body.motivo, user, this.meta(ip, userAgent, requestId));
  }

  @Post(':id/subsanar')
  @Roles('inquilino')
  @ApiOperation({
    summary:
      'Reenviar tras subsanación: requerida_subsanacion → enviada (T-V03: vuelve a la cola).',
  })
  subsanar(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    return this.service.reenviar(id, user, this.meta(ip, userAgent, requestId));
  }

  // ── Duplicar (T-084) y prioridad (T-085) ──────────────────────────────────────

  @Post(':id/duplicar')
  @Roles('inquilino')
  @ApiOperation({ summary: 'Duplicar como nuevo borrador (sin adjuntos, fechas reseteadas).' })
  duplicar(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    return this.service.duplicar(id, user, this.meta(ip, userAgent, requestId));
  }

  @Patch(':id/prioridad')
  @Roles('admin_plaza', 'superadmin')
  @ApiOperation({ summary: 'Cambiar prioridad (no en borrador ni terminales).' })
  prioridad(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdatePrioridadSchema)) body: UpdatePrioridadInput,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    return this.service.updatePrioridad(id, body, user, this.meta(ip, userAgent, requestId));
  }

  // ── Comentarios e historial (T-086) ───────────────────────────────────────────

  @Post(':id/comentarios')
  @Roles('admin_plaza', 'superadmin', 'inquilino')
  @ApiOperation({ summary: 'Agregar comentario (decision/subsanacion: solo admin).' })
  addComentario(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(CreateComentarioSchema)) body: CreateComentarioInput,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    return this.service.addComentario(id, body, user, this.meta(ip, userAgent, requestId));
  }

  @Get(':id/comentarios')
  @Roles('admin_plaza', 'superadmin', 'inquilino')
  @ApiOperation({ summary: 'Thread de comentarios (created_at ASC).' })
  listComentarios(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.listComentarios(id, user);
  }

  @Get(':id/historial')
  @Roles('admin_plaza', 'superadmin', 'inquilino')
  @ApiOperation({ summary: 'Historial append-only (created_at ASC).' })
  listHistorial(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.listHistorial(id, user);
  }

  // ── Adjuntos (T-112, máx 10 — T-090) ──────────────────────────────────────────

  @Post(':id/adjuntos')
  @Roles('admin_plaza', 'superadmin', 'inquilino')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: ADJUNTO_HARD_LIMIT_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Subir adjunto (MIME/tamaño por plaza; máx 10 por solicitud).' })
  uploadAdjunto(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: UploadedFileType | undefined,
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
    return this.adjuntos.uploadSolicitudAdjunto(
      id,
      file,
      user,
      this.meta(ip, userAgent, requestId),
    );
  }

  @Get(':id/adjuntos')
  @Roles('admin_plaza', 'superadmin', 'inquilino')
  @ApiOperation({ summary: 'Listar adjuntos vivos de la solicitud.' })
  listAdjuntos(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.adjuntos.listSolicitudAdjuntos(id, user);
  }

  private meta(
    ip: string,
    userAgent: string | undefined,
    requestId: string | undefined,
  ): RequestMeta {
    return { ip: ip || null, userAgent: userAgent ?? null, requestId: requestId ?? null };
  }
}

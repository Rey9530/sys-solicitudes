import {
  Body,
  Controller,
  Get,
  Headers,
  Ip,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AprobarSolicitudSchema,
  RechazarSolicitudSchema,
  SubsanarSolicitudAdminSchema,
  ReasignarSolicitudSchema,
  LiberarSolicitudSchema,
  BandejaQuerySchema,
  type AprobarSolicitudInput,
  type RechazarSolicitudInput,
  type SubsanarSolicitudAdminInput,
  type ReasignarSolicitudInput,
  type LiberarSolicitudInput,
  type BandejaQuery,
} from '@app/contracts';
import { AprobacionesService, type RequestMeta } from './aprobaciones.service';
import { AutoAsignacionCron } from './cron/auto-asignacion.cron';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';

/**
 * Acciones de aprobación del flujo (módulo 07). Comparte el prefijo
 * `/solicitudes` con SolicitudesController (Nest fusiona las rutas):
 * el REST queda coherente bajo el recurso solicitud.
 */
@ApiTags('aprobaciones')
@ApiBearerAuth()
@Controller('solicitudes')
export class AprobacionesController {
  constructor(
    private readonly service: AprobacionesService,
    private readonly autoAsignacion: AutoAsignacionCron,
  ) {}

  // Ruta estática antes de :id.
  @Get('bandeja')
  @Roles('admin_plaza', 'superadmin')
  @ApiOperation({ summary: 'Bandeja priorizada (enviada/asignado/en_revision; T-099).' })
  bandeja(
    @Query(new ZodValidationPipe(BandejaQuerySchema)) query: BandejaQuery,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.bandeja(query, user);
  }

  @Post('cron/test-auto-asignacion')
  @Roles('admin_plaza', 'superadmin')
  @ApiOperation({ summary: 'Ejecuta la auto-asignación manualmente (solo dev, T-091b).' })
  testAutoAsignacion() {
    if (process.env.NODE_ENV === 'production') {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        title: 'Recurso no encontrado',
        message: 'Ruta no disponible.',
      });
    }
    return this.autoAsignacion.ejecutar();
  }

  @Post(':id/tomar')
  @Roles('admin_plaza', 'superadmin')
  @ApiOperation({
    summary: 'Tomar: asignado→en_revision (solo el asignado) o enviada→en_revision (cola).',
  })
  tomar(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    return this.service.tomar(id, user, this.meta(ip, userAgent, requestId));
  }

  @Post(':id/liberar')
  @Roles('admin_plaza', 'superadmin')
  @ApiOperation({ summary: 'Liberar: vuelve a la cola enviada (solo el asignado).' })
  liberar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(LiberarSolicitudSchema)) body: LiberarSolicitudInput,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    return this.service.liberar(id, body, user, this.meta(ip, userAgent, requestId));
  }

  @Post(':id/aprobar')
  @Roles('admin_plaza', 'superadmin')
  @ApiOperation({
    summary: 'Aprobar (T6, SC-4): evento→calendario; remodelación→local en mantenimiento.',
  })
  aprobar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(AprobarSolicitudSchema)) body: AprobarSolicitudInput,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    return this.service.aprobar(id, body, user, this.meta(ip, userAgent, requestId));
  }

  @Post(':id/rechazar')
  @Roles('admin_plaza', 'superadmin')
  @ApiOperation({ summary: 'Rechazar (T7): comentario obligatorio; SC-4.' })
  rechazar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(RechazarSolicitudSchema)) body: RechazarSolicitudInput,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    return this.service.rechazar(id, body, user, this.meta(ip, userAgent, requestId));
  }

  @Post(':id/pedir-subsanacion')
  @Roles('admin_plaza', 'superadmin')
  @ApiOperation({
    summary: 'Pedir subsanación (T8): comentario obligatorio; queda sin asignar.',
  })
  pedirSubsanacion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(SubsanarSolicitudAdminSchema)) body: SubsanarSolicitudAdminInput,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    return this.service.pedirSubsanacion(id, body, user, this.meta(ip, userAgent, requestId));
  }

  @Post(':id/reasignar')
  @Roles('admin_plaza', 'superadmin')
  @ApiOperation({ summary: 'Reasignar (T12): en asignado/en_revision; SC-6; sin lock (T-V03).' })
  reasignar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ReasignarSolicitudSchema)) body: ReasignarSolicitudInput,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    return this.service.reasignar(id, body, user, this.meta(ip, userAgent, requestId));
  }

  private meta(
    ip: string,
    userAgent: string | undefined,
    requestId: string | undefined,
  ): RequestMeta {
    return { ip: ip || null, userAgent: userAgent ?? null, requestId: requestId ?? null };
  }
}

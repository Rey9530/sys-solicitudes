import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
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
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CreateLocalSchema,
  UpdateLocalSchema,
  ListLocalesQuerySchema,
  ListContratoHistorialQuerySchema,
  FueraDeServicioSchema,
  type CreateLocalInput,
  type UpdateLocalInput,
  type ListLocalesQuery,
  type ListContratoHistorialQuery,
  type FueraDeServicioInput,
} from '@app/contracts';
import { LocalesService, type RequestMeta } from './locales.service';
import { AdjuntosService, type UploadedFile as UploadedFileType } from '../adjuntos/adjuntos.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';

const ADJUNTO_HARD_LIMIT_BYTES = 100 * 1024 * 1024;

@ApiTags('locales')
@ApiBearerAuth()
@Controller('locales')
export class LocalesController {
  constructor(
    private readonly service: LocalesService,
    private readonly adjuntos: AdjuntosService,
  ) {}

  @Post()
  @Roles('admin_plaza', 'superadmin')
  @ApiOperation({ summary: 'Crear local (estado inicial: disponible).' })
  create(
    @Body(new ZodValidationPipe(CreateLocalSchema)) body: CreateLocalInput,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    return this.service.create(body, user, this.meta(ip, userAgent, requestId));
  }

  @Get()
  @Roles('admin_plaza', 'superadmin', 'inquilino')
  @ApiOperation({ summary: 'Listar locales (inquilino: solo los suyos con contrato vigente).' })
  findAll(
    @Query(new ZodValidationPipe(ListLocalesQuerySchema)) query: ListLocalesQuery,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findAll(query, user);
  }

  @Get(':id')
  @Roles('admin_plaza', 'superadmin', 'inquilino')
  @ApiOperation({ summary: 'Detalle de local + contrato vigente + histórico.' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.findOne(id, user);
  }

  @Get(':id/contratos')
  @Roles('admin_plaza', 'superadmin')
  @ApiOperation({ summary: 'Historial de contratos del local (T-061).' })
  findContratos(
    @Param('id', ParseUUIDPipe) id: string,
    @Query(new ZodValidationPipe(ListContratoHistorialQuerySchema))
    query: ListContratoHistorialQuery,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findContratos(id, query, user);
  }

  @Patch(':id')
  @Roles('admin_plaza', 'superadmin')
  @ApiOperation({ summary: 'Editar local (estado con reglas RI-2).' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateLocalSchema)) body: UpdateLocalInput,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    return this.service.update(id, body, user, this.meta(ip, userAgent, requestId));
  }

  @Post(':id/fuera-de-servicio')
  @Roles('admin_plaza', 'superadmin')
  @ApiOperation({
    summary: 'Baja a fuera_de_servicio con rechazo masivo opcional de solicitudes (T-108).',
  })
  fueraDeServicio(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(FueraDeServicioSchema)) body: FueraDeServicioInput,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    return this.service.fueraDeServicio(
      id,
      body.motivo,
      body.rechazarSolicitudesPendientes,
      user,
      this.meta(ip, userAgent, requestId),
    );
  }

  @Delete(':id')
  @Roles('admin_plaza', 'superadmin')
  @HttpCode(204)
  @ApiOperation({ summary: 'Desactivar local (soft delete; 409 si tiene contrato vigente).' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ): Promise<void> {
    await this.service.remove(id, user, this.meta(ip, userAgent, requestId));
  }

  // ── Adjuntos del local (T-116) ────────────────────────────────────────────────

  @Post(':id/adjuntos')
  @Roles('admin_plaza', 'superadmin')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: ADJUNTO_HARD_LIMIT_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Subir plano/foto de local (PNG/JPEG/WEBP).' })
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
    return this.adjuntos.uploadLocalAdjunto(id, file, user, this.meta(ip, userAgent, requestId));
  }

  @Get(':id/adjuntos')
  @Roles('admin_plaza', 'superadmin')
  @ApiOperation({ summary: 'Listar adjuntos vivos del local.' })
  listAdjuntos(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.adjuntos.listLocalAdjuntos(id, user);
  }

  private meta(
    ip: string,
    userAgent: string | undefined,
    requestId: string | undefined,
  ): RequestMeta {
    return { ip: ip || null, userAgent: userAgent ?? null, requestId: requestId ?? null };
  }
}

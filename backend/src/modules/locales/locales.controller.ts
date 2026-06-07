import {
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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';

@ApiTags('locales')
@ApiBearerAuth()
@Controller('locales')
export class LocalesController {
  constructor(private readonly service: LocalesService) {}

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

  private meta(
    ip: string,
    userAgent: string | undefined,
    requestId: string | undefined,
  ): RequestMeta {
    return { ip: ip || null, userAgent: userAgent ?? null, requestId: requestId ?? null };
  }
}

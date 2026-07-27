import { Body, Controller, Get, Headers, Ip, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UpdateConfiguracionSchema, type UpdateConfiguracionInput } from '@app/contracts';
import { ConfiguracionService } from './configuracion.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';
import type { RequestMeta } from '../plazas/plazas.service';

@ApiTags('plazas')
@ApiBearerAuth()
@Controller('configuracion')
export class ConfiguracionController {
  constructor(private readonly service: ConfiguracionService) {}

  @Get()
  @Roles('admin_plaza')
  @RequirePermission('configuracion.ver')
  @ApiOperation({ summary: 'Configuración de la plaza del usuario autenticado.' })
  get(@CurrentUser() user: AuthenticatedUser) {
    return this.service.get(user);
  }

  @Patch()
  @Roles('admin_plaza')
  // T-RBAC-1: la edición unificada cubre todos los tabs (SLA, branding,
  // adjuntos, calendario, general). El gating fino a nivel de campo podría
  // granularizarse en el service si el cliente lo pide (v1 acepta este OR
  // global para simplificar la UX: "Editar configuración" → un solo permiso).
  @RequirePermission([
    'configuracion.editar_general',
    'configuracion.editar_branding',
    'configuracion.editar_sla',
    'configuracion.editar_adjuntos',
    'configuracion.editar_calendario',
  ])
  @ApiOperation({ summary: 'Editar configuración (SLA, MIME, tamaño máx, calendario).' })
  update(
    @Body(new ZodValidationPipe(UpdateConfiguracionSchema)) body: UpdateConfiguracionInput,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    const meta: RequestMeta = { ip: ip || null, userAgent: userAgent ?? null, requestId: requestId ?? null };
    return this.service.update(body, user, meta);
  }
}

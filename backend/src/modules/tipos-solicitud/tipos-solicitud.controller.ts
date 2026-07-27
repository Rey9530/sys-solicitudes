import {
  Body,
  Controller,
  Get,
  Headers,
  Ip,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  UpdateSolicitudTipoConfigSchema,
  ListSolicitudTiposConfigQuerySchema,
  type UpdateSolicitudTipoConfigInput,
  type ListSolicitudTiposConfigQuery,
} from '@app/contracts';
import { TiposSolicitudService, type RequestMeta } from './tipos-solicitud.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';

@ApiTags('tipos-solicitud')
@ApiBearerAuth()
@Controller()
export class TiposSolicitudController {
  constructor(private readonly service: TiposSolicitudService) {}

  // ── Listado público (para wizard / reportes) ──────────────────────────────
  // Vive en /solicitudes/tipos (NO /tipos-solicitud/activos) para mantener
  // cohesión: es "información derivada de la solicitud" para el inquilino.

  @Get('solicitudes/tipos')
  @Roles('admin_plaza', 'superadmin', 'inquilino')
  @RequirePermission('tipos_solicitud.listar')
  @ApiOperation({
    summary:
      'Listar tipos de solicitud activos de la plaza actual (wizard, reportes). Orden: orden ASC, codigo ASC.',
  })
  findAllActivos(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findAllActivos(user);
  }

  // ── Endpoints admin (CRUD de configuración por plaza) ─────────────────────

  @Get('admin/tipos-solicitud')
  @Roles('admin_plaza', 'superadmin')
  @RequirePermission('tipos_solicitud.listar')
  @ApiOperation({
    summary: 'Listar configuración de tipos (paginado, filtro activo). T-V20.',
  })
  findAll(
    @Query(new ZodValidationPipe(ListSolicitudTiposConfigQuerySchema))
    query: ListSolicitudTiposConfigQuery,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findAll(query, user);
  }

  @Get('admin/tipos-solicitud/:id')
  @Roles('admin_plaza', 'superadmin')
  @RequirePermission('tipos_solicitud.listar')
  @ApiOperation({ summary: 'Detalle de configuración de un tipo.' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.findOne(id, user);
  }

  @Patch('admin/tipos-solicitud/:id')
  @Roles('admin_plaza', 'superadmin')
  @RequirePermission('tipos_solicitud.editar')
  @ApiOperation({
    summary:
      'Editar etiqueta/descripcion/orden/activo. Reglas: `otro` no se desactiva; tipo con solicitudes activas no se desactiva.',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateSolicitudTipoConfigSchema))
    body: UpdateSolicitudTipoConfigInput,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    return this.service.update(
      id,
      body,
      user,
      this.meta(ip, userAgent, requestId),
    );
  }

  private meta(
    ip: string,
    userAgent: string | undefined,
    requestId: string | undefined,
  ): RequestMeta {
    return { ip: ip || null, userAgent: userAgent ?? null, requestId: requestId ?? null };
  }
}

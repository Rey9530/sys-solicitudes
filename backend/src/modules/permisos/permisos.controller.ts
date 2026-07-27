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
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AsignarPermisosInputSchema,
  type AsignarPermisosInput,
} from '@app/contracts';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PermisosService, type RequestMeta } from './permisos.service';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';

/**
 * T-RBAC-1: endpoints de gestión de la matriz de permisos.
 *
 * Rutas (prefijo /api/v1):
 *  - GET    /permisos                                Catálogo global agrupado por módulo.
 *  - GET    /permisos/roles/:rolStaffId              Permisos asignados al rol.
 *  - PUT    /permisos/roles/:rolStaffId              Reemplaza el set completo del rol.
 *  - POST   /permisos/roles/:rolStaffId/permisos/:id Asigna un permiso individual.
 *  - DELETE /permisos/roles/:rolStaffId/permisos/:id Quita un permiso individual.
 *
 * Los endpoints de escritura requieren `permisos.asignar_a_roles` (alias
 * `roles_staff.gestionar_permisos` para mantener coherencia con la matriz UI).
 */
@ApiTags('permisos')
@ApiBearerAuth()
@Controller('permisos')
export class PermisosController {
  constructor(private readonly service: PermisosService) {}

  @Get()
  @Roles('admin_plaza', 'superadmin')
  @RequirePermission('permisos.ver_matriz')
  @ApiOperation({
    summary: 'Catálogo global de permisos, agrupado por módulo.',
  })
  listarCatalogo() {
    return this.service.listarCatalogo();
  }

  @Get('roles/:rolStaffId')
  @Roles('admin_plaza', 'superadmin')
  @RequirePermission('permisos.ver_matriz')
  @ApiOperation({
    summary: 'Permisos efectivos asignados a un rol_staff concreto.',
  })
  listarDeRol(
    @Param('rolStaffId', new ParseUUIDPipe()) rolStaffId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.listarDeRol(rolStaffId, user);
  }

  @Put('roles/:rolStaffId')
  @Roles('admin_plaza', 'superadmin')
  @RequirePermission(['roles_staff.gestionar_permisos', 'permisos.asignar_a_roles'])
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Reemplaza el set completo de permisos del rol (PUT idempotente). Bloqueado si es_sistema=true.',
  })
  async asignar(
    @Param('rolStaffId', new ParseUUIDPipe()) rolStaffId: string,
    @Body(new ZodValidationPipe(AsignarPermisosInputSchema)) body: AsignarPermisosInput,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    return this.service.asignarPermisos(rolStaffId, body, user, this.meta(ip, userAgent, requestId));
  }

  @Post('roles/:rolStaffId/permisos/:permisoId')
  @Roles('admin_plaza', 'superadmin')
  @RequirePermission(['roles_staff.gestionar_permisos', 'permisos.asignar_a_roles'])
  @ApiOperation({ summary: 'Asigna un permiso individual al rol.' })
  async agregar(
    @Param('rolStaffId', new ParseUUIDPipe()) rolStaffId: string,
    @Param('permisoId', new ParseUUIDPipe()) permisoId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    return this.service.agregarPermiso(rolStaffId, permisoId, user, this.meta(ip, userAgent, requestId));
  }

  @Delete('roles/:rolStaffId/permisos/:permisoId')
  @Roles('admin_plaza', 'superadmin')
  @RequirePermission(['roles_staff.gestionar_permisos', 'permisos.asignar_a_roles'])
  @HttpCode(200)
  @ApiOperation({ summary: 'Quita un permiso individual al rol.' })
  async quitar(
    @Param('rolStaffId', new ParseUUIDPipe()) rolStaffId: string,
    @Param('permisoId', new ParseUUIDPipe()) permisoId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    return this.service.quitarPermiso(rolStaffId, permisoId, user, this.meta(ip, userAgent, requestId));
  }

  private meta(
    ip: string,
    userAgent: string | undefined,
    requestId: string | undefined,
  ): RequestMeta {
    return { ip: ip || null, userAgent: userAgent ?? null, requestId: requestId ?? null };
  }
}
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
  CreateRolStaffSchema,
  ListRolesStaffQuerySchema,
  UpdateRolStaffSchema,
  type CreateRolStaffInput,
  type ListRolesStaffQuery,
  type UpdateRolStaffInput,
} from '@app/contracts';
import { RolesStaffService, type RequestMeta } from './roles-staff.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';

/**
 * CRUD de roles de staff (T-035). Endpoints:
 *  - GET  /roles-staff?activo=true|false&search=&page=&pageSize=  (cualquier rol autenticado)
 *  - GET  /roles-staff/con-asignaciones  (admin_plaza/superadmin: badges)
 *  - POST /roles-staff  (admin_plaza/superadmin)
 *  - GET  /roles-staff/:id
 *  - PATCH /roles-staff/:id
 *  - DELETE /roles-staff/:id  (soft delete; devuelve usuariosAsignados)
 */
@ApiTags('roles-staff')
@ApiBearerAuth()
@Controller('roles-staff')
export class RolesStaffController {
  constructor(private readonly service: RolesStaffService) {}

  @Get('con-asignaciones')
  @Roles('admin_plaza', 'superadmin')
  @ApiOperation({
    summary: 'Listar roles de staff con conteo de usuarios asignados (admin plaza).',
  })
  listConAsignaciones(@CurrentUser() user: AuthenticatedUser) {
    return this.service.listConAsignaciones(user);
  }

  @Get()
  @ApiOperation({ summary: 'Listar roles de staff de la plaza (paginado).' })
  findAll(
    @Query(new ZodValidationPipe(ListRolesStaffQuerySchema)) query: ListRolesStaffQuery,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findAll(query, user);
  }

  @Post()
  @Roles('admin_plaza', 'superadmin')
  @ApiOperation({ summary: 'Crear rol de staff en la plaza.' })
  create(
    @Body(new ZodValidationPipe(CreateRolStaffSchema)) body: CreateRolStaffInput,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    return this.service.create(body, user, this.meta(ip, userAgent, requestId));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un rol de staff.' })
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findOne(id, user);
  }

  @Patch(':id')
  @Roles('admin_plaza', 'superadmin')
  @ApiOperation({ summary: 'Editar rol de staff (nombre/descripcion/activo).' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateRolStaffSchema)) body: UpdateRolStaffInput,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    return this.service.update(id, body, user, this.meta(ip, userAgent, requestId));
  }

  @Delete(':id')
  @Roles('admin_plaza', 'superadmin')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Desactivar rol de staff (soft delete; RN-RS-3: devuelve usuariosAsignados).',
  })
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ): Promise<{ rol: unknown; usuariosAsignados: number }> {
    return this.service.softDelete(id, user, this.meta(ip, userAgent, requestId));
  }

  private meta(
    ip: string,
    userAgent: string | undefined,
    requestId: string | undefined,
  ): RequestMeta {
    return { ip: ip || null, userAgent: userAgent ?? null, requestId: requestId ?? null };
  }
}

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
  CreateUsuarioSchema,
  DisableUsuarioSchema,
  ListUsuariosQuerySchema,
  UpdateUsuarioSchema,
  type CreateUsuarioInput,
  type ListUsuariosQuery,
  type UpdateUsuarioInput,
} from '@app/contracts';
import { UsuariosService, type RequestMeta } from './usuarios.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';

/**
 * CRUD mínimo de usuarios (subconjunto de T-034, adelantado por T-059).
 * Endpoints adicionales T-059-bis para gestión desde la pestaña "Usuarios"
 * del detalle de inquilino: PATCH (nombre/teléfono), DELETE (soft delete),
 * POST :id/reset-password (admin dispara reset por email), POST :id/reactivate.
 */
@ApiTags('usuarios')
@ApiBearerAuth()
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly service: UsuariosService) {}

  @Get()
  @Roles('admin_plaza', 'superadmin')
  @ApiOperation({ summary: 'Listar usuarios de la plaza (mínimo de T-034, para selectores).' })
  findAll(
    @Query(new ZodValidationPipe(ListUsuariosQuerySchema)) query: ListUsuariosQuery,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findAll(query, user);
  }

  @Post()
  @Roles('admin_plaza', 'superadmin')
  @ApiOperation({ summary: 'Crear usuario de plaza (alta rápida de inquilino, T-059).' })
  create(
    @Body(new ZodValidationPipe(CreateUsuarioSchema)) body: CreateUsuarioInput,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    return this.service.create(body, user, this.meta(ip, userAgent, requestId));
  }

  @Patch(':id')
  @Roles('admin_plaza', 'superadmin')
  @ApiOperation({
    summary: 'Editar nombre/teléfono de un usuario (T-059-bis, vista por inquilino).',
  })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateUsuarioSchema)) body: UpdateUsuarioInput,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    return this.service.update(id, body, user, this.meta(ip, userAgent, requestId));
  }

  @Get(':id')
  @Roles('admin_plaza', 'superadmin')
  @ApiOperation({
    summary:
      'Detalle de un usuario de la plaza (incluye rol_staff para badges en el FE).',
  })
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findOne(id, user);
  }

  @Delete(':id')
  @Roles('admin_plaza', 'superadmin')
  @HttpCode(204)
  @ApiOperation({
    summary:
      'Deshabilitar usuario (soft delete; T-059-bis, roles inquilino o admin_plaza; 409 RN-AU-5 si es el último admin activo; body opcional {motivo}).',
  })
  async disable(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ): Promise<void> {
    const parsed = DisableUsuarioSchema.safeParse(body ?? {});
    const motivo = parsed.success ? parsed.data.motivo : undefined;
    await this.service.disable(id, user, this.meta(ip, userAgent, requestId), motivo);
  }

  @Post(':id/reset-password')
  @Roles('admin_plaza', 'superadmin')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Disparar reset de contraseña por email (T-059-bis, admin conoce al usuario; 409 si email inválido).',
  })
  async adminPasswordReset(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ): Promise<{ id: string; email: string; message: string }> {
    const result = await this.service.adminPasswordReset(
      id,
      user,
      this.meta(ip, userAgent, requestId),
    );
    return { ...result, message: 'Si el email es válido, el usuario recibirá un enlace de reseteo.' };
  }

  @Post(':id/reactivate')
  @Roles('admin_plaza', 'superadmin')
  @ApiOperation({
    summary: 'Reactivar usuario (revierte soft delete; T-059-bis, solo rol inquilino).',
  })
  reactivate(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    return this.service.reactivate(id, user, this.meta(ip, userAgent, requestId));
  }

  @Post(':id/reset-email-invalido')
  @Roles('admin_plaza', 'superadmin')
  @ApiOperation({ summary: 'Resetear email_invalido tras corregir la dirección (T-124).' })
  resetEmailInvalido(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    return this.service.resetEmailInvalido(id, user, this.meta(ip, userAgent, requestId));
  }

  private meta(
    ip: string,
    userAgent: string | undefined,
    requestId: string | undefined,
  ): RequestMeta {
    return { ip: ip || null, userAgent: userAgent ?? null, requestId: requestId ?? null };
  }
}

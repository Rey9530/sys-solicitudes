import { Body, Controller, Get, Headers, Ip, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CreateUsuarioSchema,
  ListUsuariosQuerySchema,
  type CreateUsuarioInput,
  type ListUsuariosQuery,
} from '@app/contracts';
import { UsuariosService } from './usuarios.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';

/**
 * Versión MÍNIMA (subconjunto de T-034, adelantado por T-059): solo creación.
 * El CRUD completo se implementa en T-034.
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
    return this.service.create(body, user, {
      ip: ip || null,
      userAgent: userAgent ?? null,
      requestId: requestId ?? null,
    });
  }
}

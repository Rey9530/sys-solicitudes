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
  CreateInquilinoSchema,
  UpdateInquilinoSchema,
  ListInquilinosQuerySchema,
  ListContratoHistorialQuerySchema,
  ListUsuariosQuerySchema,
  type CreateInquilinoInput,
  type UpdateInquilinoInput,
  type ListInquilinosQuery,
  type ListContratoHistorialQuery,
  type ListUsuariosQuery,
} from '@app/contracts';
import { InquilinosService, type RequestMeta } from './inquilinos.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';

@ApiTags('inquilinos')
@ApiBearerAuth()
@Controller('inquilinos')
export class InquilinosController {
  constructor(
    private readonly service: InquilinosService,
    private readonly usuarios: UsuariosService,
  ) {}

  @Post()
  @Roles('admin_plaza', 'superadmin')
  @RequirePermission('inquilinos.crear')
  @ApiOperation({ summary: 'Crear inquilino.' })
  create(
    @Body(new ZodValidationPipe(CreateInquilinoSchema)) body: CreateInquilinoInput,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    return this.service.create(body, user, this.meta(ip, userAgent, requestId));
  }

  @Get()
  @Roles('admin_plaza', 'superadmin', 'inquilino')
  @RequirePermission('inquilinos.listar')
  @ApiOperation({ summary: 'Listar inquilinos (inquilino: solo su propio registro).' })
  findAll(
    @Query(new ZodValidationPipe(ListInquilinosQuerySchema)) query: ListInquilinosQuery,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findAll(query, user);
  }

  @Get(':id')
  @Roles('admin_plaza', 'superadmin', 'inquilino')
  @RequirePermission('inquilinos.listar')
  @ApiOperation({ summary: 'Detalle de inquilino + contratos activos + histórico.' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.findOne(id, user);
  }

  @Get(':id/contratos')
  @Roles('admin_plaza', 'superadmin', 'inquilino')
  @RequirePermission('contratos.listar')
  @ApiOperation({ summary: 'Historial de contratos del inquilino (T-061).' })
  findContratos(
    @Param('id', ParseUUIDPipe) id: string,
    @Query(new ZodValidationPipe(ListContratoHistorialQuerySchema))
    query: ListContratoHistorialQuery,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findContratos(id, query, user);
  }

  @Get(':id/usuarios')
  @Roles('admin_plaza', 'superadmin', 'inquilino')
  @RequirePermission(['usuarios_plaza.listar', 'inquilinos.listar'])
  @ApiOperation({
    summary:
      'Listar usuarios asociados al inquilino (T-059-bis, pestaña "Usuarios" del detalle).',
  })
  findUsuarios(
    @Param('id', ParseUUIDPipe) id: string,
    @Query(new ZodValidationPipe(ListUsuariosQuerySchema)) query: ListUsuariosQuery,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.usuarios.findByInquilino(id, query, user);
  }

  @Patch(':id')
  @Roles('admin_plaza', 'superadmin')
  @RequirePermission('inquilinos.editar')
  @ApiOperation({ summary: 'Editar inquilino (solo contacto y dirección).' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateInquilinoSchema)) body: UpdateInquilinoInput,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    return this.service.update(id, body, user, this.meta(ip, userAgent, requestId));
  }

  @Delete(':id')
  @Roles('admin_plaza', 'superadmin')
  @RequirePermission('inquilinos.deshabilitar')
  @HttpCode(204)
  @ApiOperation({ summary: 'Desactivar inquilino (soft delete; 409 si tiene contrato vigente).' })
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

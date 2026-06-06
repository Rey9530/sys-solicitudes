import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Ip,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CreateCategoriaSchema,
  UpdateCategoriaSchema,
  ListCategoriasQuerySchema,
  CreateSubcategoriaSchema,
  UpdateSubcategoriaSchema,
  ListSubcategoriasQuerySchema,
  SetResponsableSubcategoriaSchema,
  AddSupervisorSubcategoriaSchema,
  type CreateCategoriaInput,
  type UpdateCategoriaInput,
  type ListCategoriasQuery,
  type CreateSubcategoriaInput,
  type UpdateSubcategoriaInput,
  type ListSubcategoriasQuery,
  type SetResponsableSubcategoriaInput,
  type AddSupervisorSubcategoriaInput,
} from '@app/contracts';
import { CategoriasService, type RequestMeta } from './categorias.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';

@ApiTags('categorias')
@ApiBearerAuth()
@Controller('categorias')
export class CategoriasController {
  constructor(private readonly service: CategoriasService) {}

  // ── Categorías (T-067) ────────────────────────────────────────────────────────

  @Post()
  @Roles('admin_plaza', 'superadmin')
  @ApiOperation({ summary: 'Crear categoría de la plaza.' })
  createCategoria(
    @Body(new ZodValidationPipe(CreateCategoriaSchema)) body: CreateCategoriaInput,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    return this.service.createCategoria(body, user, this.meta(ip, userAgent, requestId));
  }

  @Get()
  @Roles('admin_plaza', 'superadmin', 'inquilino')
  @ApiOperation({ summary: 'Listar categorías (inquilino: solo activas).' })
  findAllCategorias(
    @Query(new ZodValidationPipe(ListCategoriasQuerySchema)) query: ListCategoriasQuery,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findAllCategorias(query, user);
  }

  @Get(':id')
  @Roles('admin_plaza', 'superadmin', 'inquilino')
  @ApiOperation({ summary: 'Detalle de categoría + subcategorías activas.' })
  findOneCategoria(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.findOneCategoria(id, user);
  }

  @Patch(':id')
  @Roles('admin_plaza', 'superadmin')
  @ApiOperation({ summary: 'Editar categoría (desactivar exige sin subcategorías activas).' })
  updateCategoria(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdateCategoriaSchema)) body: UpdateCategoriaInput,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    return this.service.updateCategoria(id, body, user, this.meta(ip, userAgent, requestId));
  }

  @Delete(':id')
  @Roles('admin_plaza', 'superadmin')
  @ApiOperation({ summary: 'Desactivar categoría (soft delete vía activo=false).' })
  deleteCategoria(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    return this.service.deleteCategoria(id, user, this.meta(ip, userAgent, requestId));
  }

  // ── Subcategorías (T-068) ─────────────────────────────────────────────────────

  @Post(':id/subcategorias')
  @Roles('admin_plaza', 'superadmin')
  @ApiOperation({ summary: 'Crear subcategoría (1 responsable + 0..5 supervisores, SC-6).' })
  createSubcategoria(
    @Param('id', ParseUUIDPipe) categoriaId: string,
    @Body(new ZodValidationPipe(CreateSubcategoriaSchema)) body: CreateSubcategoriaInput,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    return this.service.createSubcategoria(
      categoriaId,
      body,
      user,
      this.meta(ip, userAgent, requestId),
    );
  }

  @Get(':id/subcategorias')
  @Roles('admin_plaza', 'superadmin', 'inquilino')
  @ApiOperation({ summary: 'Listar subcategorías de la categoría (inquilino: solo activas).' })
  findAllSubcategorias(
    @Param('id', ParseUUIDPipe) categoriaId: string,
    @Query(new ZodValidationPipe(ListSubcategoriasQuerySchema)) query: ListSubcategoriasQuery,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findAllSubcategorias(categoriaId, query, user);
  }

  @Get(':id/subcategorias/:subId')
  @Roles('admin_plaza', 'superadmin', 'inquilino')
  @ApiOperation({ summary: 'Detalle de subcategoría + responsable + supervisores.' })
  findOneSubcategoria(
    @Param('id', ParseUUIDPipe) categoriaId: string,
    @Param('subId', ParseUUIDPipe) subId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findOneSubcategoria(categoriaId, subId, user);
  }

  @Patch(':id/subcategorias/:subId')
  @Roles('admin_plaza', 'superadmin')
  @ApiOperation({ summary: 'Editar subcategoría (nombre, descripción, prioridad, activo).' })
  updateSubcategoria(
    @Param('id', ParseUUIDPipe) categoriaId: string,
    @Param('subId', ParseUUIDPipe) subId: string,
    @Body(new ZodValidationPipe(UpdateSubcategoriaSchema)) body: UpdateSubcategoriaInput,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    return this.service.updateSubcategoria(
      categoriaId,
      subId,
      body,
      user,
      this.meta(ip, userAgent, requestId),
    );
  }

  @Delete(':id/subcategorias/:subId')
  @Roles('admin_plaza', 'superadmin')
  @ApiOperation({ summary: 'Desactivar subcategoría (soft delete vía activo=false).' })
  deleteSubcategoria(
    @Param('id', ParseUUIDPipe) categoriaId: string,
    @Param('subId', ParseUUIDPipe) subId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    return this.service.deleteSubcategoria(
      categoriaId,
      subId,
      user,
      this.meta(ip, userAgent, requestId),
    );
  }

  // ── Responsable (T-069) ───────────────────────────────────────────────────────

  @Patch(':id/subcategorias/:subId/responsable')
  @Roles('admin_plaza', 'superadmin')
  @ApiOperation({
    summary: 'Cambiar responsable de la subcategoría (SC-6; reasignación masiva en módulo 07).',
  })
  setResponsable(
    @Param('id', ParseUUIDPipe) categoriaId: string,
    @Param('subId', ParseUUIDPipe) subId: string,
    @Body(new ZodValidationPipe(SetResponsableSubcategoriaSchema))
    body: SetResponsableSubcategoriaInput,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    return this.service.setResponsable(
      categoriaId,
      subId,
      body.responsableId,
      user,
      this.meta(ip, userAgent, requestId),
    );
  }

  // ── Supervisores (T-070) ──────────────────────────────────────────────────────

  @Post(':id/subcategorias/:subId/supervisores')
  @Roles('admin_plaza', 'superadmin')
  @ApiOperation({ summary: 'Agregar supervisor (máx 5, idempotente).' })
  addSupervisor(
    @Param('id', ParseUUIDPipe) categoriaId: string,
    @Param('subId', ParseUUIDPipe) subId: string,
    @Body(new ZodValidationPipe(AddSupervisorSubcategoriaSchema))
    body: AddSupervisorSubcategoriaInput,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    return this.service.addSupervisor(
      categoriaId,
      subId,
      body.usuarioId,
      user,
      this.meta(ip, userAgent, requestId),
    );
  }

  @Delete(':id/subcategorias/:subId/supervisores/:usuarioId')
  @Roles('admin_plaza', 'superadmin')
  @ApiOperation({ summary: 'Quitar supervisor de la subcategoría.' })
  removeSupervisor(
    @Param('id', ParseUUIDPipe) categoriaId: string,
    @Param('subId', ParseUUIDPipe) subId: string,
    @Param('usuarioId', ParseUUIDPipe) usuarioId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    return this.service.removeSupervisor(
      categoriaId,
      subId,
      usuarioId,
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

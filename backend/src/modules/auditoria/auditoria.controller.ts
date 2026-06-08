import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ListAuditoriaQuerySchema, type ListAuditoriaQuery } from '@app/contracts';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuditoriaService } from './auditoria.service';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';

/**
 * T-146 (decisión owner): consulta del log de auditoría.
 * `admin_plaza` ve su plaza; `superadmin` todas (incluidas acciones de
 * plataforma con plaza_id NULL). Sin UI en v1.
 */
@ApiTags('auditoria')
@ApiBearerAuth()
@Controller('auditoria')
export class AuditoriaController {
  constructor(private readonly service: AuditoriaService) {}

  @Get()
  @Roles('admin_plaza', 'superadmin')
  @ApiOperation({ summary: 'Log de auditoría con filtros (acción/entidad/usuario/fechas).' })
  findAll(
    @Query(new ZodValidationPipe(ListAuditoriaQuerySchema)) query: ListAuditoriaQuery,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findAll(query, user);
  }
}

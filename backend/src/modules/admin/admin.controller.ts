import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import {
  ListSolicitudesPlataformaQuerySchema,
  type ListSolicitudesPlataformaQuery,
} from '@app/contracts';
import { AdminService } from './admin.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
export class AdminController {
  constructor(private readonly service: AdminService) {}

  /**
   * T-V25 · Listado cross-plaza de solicitudes para el `superadmin`.
   * Usa `PrismaAdminService` (bypass RLS); `actor.plazaId` se ignora por
   * diseño. Solo lectura: no expone acciones de workflow (SC-5).
   */
  @Get('solicitudes')
  @Roles('superadmin')
  @ApiOperation({
    summary:
      '[superadmin] Listado cross-plaza de solicitudes. Solo lectura. Bypass RLS.',
  })
  findAllSolicitudes(
    @Query(new ZodValidationPipe(ListSolicitudesPlataformaQuerySchema))
    query: ListSolicitudesPlataformaQuery,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findAllSolicitudes(query, user);
  }

  /**
   * T-V25 · Export CSV de la misma vista (cap 10.000 filas). Mismos filtros
   * que el listado. Devuelve `text/csv; charset=utf-8` con BOM.
   */
  @Get('solicitudes/export.csv')
  @Roles('superadmin')
  @ApiOperation({
    summary:
      '[superadmin] Export CSV cross-plaza con BOM UTF-8. Cap 10.000 filas.',
  })
  async exportSolicitudesCsv(
    @Query(new ZodValidationPipe(ListSolicitudesPlataformaQuerySchema))
    query: ListSolicitudesPlataformaQuery,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ): Promise<void> {
    const { filename, stream } = await this.service.exportSolicitudesCsv(query, user);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    // Pipe manual para no requerir Nest passthrough.
    for await (const chunk of stream) {
      res.write(chunk);
    }
    res.end();
  }

  /**
   * T-V25 · Detalle cross-plaza de una solicitud. Reutiliza el shape de
   * `SolicitudDetailOutput` y le añade `plaza: PlazaRef`. No expone acciones.
   */
  @Get('solicitudes/:id')
  @Roles('superadmin')
  @ApiOperation({
    summary: '[superadmin] Detalle cross-plaza de una solicitud. Solo lectura.',
  })
  findOneSolicitud(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findOneSolicitud(id, user);
  }
}

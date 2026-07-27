import {
  BadRequestException,
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
  ReporteEntidadSchema,
  ReporteInquilinosFiltrosSchema,
  ReporteLocalesFiltrosSchema,
  ReporteSolicitudesFiltrosSchema,
  type ReporteEntidad,
} from '@app/contracts';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ReportesService } from './reportes.service';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';

/**
 * Módulo 11 — reportes (T-138..T-141). Inquilino NO accede (S-RE-A).
 * Rutas específicas (`locales/:id/...`) ANTES de las genéricas `:entidad/...`.
 */
@ApiTags('reportes')
@ApiBearerAuth()
@Controller('reportes')
export class ReportesController {
  constructor(private readonly service: ReportesService) {}

  @Get('kpis')
  @Roles('admin_plaza', 'superadmin')
  @RequirePermission('reportes.kpis.ver')
  @ApiOperation({ summary: 'KPIs del dashboard (T-141); superadmin: agregado global.' })
  kpis(@CurrentUser() user: AuthenticatedUser) {
    return this.service.kpis(user);
  }

  @Get('dashboard')
  @Roles('admin_plaza', 'superadmin')
  @RequirePermission('reportes.dashboard.ver')
  @ApiOperation({ summary: 'Datos de gráficos del dashboard (T-143).' })
  dashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.service.dashboardCharts(user);
  }

  @Get('locales/:id/export.pdf')
  @Roles('admin_plaza', 'superadmin')
  @RequirePermission('reportes.ficha_local_pdf')
  @ApiOperation({ summary: 'Ficha PDF de un local: detalle + contratos + solicitudes (T-140).' })
  async localDetallePdf(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ): Promise<void> {
    const { filename, buffer } = await this.service.exportLocalDetallePdf(id, user);
    enviarArchivo(res, filename, buffer, 'application/pdf');
  }

  @Get('inquilinos/:id/export.pdf')
  @Roles('admin_plaza', 'superadmin')
  @RequirePermission('reportes.ficha_inquilino_pdf')
  @ApiOperation({ summary: 'Ficha PDF de un inquilino (T-140).' })
  async inquilinoDetallePdf(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ): Promise<void> {
    const { filename, buffer } = await this.service.exportInquilinoDetallePdf(id, user);
    enviarArchivo(res, filename, buffer, 'application/pdf');
  }

  @Get('solicitudes/:id/permiso.pdf')
  @Roles('admin_plaza', 'superadmin', 'inquilino')
  @RequirePermission(['reportes.ficha_local_pdf', 'solicitudes.detalle.ver'])
  @ApiOperation({
    summary: 'PDF "Permiso de Trabajos" de una solicitud; inquilino solo la suya.',
  })
  async solicitudPermisoPdf(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ): Promise<void> {
    const { filename, buffer } = await this.service.exportSolicitudPermisoPdf(id, user);
    enviarArchivo(res, filename, buffer, 'application/pdf');
  }

  @Get(':entidad/preview')
  @Roles('admin_plaza', 'superadmin')
  @RequirePermission('reportes.preview')
  @ApiOperation({ summary: 'Primeros 10 registros del reporte (T-144, sin descarga).' })
  preview(
    @Param('entidad') entidadRaw: string,
    @Query() query: Record<string, string>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const { entidad, filtros } = parseEntidadYFiltros(entidadRaw, query);
    return this.service.preview(entidad, filtros, user);
  }

  @Get(':entidad/export.csv')
  @Roles('admin_plaza', 'superadmin')
  @RequirePermission('reportes.exportar_csv')
  @ApiOperation({ summary: 'Export CSV inline con BOM UTF-8 (T-138).' })
  async exportCsv(
    @Param('entidad') entidadRaw: string,
    @Query() query: Record<string, string>,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ): Promise<void> {
    const { entidad, filtros } = parseEntidadYFiltros(entidadRaw, query);
    const { filename, stream } = await this.service.exportCsv(entidad, filtros, user);
    res
      .status(200)
      .setHeader('Content-Type', 'text/csv; charset=utf-8')
      .setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    stream.pipe(res);
  }

  @Get(':entidad/export.xlsx')
  @Roles('admin_plaza', 'superadmin')
  @RequirePermission('reportes.exportar_xlsx')
  @ApiOperation({ summary: 'Export XLSX vía jsreport (T-139).' })
  async exportXlsx(
    @Param('entidad') entidadRaw: string,
    @Query() query: Record<string, string>,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ): Promise<void> {
    const { entidad, filtros } = parseEntidadYFiltros(entidadRaw, query);
    const { filename, buffer, contentType } = await this.service.exportJsreport(
      entidad,
      'xlsx',
      filtros,
      user,
    );
    enviarArchivo(res, filename, buffer, contentType);
  }

  @Get(':entidad/export.pdf')
  @Roles('admin_plaza', 'superadmin')
  @RequirePermission('reportes.exportar_pdf')
  @ApiOperation({ summary: 'Export PDF vía jsreport (T-140).' })
  async exportPdf(
    @Param('entidad') entidadRaw: string,
    @Query() query: Record<string, string>,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ): Promise<void> {
    const { entidad, filtros } = parseEntidadYFiltros(entidadRaw, query);
    const { filename, buffer, contentType } = await this.service.exportJsreport(
      entidad,
      'pdf',
      filtros,
      user,
    );
    enviarArchivo(res, filename, buffer, contentType);
  }
}

/** Valida la entidad y sus filtros con el schema Zod correspondiente. */
function parseEntidadYFiltros(
  entidadRaw: string,
  query: Record<string, string>,
): { entidad: ReporteEntidad; filtros: Record<string, unknown> } {
  const entidadParsed = ReporteEntidadSchema.safeParse(entidadRaw);
  if (!entidadParsed.success) {
    throw new BadRequestException({
      code: 'ENTIDAD_INVALIDA',
      title: 'Solicitud inválida',
      message: `Entidad de reporte desconocida: "${entidadRaw}".`,
    });
  }
  const entidad = entidadParsed.data;
  const schema =
    entidad === 'solicitudes'
      ? ReporteSolicitudesFiltrosSchema
      : entidad === 'locales'
        ? ReporteLocalesFiltrosSchema
        : ReporteInquilinosFiltrosSchema;
  const filtrosParsed = schema.safeParse(query);
  if (!filtrosParsed.success) {
    throw new BadRequestException({
      code: 'FILTROS_INVALIDOS',
      title: 'Solicitud inválida',
      message: filtrosParsed.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; '),
    });
  }
  return { entidad, filtros: filtrosParsed.data };
}

function enviarArchivo(res: Response, filename: string, buffer: Buffer, contentType: string): void {
  res
    .status(200)
    .setHeader('Content-Type', contentType)
    .setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    .send(buffer);
}

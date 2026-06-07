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
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import {
  CalendarioQuerySchema,
  ChoquesQuerySchema,
  IcsQuerySchema,
  MoverEventoFechasSchema,
  type CalendarioQuery,
  type ChoquesQuery,
  type IcsQuery,
  type MoverEventoFechas,
} from '@app/contracts';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CalendarioService } from './calendario.service';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';

/** Módulo 10 — calendario (T-129..T-134). Rutas estáticas antes de `:id`. */
@ApiTags('calendario')
@ApiBearerAuth()
@Controller('calendario')
export class CalendarioController {
  constructor(private readonly service: CalendarioService) {}

  @Get()
  @Roles('admin_plaza', 'inquilino')
  @ApiOperation({ summary: 'Feed de eventos para FullCalendar (T-129).' })
  feed(
    @Query(new ZodValidationPipe(CalendarioQuerySchema)) query: CalendarioQuery,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.feed(query, user);
  }

  @Get('export.ics')
  @Roles('admin_plaza', 'inquilino')
  @ApiOperation({ summary: 'Exportar calendario en formato iCalendar (T-130).' })
  async exportIcs(
    @Query(new ZodValidationPipe(IcsQuerySchema)) query: IcsQuery,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ): Promise<void> {
    const { filename, contenido } = await this.service.exportIcs(query, user);
    res
      .status(200)
      .setHeader('Content-Type', 'text/calendar; charset=utf-8')
      .setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      .send(contenido);
  }

  @Get('choques')
  @Roles('admin_plaza', 'inquilino')
  @ApiOperation({ summary: 'Pares de eventos que se solapan en el mismo local (T-131).' })
  choques(
    @Query(new ZodValidationPipe(ChoquesQuerySchema)) query: ChoquesQuery,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.choques(query, user);
  }

  @Patch('eventos/:id/fechas')
  @Roles('admin_plaza')
  @ApiOperation({ summary: 'Mover un evento aprobado (drag-and-drop del admin).' })
  moverEvento(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(MoverEventoFechasSchema)) body: MoverEventoFechas,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    return this.service.moverEvento(id, body, user, {
      ip: ip || null,
      userAgent: userAgent ?? null,
      requestId: requestId ?? null,
    });
  }
}

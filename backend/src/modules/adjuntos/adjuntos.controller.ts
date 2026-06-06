import {
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Ip,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdjuntosService } from './adjuntos.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';

/**
 * Endpoints polimórficos de adjuntos (T-062; se amplían en T-112..T-117).
 * La subida/listado por entidad vive en el controller de cada recurso
 * (p. ej. POST /contratos/:id/adjuntos).
 */
@ApiTags('adjuntos')
@ApiBearerAuth()
@Controller('adjuntos')
export class AdjuntosController {
  constructor(private readonly service: AdjuntosService) {}

  @Get(':id/download')
  @Roles('admin_plaza', 'superadmin', 'inquilino')
  @ApiOperation({ summary: 'URL pre-firmada de descarga (15 min).' })
  download(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.download(id, user);
  }

  @Delete(':id')
  @Roles('admin_plaza', 'superadmin', 'inquilino')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar adjunto (cuarentena + soft delete; solo uploader o admin).' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ): Promise<void> {
    await this.service.remove(id, user, {
      ip: ip || null,
      userAgent: userAgent ?? null,
      requestId: requestId ?? null,
    });
  }
}

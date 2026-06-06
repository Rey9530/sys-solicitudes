import {
  BadRequestException,
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
  PayloadTooLargeException,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CreatePlazaSchema,
  UpdatePlazaSchema,
  ListPlazasQuerySchema,
  type CreatePlazaInput,
  type UpdatePlazaInput,
  type ListPlazasQuery,
} from '@app/contracts';
import {
  PlazasService,
  LOGO_MIME_ALLOWLIST,
  LOGO_MAX_BYTES,
  type RequestMeta,
} from './plazas.service';

interface UploadedLogo {
  buffer: Buffer;
  mimetype: string;
  size: number;
}
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';

@ApiTags('plazas')
@ApiBearerAuth()
@Controller('plazas')
export class PlazasController {
  constructor(private readonly service: PlazasService) {}

  @Post()
  @Roles('superadmin')
  @ApiOperation({ summary: 'Crear plaza + configuración + roles staff + admin inicial.' })
  create(
    @Body(new ZodValidationPipe(CreatePlazaSchema)) body: CreatePlazaInput,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    return this.service.create(body, user, this.meta(ip, userAgent, requestId));
  }

  @Get()
  @Roles('superadmin')
  @ApiOperation({ summary: 'Listar plazas (paginado).' })
  findAll(@Query(new ZodValidationPipe(ListPlazasQuerySchema)) query: ListPlazasQuery) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @Roles('superadmin', 'admin_plaza')
  @ApiOperation({ summary: 'Detalle de plaza (superadmin: cualquiera; admin_plaza: la suya).' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findOne(id, user);
  }

  @Patch(':id')
  @Roles('superadmin', 'admin_plaza')
  @ApiOperation({ summary: 'Editar plaza (nombre/contacto/color; no slug ni timezone).' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(UpdatePlazaSchema)) body: UpdatePlazaInput,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    return this.service.update(id, body, user, this.meta(ip, userAgent, requestId));
  }

  @Post(':id/logo')
  @Roles('superadmin', 'admin_plaza')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: LOGO_MAX_BYTES + 1 } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Subir logo de la plaza (PNG/SVG, máx 2 MB).' })
  uploadLogo(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: UploadedLogo | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    if (!file) {
      throw new BadRequestException({
        code: 'LOGO_REQUERIDO',
        title: 'Solicitud inválida',
        message: 'Falta el archivo de logo (campo "file").',
      });
    }
    if (!LOGO_MIME_ALLOWLIST.includes(file.mimetype)) {
      throw new BadRequestException({
        code: 'ADJUNTO_MIME_INVALIDO',
        title: 'Solicitud inválida',
        message: `Tipo no permitido. Solo PNG o SVG (${LOGO_MIME_ALLOWLIST.join(', ')}).`,
      });
    }
    if (file.size > LOGO_MAX_BYTES) {
      throw new PayloadTooLargeException({
        code: 'ADJUNTO_DEMASIADO_GRANDE',
        title: 'Carga demasiado grande',
        message: 'El logo no puede superar 2 MB.',
      });
    }
    return this.service.uploadLogo(id, file, user, this.meta(ip, userAgent, requestId));
  }

  @Delete(':id')
  @Roles('superadmin')
  @HttpCode(204)
  @ApiOperation({ summary: 'Desactivar plaza (soft delete).' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ): Promise<void> {
    await this.service.remove(id, user, this.meta(ip, userAgent, requestId));
  }

  private meta(ip: string, userAgent: string | undefined, requestId: string | undefined): RequestMeta {
    return { ip: ip || null, userAgent: userAgent ?? null, requestId: requestId ?? null };
  }
}

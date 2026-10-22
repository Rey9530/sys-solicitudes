import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Ip,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CARGA_INICIAL_MAX_BYTES } from '@app/contracts';
import { CargaInicialService, type RequestMeta } from './carga-inicial.service';
import type { ArchivoExcel } from './carga-inicial.parser';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';

/**
 * Carga inicial desde Excel (PLANIFICACION/18). Ambos endpoints reciben el
 * mismo archivo (multipart, campo `file`): `analizar` no escribe nada y
 * `ejecutar` crea todo lo válido en una sola transacción.
 */
@ApiTags('importacion')
@ApiBearerAuth()
@Controller('importacion/carga-inicial')
export class ImportacionController {
  constructor(private readonly cargaInicial: CargaInicialService) {}

  @Post('analizar')
  @HttpCode(200)
  @Roles('admin_plaza', 'superadmin')
  @RequirePermission('contratos.importar')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: CARGA_INICIAL_MAX_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Analiza la plantilla de carga inicial sin escribir nada.' })
  analizar(@UploadedFile() file: ArchivoExcel | undefined, @CurrentUser() user: AuthenticatedUser) {
    return this.cargaInicial.analizar(this.requireFile(file), user);
  }

  @Post('ejecutar')
  @Roles('admin_plaza', 'superadmin')
  @RequirePermission('contratos.importar')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: CARGA_INICIAL_MAX_BYTES } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Crea locales, inquilinos y contratos de la plantilla de carga inicial.',
  })
  ejecutar(
    @UploadedFile() file: ArchivoExcel | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    return this.cargaInicial.ejecutar(
      this.requireFile(file),
      user,
      this.meta(ip, userAgent, requestId),
    );
  }

  private requireFile(file: ArchivoExcel | undefined): ArchivoExcel {
    if (!file) {
      throw new BadRequestException({
        code: 'IMPORTACION_ARCHIVO_REQUERIDO',
        title: 'Solicitud inválida',
        message: 'Falta el archivo Excel (campo "file").',
      });
    }
    return file;
  }

  private meta(
    ip: string,
    userAgent: string | undefined,
    requestId: string | undefined,
  ): RequestMeta {
    return { ip: ip || null, userAgent: userAgent ?? null, requestId: requestId ?? null };
  }
}

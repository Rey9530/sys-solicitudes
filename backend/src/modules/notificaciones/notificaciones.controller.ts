import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  HttpCode,
  Ip,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ListEmailLogQuerySchema,
  ListUnsubscribesQuerySchema,
  type ListEmailLogQuery,
  type ListUnsubscribesQuery,
} from '@app/contracts';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { NotificacionesService, type RequestMeta } from './notificaciones.service';
import { UnsubscribeService } from './unsubscribe.service';
import type { AuthenticatedUser } from '../auth/types/jwt-payload';

/**
 * Módulo 09: log de emails (T-127) + desuscripción pública (T-125).
 * Las rutas estáticas (`unsubscribe`, `unsubscribes`) van ANTES de `:id`.
 */
@ApiTags('notificaciones')
@Controller('notificaciones')
export class NotificacionesController {
  constructor(
    private readonly service: NotificacionesService,
    private readonly unsubscribeService: UnsubscribeService,
  ) {}

  /**
   * T-125: desuscripción vía link del footer. Público (el JWT del query es la
   * autenticación: HMAC con plaza+email+plantilla firmado por el backend).
   * Responde una página HTML simple de confirmación.
   */
  @Public()
  @Get('unsubscribe')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @ApiOperation({ summary: 'Desuscribirse de un tipo de email no crítico (link del footer)' })
  async unsubscribe(@Query('token') token?: string): Promise<string> {
    if (!token) {
      throw new BadRequestException({
        code: 'UNSUBSCRIBE_TOKEN_INVALIDO',
        title: 'Token inválido',
        message: 'Falta el token de desuscripción.',
      });
    }
    const { email, plantilla } = await this.unsubscribeService.procesar(token);
    return `<!doctype html>
<html lang="es">
  <head><meta charset="utf-8" /><title>Desuscripción · Plazapp</title></head>
  <body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f4f4f5;margin:0;padding:48px 16px;">
    <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;text-align:center;">
      <h1 style="font-size:20px;margin:0 0 12px;">Desuscripción confirmada</h1>
      <p style="color:#52525b;">La dirección <strong>${escapeHtml(email)}</strong> ya no recibirá
      emails del tipo <strong>${escapeHtml(plantilla)}</strong>.</p>
      <p style="color:#a1a1aa;font-size:13px;">Los avisos críticos (aprobaciones, rechazos,
      subsanaciones y restablecimiento de contraseña) se seguirán enviando.</p>
    </div>
  </body>
</html>`;
  }

  // ── T-125: gestión de desuscripciones (admin) ────────────────────────────────

  @Get('unsubscribes')
  @ApiBearerAuth()
  @Roles('admin_plaza', 'superadmin')
  @RequirePermission('notificaciones.gestionar_desuscripciones')
  @ApiOperation({ summary: 'Listar desuscripciones de la plaza (T-125).' })
  listUnsubscribes(
    @Query(new ZodValidationPipe(ListUnsubscribesQuerySchema)) query: ListUnsubscribesQuery,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.listUnsubscribes(query, user);
  }

  @Delete('unsubscribes/:id')
  @ApiBearerAuth()
  @Roles('admin_plaza', 'superadmin')
  @RequirePermission('notificaciones.gestionar_desuscripciones')
  @HttpCode(204)
  @ApiOperation({ summary: 'Resetear una desuscripción (vuelve a recibir esa plantilla).' })
  async deleteUnsubscribe(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ): Promise<void> {
    await this.service.deleteUnsubscribe(id, user, meta(ip, userAgent, requestId));
  }

  // ── T-127: log de emails + reintento manual ──────────────────────────────────

  @Get()
  @ApiBearerAuth()
  @Roles('admin_plaza', 'superadmin')
  @RequirePermission('notificaciones.ver_log')
  @ApiOperation({ summary: 'Log de emails (admin_plaza: su plaza; superadmin: todas).' })
  findAll(
    @Query(new ZodValidationPipe(ListEmailLogQuerySchema)) query: ListEmailLogQuery,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findAll(query, user);
  }

  @Get(':id/preview')
  @ApiBearerAuth()
  @Roles('admin_plaza', 'superadmin')
  @RequirePermission('notificaciones.ver_preview')
  @ApiOperation({ summary: 'HTML renderizado del email (modal "Ver contenido").' })
  preview(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.preview(id, user);
  }

  @Post(':id/reintentar')
  @ApiBearerAuth()
  @Roles('admin_plaza', 'superadmin')
  @RequirePermission('notificaciones.reintentar')
  @ApiOperation({ summary: 'Reintento manual de un email fallido (lo retoma el worker).' })
  reintentar(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    return this.service.reintentar(id, user, meta(ip, userAgent, requestId));
  }
}

function meta(
  ip: string,
  userAgent: string | undefined,
  requestId: string | undefined,
): RequestMeta {
  return { ip: ip || null, userAgent: userAgent ?? null, requestId: requestId ?? null };
}

function escapeHtml(value: string): string {
  return value.replace(
    /[<>&"]/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c] ?? c,
  );
}

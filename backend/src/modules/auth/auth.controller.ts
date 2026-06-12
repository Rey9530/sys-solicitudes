import {
  Body,
  Controller,
  Get,
  HttpCode,
  Headers,
  Ip,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  LoginSchema,
  RefreshSchema,
  ResetPasswordRequestSchema,
  ResetPasswordConfirmSchema,
  ChangePasswordSchema,
  type LoginInput,
  type RefreshInput,
  type ResetPasswordRequest,
  type ResetPasswordConfirm,
  type ChangePasswordInput,
} from '@app/contracts';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators/public.decorator';
import { Auditable } from '../../common/decorators/auditable.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from './types/jwt-payload';
import type { RequestMeta } from './services/token.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  // Rate limit más estricto en login: 5 req/min por IP (T-014, override del 'global').
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  // T-161: además de la fila en `auditoria_login` (intentos, lockout T-021),
  // se persiste en `auditoria` para vista unificada en /admin/auditoria. El
  // body (email) se redacta por la lista de llaves sensibles del interceptor.
  @Auditable({ accion: 'auth.login', entidadTipo: 'usuario', omitirBody: true })
  @ApiOperation({ summary: 'Login con email y password. Devuelve access + refresh.' })
  login(
    @Body(new ZodValidationPipe(LoginSchema)) body: LoginInput,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
  ) {
    return this.authService.login(body, this.meta(ip, userAgent));
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  // T-161: registro de refresh en `auditoria`. omitirBody: el body trae el
  // refresh token (ya redactado por la lista de llaves sensibles, pero ni
  // siquiera se persiste por seguridad).
  @Auditable({ accion: 'auth.refresh', entidadTipo: 'usuario', omitirBody: true })
  @ApiOperation({ summary: 'Rota el refresh token y emite un nuevo par de tokens.' })
  refresh(
    @Body(new ZodValidationPipe(RefreshSchema)) body: RefreshInput,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
  ) {
    return this.authService.refresh(body.refreshToken, this.meta(ip, userAgent));
  }

  @Post('logout')
  @HttpCode(204)
  @ApiBearerAuth()
  // T-161: registro de logout. Revoca el refresh token activo.
  @Auditable({ accion: 'auth.logout', entidadTipo: 'usuario', omitirBody: true })
  @ApiOperation({ summary: 'Revoca el refresh token actual.' })
  async logout(@Body(new ZodValidationPipe(RefreshSchema)) body: RefreshInput): Promise<void> {
    await this.authService.logout(body.refreshToken);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(200)
  // T-149: 3 req/min — el reset dispara emails; evita abuso de enumeración/spam.
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  // T-161: registro de solicitud de reset (no del confirm, que ya estaba).
  // Se audita siempre (200 OK exista o no el email) para detectar enumeración.
  @Auditable({
    accion: 'auth.password_reset_request',
    entidadTipo: 'usuario',
    omitirBody: true,
  })
  @ApiOperation({ summary: 'Solicita reset de contraseña. Responde 200 exista o no el email.' })
  async resetPassword(
    @Body(new ZodValidationPipe(ResetPasswordRequestSchema)) body: ResetPasswordRequest,
  ): Promise<{ message: string }> {
    await this.authService.requestPasswordReset(body.email);
    return { message: 'Si el email existe, recibirás un enlace para restablecer la contraseña.' };
  }

  @Public()
  @Post('reset-password/confirm')
  @HttpCode(200)
  // T-150: hueco de auditoría detectado en el survey — el cambio de contraseña
  // queda registrado. omitirBody: el body trae token + password (se redactan
  // igual, pero ni siquiera se persisten).
  @Auditable({ accion: 'auth.password_reset_confirm', entidadTipo: 'usuario', omitirBody: true })
  @ApiOperation({ summary: 'Confirma el reset con token + nueva contraseña.' })
  async confirmReset(
    @Body(new ZodValidationPipe(ResetPasswordConfirmSchema)) body: ResetPasswordConfirm,
  ): Promise<{ message: string }> {
    await this.authService.confirmPasswordReset(body);
    return { message: 'Contraseña actualizada. Ya puedes iniciar sesión.' };
  }

  @Patch('change-password')
  @HttpCode(204)
  @ApiBearerAuth()
  // T-161: registro de cambio de contraseña con sesión activa. getIdFromResponse
  // no aplica (el controller no devuelve payload); se usa paramId: 'id' no
  // presente en la ruta, así que el interceptor deja entidadId null y la fila
  // queda asociable solo por usuarioId (que sí se extrae del JWT).
  @Auditable({ accion: 'auth.password_change', entidadTipo: 'usuario', omitirBody: true })
  @ApiOperation({ summary: 'Cambia la contraseña con la sesión activa.' })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(ChangePasswordSchema)) body: ChangePasswordInput,
  ): Promise<void> {
    await this.authService.changePassword(user.sub, body);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Perfil del usuario autenticado.' })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user);
  }

  private meta(ip: string, userAgent: string | undefined): RequestMeta {
    return { ip: ip || null, userAgent: userAgent ?? null };
  }
}

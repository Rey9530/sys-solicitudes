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
  @Throttle({ global: { limit: 5, ttl: 60_000 } })
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
  @ApiOperation({ summary: 'Revoca el refresh token actual.' })
  async logout(@Body(new ZodValidationPipe(RefreshSchema)) body: RefreshInput): Promise<void> {
    await this.authService.logout(body.refreshToken);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(200)
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

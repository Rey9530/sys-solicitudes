import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaAdminService } from '../../prisma/prisma-admin.service';
import { getTemplateDef } from './email-templates.registry';

interface UnsubscribePayload {
  scope: 'unsubscribe';
  plaza: string;
  email: string;
  plantilla: string;
}

/**
 * Desuscripción de emails no críticos (T-125, S-Unsubscribe, RN-NE-4).
 *
 * El link del footer lleva un JWT HS256 (HMAC con el mismo JWT_SECRET de la
 * app, scope `unsubscribe`, 365 días) con plaza + email + plantilla. El
 * endpoint público lo valida y hace upsert en la tabla `unsubscribe`; el
 * check de envío vive en EmailService (T-121).
 */
@Injectable()
export class UnsubscribeService {
  private readonly logger = new Logger(UnsubscribeService.name);
  private readonly apiUrl: string;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prismaAdmin: PrismaAdminService,
  ) {
    // Base pública del backend para armar el link absoluto del footer.
    this.apiUrl = this.config
      .get<string>('NEXT_PUBLIC_API_URL', 'http://localhost:4000')
      .replace(/\/$/, '');
  }

  /** URL absoluta de desuscripción para el footer (solo plantillas no críticas). */
  generarUrl(plazaId: string, email: string, plantilla: string): string | undefined {
    const def = getTemplateDef(plantilla);
    if (!def || def.critico || !def.unsubscribe) return undefined;
    const payload: UnsubscribePayload = { scope: 'unsubscribe', plaza: plazaId, email, plantilla };
    const token = this.jwt.sign(payload, {
      secret: this.config.getOrThrow<string>('JWT_SECRET'),
      expiresIn: '365d',
    });
    return `${this.apiUrl}/api/v1/notificaciones/unsubscribe?token=${encodeURIComponent(token)}`;
  }

  /**
   * Valida el token y registra la desuscripción (idempotente).
   * Usa el admin client: el endpoint es público, sin contexto de tenant —
   * el plaza_id viene FIRMADO en el token, no del request.
   */
  async procesar(token: string): Promise<{ email: string; plantilla: string }> {
    let payload: UnsubscribePayload;
    try {
      payload = this.jwt.verify<UnsubscribePayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      });
    } catch {
      throw new BadRequestException({
        code: 'UNSUBSCRIBE_TOKEN_INVALIDO',
        title: 'Token inválido',
        message: 'El enlace de desuscripción no es válido o expiró.',
      });
    }
    if (payload.scope !== 'unsubscribe' || !payload.plaza || !payload.email || !payload.plantilla) {
      throw new BadRequestException({
        code: 'UNSUBSCRIBE_TOKEN_INVALIDO',
        title: 'Token inválido',
        message: 'El enlace de desuscripción no es válido.',
      });
    }
    await this.prismaAdmin.unsubscribe.upsert({
      where: {
        plaza_id_email_plantilla: {
          plaza_id: payload.plaza,
          email: payload.email,
          plantilla: payload.plantilla,
        },
      },
      update: {},
      create: { plaza_id: payload.plaza, email: payload.email, plantilla: payload.plantilla },
    });
    this.logger.log(`unsubscribe registrado: ${payload.email} / ${payload.plantilla}`);
    return { email: payload.email, plantilla: payload.plantilla };
  }
}

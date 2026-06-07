import { Global, Module, type DynamicModule, type Provider } from '@nestjs/common';
import { MailerService } from './mailer.service';
import { MAILER_OPTIONS, type MailerOptions } from './mailer.types';

export interface MailerModuleAsyncOptions {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- contrato estándar de forRootAsync de Nest
  inject?: any[];
  useFactory: (...args: never[]) => MailerOptions | Promise<MailerOptions>;
}

/**
 * Módulo dinámico del transporter SMTP (T-119).
 *
 * ⚠️ Decisión documentada en bitácora: es un MailerModule PROPIO (no el
 * paquete `@nestjs-modules/mailer`) — el plan solo exige Nodemailer y aquí
 * necesitamos los errores crudos del transporter para clasificar hard
 * bounces (T-124). `@Global()` para que auth/contratos/notificaciones lo
 * inyecten sin re-importar.
 */
@Global()
@Module({})
export class MailerModule {
  static forRootAsync(options: MailerModuleAsyncOptions): DynamicModule {
    const optionsProvider: Provider = {
      provide: MAILER_OPTIONS,
      inject: options.inject ?? [],
      useFactory: options.useFactory,
    };
    return {
      module: MailerModule,
      providers: [optionsProvider, MailerService],
      exports: [MailerService],
    };
  }
}

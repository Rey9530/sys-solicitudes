import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

/**
 * Worker que procesa la cola `email_log` cada 1 minuto.
 * Detalles: PLANIFICACION/09-notificaciones-email.md (T-122).
 */
@Injectable()
export class EmailWorker {
  private readonly logger = new Logger(EmailWorker.name);

  @Cron('*/1 * * * *', { name: 'email-worker' })
  async handleCron(): Promise<void> {
    // Implementación completa en T-122
    this.logger.debug('email-worker tick (stub)');
  }
}

import { Module } from '@nestjs/common';
import { LocalesController } from './locales.controller';
import { LocalesService } from './locales.service';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  imports: [AuditoriaModule],
  controllers: [LocalesController],
  providers: [LocalesService],
  exports: [LocalesService],
})
export class LocalesModule {}

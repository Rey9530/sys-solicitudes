import { Module } from '@nestjs/common';
import { InquilinosController } from './inquilinos.controller';
import { InquilinosService } from './inquilinos.service';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  imports: [AuditoriaModule],
  controllers: [InquilinosController],
  providers: [InquilinosService],
  exports: [InquilinosService],
})
export class InquilinosModule {}

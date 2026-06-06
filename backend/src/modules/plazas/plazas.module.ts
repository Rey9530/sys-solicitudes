import { Module } from '@nestjs/common';
import { PlazasController } from './plazas.controller';
import { PlazasService } from './plazas.service';
import { AuthModule } from '../auth/auth.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  // AuthModule aporta PasswordService + MailerService (admin inicial + bienvenida);
  // AuditoriaModule aporta AuditoriaService.
  imports: [AuthModule, AuditoriaModule],
  controllers: [PlazasController],
  providers: [PlazasService],
  exports: [PlazasService],
})
export class PlazasModule {}

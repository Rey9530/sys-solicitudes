import { Module } from '@nestjs/common';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';
import { AuthModule } from '../auth/auth.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  // AuthModule aporta PasswordService + MailerService; AuditoriaModule, AuditoriaService.
  imports: [AuthModule, AuditoriaModule],
  controllers: [UsuariosController],
  providers: [UsuariosService],
  exports: [UsuariosService],
})
export class UsuariosModule {}

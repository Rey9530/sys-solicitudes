import { Module } from '@nestjs/common';
import { InquilinosController } from './inquilinos.controller';
import { InquilinosService } from './inquilinos.service';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { UsuariosModule } from '../usuarios/usuarios.module';

@Module({
  // T-059-bis: el controller de inquilinos expone GET /:id/usuarios, que
  // delega en UsuariosService.findByInquilino. El scope por plaza y los
  // guards transversales siguen aplicando (JwtAuthGuard → PlazaScopeGuard
  // → RolesGuard) y el sub-filtro por inquilino es defensa adicional contra
  // IDs cruzadaS entre usuarios de distintos inquilinos de la misma plaza.
  imports: [AuditoriaModule, UsuariosModule],
  controllers: [InquilinosController],
  providers: [InquilinosService],
  exports: [InquilinosService],
})
export class InquilinosModule {}

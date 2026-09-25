import { Module } from '@nestjs/common';
import { CategoriasController } from './categorias.controller';
import { CategoriasService } from './categorias.service';
import { StaffForSubcategoriaValidator } from './validators/staff-for-subcategoria.validator';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { SolicitudStateModule } from '../solicitudes/state/solicitud-state.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';

@Module({
  imports: [AuditoriaModule, SolicitudStateModule, NotificacionesModule],
  controllers: [CategoriasController],
  providers: [CategoriasService, StaffForSubcategoriaValidator],
  exports: [CategoriasService, StaffForSubcategoriaValidator],
})
export class CategoriasModule {}

import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuditoriaModule } from '../auditoria/auditoria.module';

/**
 * Módulo de plataforma para el `superadmin` (T-V25). Endpoints cross-tenant:
 * usan `PrismaAdminService` (bypass RLS) y están restringidos por
 * `@Roles('superadmin')` en el controller. La auditoría se registra como
 * `admin.solicitudes.*` con `plaza_id = null` (señal de "vista global").
 */
@Module({
  imports: [AuditoriaModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}

import { Module } from '@nestjs/common';
import { RolesStaffController } from './roles-staff.controller';
import { RolesStaffService } from './roles-staff.service';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  imports: [AuditoriaModule],
  controllers: [RolesStaffController],
  providers: [RolesStaffService],
  exports: [RolesStaffService],
})
export class RolesStaffModule {}

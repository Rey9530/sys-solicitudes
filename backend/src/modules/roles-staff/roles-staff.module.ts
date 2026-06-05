import { Module } from '@nestjs/common';
import { RolesStaffController } from './roles-staff.controller';
import { RolesStaffService } from './roles-staff.service';

@Module({
  controllers: [RolesStaffController],
  providers: [RolesStaffService],
  exports: [RolesStaffService],
})
export class RolesStaffModule {}

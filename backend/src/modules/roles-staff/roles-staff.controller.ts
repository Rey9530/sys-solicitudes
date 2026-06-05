import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RolesStaffService } from './roles-staff.service';

@ApiTags('roles-staff')
@Controller('roles-staff')
export class RolesStaffController {
  constructor(private readonly _service: RolesStaffService) {}
  // Implementado en T-035
}

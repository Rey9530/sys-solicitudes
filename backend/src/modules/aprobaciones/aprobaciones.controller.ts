import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AprobacionesService } from './aprobaciones.service';

@ApiTags('aprobaciones')
@Controller('aprobaciones')
export class AprobacionesController {
  constructor(private readonly _service: AprobacionesService) {}
  // Implementado en T-094
}

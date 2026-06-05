import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SolicitudesService } from './solicitudes.service';

@ApiTags('solicitudes')
@Controller('solicitudes')
export class SolicitudesController {
  constructor(private readonly _service: SolicitudesService) {}
  // Implementado en T-080
}

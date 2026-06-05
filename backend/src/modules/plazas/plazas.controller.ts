import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PlazasService } from './plazas.service';

@ApiTags('plazas')
@Controller('plazas')
export class PlazasController {
  constructor(private readonly _service: PlazasService) {}
  // Implementado en T-040
}

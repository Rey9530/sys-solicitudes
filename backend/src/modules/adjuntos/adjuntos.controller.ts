import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdjuntosService } from './adjuntos.service';

@ApiTags('adjuntos')
@Controller('adjuntos')
export class AdjuntosController {
  constructor(private readonly _service: AdjuntosService) {}
  // Implementado en T-112 a T-117
}

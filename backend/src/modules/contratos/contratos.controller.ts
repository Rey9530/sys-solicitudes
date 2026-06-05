import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ContratosService } from './contratos.service';

@ApiTags('contratos')
@Controller('contratos')
export class ContratosController {
  constructor(private readonly _service: ContratosService) {}
  // Implementado en T-054
}

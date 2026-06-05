import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CalendarioService } from './calendario.service';

@ApiTags('calendario')
@Controller('calendario')
export class CalendarioController {
  constructor(private readonly _service: CalendarioService) {}
  // Implementado en T-129
}

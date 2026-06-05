import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { LocalesService } from './locales.service';

@ApiTags('locales')
@Controller('locales')
export class LocalesController {
  constructor(private readonly _service: LocalesService) {}
  // Implementado en T-051
}

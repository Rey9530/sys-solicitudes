import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { NotificacionesService } from './notificaciones.service';

@ApiTags('notificaciones')
@Controller('notificaciones')
export class NotificacionesController {
  constructor(private readonly _service: NotificacionesService) {}
  // Implementado en T-121 y T-127
}

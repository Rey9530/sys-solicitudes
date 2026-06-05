import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly _authService: AuthService) {}
  // Endpoints implementados en T-026 a T-031 (PLANIFICACION/02-autenticacion-usuarios.md)
}

import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaHealthIndicator } from './prisma.health';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
  ) {}

  /**
   * Liveness: solo verifica que el proceso está vivo.
   * Detalles: PLANIFICACION/13-observabilidad-despliegue.md (T-154).
   */
  @SkipThrottle()
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([]);
  }

  /**
   * Readiness: verifica dependencias (PostgreSQL).
   * Devuelve 503 si alguna dependencia falla.
   */
  @SkipThrottle()
  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([async () => this.prismaHealth.isHealthy('prisma')]);
  }
}

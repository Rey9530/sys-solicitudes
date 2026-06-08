import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { setupRequestContext } from './common/middleware/request-id.middleware';
import { buildHelmet } from './common/security/helmet.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Logger con pino (configurado en AppModule)
  app.useLogger(app.get(PinoLogger));

  // Prefijo global de versión
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // Helmet: seguridad HTTP (CSP estricta, HSTS, X-Frame-Options, etc.) (T-015 / T-147)
  app.use(buildHelmet());

  // CORS restrictivo (T-015 / T-148)
  const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-plaza-slug', 'x-request-id', 'x-plaza-id'],
    exposedHeaders: ['x-request-id', 'Retry-After'],
    maxAge: 86_400, // 24h cache del preflight
  });

  // ValidationPipe global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Filtros de excepciones
  app.useGlobalFilters(new AllExceptionsFilter(), new HttpExceptionFilter());

  // Swagger / OpenAPI
  const config = new DocumentBuilder()
    .setTitle('Plazapp API')
    .setDescription('API del sistema Plazapp · SaaS multi-plaza de gestión de solicitudes')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Autenticación y sesión')
    .addTag('plazas', 'Plazas (tenants)')
    .addTag('usuarios', 'Usuarios de la plaza')
    .addTag('locales', 'Locales e inquilinos')
    .addTag('contratos', 'Contratos de alquiler')
    .addTag('solicitudes', 'Solicitudes')
    .addTag('aprobaciones', 'Aprobaciones y transiciones')
    .addTag('categorias', 'Categorías y subcategorías')
    .addTag('adjuntos', 'Archivos adjuntos')
    .addTag('notificaciones', 'Log y plantillas de email')
    .addTag('calendario', 'Eventos del calendario')
    .addTag('reportes', 'Reportes y panel')
    .addTag('admin', 'Administración de plataforma (superadmin)')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Health checks
  app.getHttpAdapter().get('/api/ping', (_req: unknown, res: { status: (code: number) => { json: (body: unknown) => void } }) => {
    res.status(200).json({ status: 'ok', ts: new Date().toISOString() });
  });

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  Logger.log(`🚀 Plazapp backend en http://localhost:${port}`, 'Bootstrap');
  Logger.log(`📚 Swagger en http://localhost:${port}/api/docs`, 'Bootstrap');
}

void setupRequestContext(); // noop, kept for future use
bootstrap().catch((err) => {
   
  console.error('Error fatal durante el bootstrap:', err);
  process.exit(1);
});

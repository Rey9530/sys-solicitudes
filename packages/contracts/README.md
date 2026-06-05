# `@app/contracts`

Paquete compartido con **Zod 4** que define los schemas y tipos inferidos usados por el frontend (Next.js 16) y el backend (NestJS 11).

## Estructura

```
packages/contracts/src/
├── index.ts             # Re-exports por dominio
├── common/              # Schemas comunes (UUID, email, paginación, errores)
├── auth/                # Login, refresh, reset, cambio de password
├── usuarios/            # CRUD de usuarios
├── plazas/              # CRUD de plazas + configuración
├── roles-staff/         # CRUD de roles de staff (configurables por plaza)
├── locales/             # Locales e inquilinos
├── contratos/           # Contratos de alquiler
├── categorias/          # Categorías, subcategorías, prioridades
├── solicitudes/         # Solicitudes (4 tipos, state machine)
└── adjuntos/            # Adjuntos polimórficos (solicitud/local/contrato)
```

## Convenciones

- **Un archivo por dominio**, exportado desde `index.ts` del dominio y re-exportado desde el `index.ts` raíz.
- **Schemas en PascalCase** con sufijo `Schema`: `LoginSchema`, `CreateSolicitudSchema`.
- **Tipos inferidos en PascalCase** sin sufijo: `LoginInput`, `CreateSolicitudInput`, `SolicitudOutput`.
- **Inputs y Outputs separados**: nunca se mezcla la forma de input con la de output.
- **Errores de validación** se acumulan; el cliente puede leer `error.flatten()` o `error.format()` de Zod.

## Uso

### Frontend (Next.js)

```ts
import { LoginSchema, type LoginInput } from '@app/contracts/auth';

const input: LoginInput = { email: 'user@example.com', password: 'secret' };
const result = LoginSchema.safeParse(input);
if (!result.success) {
  console.error(result.error.flatten());
}
```

### Backend (NestJS)

```ts
import { LoginSchema, type LoginInput } from '@app/contracts/auth';
import { ZodValidationPipe } from 'nestjs-zod';

@Post('login')
@UsePipes(new ZodValidationPipe(LoginSchema))
async login(@Body() body: LoginInput) {
  // body ya está validado y tipado
}
```

## Build

```bash
npm run build --workspace=@app/contracts
```

El output queda en `packages/contracts/dist/` (`.js`, `.d.ts`, sourcemaps).

## Versionado

Este paquete es interno. Cambios breaking requieren:
1. Actualizar todas las tareas dependientes en `PLANIFICACION/` que importen los tipos modificados.
2. Coordinar con el equipo para migrar FE y BE en el mismo PR.

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import {
  PERMISSION_KEY,
} from '../decorators/require-permission.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { RolGlobal } from '@app/contracts';
import type { AuthenticatedUser } from '../../modules/auth/types/jwt-payload';

/**
 * T-RBAC-1: guard global de permisos granulares. Corre DESPUÉS de RolesGuard.
 *
 * Reglas de evaluación (orden estricto):
 *   1. Si el endpoint lleva `@Public()` → pasa (otros guards ya autorizaron).
 *   2. Si el endpoint lleva `@SkipPermissionCheck()` → pasa (omite este guard).
 *   3. Si el endpoint NO lleva `@RequirePermission(...)` → pasa (compatibilidad
 *      con endpoints no migrados; solo aplican los guards anteriores).
 *   4. Si el usuario es `superadmin` → pasa siempre (imperdonable a nivel
 *      plataforma; gestiona todas las plazas).
 *   5. Si el usuario es `inquilino`:
 *      a) Si el endpoint está abierto al rol `inquilino` vía `@Roles('inquilino', ...)`
 *         → PASA. Los permisos granulares aplican solo a `admin_plaza` en v1
 *         (ver `JwtPayload` y comentario en `POST /solicitudes`). El dev que
 *         expone un endpoint al inquilino lo hace porque esa ruta es legítima
 *         para él sin gating fino; el gating fino se reservará a una v2 con
 *         `rol_staff` también para inquilinos.
 *      b) Si el endpoint NO admite `inquilino` en `@Roles()` → el `RolesGuard`
 *         ya lo bloqueó antes; llegamos aquí solo si la lista está vacía.
 *         DENEGADO (defensivo: el endpoint no fue pensado para el inquilino).
 *   6. Si el usuario es `admin_plaza`:
 *      a) Sin `rol_staff_id` (compatibilidad con datos pre-RBAC) → pasa
 *         (acceso total al admin de plaza legacy).
 *      b) Con `rol_staff_id` → debe tener AL MENOS UNO de los permisos
 *         requeridos en `user.permisos`. Lógica OR entre los del array;
 *         para AND apilar varios `@RequirePermission(...)`.
 *
 * Errores: 403 con código RFC 7807 `PERMISSION_DENIED` y `meta.permisosRequeridos`.
 *
 * Detalles: PERMISOS_README.md, docs/07-arquitectura.md §7.4.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1) @Public() salta este guard (otros ya validaron JWT/Roles).
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    // 2) @SkipPermissionCheck() omite explícitamente el chequeo.
    const skip = this.reflector.getAllAndOverride<null>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip === null) {
      return true;
    }

    // 3) Sin metadata de permisos → guard no aplica (compat con legacy).
    const required = this.reflector.getAllAndOverride<string[] | undefined>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<
      Request & { user?: AuthenticatedUser }
    >();
    const user = request.user;
    if (!user) {
      // Si llegamos aquí sin user es porque JwtAuthGuard falló; defensivo.
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        title: 'Acceso denegado',
        message: 'No se pudo identificar al usuario.',
      });
    }

    // 4) Superadmin pasa siempre.
    if (user.rol === 'superadmin') {
      return true;
    }

    // 5) Inquilino: en v1 no tiene permisos granulares propios
    // (RBAC solo Admin Plaza). Si el endpoint está marcado con
    // `@Roles('inquilino', ...)`, el dev lo expone a propósito y debe pasar
    // este guard; el gating fino se reservará a v2 con rol_staff para
    // inquilinos. Ver JwtPayload (T-RBAC-1) y comentario en POST /solicitudes.
    if (user.rol === 'inquilino') {
      const endpointRoles = this.reflector.getAllAndOverride<RolGlobal[] | undefined>(
        ROLES_KEY,
        [context.getHandler(), context.getClass()],
      );
      const admiteInquilino = endpointRoles?.includes('inquilino') ?? false;
      if (admiteInquilino) {
        return true;
      }
      this.deny(required, user.permisos);
    }

    // 6) Admin Plaza.
    if (user.rol === 'admin_plaza') {
      // 6a) Compat: sin rol_staff_id → acceso total (datos pre-RBAC).
      if (!user.rolStaffId) {
        return true;
      }
      // 6b) Con rol_staff_id → chequear permisos efectivos.
      const userPerms = user.permisos ?? [];
      const ok = required.some((p) => userPerms.includes(p));
      if (!ok) {
        this.deny(required, userPerms);
      }
      return true;
    }

    // Cualquier otro rol no contemplado: denegado.
    this.deny(required, user.permisos);
  }

  private deny(required: string[], userPerms: string[] | undefined): never {
    throw new ForbiddenException({
      code: 'PERMISSION_DENIED',
      title: 'Acceso denegado',
      message: 'No tienes permiso para realizar esta acción.',
      meta: {
        permisosRequeridos: required,
        permisosUsuario: userPerms ?? [],
      },
    });
  }
}
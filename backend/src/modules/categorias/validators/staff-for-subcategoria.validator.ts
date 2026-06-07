import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

/** Contexto del uso: define el código de error de dominio. */
export type StaffContexto = 'responsable' | 'supervisor';

interface CacheEntry {
  valido: boolean;
  expiresAt: number;
}

const CACHE_TTL_MS = 60_000;

/**
 * Validador SC-6 (T-071): el responsable y los supervisores de una subcategoría
 * deben ser `admin_plaza` con `rol_staff` activo y pertenecer a la misma plaza.
 *
 * Cachea el veredicto por usuario 1 min para no pegar a BD en validaciones
 * repetidas (p. ej. al crear una subcategoría con 5 supervisores). El caché es
 * por proceso (sin Redis en v1, T-V11) y solo cachea resultados VÁLIDOS: un
 * fallo siempre se re-consulta (el usuario pudo ser activado entre llamadas).
 */
@Injectable()
export class StaffForSubcategoriaValidator {
  private readonly cache = new Map<string, CacheEntry>();

  /**
   * Lanza 422 `RESPONSABLE_INVALIDO` / `SUPERVISOR_INVALIDO` si el usuario no
   * cumple SC-6. Corre dentro de la transacción del caller (RLS ya scoped).
   */
  async validate(
    tx: Prisma.TransactionClient,
    usuarioId: string,
    plazaId: string,
    contexto: StaffContexto,
  ): Promise<void> {
    const cacheKey = `${plazaId}:${usuarioId}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now() && cached.valido) {
      return;
    }

    const usuario = await tx.usuario.findFirst({
      where: { id: usuarioId, deleted_at: null },
      include: { rol: { select: { codigo: true } }, rol_staff: { select: { activo: true } } },
    });

    const valido =
      usuario !== null &&
      usuario.plaza_id === plazaId &&
      usuario.rol.codigo === 'admin_plaza' &&
      usuario.rol_staff_id !== null &&
      usuario.rol_staff?.activo === true;

    if (!valido) {
      throw new UnprocessableEntityException({
        code: contexto === 'responsable' ? 'RESPONSABLE_INVALIDO' : 'SUPERVISOR_INVALIDO',
        title: 'Entidad no procesable',
        message:
          contexto === 'responsable'
            ? 'El responsable debe ser un admin de plaza activo, con rol de staff activo y de la misma plaza.'
            : 'Cada supervisor debe ser un admin de plaza activo, con rol de staff activo y de la misma plaza.',
      });
    }

    this.cache.set(cacheKey, { valido: true, expiresAt: Date.now() + CACHE_TTL_MS });
  }

  /** Invalida el caché de un usuario (p. ej. al desactivarlo). */
  invalidate(plazaId: string, usuarioId: string): void {
    this.cache.delete(`${plazaId}:${usuarioId}`);
  }
}

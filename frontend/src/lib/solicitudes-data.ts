import 'server-only';
import type { CategoriaOutput, CategoriaDetailOutput, ContratoListItem } from '@app/contracts';
import { apiFetch } from '@/lib/api';
import type { CategoriaOption, LocalOption } from '@/components/client/solicitud-wizard';

/** Árbol categoría→subcategorías activas para el wizard (T-088). */
export async function loadCategorias(): Promise<CategoriaOption[]> {
  const res = await apiFetch('/categorias?page=1&pageSize=100');
  if (!res.ok) return [];
  const categorias = ((await res.json()) as { items: CategoriaOutput[] }).items;
  const detalles = await Promise.all(
    categorias.map(async (c) => {
      const d = await apiFetch(`/categorias/${c.id}`);
      if (!d.ok) return null;
      return (await d.json()) as CategoriaDetailOutput;
    }),
  );
  return detalles
    .filter((d): d is CategoriaDetailOutput => d !== null)
    .map((d) => ({
      id: d.id,
      nombre: d.nombre,
      subcategorias: d.subcategorias.map((s) => ({
        id: s.id,
        nombre: s.nombre,
        prioridad: s.prioridad,
      })),
    }));
}

/** Locales del inquilino = los de sus contratos VIGENTES (RN-SO-1). */
export async function loadLocales(): Promise<LocalOption[]> {
  const res = await apiFetch('/contratos?estado=vigente&page=1&pageSize=100');
  if (!res.ok) return [];
  const contratos = ((await res.json()) as { items: ContratoListItem[] }).items;
  const vistos = new Set<string>();
  return contratos
    .filter((c) => {
      if (vistos.has(c.localId)) return false;
      vistos.add(c.localId);
      return true;
    })
    .map((c) => ({ id: c.localId, codigo: c.localCodigo ?? c.localId }));
}

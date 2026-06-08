import 'server-only';
import type { PlazaOutput } from '@app/contracts';
import { apiFetch } from '@/lib/api';
import { loadSelectedPlaza } from '@/lib/branding';

export interface SuperadminShell {
  /** Lista ligera de plazas para el selector del topbar. */
  plazas: Array<{ id: string; nombreComercial: string; slug: string; colorPrimario: string | null }>;
  /** Plaza actualmente seleccionada (impersonación), o null. */
  selected: PlazaOutput | null;
}

/** Carga el contexto de shell del superadmin: plazas disponibles + selección. */
export async function loadSuperadminShell(): Promise<SuperadminShell> {
  const [plazasRes, selected] = await Promise.all([
    apiFetch('/plazas?page=1&pageSize=100'),
    loadSelectedPlaza(),
  ]);
  const plazas = plazasRes.ok
    ? ((await plazasRes.json()) as { items: PlazaOutput[] }).items.map((p) => ({
        id: p.id,
        nombreComercial: p.nombreComercial,
        slug: p.slug,
        colorPrimario: p.colorPrimario,
      }))
    : [];
  return { plazas, selected };
}

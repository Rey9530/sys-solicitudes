import type {
  categoria as CategoriaModel,
  subcategoria as SubcategoriaModel,
  subcategoria_supervisor as SupervisorModel,
} from '@prisma/client';
import type {
  CategoriaOutput,
  SubcategoriaOutput,
  SubcategoriaDetailOutput,
  StaffRef,
} from '@app/contracts';

export type SupervisorConUsuario = SupervisorModel & {
  usuario?: { id: string; nombre: string; email: string } | null;
};

export type SubcategoriaConRelaciones = SubcategoriaModel & {
  supervisores?: SupervisorConUsuario[];
  responsable?: { id: string; nombre: string; email: string } | null;
};

export function categoriaToOutput(c: CategoriaModel): CategoriaOutput {
  return {
    id: c.id,
    plazaId: c.plaza_id,
    nombre: c.nombre,
    descripcion: c.descripcion,
    activo: c.activo,
    createdAt: c.created_at.toISOString(),
    updatedAt: c.updated_at.toISOString(),
  };
}

export function subcategoriaToOutput(s: SubcategoriaConRelaciones): SubcategoriaOutput {
  return {
    id: s.id,
    plazaId: s.plaza_id,
    categoriaId: s.categoria_id,
    responsableId: s.responsable_id,
    nombre: s.nombre,
    descripcion: s.descripcion,
    prioridad: s.prioridad,
    activo: s.activo,
    supervisorIds: (s.supervisores ?? []).map((sup) => sup.usuario_id),
    createdAt: s.created_at.toISOString(),
    updatedAt: s.updated_at.toISOString(),
  };
}

export function subcategoriaToDetail(s: SubcategoriaConRelaciones): SubcategoriaDetailOutput {
  const toRef = (u: { id: string; nombre: string; email: string } | null | undefined): StaffRef | null =>
    u ? { id: u.id, nombre: u.nombre, email: u.email } : null;
  return {
    ...subcategoriaToOutput(s),
    responsable: toRef(s.responsable),
    supervisores: (s.supervisores ?? [])
      .map((sup) => toRef(sup.usuario))
      .filter((r): r is StaffRef => r !== null),
  };
}

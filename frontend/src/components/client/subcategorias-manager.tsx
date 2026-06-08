'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  CreateSubcategoriaSchema,
  SolicitudPrioridadSchema,
  type SubcategoriaDetailOutput,
} from '@app/contracts';
import {
  createSubcategoriaAction,
  updateSubcategoriaAction,
  deleteSubcategoriaAction,
  setResponsableAction,
  addSupervisorAction,
  removeSupervisorAction,
} from '@/app/(admin-plaza)/admin/categorias/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export interface StaffOption {
  id: string;
  nombre: string;
  email: string;
}

const PRIORIDADES = SolicitudPrioridadSchema.options;

const selectClass = 'select';

// Form sin supervisores (se gestionan con su propio modal).
const SubFormSchema = CreateSubcategoriaSchema.omit({ supervisorIds: true });
type SubFormValues = z.input<typeof SubFormSchema>;

/** Gestión completa de subcategorías (T-073): crear, editar, responsable, supervisores. */
export function SubcategoriasManager({
  categoriaId,
  subcategorias,
  staffOptions,
}: {
  categoriaId: string;
  subcategorias: SubcategoriaDetailOutput[];
  staffOptions: StaffOption[];
}) {
  const router = useRouter();
  const [modal, setModal] = useState<
    | { kind: 'nueva' }
    | { kind: 'editar'; sub: SubcategoriaDetailOutput }
    | { kind: 'responsable'; sub: SubcategoriaDetailOutput }
    | { kind: 'supervisores'; sub: SubcategoriaDetailOutput }
    | null
  >(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const close = () => setModal(null);
  const refresh = () => {
    close();
    router.refresh();
  };

  const onDelete = async (sub: SubcategoriaDetailOutput) => {
    if (!confirm(`¿Desactivar la subcategoría "${sub.nombre}"?`)) return;
    setPendingId(sub.id);
    const result = await deleteSubcategoriaAction(categoriaId, sub.id);
    setPendingId(null);
    if (result.ok) {
      toast.success('Subcategoría desactivada');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setModal({ kind: 'nueva' })}>Nueva subcategoría</Button>
      </div>

      {subcategorias.length === 0 ? (
        <div className="card card-pad text-center">
          <p className="muted text-sm">No hay subcategorías. Crea la primera.</p>
        </div>
      ) : (
        <div className="card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Prioridad</TableHead>
                <TableHead>Responsable</TableHead>
                <TableHead>Supervisores</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subcategorias.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="lead">{s.nombre}</TableCell>
                  <TableCell>
                    <span className={`prio prio-${s.prioridad}`}>{s.prioridad}</span>
                  </TableCell>
                  <TableCell className="text-gray-600">{s.responsable?.nombre ?? '—'}</TableCell>
                  <TableCell>
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-semibold ${
                        s.supervisores.length >= 5
                          ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {s.supervisores.length}/5
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        s.activo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {s.activo ? 'Activa' : 'Inactiva'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setModal({ kind: 'editar', sub: s })}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setModal({ kind: 'responsable', sub: s })}
                      >
                        Responsable
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setModal({ kind: 'supervisores', sub: s })}
                      >
                        Supervisores
                      </Button>
                      {s.activo && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:bg-red-50"
                          disabled={pendingId === s.id}
                          onClick={() => onDelete(s)}
                        >
                          Desactivar
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {modal?.kind === 'nueva' && (
        <SubcategoriaFormDialog
          categoriaId={categoriaId}
          staffOptions={staffOptions}
          onClose={close}
          onSaved={refresh}
        />
      )}
      {modal?.kind === 'editar' && (
        <SubcategoriaFormDialog
          categoriaId={categoriaId}
          sub={modal.sub}
          staffOptions={staffOptions}
          onClose={close}
          onSaved={refresh}
        />
      )}
      {modal?.kind === 'responsable' && (
        <ResponsableDialog
          categoriaId={categoriaId}
          sub={modal.sub}
          staffOptions={staffOptions}
          onClose={close}
          onSaved={refresh}
        />
      )}
      {modal?.kind === 'supervisores' && (
        <SupervisoresDialog
          categoriaId={categoriaId}
          sub={modal.sub}
          staffOptions={staffOptions}
          onClose={close}
        />
      )}
    </div>
  );
}

// ── Modal crear/editar ──────────────────────────────────────────────────────────

function SubcategoriaFormDialog({
  categoriaId,
  sub,
  staffOptions,
  onClose,
  onSaved,
}: {
  categoriaId: string;
  sub?: SubcategoriaDetailOutput;
  staffOptions: StaffOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SubFormValues>({
    resolver: zodResolver(SubFormSchema),
    defaultValues: sub
      ? {
          nombre: sub.nombre,
          descripcion: sub.descripcion ?? undefined,
          responsableId: sub.responsableId,
          prioridad: sub.prioridad,
        }
      : { prioridad: 'B' },
  });

  const onSubmit = async (values: SubFormValues) => {
    setSubmitting(true);
    const result = sub
      ? await updateSubcategoriaAction(categoriaId, sub.id, {
          nombre: values.nombre,
          descripcion: values.descripcion,
          prioridad: values.prioridad,
        })
      : await createSubcategoriaAction(categoriaId, { ...values, supervisorIds: [] });
    setSubmitting(false);
    if (result.ok) {
      toast.success(sub ? 'Subcategoría actualizada' : 'Subcategoría creada');
      onSaved();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{sub ? `Editar ${sub.nombre}` : 'Nueva subcategoría'}</DialogTitle>
          <DialogDescription>
            La prioridad se hereda a las solicitudes nuevas (S-FS-Prioridad).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3" noValidate>
          <div className="grid gap-1.5">
            <Label htmlFor="sub-nombre">Nombre *</Label>
            <Input id="sub-nombre" maxLength={80} {...register('nombre')} />
            {errors.nombre && <p className="text-xs text-red-600">{errors.nombre.message}</p>}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="sub-descripcion">Descripción</Label>
            <textarea id="sub-descripcion" rows={2} maxLength={500} className="textarea" {...register('descripcion')} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="sub-prioridad">Prioridad por defecto</Label>
            <select id="sub-prioridad" className={selectClass} {...register('prioridad')}>
              {PRIORIDADES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          {!sub && (
            <div className="grid gap-1.5">
              <Label htmlFor="sub-responsable">Responsable *</Label>
              <select id="sub-responsable" className={selectClass} {...register('responsableId')}>
                <option value="">Selecciona…</option>
                {staffOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre} ({u.email})
                  </option>
                ))}
              </select>
              {errors.responsableId && (
                <p className="text-xs text-red-600">Selecciona un responsable.</p>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Modal de responsable (T-069) ────────────────────────────────────────────────

function ResponsableDialog({
  categoriaId,
  sub,
  staffOptions,
  onClose,
  onSaved,
}: {
  categoriaId: string;
  sub: SubcategoriaDetailOutput;
  staffOptions: StaffOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [responsableId, setResponsableId] = useState(sub.responsableId);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    setSubmitting(true);
    const result = await setResponsableAction(categoriaId, sub.id, responsableId);
    setSubmitting(false);
    if (result.ok) {
      toast.success('Responsable actualizado');
      onSaved();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Responsable de {sub.nombre}</DialogTitle>
          <DialogDescription>
            Debe ser un admin de plaza con rol de staff activo (SC-6).
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <select
            className={selectClass}
            value={responsableId}
            onChange={(e) => setResponsableId(e.target.value)}
          >
            {staffOptions.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre} ({u.email})
              </option>
            ))}
          </select>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={onSubmit} disabled={submitting || responsableId === sub.responsableId}>
              {submitting ? 'Guardando…' : 'Cambiar responsable'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Modal de supervisores (T-070) ───────────────────────────────────────────────

function SupervisoresDialog({
  categoriaId,
  sub,
  staffOptions,
  onClose,
}: {
  categoriaId: string;
  sub: SubcategoriaDetailOutput;
  staffOptions: StaffOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [seleccion, setSeleccion] = useState('');
  const [pending, setPending] = useState(false);
  const alLimite = sub.supervisores.length >= 5;
  const disponibles = staffOptions.filter(
    (u) => !sub.supervisores.some((s) => s.id === u.id),
  );

  const onAdd = async () => {
    if (!seleccion) return;
    setPending(true);
    const result = await addSupervisorAction(categoriaId, sub.id, seleccion);
    setPending(false);
    if (result.ok) {
      toast.success('Supervisor agregado');
      setSeleccion('');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const onRemove = async (usuarioId: string) => {
    setPending(true);
    const result = await removeSupervisorAction(categoriaId, sub.id, usuarioId);
    setPending(false);
    if (result.ok) {
      toast.success('Supervisor quitado');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Supervisores de {sub.nombre}{' '}
            <span
              className={`ml-1 rounded px-2 py-0.5 text-xs font-semibold ${
                alLimite ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
              }`}
            >
              {sub.supervisores.length}/5
            </span>
          </DialogTitle>
          <DialogDescription>
            Reciben notificación de cada solicitud nueva de la subcategoría.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {sub.supervisores.length === 0 ? (
            <p className="text-sm text-gray-500">Sin supervisores.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {sub.supervisores.map((s) => (
                <li key={s.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span>
                    {s.nombre} <span className="text-gray-500">({s.email})</span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:bg-red-50"
                    disabled={pending}
                    onClick={() => onRemove(s.id)}
                  >
                    Quitar
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <select
              className={selectClass}
              value={seleccion}
              onChange={(e) => setSeleccion(e.target.value)}
              disabled={alLimite || disponibles.length === 0}
            >
              <option value="">
                {alLimite ? 'Límite de 5 alcanzado' : 'Agregar supervisor…'}
              </option>
              {disponibles.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre} ({u.email})
                </option>
              ))}
            </select>
            <Button onClick={onAdd} disabled={pending || !seleccion || alLimite}>
              Agregar
            </Button>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

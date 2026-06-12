'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Pencil, Plus } from 'lucide-react';
import {
  CreateRolStaffSchema,
  UpdateRolStaffSchema,
  type CreateRolStaffInput,
  type UpdateRolStaffInput,
} from '@app/contracts';
import {
  createRolStaffAction,
  updateRolStaffAction,
} from '@/app/(admin-plaza)/admin/usuarios-plaza/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const CreateFormSchema = CreateRolStaffSchema;
type CreateFormValues = CreateRolStaffInput;

const EditFormSchema = UpdateRolStaffSchema.extend({
  activo: z.boolean().optional(),
});
type EditFormValues = z.infer<typeof EditFormSchema>;

interface RolEditable {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}

/**
 * Dialog dual para crear/editar un `rol_staff`. El `codigo` es inmutable
 * después de la creación (RN: es un identificador de sistema; se usa en
 * selects y en la baja inicial del admin de plaza).
 */
export function RolStaffFormDialog({
  mode,
  rol,
}: {
  mode: 'create' | 'edit';
  rol?: RolEditable;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const isEdit = mode === 'edit' && rol;

  const createForm = useForm<CreateFormValues>({
    resolver: zodResolver(CreateFormSchema),
    defaultValues: { codigo: '', nombre: '', descripcion: '' },
  });
  const editForm = useForm<EditFormValues>({
    resolver: zodResolver(EditFormSchema),
    defaultValues: rol
      ? { nombre: rol.nombre, descripcion: rol.descripcion ?? '', activo: rol.activo }
      : { nombre: '', descripcion: '', activo: true },
  });

  const onCreate = async (values: CreateFormValues) => {
    setSubmitting(true);
    const result = await createRolStaffAction(values);
    setSubmitting(false);
    if (result.ok) {
      toast.success('Rol creado');
      setOpen(false);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const onEdit = async (values: EditFormValues) => {
    if (!rol) return;
    setSubmitting(true);
    const payload: UpdateRolStaffInput = {
      nombre: values.nombre,
      descripcion: values.descripcion === '' ? null : (values.descripcion ?? null),
      activo: values.activo,
    };
    const result = await updateRolStaffAction(rol.id, payload);
    setSubmitting(false);
    if (result.ok) {
      toast.success('Rol actualizado');
      setOpen(false);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next && isEdit && rol) {
      editForm.reset({
        nombre: rol.nombre,
        descripcion: rol.descripcion ?? '',
        activo: rol.activo,
      });
    } else if (!next && !isEdit) {
      createForm.reset({ codigo: '', nombre: '', descripcion: '' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="sm" aria-label={`Editar ${rol!.nombre}`}>
            <Pencil />
          </Button>
        ) : (
          <Button variant="primary">
            <Plus />
            Nuevo rol
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Editar rol: ${rol!.nombre}` : 'Nuevo rol de staff'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Modifica nombre, descripción o estado del rol.'
              : 'Crea un rol operativo para clasificar al personal de la plaza.'}
          </DialogDescription>
        </DialogHeader>

        {isEdit ? (
          <form onSubmit={editForm.handleSubmit(onEdit)} className="grid gap-3" noValidate>
            <div className="grid gap-1.5">
              <Label>Código</Label>
              <Input value={rol!.codigo} disabled />
              <p className="text-xs text-gray-400">Inmutable tras la creación.</p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="rsf-nombre">Nombre</Label>
              <Input id="rsf-nombre" {...editForm.register('nombre')} />
              {editForm.formState.errors.nombre && (
                <p className="text-xs text-red-600">{editForm.formState.errors.nombre.message}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="rsf-desc">Descripción (opcional)</Label>
              <Input id="rsf-desc" {...editForm.register('descripcion')} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...editForm.register('activo')} />
              Activo
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Guardando…' : 'Guardar'}
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={createForm.handleSubmit(onCreate)} className="grid gap-3" noValidate>
            <div className="grid gap-1.5">
              <Label htmlFor="rsf-codigo">Código (slug, inmutable)</Label>
              <Input
                id="rsf-codigo"
                placeholder="tecnico"
                {...createForm.register('codigo')}
              />
              <p className="text-xs text-gray-400">
                minúsculas, dígitos y guiones. Ej.: <code>tecnico</code>, <code>supervisor-nocturno</code>.
              </p>
              {createForm.formState.errors.codigo && (
                <p className="text-xs text-red-600">{createForm.formState.errors.codigo.message}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="rsf-nombre-new">Nombre</Label>
              <Input id="rsf-nombre-new" {...createForm.register('nombre')} />
              {createForm.formState.errors.nombre && (
                <p className="text-xs text-red-600">{createForm.formState.errors.nombre.message}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="rsf-desc-new">Descripción (opcional)</Label>
              <Input id="rsf-desc-new" {...createForm.register('descripcion')} />
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creando…' : 'Crear rol'}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

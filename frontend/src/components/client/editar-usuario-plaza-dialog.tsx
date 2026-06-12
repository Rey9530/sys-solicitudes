'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
import type { RolStaffOutput, UpdateUsuarioInput } from '@app/contracts';
import { updateUsuarioPlazaAction } from '@/app/(admin-plaza)/admin/usuarios-plaza/actions';
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

const FormSchema = z.object({
  nombre: z.string().trim().min(1, 'Requerido').max(120),
  telefono: z
    .string()
    .trim()
    .max(40, 'Máximo 40 caracteres')
    .nullable()
    .or(z.literal('').transform(() => null)),
  rolStaffId: z.string().min(1, 'Selecciona un rol de staff'),
});
type FormValues = z.infer<typeof FormSchema>;

/**
 * Edición de un usuario `admin_plaza`: nombre, teléfono y `rol_staff`. Si el
 * nuevo `rol_staff` está inactivo se permite igualmente (el usuario sigue
 * activo, el FE muestra un badge de warning en la tabla).
 */
export function EditarUsuarioPlazaDialog({
  usuarioId,
  nombreInicial,
  telefonoInicial,
  email,
  rolStaffIdInicial,
  rolesStaff,
}: {
  usuarioId: string;
  nombreInicial: string;
  telefonoInicial: string | null;
  email: string;
  rolStaffIdInicial: string | null;
  rolesStaff: RolStaffOutput[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      nombre: nombreInicial,
      telefono: telefonoInicial ?? '',
      rolStaffId: rolStaffIdInicial ?? '',
    },
  });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    const input: UpdateUsuarioInput = {
      nombre: values.nombre,
      telefono: values.telefono,
      rolStaffId: values.rolStaffId,
    };
    const result = await updateUsuarioPlazaAction(usuarioId, input);
    setSubmitting(false);
    if (result.ok) {
      toast.success('Usuario actualizado');
      setOpen(false);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      reset({
        nombre: nombreInicial,
        telefono: telefonoInicial ?? '',
        rolStaffId: rolStaffIdInicial ?? '',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={`Editar ${email}`}>
          <Pencil />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar usuario</DialogTitle>
          <DialogDescription>
            Modifica nombre, teléfono y rol de staff de <b>{email}</b>.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3" noValidate>
          <div className="grid gap-1.5">
            <Label htmlFor="edit-usp-nombre">Nombre</Label>
            <Input id="edit-usp-nombre" {...register('nombre')} />
            {errors.nombre && <p className="text-xs text-red-600">{errors.nombre.message}</p>}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="edit-usp-telefono">Teléfono (opcional)</Label>
            <Input
              id="edit-usp-telefono"
              type="tel"
              placeholder="+52 55 1234 5678"
              {...register('telefono')}
            />
            {errors.telefono && (
              <p className="text-xs text-red-600">{errors.telefono.message}</p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="edit-usp-rol">Rol de staff</Label>
            <select
              id="edit-usp-rol"
              className="select"
              {...register('rolStaffId')}
            >
              <option value="" disabled>
                Selecciona…
              </option>
              {rolesStaff.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre} ({r.codigo})
                  {r.activo ? '' : ' — inactivo'}
                </option>
              ))}
            </select>
            {errors.rolStaffId && (
              <p className="text-xs text-red-600">{errors.rolStaffId.message}</p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
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

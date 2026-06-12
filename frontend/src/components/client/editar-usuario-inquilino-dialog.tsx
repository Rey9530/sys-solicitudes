'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Pencil } from 'lucide-react';
import type { UpdateUsuarioInput } from '@app/contracts';
import { updateUsuarioInquilinoAction } from '@/app/(admin-plaza)/admin/inquilinos/actions';
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
});
type FormValues = z.infer<typeof FormSchema>;

/**
 * Edición rápida de nombre y teléfono de un usuario del inquilino (T-059-bis).
 * El email y el rol no se exponen aquí — el email es el identificador de
 * cuenta y el rol solo cambia vía CRUD completo (T-034).
 */
export function EditarUsuarioInquilinoDialog({
  usuarioId,
  nombreInicial,
  telefonoInicial,
  email,
}: {
  usuarioId: string;
  nombreInicial: string;
  telefonoInicial: string | null;
  email: string;
}) {
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
    },
  });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    const input: UpdateUsuarioInput = {
      nombre: values.nombre,
      telefono: values.telefono,
    };
    const result = await updateUsuarioInquilinoAction(usuarioId, input);
    setSubmitting(false);
    if (result.ok) {
      toast.success('Usuario actualizado');
      setOpen(false);
    } else {
      toast.error(result.error);
    }
  };

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) reset({ nombre: nombreInicial, telefono: telefonoInicial ?? '' });
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
            Modifica el nombre y teléfono de <b>{email}</b>.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3" noValidate>
          <div className="grid gap-1.5">
            <Label htmlFor="edit-usuario-nombre">Nombre</Label>
            <Input id="edit-usuario-nombre" {...register('nombre')} />
            {errors.nombre && <p className="text-xs text-red-600">{errors.nombre.message}</p>}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="edit-usuario-telefono">Teléfono (opcional)</Label>
            <Input
              id="edit-usuario-telefono"
              type="tel"
              placeholder="+52 55 1234 5678"
              {...register('telefono')}
            />
            {errors.telefono && (
              <p className="text-xs text-red-600">{errors.telefono.message}</p>
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

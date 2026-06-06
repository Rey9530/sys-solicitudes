'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  UpdateInquilinoSchema,
  type UpdateInquilinoInput,
  type InquilinoOutput,
} from '@app/contracts';
import {
  updateInquilinoAction,
  deleteInquilinoAction,
} from '@/app/(admin-plaza)/admin/inquilinos/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/** Edición de inquilino (T-059): solo contacto y dirección son editables. */
export function EditarInquilinoForm({
  inquilino,
  tieneContratoVigente,
}: {
  inquilino: InquilinoOutput;
  tieneContratoVigente: boolean;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateInquilinoInput>({
    resolver: zodResolver(UpdateInquilinoSchema),
    defaultValues: {
      contactoNombre: inquilino.contactoNombre,
      contactoEmail: inquilino.contactoEmail,
      contactoTelefono: inquilino.contactoTelefono,
      direccion: inquilino.direccion,
    },
  });

  const onSubmit = async (values: UpdateInquilinoInput) => {
    setSubmitting(true);
    const result = await updateInquilinoAction(inquilino.id, values);
    setSubmitting(false);
    if (result.ok) {
      toast.success('Inquilino actualizado');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const onDelete = async () => {
    if (!confirm(`¿Desactivar a "${inquilino.razonSocial}"?`)) return;
    setDeleting(true);
    const result = await deleteInquilinoAction(inquilino.id);
    setDeleting(false);
    if (result.ok) {
      toast.success('Inquilino desactivado');
      router.push('/admin/inquilinos');
    } else {
      toast.error(result.error);
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="grid max-w-lg gap-4 rounded-lg border bg-white p-6"
      noValidate
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label>Razón social</Label>
          <Input value={inquilino.razonSocial} disabled className="bg-gray-50" />
        </div>
        <div className="grid gap-1.5">
          <Label>Identificación</Label>
          <Input value={inquilino.identificacion ?? '—'} disabled className="bg-gray-50" />
        </div>
      </div>
      <p className="-mt-2 text-xs text-gray-400">
        Razón social e identificación son inmutables (decisión de UX).
      </p>
      <div className="grid gap-1.5">
        <Label htmlFor="direccion">Dirección</Label>
        <Input id="direccion" {...register('direccion')} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="contactoNombre">Contacto</Label>
          <Input id="contactoNombre" {...register('contactoNombre')} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="contactoTelefono">Teléfono</Label>
          <Input id="contactoTelefono" {...register('contactoTelefono')} />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="contactoEmail">Email de contacto</Label>
        <Input id="contactoEmail" type="email" {...register('contactoEmail')} />
        {errors.contactoEmail && (
          <p className="text-xs text-red-600">{errors.contactoEmail.message}</p>
        )}
      </div>
      <div className="flex items-center justify-between">
        <div title={tieneContratoVigente ? 'No se puede desactivar con contrato vigente' : ''}>
          <Button
            type="button"
            variant="outline"
            className="text-red-600"
            disabled={tieneContratoVigente || deleting}
            onClick={onDelete}
          >
            {deleting ? 'Desactivando…' : 'Desactivar'}
          </Button>
        </div>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </div>
      {tieneContratoVigente && (
        <p className="text-xs text-gray-400">
          El botón «Desactivar» está deshabilitado porque tiene contratos vigentes.
        </p>
      )}
    </form>
  );
}

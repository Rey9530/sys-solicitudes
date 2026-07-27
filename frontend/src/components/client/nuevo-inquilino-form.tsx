'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { CreateInquilinoSchema, type CreateInquilinoInput } from '@app/contracts';
import { createInquilinoAction } from '@/app/(admin-plaza)/admin/inquilinos/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function NuevoInquilinoForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateInquilinoInput>({ resolver: zodResolver(CreateInquilinoSchema) });

  const onSubmit = async (values: CreateInquilinoInput) => {
    setSubmitting(true);
    const result = await createInquilinoAction(values);
    setSubmitting(false);
    if (result.ok) {
      toast.success('Inquilino creado');
      router.push('/admin/inquilinos');
    } else {
      toast.error(result.error);
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="card card-pad grid gap-4"
      noValidate
    >
      <div className="grid gap-1.5">
        <Label htmlFor="razonSocial">Razón social *</Label>
        <Input id="razonSocial" {...register('razonSocial')} />
        {errors.razonSocial && (
          <p className="text-xs text-red-600">{errors.razonSocial.message}</p>
        )}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="identificacion">Identificación (RUC/NIT)</Label>
        <Input id="identificacion" {...register('identificacion')} />
        {errors.identificacion && (
          <p className="text-xs text-red-600">{errors.identificacion.message}</p>
        )}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="direccion">Dirección</Label>
        <Input id="direccion" {...register('direccion')} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
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
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Creando…' : 'Crear inquilino'}
        </Button>
      </div>
    </form>
  );
}

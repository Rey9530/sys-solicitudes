'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { z } from 'zod';
import { CreateLocalSchema } from '@app/contracts';

/** Tipo de entrada del form (z.coerce hace `metrajeM2` unknown en input). */
type FormValues = z.input<typeof CreateLocalSchema>;
import { createLocalAction } from '@/app/(admin-plaza)/admin/locales/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function NuevoLocalForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(CreateLocalSchema) });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    const result = await createLocalAction(values);
    setSubmitting(false);
    if (result.ok) {
      toast.success('Local creado');
      router.push('/admin/locales');
    } else {
      toast.error(result.error);
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="grid gap-4 rounded-lg border bg-white p-6"
      noValidate
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="codigo">Código *</Label>
          <Input id="codigo" placeholder="L-101" {...register('codigo')} />
          {errors.codigo && <p className="text-xs text-red-600">{errors.codigo.message}</p>}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="metrajeM2">Metraje (m²)</Label>
          <Input id="metrajeM2" type="number" step="0.01" {...register('metrajeM2')} />
          {errors.metrajeM2 && <p className="text-xs text-red-600">{errors.metrajeM2.message}</p>}
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="nombre">Nombre</Label>
        <Input id="nombre" {...register('nombre')} />
        {errors.nombre && <p className="text-xs text-red-600">{errors.nombre.message}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="piso">Piso</Label>
          <Input id="piso" {...register('piso')} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="sector">Sector</Label>
          <Input id="sector" {...register('sector')} />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="descripcion">Descripción</Label>
        <Input id="descripcion" {...register('descripcion')} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Creando…' : 'Crear local'}
        </Button>
      </div>
    </form>
  );
}

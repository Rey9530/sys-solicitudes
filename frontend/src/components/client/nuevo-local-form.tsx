'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { z } from 'zod';
import { CreateLocalSchema } from '@app/contracts';

/** Tipo de entrada del form (z.coerce hace `areaM2` unknown en input). */
type FormValues = z.input<typeof CreateLocalSchema>;
import { createLocalAction } from '@/app/(admin-plaza)/admin/locales/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Formulario de creación de local.
 * Campos alineados al formato Excel "INFORMACION PARA CREACION DE LOCALES":
 *   MODULO, NIVEL, LOCAL (codigo), ÁREA, MEDIDOR ENERGIA, MEDIDOR AGUA.
 */
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
    <form onSubmit={handleSubmit(onSubmit)} className="card card-pad grid gap-4" noValidate>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="modulo">Módulo *</Label>
          <Input id="modulo" placeholder="A" {...register('modulo')} />
          {errors.modulo && <p className="text-xs text-red-600">{errors.modulo.message}</p>}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="nivel">Nivel *</Label>
          <Input id="nivel" placeholder="1" {...register('nivel')} />
          {errors.nivel && <p className="text-xs text-red-600">{errors.nivel.message}</p>}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="codigo">Local *</Label>
          <Input id="codigo" placeholder="L-101" {...register('codigo')} />
          {errors.codigo && <p className="text-xs text-red-600">{errors.codigo.message}</p>}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="areaM2">Área (m²)</Label>
          <Input id="areaM2" type="number" step="0.01" {...register('areaM2')} />
          {errors.areaM2 && <p className="text-xs text-red-600">{errors.areaM2.message}</p>}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="medidorEnergia">Medidor energía</Label>
          <Input
            id="medidorEnergia"
            inputMode="numeric"
            pattern="\d*"
            placeholder="10456050"
            {...register('medidorEnergia')}
          />
          {errors.medidorEnergia && (
            <p className="text-xs text-red-600">{errors.medidorEnergia.message}</p>
          )}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="medidorAgua">Medidor agua</Label>
          <Input
            id="medidorAgua"
            inputMode="numeric"
            pattern="\d*"
            placeholder="9999999"
            {...register('medidorAgua')}
          />
          {errors.medidorAgua && (
            <p className="text-xs text-red-600">{errors.medidorAgua.message}</p>
          )}
        </div>
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

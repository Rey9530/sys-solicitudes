'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { z } from 'zod';
import { CreateContratoSchema } from '@app/contracts';

/** Tipo de entrada del form (antes de defaults de Zod: `moneda` es opcional). */
type FormValues = z.input<typeof CreateContratoSchema>;
import { createContratoAction } from '@/app/(admin-plaza)/admin/contratos/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function NuevoContratoForm({
  locales,
  inquilinos,
}: {
  locales: Array<{ id: string; codigo: string; nombre: string | null }>;
  inquilinos: Array<{ id: string; razonSocial: string }>;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(CreateContratoSchema),
    defaultValues: { moneda: 'USD' },
  });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    const result = await createContratoAction({
      ...values,
      fechaFin: values.fechaFin || null,
    });
    setSubmitting(false);
    if (result.ok) {
      toast.success('Contrato creado; el local pasó a «alquilado»');
      router.push('/admin/contratos');
    } else {
      toast.error(result.error);
    }
  };

  const selectClass = 'select';

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="card card-pad grid gap-4" noValidate>
      <div className="grid gap-1.5">
        <Label htmlFor="localId">Local (solo disponibles) *</Label>
        <select id="localId" className={selectClass} {...register('localId')}>
          <option value="">Selecciona un local…</option>
          {locales.map((l) => (
            <option key={l.id} value={l.id}>
              {l.codigo} {l.nombre ? `· ${l.nombre}` : ''}
            </option>
          ))}
        </select>
        {errors.localId && <p className="text-xs text-red-600">Selecciona un local</p>}
        {locales.length === 0 && (
          <p className="text-xs text-amber-600">No hay locales disponibles.</p>
        )}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="inquilinoId">Inquilino *</Label>
        <select id="inquilinoId" className={selectClass} {...register('inquilinoId')}>
          <option value="">Selecciona un inquilino…</option>
          {inquilinos.map((i) => (
            <option key={i.id} value={i.id}>
              {i.razonSocial}
            </option>
          ))}
        </select>
        {errors.inquilinoId && <p className="text-xs text-red-600">Selecciona un inquilino</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="fechaInicio">Fecha de inicio *</Label>
          <Input id="fechaInicio" type="date" {...register('fechaInicio')} />
          {errors.fechaInicio && <p className="text-xs text-red-600">Requerida</p>}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="fechaFin">Fecha de fin (vacío = indefinido)</Label>
          <Input id="fechaFin" type="date" {...register('fechaFin')} />
          {errors.fechaFin && <p className="text-xs text-red-600">{errors.fechaFin.message}</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="montoMensual">Monto mensual *</Label>
          <Input id="montoMensual" type="number" step="0.01" {...register('montoMensual')} />
          {errors.montoMensual && (
            <p className="text-xs text-red-600">{errors.montoMensual.message}</p>
          )}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="moneda">Moneda (ISO 4217)</Label>
          <Input id="moneda" maxLength={3} {...register('moneda')} />
          {errors.moneda && <p className="text-xs text-red-600">{errors.moneda.message}</p>}
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="condiciones">Condiciones</Label>
        <textarea id="condiciones" rows={3} className="textarea" {...register('condiciones')} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Creando…' : 'Crear contrato'}
        </Button>
      </div>
    </form>
  );
}

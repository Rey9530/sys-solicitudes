'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { z } from 'zod';
import { RenovarContratoSchema, type ContratoOutput } from '@app/contracts';

/** Tipo de entrada del form (z.coerce hace `nuevoMontoMensual` unknown en input). */
type FormValues = z.input<typeof RenovarContratoSchema>;
import { renovarContratoAction } from '@/app/(admin-plaza)/admin/contratos/actions';
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

/**
 * Renovación de contrato (T-055/T-060): cierra el actual con motivo «renovado»
 * y crea uno nuevo vigente en la misma transacción. Muestra preview del nuevo.
 */
export function RenovarContratoDialog({ contrato }: { contrato: ContratoOutput }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(RenovarContratoSchema),
    defaultValues: { nuevoMontoMensual: contrato.montoMensual ?? undefined },
  });

  const nuevaInicio = watch('nuevaFechaInicio');
  const nuevaFin = watch('nuevaFechaFin');
  const nuevoMonto = watch('nuevoMontoMensual');

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    const result = await renovarContratoAction(contrato.id, {
      ...values,
      nuevaFechaFin: values.nuevaFechaFin || null,
    });
    setSubmitting(false);
    if (result.ok) {
      toast.success('Contrato renovado');
      setOpen(false);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Renovar contrato</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renovar contrato</DialogTitle>
          <DialogDescription>
            El contrato actual se cierra con motivo «renovado» y se crea uno nuevo vigente.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3" noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="nuevaFechaInicio">Nueva fecha de inicio *</Label>
              <Input id="nuevaFechaInicio" type="date" {...register('nuevaFechaInicio')} />
              {errors.nuevaFechaInicio && <p className="text-xs text-red-600">Requerida</p>}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="nuevaFechaFin">Nueva fecha de fin</Label>
              <Input id="nuevaFechaFin" type="date" {...register('nuevaFechaFin')} />
              {errors.nuevaFechaFin && (
                <p className="text-xs text-red-600">{errors.nuevaFechaFin.message}</p>
              )}
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="nuevoMontoMensual">Nuevo monto mensual</Label>
            <Input
              id="nuevoMontoMensual"
              type="number"
              step="0.01"
              {...register('nuevoMontoMensual')}
            />
          </div>
          {nuevaInicio && (
            <div
              className="text-sm"
              style={{ background: 'var(--surface-3)', borderRadius: 'var(--r-md)', padding: 12 }}
            >
              <p className="muted text-xs font-medium uppercase tracking-wide">
                Preview del nuevo contrato
              </p>
              <p style={{ color: 'var(--text)' }}>
                {nuevaInicio} → {nuevaFin || 'indefinido'} · {contrato.moneda}{' '}
                {String(nuevoMonto ?? contrato.montoMensual ?? '—')} / mes
              </p>
            </div>
          )}
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Renovando…' : 'Renovar'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

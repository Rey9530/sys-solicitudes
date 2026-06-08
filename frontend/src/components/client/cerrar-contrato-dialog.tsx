'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { z } from 'zod';
import { CerrarContratoSchema, type ContratoOutput } from '@app/contracts';

/** Tipo de entrada del form (antes de defaults de Zod: `estado` es opcional). */
type FormValues = z.input<typeof CerrarContratoSchema>;
import { cerrarContratoAction } from '@/app/(admin-plaza)/admin/contratos/actions';
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

/** Cierre de contrato (T-055/T-060): finalizado o cancelado + motivo. */
export function CerrarContratoDialog({ contrato }: { contrato: ContratoOutput }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(CerrarContratoSchema),
    defaultValues: { estado: 'finalizado' },
  });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    const result = await cerrarContratoAction(contrato.id, {
      ...values,
      fechaFinEfectiva: values.fechaFinEfectiva || undefined,
    });
    setSubmitting(false);
    if (result.ok) {
      toast.success('Contrato cerrado; el local quedó disponible si no hay otros vigentes');
      setOpen(false);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="danger">Cerrar contrato</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cerrar contrato</DialogTitle>
          <DialogDescription>
            {contrato.fechaInicio} → {contrato.fechaFin ?? 'indefinido'}. Esta acción no se
            puede deshacer.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3" noValidate>
          <div className="grid gap-1.5">
            <Label htmlFor="cerrar-estado">Tipo de cierre</Label>
            <select id="cerrar-estado" className="select" {...register('estado')}>
              <option value="finalizado">Finalizado (fin normal)</option>
              <option value="cancelado">Cancelado (terminación anticipada)</option>
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="motivoFin">Motivo *</Label>
            <Input id="motivoFin" {...register('motivoFin')} />
            {errors.motivoFin && <p className="text-xs text-red-600">Motivo requerido</p>}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="fechaFinEfectiva">Fecha de fin efectiva (default: hoy)</Label>
            <Input id="fechaFinEfectiva" type="date" {...register('fechaFinEfectiva')} />
            {errors.fechaFinEfectiva && (
              <p className="text-xs text-red-600">{errors.fechaFinEfectiva.message}</p>
            )}
          </div>
          <Button type="submit" variant="destructive" disabled={submitting}>
            {submitting ? 'Cerrando…' : 'Cerrar contrato'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

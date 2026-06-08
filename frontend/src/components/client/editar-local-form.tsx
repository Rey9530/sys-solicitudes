'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { z } from 'zod';
import { UpdateLocalSchema, type LocalOutput, type LocalEstado } from '@app/contracts';

/** Tipo de entrada del form (z.coerce hace `metrajeM2` unknown en input). */
type FormValues = z.input<typeof UpdateLocalSchema>;
import { updateLocalAction } from '@/app/(admin-plaza)/admin/locales/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Edición de local (T-057). Reglas de estado:
 *  - Con contrato vigente el select está deshabilitado (el local está alquilado).
 *  - Sin contrato vigente solo se ofrecen transiciones válidas (nunca «alquilado»,
 *    que únicamente lo setea el flujo de contratos).
 */
const TRANSICIONES_SIN_CONTRATO: LocalEstado[] = [
  'disponible',
  'en_mantenimiento',
  'fuera_de_servicio',
];

export function EditarLocalForm({
  local,
  tieneContratoVigente,
}: {
  local: LocalOutput;
  tieneContratoVigente: boolean;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(UpdateLocalSchema),
    defaultValues: {
      nombre: local.nombre,
      metrajeM2: local.metrajeM2,
      piso: local.piso,
      sector: local.sector,
      descripcion: local.descripcion,
      estado: local.estado,
    },
  });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    // Con contrato vigente no se envía `estado` (select deshabilitado).
    const result = await updateLocalAction(
      local.id,
      tieneContratoVigente ? { ...values, estado: undefined } : values,
    );
    setSubmitting(false);
    if (result.ok) {
      toast.success('Local actualizado');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="card card-pad grid max-w-lg gap-4"
      noValidate
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label>Código</Label>
          <Input value={local.codigo} disabled />
          <p className="text-xs text-gray-400">El código es inmutable.</p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="estado">Estado</Label>
          <select id="estado" disabled={tieneContratoVigente} className="select" {...register('estado')}>
            {tieneContratoVigente ? (
              <option value="alquilado">alquilado</option>
            ) : (
              TRANSICIONES_SIN_CONTRATO.map((e) => (
                <option key={e} value={e}>
                  {e.replaceAll('_', ' ')}
                </option>
              ))
            )}
          </select>
          {tieneContratoVigente && (
            <p className="text-xs text-gray-400">
              Con contrato vigente el estado se gestiona desde contratos.
            </p>
          )}
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="nombre">Nombre</Label>
        <Input id="nombre" {...register('nombre')} />
        {errors.nombre && <p className="text-xs text-red-600">{errors.nombre.message}</p>}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="metrajeM2">m²</Label>
          <Input id="metrajeM2" type="number" step="0.01" {...register('metrajeM2')} />
        </div>
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
      <div className="flex justify-end">
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </div>
    </form>
  );
}

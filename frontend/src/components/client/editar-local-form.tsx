'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { z } from 'zod';
import { UpdateLocalSchema, type LocalOutput, type LocalEstado } from '@app/contracts';

/** Tipo de entrada del form (z.coerce hace `areaM2` unknown en input). */
type FormValues = z.input<typeof UpdateLocalSchema>;
import { updateLocalAction } from '@/app/(admin-plaza)/admin/locales/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Edición de local (T-057). Campos alineados al formato Excel:
 *   MODULO, NIVEL, LOCAL (codigo, inmutable), ÁREA, MEDIDOR ENERGIA, MEDIDOR AGUA.
 *
 * Reglas de estado:
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
      modulo: local.modulo ?? '',
      nivel: local.nivel ?? '',
      areaM2: local.areaM2 ?? ('' as unknown as number),
      medidorEnergia: local.medidorEnergia ?? '',
      medidorAgua: local.medidorAgua ?? '',
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
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label>Módulo *</Label>
          <Input id="modulo" placeholder="A" {...register('modulo')} />
          {errors.modulo && <p className="text-xs text-red-600">{errors.modulo.message}</p>}
        </div>
        <div className="grid gap-1.5">
          <Label>Nivel *</Label>
          <Input id="nivel" placeholder="1" {...register('nivel')} />
          {errors.nivel && <p className="text-xs text-red-600">{errors.nivel.message}</p>}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
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
      <div className="grid gap-3 sm:grid-cols-2">
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
            {...register('medidorAgua')}
          />
          {errors.medidorAgua && (
            <p className="text-xs text-red-600">{errors.medidorAgua.message}</p>
          )}
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </div>
    </form>
  );
}

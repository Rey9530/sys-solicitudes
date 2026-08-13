'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { z } from 'zod';
import { CreateContratoSchema } from '@app/contracts';
import { createContratoAction } from '@/app/(admin-plaza)/admin/contratos/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/** Tipo de entrada del form (antes de defaults de Zod: `moneda` es opcional). */
type FormValues = z.input<typeof CreateContratoSchema>;

export function NuevoContratoForm({
  locales,
  inquilinos,
}: {
  locales: Array<{ id: string; codigo: string; modulo: string | null }>;
  inquilinos: Array<{ id: string; razonSocial: string }>;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(CreateContratoSchema),
    defaultValues: { moneda: 'USD' },
  });

  // Totales derivados (T-V14+): Y/Z/AA se calculan en frontend, no se persisten.
  const [cuotaArrendamiento, cuotaCam] = useWatch({
    control,
    name: ['cuotaArrendamiento', 'cuotaCam'],
  });
  const canon = Number(cuotaArrendamiento ?? 0);
  const cam = Number(cuotaCam ?? 0);
  const totalCanon = canon + cam;
  const totalCam = cam;
  const total = totalCanon + totalCam;

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
    <form onSubmit={handleSubmit(onSubmit)} className="card card-pad grid gap-6" noValidate>
      {/* ── Sección: Local e inquilino ──────────────────────────────────────── */}
      <section className="grid gap-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide muted">
          Local e inquilino
        </h3>
        <div className="grid gap-1.5">
          <Label htmlFor="localId">Local (solo disponibles) *</Label>
          <select id="localId" className={selectClass} {...register('localId')}>
            <option value="">Selecciona un local…</option>
            {locales.map((l) => (
              <option key={l.id} value={l.id}>
                {l.codigo} {l.modulo ? `· Módulo ${l.modulo}` : ''}
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
          {errors.inquilinoId && (
            <p className="text-xs text-red-600">Selecciona un inquilino</p>
          )}
        </div>
      </section>

      {/* ── Sección: Vigencia ─────────────────────────────────────────────── */}
      <section className="grid gap-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide muted">Vigencia</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="fechaInicio">Fecha de inicio *</Label>
            <Input id="fechaInicio" type="date" {...register('fechaInicio')} />
            {errors.fechaInicio && <p className="text-xs text-red-600">Requerida</p>}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="fechaFin">Fecha de fin (vacío = indefinido)</Label>
            <Input id="fechaFin" type="date" {...register('fechaFin')} />
            {errors.fechaFin && (
              <p className="text-xs text-red-600">{errors.fechaFin.message}</p>
            )}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="plazoAnios">Plazo (años)</Label>
            <Input
              id="plazoAnios"
              type="number"
              step="1"
              min="1"
              max="100"
              {...register('plazoAnios')}
            />
            {errors.plazoAnios && (
              <p className="text-xs text-red-600">{errors.plazoAnios.message}</p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="periodoGracia">Período de gracia</Label>
            <Input
              id="periodoGracia"
              placeholder="ej. 3 meses"
              {...register('periodoGracia')}
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="fechaEntregaLocal">Fecha de entrega del local</Label>
            <Input
              id="fechaEntregaLocal"
              type="date"
              {...register('fechaEntregaLocal')}
            />
            {errors.fechaEntregaLocal && (
              <p className="text-xs text-red-600">{errors.fechaEntregaLocal.message}</p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="inicioOperaciones">Inicio de operaciones</Label>
            <Input
              id="inicioOperaciones"
              type="date"
              {...register('inicioOperaciones')}
            />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="avisoTerminacion">Aviso de terminación</Label>
          <Input id="avisoTerminacion" type="date" {...register('avisoTerminacion')} />
          {errors.avisoTerminacion && (
            <p className="text-xs text-red-600">{errors.avisoTerminacion.message}</p>
          )}
        </div>
      </section>

      {/* ── Sección: Pagos ────────────────────────────────────────────────── */}
      <section className="grid gap-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide muted">Pagos</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label htmlFor="montoMensual">Monto mensual *</Label>
            <Input
              id="montoMensual"
              type="number"
              step="0.01"
              {...register('montoMensual')}
            />
            {errors.montoMensual && (
              <p className="text-xs text-red-600">{errors.montoMensual.message}</p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="moneda">Moneda (ISO 4217)</Label>
            <Input id="moneda" maxLength={3} {...register('moneda')} />
            {errors.moneda && (
              <p className="text-xs text-red-600">{errors.moneda.message}</p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="areaMt2MedicionReal">Área m² (medición real)</Label>
            <Input
              id="areaMt2MedicionReal"
              type="number"
              step="0.01"
              {...register('areaMt2MedicionReal')}
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="cuotaArrendamiento">Canon arrendamiento</Label>
            <Input
              id="cuotaArrendamiento"
              type="number"
              step="0.01"
              {...register('cuotaArrendamiento')}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cuotaCam">CAM</Label>
            <Input id="cuotaCam" type="number" step="0.01" {...register('cuotaCam')} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="depositoGarantia">Depósito de garantía</Label>
            <Input
              id="depositoGarantia"
              type="number"
              step="0.01"
              {...register('depositoGarantia')}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="fechaPagoDeposito">Fecha de pago del depósito</Label>
            <Input
              id="fechaPagoDeposito"
              type="date"
              {...register('fechaPagoDeposito')}
            />
            {errors.fechaPagoDeposito && (
              <p className="text-xs text-red-600">{errors.fechaPagoDeposito.message}</p>
            )}
          </div>
        </div>

        {/* Totales derivados (Y/Z/AA — T-V14+) */}
        <div
          className="grid gap-1 text-sm"
          style={{
            background: 'var(--surface-3)',
            borderRadius: 'var(--r-md)',
            padding: 12,
          }}
        >
          <p className="muted text-xs font-medium uppercase tracking-wide">Totales derivados</p>
          <p>
            <span className="muted">Total canon:</span>{' '}
            <span className="font-mono">{totalCanon.toFixed(2)}</span>
            <span className="muted"> (canon + CAM)</span>
          </p>
          <p>
            <span className="muted">Total CAM:</span>{' '}
            <span className="font-mono">{totalCam.toFixed(2)}</span>
          </p>
          <p>
            <span className="muted">Total:</span>{' '}
            <span className="font-mono font-semibold">{total.toFixed(2)}</span>
            <span className="muted"> (total canon + CAM)</span>
          </p>
        </div>
      </section>

      {/* ── Sección: Notas ────────────────────────────────────────────────── */}
      <section className="grid gap-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide muted">Notas</h3>
        <div className="grid gap-1.5">
          <Label htmlFor="condiciones">Condiciones generales</Label>
          <textarea
            id="condiciones"
            rows={3}
            className="textarea"
            {...register('condiciones')}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="condicionesIncrementoCanon">Condiciones de incremento de canon</Label>
          <textarea
            id="condicionesIncrementoCanon"
            rows={3}
            className="textarea"
            placeholder="ej. Incremento anual según IPC"
            {...register('condicionesIncrementoCanon')}
          />
        </div>
      </section>

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
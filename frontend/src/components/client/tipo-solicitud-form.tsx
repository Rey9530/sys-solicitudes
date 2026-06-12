'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  UpdateSolicitudTipoConfigSchema,
  type SolicitudTipoConfigOutput,
} from '@app/contracts';
import { updateTipoSolicitudAction } from '@/app/(admin-plaza)/admin/catalogos/tipos-solicitud/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { confirmAction } from '@/lib/sweetalert';

type FormValues = z.input<typeof UpdateSolicitudTipoConfigSchema>;

/**
 * T-V20: edición de un tipo de solicitud. El `codigo` es inmutable (proviene
 * del enum `solicitud_tipo` y se guarda en la columna `solicitud.tipo`).
 * Se editan etiqueta, descripción, orden y `activo` (este último con
 * bloqueos server-side: `otro` no se puede desactivar; un tipo con
 * solicitudes activas tampoco).
 */
export function TipoSolicitudForm({ tipo }: { tipo: SolicitudTipoConfigOutput }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const isOtro = tipo.codigo === 'otro';

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(UpdateSolicitudTipoConfigSchema),
    defaultValues: {
      etiqueta: tipo.etiqueta,
      descripcion: tipo.descripcion ?? '',
      orden: tipo.orden,
      activo: tipo.activo,
    },
  });

  // El toggle `activo` se maneja con un botón explícito (fuera del useForm)
  // para que el backend siempre reciba el valor actual sin requerir
  // "guardar cambios" antes.
  const [activoLocal, setActivoLocal] = useState<boolean>(tipo.activo);
  const [toggling, setToggling] = useState(false);

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    const payload: FormValues = {
      ...values,
      descripcion: values.descripcion === '' ? null : values.descripcion,
    };
    const result = await updateTipoSolicitudAction(tipo.id, payload);
    setSubmitting(false);
    if (result.ok) {
      toast.success('Tipo de solicitud actualizado');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const onToggleActivo = async () => {
    const nuevoEstado = !activoLocal;
    if (isOtro && !nuevoEstado) {
      // Defensa de UI: el botón está deshabilitado, pero si se fuerza,
      // mostramos el aviso por SweetAlert (regla CLAUDE.md: nada de window.confirm).
      await confirmAction({
        title: 'El tipo «otro» no se puede desactivar',
        text: 'Es el fallback del flujo de solicitudes (no requiere categoría/subcategoría). Por diseño nunca se desactiva.',
        icon: 'warning',
        confirmButtonText: 'Entendido',
      });
      return;
    }
    const ok = await confirmAction({
      title: nuevoEstado
        ? `¿Activar el tipo «${tipo.etiqueta}»?`
        : `¿Desactivar el tipo «${tipo.etiqueta}»?`,
      text: nuevoEstado
        ? 'Volverá a aparecer en el wizard y en los filtros de reportes.'
        : 'Ya no aparecerá en el wizard ni en los filtros. Las solicitudes existentes NO se modifican.',
      icon: nuevoEstado ? 'question' : 'warning',
      confirmButtonText: nuevoEstado ? 'Sí, activar' : 'Sí, desactivar',
    });
    if (!ok) return;

    setToggling(true);
    const result = await updateTipoSolicitudAction(tipo.id, { activo: nuevoEstado });
    setToggling(false);
    if (result.ok) {
      setActivoLocal(nuevoEstado);
      toast.success(nuevoEstado ? 'Tipo activado' : 'Tipo desactivado');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="space-y-4">
      {isOtro && (
        <div
          className="card card-pad"
          style={{ background: 'var(--color-info-bg, #eff6ff)', borderColor: 'var(--color-info, #3b82f6)' }}
        >
          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            Tipo «otro»
          </p>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-2)' }}>
            Es el fallback del flujo de solicitudes (no requiere categoría/subcategoría).
            Por diseño, <strong>nunca se puede desactivar</strong>: el backend rechaza el cambio con{' '}
            <code>TIPO_INMUTABLE</code>.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="card card-pad grid gap-4" noValidate>
        <div className="grid gap-1.5">
          <Label htmlFor="etiqueta">Etiqueta visible *</Label>
          <Input id="etiqueta" maxLength={80} {...register('etiqueta')} />
          {errors.etiqueta && <p className="text-xs text-red-600">{errors.etiqueta.message}</p>}
          <p className="text-xs text-gray-500">
            Es lo que ven los inquilinos en el wizard y los admins en los reportes.
          </p>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="descripcion">Descripción</Label>
          <textarea
            id="descripcion"
            rows={3}
            maxLength={500}
            className="textarea"
            {...register('descripcion')}
          />
          {errors.descripcion && (
            <p className="text-xs text-red-600">{errors.descripcion.message}</p>
          )}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="orden">Orden</Label>
          <Input
            id="orden"
            type="number"
            min={0}
            max={99}
            style={{ width: 120 }}
            {...register('orden', { valueAsNumber: true })}
          />
          {errors.orden && <p className="text-xs text-red-600">{errors.orden.message}</p>}
          <p className="text-xs text-gray-500">
            Posición en el selector del wizard y en los filtros. Menor = primero.
          </p>
        </div>

        <div className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 p-3">
          <div>
            <Label className="text-sm font-semibold">Estado</Label>
            <p className="text-xs text-gray-500">
              {activoLocal ? 'Visible en el wizard y en los filtros.' : 'Oculto del wizard y de los filtros.'}
            </p>
          </div>
          <Button
            type="button"
            variant={activoLocal ? 'danger' : 'secondary'}
            disabled={toggling || (isOtro && activoLocal)}
            onClick={onToggleActivo}
          >
            {toggling ? 'Guardando…' : activoLocal ? 'Desactivar' : 'Activar'}
          </Button>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting || !isDirty}>
            {submitting ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </div>
      </form>
    </div>
  );
}

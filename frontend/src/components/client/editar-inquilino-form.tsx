'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  UpdateInquilinoSchema,
  type UpdateInquilinoInput,
  type InquilinoOutput,
} from '@app/contracts';
import {
  updateInquilinoAction,
  deleteInquilinoAction,
} from '@/app/(admin-plaza)/admin/inquilinos/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { confirmAction } from '@/lib/sweetalert';

/**
 * Edición de inquilino (T-059 actualizado).
 *
 * Campos inmutables (`razonSocial`, `identificacion`) se muestran como
 * Input disabled — regla de trazabilidad legal/contable, NO se exponen en
 * el `UpdateInquilinoInput`. Para "renombrar" un inquilino: desactivar y
 * crear uno nuevo.
 */
export function EditarInquilinoForm({
  inquilino,
  tieneContratoVigente,
}: {
  inquilino: InquilinoOutput;
  tieneContratoVigente: boolean;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateInquilinoInput>({
    resolver: zodResolver(UpdateInquilinoSchema),
    defaultValues: {
      nombreComercial: inquilino.nombreComercial,
      representanteLegal: inquilino.representanteLegal,
      numeroNrc: inquilino.numeroNrc,
      correoRecepcionDte: inquilino.correoRecepcionDte,
      numeroTelefono: inquilino.numeroTelefono,
      direccion: inquilino.direccion,
      contacto1Nombre: inquilino.contacto1Nombre,
      contacto1Cargo: inquilino.contacto1Cargo,
      contacto1Email: inquilino.contacto1Email,
      contacto1Telefono: inquilino.contacto1Telefono,
      contacto2Nombre: inquilino.contacto2Nombre,
      contacto2Cargo: inquilino.contacto2Cargo,
      contacto2Email: inquilino.contacto2Email,
      contacto2Telefono: inquilino.contacto2Telefono,
      tipoCliente: inquilino.tipoCliente,
      giroAutorizado: inquilino.giroAutorizado,
      categoria: inquilino.categoria,
      subcategoria: inquilino.subcategoria,
      comentarios: inquilino.comentarios,
    },
  });

  const onSubmit = async (values: UpdateInquilinoInput) => {
    setSubmitting(true);
    const result = await updateInquilinoAction(inquilino.id, values);
    setSubmitting(false);
    if (result.ok) {
      toast.success('Inquilino actualizado');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const onDelete = async () => {
    const ok = await confirmAction({
      title: `¿Desactivar a "${inquilino.razonSocial}"?`,
      text: 'El inquilino no podrá ser usado en nuevos contratos, pero sus datos y contratos históricos se conservan.',
      icon: 'warning',
      confirmButtonText: 'Sí, desactivar',
    });
    if (!ok) return;
    setDeleting(true);
    const result = await deleteInquilinoAction(inquilino.id);
    setDeleting(false);
    if (result.ok) {
      toast.success('Inquilino desactivado');
      router.push('/admin/inquilinos');
    } else {
      toast.error(result.error);
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="card card-pad grid max-w-3xl gap-6"
      noValidate
    >
      {/* Inmutables */}
      <section className="grid gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Identidad (inmutable)
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>Razón social</Label>
            <Input value={inquilino.razonSocial} disabled />
          </div>
          <div className="grid gap-1.5">
            <Label>Identificación (NIT)</Label>
            <Input value={inquilino.identificacion ?? '—'} disabled />
          </div>
        </div>
        <p className="-mt-2 text-xs text-gray-400">
          Razón social e identificación son inmutables tras la creación. Para cambiarlas, desactive
          el inquilino y cree uno nuevo.
        </p>
      </section>

      {/* Identidad editable */}
      <section className="grid gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Datos adicionales
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="nombreComercial">Nombre comercial</Label>
            <Input id="nombreComercial" {...register('nombreComercial')} />
            {errors.nombreComercial && (
              <p className="text-xs text-red-600">{errors.nombreComercial.message}</p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="numeroNrc">Número de NRC</Label>
            <Input id="numeroNrc" {...register('numeroNrc')} />
            {errors.numeroNrc && <p className="text-xs text-red-600">{errors.numeroNrc.message}</p>}
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="representanteLegal">Representante legal</Label>
          <Input id="representanteLegal" {...register('representanteLegal')} />
          {errors.representanteLegal && (
            <p className="text-xs text-red-600">{errors.representanteLegal.message}</p>
          )}
        </div>
      </section>

      {/* Canales del inquilino */}
      <section className="grid gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Canales del inquilino
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="numeroTelefono">Número de teléfono</Label>
            <Input id="numeroTelefono" type="tel" {...register('numeroTelefono')} />
            {errors.numeroTelefono && (
              <p className="text-xs text-red-600">{errors.numeroTelefono.message}</p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="correoRecepcionDte">Correo de recepción DTE</Label>
            <Input id="correoRecepcionDte" type="email" {...register('correoRecepcionDte')} />
            {errors.correoRecepcionDte && (
              <p className="text-xs text-red-600">{errors.correoRecepcionDte.message}</p>
            )}
          </div>
        </div>
      </section>

      {/* Contacto 1 */}
      <section className="grid gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Contacto 1</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="contacto1Nombre">Nombre</Label>
            <Input id="contacto1Nombre" {...register('contacto1Nombre')} />
            {errors.contacto1Nombre && (
              <p className="text-xs text-red-600">{errors.contacto1Nombre.message}</p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="contacto1Cargo">Cargo</Label>
            <Input id="contacto1Cargo" {...register('contacto1Cargo')} />
            {errors.contacto1Cargo && (
              <p className="text-xs text-red-600">{errors.contacto1Cargo.message}</p>
            )}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="contacto1Email">Email</Label>
            <Input id="contacto1Email" type="email" {...register('contacto1Email')} />
            {errors.contacto1Email && (
              <p className="text-xs text-red-600">{errors.contacto1Email.message}</p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="contacto1Telefono">Teléfono</Label>
            <Input id="contacto1Telefono" type="tel" {...register('contacto1Telefono')} />
            {errors.contacto1Telefono && (
              <p className="text-xs text-red-600">{errors.contacto1Telefono.message}</p>
            )}
          </div>
        </div>
      </section>

      {/* Contacto 2 */}
      <section className="grid gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Contacto 2 (opcional)
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="contacto2Nombre">Nombre</Label>
            <Input id="contacto2Nombre" {...register('contacto2Nombre')} />
            {errors.contacto2Nombre && (
              <p className="text-xs text-red-600">{errors.contacto2Nombre.message}</p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="contacto2Cargo">Cargo</Label>
            <Input id="contacto2Cargo" {...register('contacto2Cargo')} />
            {errors.contacto2Cargo && (
              <p className="text-xs text-red-600">{errors.contacto2Cargo.message}</p>
            )}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="contacto2Email">Email</Label>
            <Input id="contacto2Email" type="email" {...register('contacto2Email')} />
            {errors.contacto2Email && (
              <p className="text-xs text-red-600">{errors.contacto2Email.message}</p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="contacto2Telefono">Teléfono</Label>
            <Input id="contacto2Telefono" type="tel" {...register('contacto2Telefono')} />
            {errors.contacto2Telefono && (
              <p className="text-xs text-red-600">{errors.contacto2Telefono.message}</p>
            )}
          </div>
        </div>
      </section>

      {/* Clasificación */}
      <section className="grid gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Clasificación
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="tipoCliente">Tipo de cliente</Label>
            <select
              id="tipoCliente"
              defaultValue={inquilino.tipoCliente ?? ''}
              className="input"
              {...register('tipoCliente')}
            >
              <option value="">— Sin clasificar —</option>
              <option value="grande">Grande</option>
              <option value="mediano">Mediano</option>
              <option value="otro">Otro</option>
            </select>
            {errors.tipoCliente && (
              <p className="text-xs text-red-600">{errors.tipoCliente.message}</p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="giroAutorizado">Giro autorizado</Label>
            <Input id="giroAutorizado" {...register('giroAutorizado')} />
            {errors.giroAutorizado && (
              <p className="text-xs text-red-600">{errors.giroAutorizado.message}</p>
            )}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="categoria">Categoría</Label>
            <Input id="categoria" {...register('categoria')} />
            {errors.categoria && (
              <p className="text-xs text-red-600">{errors.categoria.message}</p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="subcategoria">Subcategoría</Label>
            <Input id="subcategoria" {...register('subcategoria')} />
            {errors.subcategoria && (
              <p className="text-xs text-red-600">{errors.subcategoria.message}</p>
            )}
          </div>
        </div>
      </section>

      {/* Otros */}
      <section className="grid gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Otros</h2>
        <div className="grid gap-1.5">
          <Label htmlFor="direccion">Dirección</Label>
          <textarea
            id="direccion"
            className="input min-h-20"
            rows={2}
            {...register('direccion')}
          />
          {errors.direccion && (
            <p className="text-xs text-red-600">{errors.direccion.message}</p>
          )}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="comentarios">Comentarios</Label>
          <textarea
            id="comentarios"
            className="input min-h-24"
            rows={3}
            {...register('comentarios')}
          />
          {errors.comentarios && (
            <p className="text-xs text-red-600">{errors.comentarios.message}</p>
          )}
        </div>
      </section>

      <div className="flex items-center justify-between">
        <div title={tieneContratoVigente ? 'No se puede desactivar con contrato vigente' : ''}>
          <Button
            type="button"
            variant="danger"
            disabled={tieneContratoVigente || deleting}
            onClick={onDelete}
          >
            {deleting ? 'Desactivando…' : 'Desactivar'}
          </Button>
        </div>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </div>
      {tieneContratoVigente && (
        <p className="text-xs text-gray-400">
          El botón «Desactivar» está deshabilitado porque tiene contratos vigentes.
        </p>
      )}
    </form>
  );
}

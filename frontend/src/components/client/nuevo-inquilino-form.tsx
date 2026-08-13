'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { CreateInquilinoSchema, type CreateInquilinoInput } from '@app/contracts';
import { createInquilinoAction } from '@/app/(admin-plaza)/admin/inquilinos/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Formulario de creación de inquilino (T-053 actualizado).
 *
 * Campos alineados al formato Excel "INFORMACION PARA CREACION DE INQUILINOS"
 * (Hoja 2, columnas B-T + AL). Excluye los 16 campos del primer contrato
 * (U-AK): esos viven en el CRUD de `contrato`.
 *
 * Inmutables en update (NO se piden aquí porque no son modificables desde
 * el form de edición): `razonSocial` e `identificacion`.
 */
export function NuevoInquilinoForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateInquilinoInput>({ resolver: zodResolver(CreateInquilinoSchema) });

  const onSubmit = async (values: CreateInquilinoInput) => {
    setSubmitting(true);
    const result = await createInquilinoAction(values);
    setSubmitting(false);
    if (result.ok) {
      toast.success('Inquilino creado');
      router.push('/admin/inquilinos');
    } else {
      toast.error(result.error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="card card-pad grid gap-6" noValidate>
      {/* Identidad */}
      <section className="grid gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Identidad</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="razonSocial">Razón social *</Label>
            <Input id="razonSocial" {...register('razonSocial')} />
            {errors.razonSocial && (
              <p className="text-xs text-red-600">{errors.razonSocial.message}</p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="nombreComercial">Nombre comercial</Label>
            <Input id="nombreComercial" {...register('nombreComercial')} />
            {errors.nombreComercial && (
              <p className="text-xs text-red-600">{errors.nombreComercial.message}</p>
            )}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="identificacion">Identificación (NIT)</Label>
            <Input id="identificacion" {...register('identificacion')} />
            {errors.identificacion && (
              <p className="text-xs text-red-600">{errors.identificacion.message}</p>
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
            <Input
              id="correoRecepcionDte"
              type="email"
              {...register('correoRecepcionDte')}
            />
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

      {/* Contacto 2 (opcional) */}
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
              defaultValue=""
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

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Creando…' : 'Crear inquilino'}
        </Button>
      </div>
    </form>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { z } from 'zod';
import { CreateCategoriaSchema, type CategoriaOutput } from '@app/contracts';
import {
  createCategoriaAction,
  updateCategoriaAction,
} from '@/app/(admin-plaza)/admin/categorias/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type FormValues = z.input<typeof CreateCategoriaSchema>;

/** Form de categoría (T-072): crea o edita según reciba `categoria`. */
export function CategoriaForm({ categoria }: { categoria?: CategoriaOutput }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(CreateCategoriaSchema),
    defaultValues: categoria
      ? { nombre: categoria.nombre, descripcion: categoria.descripcion ?? undefined }
      : undefined,
  });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    const result = categoria
      ? await updateCategoriaAction(categoria.id, values)
      : await createCategoriaAction(values);
    setSubmitting(false);
    if (result.ok) {
      toast.success(categoria ? 'Categoría actualizada' : 'Categoría creada');
      router.push('/admin/categorias');
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="grid gap-4 rounded-lg border bg-white p-6"
      noValidate
    >
      <div className="grid gap-1.5">
        <Label htmlFor="nombre">Nombre *</Label>
        <Input id="nombre" maxLength={80} {...register('nombre')} />
        {errors.nombre && <p className="text-xs text-red-600">{errors.nombre.message}</p>}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="descripcion">Descripción</Label>
        <textarea
          id="descripcion"
          rows={3}
          maxLength={500}
          className="rounded-md border border-input bg-white px-3 py-2 text-sm"
          {...register('descripcion')}
        />
        {errors.descripcion && <p className="text-xs text-red-600">{errors.descripcion.message}</p>}
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Guardando…' : categoria ? 'Guardar cambios' : 'Crear categoría'}
        </Button>
      </div>
    </form>
  );
}

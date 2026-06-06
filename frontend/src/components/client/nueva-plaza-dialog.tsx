'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { SlugSchema, HexColorSchema } from '@app/contracts';
import { createPlazaAction } from '@/app/(admin-plataform)/superadmin/plazas/actions';
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

const FormSchema = z.object({
  nombreComercial: z.string().trim().min(1, 'Requerido').max(120),
  slug: SlugSchema,
  emailContacto: z.union([z.string().email('Email inválido'), z.literal('')]).optional(),
  telefonoContacto: z.string().trim().max(40).optional(),
  colorPrimario: HexColorSchema,
  adminEmail: z.string().trim().toLowerCase().email('Email inválido'),
  adminNombre: z.string().trim().min(1, 'Requerido').max(120),
  adminPassword: z.string().min(8, 'Mínimo 8 caracteres').max(128),
  adminRolStaffCodigo: z.enum(['tecnico', 'ingeniero', 'supervisor']),
});
type FormValues = z.infer<typeof FormSchema>;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

export function NuevaPlazaDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: { colorPrimario: '#2563eb', adminRolStaffCodigo: 'supervisor' },
  });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    const result = await createPlazaAction({
      slug: values.slug,
      nombreComercial: values.nombreComercial,
      emailContacto: values.emailContacto ? values.emailContacto : undefined,
      telefonoContacto: values.telefonoContacto || undefined,
      colorPrimario: values.colorPrimario,
      adminPlazaInicial: {
        email: values.adminEmail,
        nombre: values.adminNombre,
        password: values.adminPassword,
        rolStaffCodigo: values.adminRolStaffCodigo,
      },
    });
    setSubmitting(false);
    if (result.ok) {
      toast.success('Plaza creada');
      reset();
      setOpen(false);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Nueva plaza</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva plaza</DialogTitle>
          <DialogDescription>
            Se crea la plaza con su configuración, roles de staff y un administrador inicial.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3" noValidate>
          <div className="grid gap-1.5">
            <Label htmlFor="nombreComercial">Nombre comercial</Label>
            <Input
              id="nombreComercial"
              {...register('nombreComercial')}
              onChange={(e) => setValue('slug', slugify(e.target.value), { shouldValidate: true })}
            />
            {errors.nombreComercial && (
              <p className="text-xs text-red-600">{errors.nombreComercial.message}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="slug">Slug</Label>
              <Input id="slug" {...register('slug')} />
              {errors.slug && <p className="text-xs text-red-600">{errors.slug.message}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="colorPrimario">Color primario</Label>
              <Input id="colorPrimario" type="color" className="h-9 p-1" {...register('colorPrimario')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="emailContacto">Email de contacto</Label>
              <Input id="emailContacto" type="email" {...register('emailContacto')} />
              {errors.emailContacto && (
                <p className="text-xs text-red-600">{errors.emailContacto.message}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="telefonoContacto">Teléfono</Label>
              <Input id="telefonoContacto" {...register('telefonoContacto')} />
            </div>
          </div>

          <div className="mt-2 border-t pt-3">
            <p className="mb-2 text-sm font-semibold text-gray-700">Administrador inicial</p>
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="adminNombre">Nombre</Label>
                  <Input id="adminNombre" {...register('adminNombre')} />
                  {errors.adminNombre && (
                    <p className="text-xs text-red-600">{errors.adminNombre.message}</p>
                  )}
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="adminRolStaffCodigo">Rol de staff</Label>
                  <select
                    id="adminRolStaffCodigo"
                    {...register('adminRolStaffCodigo')}
                    className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="supervisor">Supervisor</option>
                    <option value="ingeniero">Ingeniero</option>
                    <option value="tecnico">Técnico</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="adminEmail">Email</Label>
                <Input id="adminEmail" type="email" {...register('adminEmail')} />
                {errors.adminEmail && (
                  <p className="text-xs text-red-600">{errors.adminEmail.message}</p>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="adminPassword">Contraseña temporal</Label>
                <Input id="adminPassword" type="text" {...register('adminPassword')} />
                {errors.adminPassword && (
                  <p className="text-xs text-red-600">{errors.adminPassword.message}</p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creando…' : 'Crear plaza'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { altaUsuarioInquilinoAction } from '@/app/(admin-plaza)/admin/inquilinos/actions';
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
  email: z.string().trim().toLowerCase().email('Email inválido'),
  nombre: z.string().trim().min(1, 'Requerido').max(120),
});
type FormValues = z.infer<typeof FormSchema>;

/**
 * Alta rápida de usuario asociado al inquilino (T-059). Crea `usuario` con
 * rol inquilino + inquilino_id prellenado; la contraseña temporal se genera
 * en el servidor y se muestra UNA sola vez.
 */
export function AltaUsuarioInquilinoDialog({
  inquilinoId,
  razonSocial,
  contacto1Email,
  contacto1Nombre,
}: {
  inquilinoId: string;
  razonSocial: string;
  contacto1Email: string | null;
  contacto1Nombre: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [passwordTemporal, setPasswordTemporal] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: { email: contacto1Email ?? '', nombre: contacto1Nombre ?? '' },
  });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    const result = await altaUsuarioInquilinoAction({ inquilinoId, ...values });
    setSubmitting(false);
    if (result.ok) {
      toast.success('Usuario creado; se envió el email de bienvenida');
      setPasswordTemporal(result.passwordTemporal);
    } else {
      toast.error(result.error);
    }
  };

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setPasswordTemporal(null);
      reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">Alta rápida de usuario</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Usuario para {razonSocial}</DialogTitle>
          <DialogDescription>
            Crea el acceso del inquilino al portal (rol «inquilino»).
          </DialogDescription>
        </DialogHeader>
        {passwordTemporal ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Usuario creado. Comparte esta contraseña temporal de forma segura — no se volverá
              a mostrar:
            </p>
            <p className="rounded-md bg-gray-100 p-3 text-center font-mono text-lg font-semibold">
              {passwordTemporal}
            </p>
            <Button className="w-full" onClick={() => onOpenChange(false)}>
              Entendido
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3" noValidate>
            <div className="grid gap-1.5">
              <Label htmlFor="alta-email">Email</Label>
              <Input id="alta-email" type="email" {...register('email')} />
              {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="alta-nombre">Nombre</Label>
              <Input id="alta-nombre" {...register('nombre')} />
              {errors.nombre && <p className="text-xs text-red-600">{errors.nombre.message}</p>}
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creando…' : 'Crear usuario'}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

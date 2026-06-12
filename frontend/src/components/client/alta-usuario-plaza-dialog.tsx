'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import type { RolStaffOutput } from '@app/contracts';
import { createUsuarioPlazaAction } from '@/app/(admin-plaza)/admin/usuarios-plaza/actions';
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
  telefono: z
    .string()
    .trim()
    .max(40, 'Máximo 40 caracteres')
    .or(z.literal('').transform(() => undefined))
    .optional(),
  rolStaffId: z.string().min(1, 'Selecciona un rol de staff'),
});
type FormValues = z.infer<typeof FormSchema>;

/**
 * Alta rápida de usuario `admin_plaza`. Genera contraseña temporal en el
 * server action, llama al backend con `rol: 'admin_plaza'` + `rolStaffId` y
 * muestra la contraseña UNA sola vez para que el admin la comparta.
 */
export function AltaUsuarioPlazaDialog({
  rolesStaff,
}: {
  rolesStaff: RolStaffOutput[];
}) {
  const router = useRouter();
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
    defaultValues: { email: '', nombre: '', telefono: '', rolStaffId: '' },
  });

  const noHayRoles = rolesStaff.length === 0;

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    const result = await createUsuarioPlazaAction({
      email: values.email,
      nombre: values.nombre,
      telefono: values.telefono || undefined,
      rolStaffId: values.rolStaffId,
    });
    setSubmitting(false);
    if (result.ok) {
      toast.success('Usuario creado; se envió el email de bienvenida');
      setPasswordTemporal(result.passwordTemporal);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setPasswordTemporal(null);
      reset({ email: '', nombre: '', telefono: '', rolStaffId: '' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="primary" disabled={noHayRoles}>
          <UserPlus />
          Nuevo usuario
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo usuario admin_plaza</DialogTitle>
          <DialogDescription>
            Crea un nuevo administrador de la plaza. Se le asignará un rol de
            staff y se le enviará un email de bienvenida.
          </DialogDescription>
        </DialogHeader>
        {passwordTemporal ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Usuario creado. Comparte esta contraseña temporal de forma segura — no se
              volverá a mostrar:
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
              <Label htmlFor="alta-usp-email">Email</Label>
              <Input id="alta-usp-email" type="email" {...register('email')} />
              {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="alta-usp-nombre">Nombre</Label>
              <Input id="alta-usp-nombre" {...register('nombre')} />
              {errors.nombre && <p className="text-xs text-red-600">{errors.nombre.message}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="alta-usp-telefono">Teléfono (opcional)</Label>
              <Input id="alta-usp-telefono" type="tel" {...register('telefono')} />
              {errors.telefono && (
                <p className="text-xs text-red-600">{errors.telefono.message}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="alta-usp-rol">Rol de staff</Label>
              <select id="alta-usp-rol" className="select" {...register('rolStaffId')}>
                <option value="" disabled>
                  Selecciona…
                </option>
                {rolesStaff.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre} ({r.codigo})
                    {r.activo ? '' : ' — inactivo'}
                  </option>
                ))}
              </select>
              {errors.rolStaffId && (
                <p className="text-xs text-red-600">{errors.rolStaffId.message}</p>
              )}
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

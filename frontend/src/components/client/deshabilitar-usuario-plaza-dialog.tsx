'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { PowerOff } from 'lucide-react';
import { disableUsuarioPlazaAction } from '@/app/(admin-plaza)/admin/usuarios-plaza/actions';
import { Button } from '@/components/ui/button';
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
  motivo: z.string().trim().min(3, 'Mínimo 3 caracteres').max(500),
});
type FormValues = z.infer<typeof FormSchema>;

/**
 * Dialog de deshabilitación de un `admin_plaza` con motivo obligatorio
 * (trazabilidad en `auditoria.despues.motivo`). El backend aplica RN-AU-5:
 * si es el único admin activo, devuelve 409 `ULTIMO_ADMIN_ACTIVO` y el FE
 * muestra el mensaje tal cual.
 */
export function DeshabilitarUsuarioPlazaDialog({
  usuarioId,
  nombre,
  email,
  onDisabled,
}: {
  usuarioId: string;
  nombre: string;
  email: string;
  onDisabled: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: { motivo: '' },
  });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    const result = await disableUsuarioPlazaAction(usuarioId, values.motivo);
    setSubmitting(false);
    if (result.ok) {
      toast.success('Usuario deshabilitado');
      setOpen(false);
      reset();
      onDisabled();
    } else {
      toast.error(result.error);
    }
  };

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="danger" size="sm" aria-label={`Deshabilitar ${email}`}>
          <PowerOff />
          Deshabilitar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Deshabilitar a {nombre}?</DialogTitle>
          <DialogDescription>
            {email}. El usuario no podrá iniciar sesión ni tomar decisiones sobre
            solicitudes. Puedes reactivarlo después. Indica el motivo (queda
            registrado en auditoría).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3" noValidate>
          <div className="grid gap-1.5">
            <Label htmlFor="motivo">Motivo (obligatorio)</Label>
            <textarea
              id="motivo"
              className="textarea min-h-24"
              placeholder="Ej. Renuncia del empleado / Reasignación de funciones"
              {...register('motivo')}
            />
            {errors.motivo && <p className="text-xs text-red-600">{errors.motivo.message}</p>}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="danger" disabled={submitting}>
              <PowerOff />
              {submitting ? 'Deshabilitando…' : 'Sí, deshabilitar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

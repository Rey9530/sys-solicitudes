'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Configuracion, PlazaOutput } from '@app/contracts';
import { Tabs } from '@/components/client/tabs';
import { Can } from '@/components/client/can';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  updateConfiguracionAction,
  updatePlazaAction,
  uploadLogoAction,
} from '@/app/(admin-plaza)/admin/configuracion/actions';

const MIME_CONOCIDOS: Array<{ mime: string; label: string }> = [
  { mime: 'application/pdf', label: 'PDF' },
  { mime: 'image/jpeg', label: 'JPG' },
  { mime: 'image/png', label: 'PNG' },
  { mime: 'image/webp', label: 'WebP' },
  { mime: 'application/vnd.ms-excel', label: 'XLS' },
  {
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    label: 'XLSX',
  },
  {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    label: 'DOCX',
  },
  { mime: 'application/dwg', label: 'DWG' },
];

const TIPOS = ['mantenimiento', 'evento', 'remodelacion', 'otro'] as const;
const PRIORIDADES = ['A', 'B', 'C', 'D', 'F'] as const;

/** T-145: configuración de la plaza en tabs (General/Branding/SLA/Adjuntos/Calendario). */
export function ConfiguracionForm({
  plaza,
  configuracion,
}: {
  plaza: PlazaOutput;
  configuracion: Configuracion;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  // General + branding
  const [nombre, setNombre] = useState(plaza.nombreComercial);
  const [email, setEmail] = useState(plaza.emailContacto ?? '');
  const [telefono, setTelefono] = useState(plaza.telefonoContacto ?? '');
  const [color, setColor] = useState(plaza.colorPrimario);
  // SLA
  const [slaDias, setSlaDias] = useState(configuracion.slaDiasPorTipo);
  const [slaMult, setSlaMult] = useState(configuracion.slaMultiplicadorPorPrioridad);
  // Adjuntos
  const [mimes, setMimes] = useState<string[]>(configuracion.mimeTypesPermitidos);
  const [tamanioMax, setTamanioMax] = useState(String(configuracion.tamanioMaxArchivoMb));
  // Calendario
  const [hitos, setHitos] = useState(configuracion.calendarMostrarHitosContrato);

  const notificar = (res: { ok: boolean; error?: string }, okMsg: string) => {
    if (res.ok) {
      setMensaje({ tipo: 'ok', texto: okMsg });
      router.refresh();
    } else {
      setMensaje({ tipo: 'error', texto: res.error ?? 'Error' });
    }
  };

  const guardarGeneral = () =>
    startTransition(async () => {
      setMensaje(null);
      notificar(
        await updatePlazaAction({
          nombreComercial: nombre,
          emailContacto: email || null,
          telefonoContacto: telefono || null,
        }),
        'Datos generales guardados.',
      );
    });

  const guardarBranding = () =>
    startTransition(async () => {
      setMensaje(null);
      notificar(await updatePlazaAction({ colorPrimario: color }), 'Branding guardado.');
    });

  const subirLogo = (file: File) =>
    startTransition(async () => {
      setMensaje(null);
      const fd = new FormData();
      fd.append('file', file);
      notificar(await uploadLogoAction(fd), 'Logo actualizado.');
    });

  const guardarSla = () =>
    startTransition(async () => {
      setMensaje(null);
      notificar(
        await updateConfiguracionAction({
          slaDiasPorTipo: slaDias,
          slaMultiplicadorPorPrioridad: slaMult,
        }),
        'SLA guardado.',
      );
    });

  const guardarAdjuntos = () =>
    startTransition(async () => {
      setMensaje(null);
      const mb = Number(tamanioMax);
      if (!Number.isInteger(mb) || mb < 1) {
        setMensaje({ tipo: 'error', texto: 'El tamaño máximo debe ser un entero ≥ 1 MB.' });
        return;
      }
      if (mimes.length === 0) {
        setMensaje({ tipo: 'error', texto: 'Debe haber al menos un tipo de archivo permitido.' });
        return;
      }
      notificar(
        await updateConfiguracionAction({ mimeTypesPermitidos: mimes, tamanioMaxArchivoMb: mb }),
        'Adjuntos guardados.',
      );
    });

  const guardarCalendario = () =>
    startTransition(async () => {
      setMensaje(null);
      notificar(
        await updateConfiguracionAction({ calendarMostrarHitosContrato: hitos }),
        'Calendario guardado.',
      );
    });

  const labelClass = 'text-xs font-medium text-gray-500';

  /** Preview del semáforo SLA: días totales por tipo × prioridad. */
  const previewSla = TIPOS.map((t) => ({
    tipo: t,
    valores: PRIORIDADES.map((p) => ({
      prioridad: p,
      dias: Math.round(slaDias[t] * slaMult[p] * 10) / 10,
    })),
  }));

  return (
    <div className="space-y-4">
      {mensaje && (
        <div className={`banner ${mensaje.tipo === 'ok' ? 'banner-ok' : 'banner-danger'}`}>
          {mensaje.texto}
        </div>
      )}
      <Tabs
        tabs={[
          {
            key: 'general',
            label: 'General',
            content: (
              <div className="card card-pad max-w-md space-y-3">
                <div className="grid gap-1">
                  <label className={labelClass}>Nombre comercial</label>
                  <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
                </div>
                <div className="grid gap-1">
                  <label className={labelClass}>Email de contacto</label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="grid gap-1">
                  <label className={labelClass}>Teléfono</label>
                  <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} />
                </div>
                <div className="grid gap-1">
                  <label className={labelClass}>Zona horaria</label>
                  <Input value="America/El_Salvador" disabled />
                  <p className="text-xs text-gray-400">
                    Fija para todas las plazas en v1 (decisión T-V08).
                  </p>
                </div>
                <Can permiso="configuracion.editar_general">
                  <Button disabled={pending} onClick={guardarGeneral}>
                    Guardar
                  </Button>
                </Can>
              </div>
            ),
          },
          {
            key: 'branding',
            label: 'Branding',
            content: (
              <div className="card card-pad max-w-md space-y-3">
                <div className="grid gap-1">
                  <label className={labelClass}>Color primario</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="h-9 w-14 cursor-pointer rounded"
                      style={{ border: '1px solid var(--border-strong)' }}
                    />
                    <Input
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="w-32"
                    />
                  </div>
                </div>
                <div className="grid gap-1">
                  <label className={labelClass}>Logo (PNG/SVG, máx 2 MB)</label>
                  {plaza.logoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element -- preview simple del logo subido (URL MinIO pre-firmada)
                    <img src={plaza.logoUrl} alt="Logo" className="h-12 w-auto rounded border p-1" />
                  )}
                  <input
                    type="file"
                    accept="image/png,image/svg+xml"
                    className="text-sm"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) subirLogo(f);
                    }}
                  />
                </div>
                <Can permiso="configuracion.editar_branding">
                  <Button disabled={pending} onClick={guardarBranding}>
                    Guardar color
                  </Button>
                </Can>
              </div>
            ),
          },
          {
            key: 'sla',
            label: 'SLA',
            content: (
              <div className="card card-pad space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Días por tipo</p>
                    {TIPOS.map((t) => (
                      <div key={t} className="flex items-center gap-2">
                        <span className="w-32 text-sm capitalize">{t}</span>
                        <Input
                          type="number"
                          min={0}
                          className="w-24"
                          value={slaDias[t]}
                          onChange={(e) =>
                            setSlaDias({ ...slaDias, [t]: Number(e.target.value) })
                          }
                        />
                        <span className="text-xs text-gray-400">días</span>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">
                      Multiplicador por prioridad
                    </p>
                    {PRIORIDADES.map((p) => (
                      <div key={p} className="flex items-center gap-2">
                        <span className="w-32 text-sm">Prioridad {p}</span>
                        <Input
                          type="number"
                          min={0}
                          step="0.1"
                          className="w-24"
                          value={slaMult[p]}
                          onChange={(e) => setSlaMult({ ...slaMult, [p]: Number(e.target.value) })}
                        />
                        <span className="text-xs text-gray-400">×</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-sm font-semibold">
                    Preview del semáforo (días totales)
                  </p>
                  <table className="sla-matrix">
                    <thead>
                      <tr>
                        <th>Tipo</th>
                        {PRIORIDADES.map((p) => (
                          <th key={p}>{p}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewSla.map((fila) => (
                        <tr key={fila.tipo}>
                          <td className="capitalize">{fila.tipo}</td>
                          {fila.valores.map((v) => (
                            <td key={v.prioridad}>
                              <span
                                className={`sla-cell ${
                                  v.dias <= 3 ? 'red' : v.dias <= 7 ? 'amber' : 'green'
                                }`}
                              >
                                {v.dias}d
                              </span>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Can permiso="configuracion.editar_sla">
                  <Button disabled={pending} onClick={guardarSla}>
                    Guardar SLA
                  </Button>
                </Can>
              </div>
            ),
          },
          {
            key: 'adjuntos',
            label: 'Adjuntos',
            content: (
              <div className="card card-pad max-w-md space-y-3">
                <div>
                  <p className="mb-1 text-sm font-semibold">Tipos permitidos</p>
                  {MIME_CONOCIDOS.map((m) => (
                    <label key={m.mime} className="flex items-center gap-2 py-0.5 text-sm">
                      <input
                        type="checkbox"
                        checked={mimes.includes(m.mime)}
                        onChange={() =>
                          setMimes((prev) =>
                            prev.includes(m.mime)
                              ? prev.filter((x) => x !== m.mime)
                              : [...prev, m.mime],
                          )
                        }
                      />
                      {m.label} <span className="text-xs text-gray-400">({m.mime})</span>
                    </label>
                  ))}
                </div>
                <div className="grid gap-1">
                  <label className={labelClass}>Tamaño máximo por archivo (MB)</label>
                  <Input
                    type="number"
                    min={1}
                    className="w-28"
                    value={tamanioMax}
                    onChange={(e) => setTamanioMax(e.target.value)}
                  />
                </div>
                <Can permiso="configuracion.editar_adjuntos">
                  <Button disabled={pending} onClick={guardarAdjuntos}>
                    Guardar adjuntos
                  </Button>
                </Can>
              </div>
            ),
          },
          {
            key: 'calendario',
            label: 'Calendario',
            content: (
              <div className="card card-pad max-w-md space-y-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={hitos}
                    onChange={(e) => setHitos(e.target.checked)}
                  />
                  Mostrar hitos contractuales en el calendario
                </label>
                <Can permiso="configuracion.editar_calendario">
                  <Button disabled={pending} onClick={guardarCalendario}>
                    Guardar calendario
                  </Button>
                </Can>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

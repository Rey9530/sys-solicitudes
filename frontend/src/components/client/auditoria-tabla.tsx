'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ScrollText, ExternalLink } from 'lucide-react';
import type { AuditoriaOutput } from '@app/contracts';
import {
  Card,
} from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatInPlazaTz } from '@/lib/datetime';

/**
 * T-161: tabla del log de auditoría + drawer con diff antes/después.
 *
 * Decisiones:
 * - Click en fila abre un modal (Dialog) con la entrada completa: timestamp,
 *   usuario, acción, entidad (con link al detalle si aplica), IP, user-agent
 *   y los JSON `antes`/`después` formateados.
 * - El "diff" se hace de forma naïve por super-conjunto de keys: las keys
 *   que solo aparecen en `despues` se marcan como añadidas, las que solo
 *   en `antes` como eliminadas, las presentes en ambos con valor distinto
 *   como modificadas. Sin librería externa — la lógica es trivial.
 * - Las acciones con `omitirBody: true` (auth) llegan con `despues: null`;
 *   se renderiza el placeholder correspondiente.
 */

const ACCION_TONE: Record<string, string> = {
  create: 'b-ok',
  update: 'b-info',
  delete: 'b-danger',
};

function accionTone(accion: string): string {
  // accion suele ser `entidad.verbo` (e.g. `local.update`); cae al sufijo.
  const suffix = accion.split('.').pop() ?? '';
  return ACCION_TONE[suffix] ?? 'b-neutral';
}

function accionLabel(accion: string): string {
  const partes = accion.split('.');
  if (partes.length === 2) {
    return `${partes[0]}.${partes[1]}`;
  }
  return accion;
}

/** Mapea `entidad_tipo` a una ruta del admin (si tiene vista de detalle). */
function entidadHref(entidadTipo: string, entidadId: string | null): string | null {
  if (!entidadId) return null;
  const map: Record<string, string> = {
    local: '/admin/locales',
    inquilino: '/admin/inquilinos',
    contrato: '/admin/contratos',
    solicitud: '/admin/solicitudes',
    categoria: '/admin/categorias',
    subcategoria: '/admin/categorias',
    usuario: '/admin/usuarios-plaza',
    plaza: '/superadmin/plazas',
  };
  const base = map[entidadTipo];
  return base ? `${base}/${entidadId}` : null;
}

function DiffView({ antes, despues }: { antes: unknown; despues: unknown }) {
  const isNull = (v: unknown) => v === null || v === undefined;
  if (isNull(antes) && isNull(despues)) {
    return (
      <p className="muted" style={{ fontSize: 13 }}>
        Esta entrada no tiene payload persistido (decorador <code>omitirBody</code>).
      </p>
    );
  }
  if (isNull(antes)) {
    return (
      <div>
        <h5 className="diff-title">Después</h5>
        <pre className="diff-pre">{JSON.stringify(despues, null, 2)}</pre>
      </div>
    );
  }
  if (isNull(despues)) {
    return (
      <div>
        <h5 className="diff-title">Antes</h5>
        <pre className="diff-pre">{JSON.stringify(antes, null, 2)}</pre>
      </div>
    );
  }

  const a = (antes ?? {}) as Record<string, unknown>;
  const d = (despues ?? {}) as Record<string, unknown>;
  const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(d)])).sort();

  return (
    <div className="diff">
      <table className="diff-tbl">
        <thead>
          <tr>
            <th>Campo</th>
            <th>Antes</th>
            <th>Después</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((k) => {
            const av = a[k];
            const dv = d[k];
            const changed = JSON.stringify(av) !== JSON.stringify(dv);
            const cls = changed ? 'diff-changed' : '';
            return (
              <tr key={k} className={cls}>
                <td className="diff-key">{k}</td>
                <td className="diff-val">
                  <code>{JSON.stringify(av) ?? '—'}</code>
                </td>
                <td className="diff-val">
                  <code>{JSON.stringify(dv) ?? '—'}</code>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DetalleDialog({
  item,
  onClose,
}: {
  item: AuditoriaOutput | null;
  onClose: () => void;
}) {
  if (!item) return null;
  const href = entidadHref(item.entidadTipo, item.entidadId);

  return (
    <Dialog open={Boolean(item)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            <span className={`badge ${accionTone(item.accion)}`} style={{ marginRight: 8 }}>
              <span className="bdot" />
              {accionLabel(item.accion)}
            </span>
            {item.entidadTipo}
            {item.entidadId ? `: ${item.entidadId.slice(0, 8)}` : ''}
          </DialogTitle>
          <DialogDescription>
            {formatInPlazaTz(item.createdAt, 'dd/MM/yyyy HH:mm:ss')}
            {' · '}
            {item.usuario ? (
              <>
                {item.usuario.nombre} &lt;{item.usuario.email}&gt;
              </>
            ) : item.usuarioId ? (
              <span className="muted">usuario eliminado (id {item.usuarioId.slice(0, 8)})</span>
            ) : (
              <span className="muted">acción del sistema</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="auditoria-meta">
          <div>
            <span className="auditoria-meta-k">Entidad</span>
            <span className="auditoria-meta-v">
              {item.entidadTipo}
              {item.entidadId ? ` · ${item.entidadId.slice(0, 8)}…` : ''}
              {href && (
                <Link href={href} target="_blank" className="auditoria-link">
                  <ExternalLink />
                  Ver detalle
                </Link>
              )}
            </span>
          </div>
          <div>
            <span className="auditoria-meta-k">Plaza</span>
            <span className="auditoria-meta-v">
              {item.plazaId ? item.plazaId.slice(0, 8) + '…' : <em>plataforma</em>}
            </span>
          </div>
          {item.ip && (
            <div>
              <span className="auditoria-meta-k">IP</span>
              <span className="auditoria-meta-v">{item.ip}</span>
            </div>
          )}
          {item.userAgent && (
            <div>
              <span className="auditoria-meta-k">User-Agent</span>
              <span className="auditoria-meta-v">{item.userAgent}</span>
            </div>
          )}
          {item.requestId && (
            <div>
              <span className="auditoria-meta-k">Request ID</span>
              <span className="auditoria-meta-v">{item.requestId}</span>
            </div>
          )}
        </div>

        <div className="auditoria-diff">
          <DiffView antes={item.antes} despues={item.despues} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AuditoriaTabla({ items }: { items: AuditoriaOutput[] }) {
  const [selected, setSelected] = useState<AuditoriaOutput | null>(null);

  if (items.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={ScrollText}
          title="Sin eventos"
          body="No hay eventos de auditoría que coincidan con esos filtros."
        />
      </Card>
    );
  }

  return (
    <>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha y hora</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Acción</TableHead>
              <TableHead>Entidad</TableHead>
              <TableHead className="actions">Ver</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((a) => (
              <TableRow
                key={a.id}
                onClick={() => setSelected(a)}
                style={{ cursor: 'pointer' }}
              >
                <TableCell className="muted">
                  {formatInPlazaTz(a.createdAt, 'dd/MM/yyyy HH:mm')}
                </TableCell>
                <TableCell className="lead">
                  {a.usuario ? a.usuario.nombre : <span className="muted">sistema</span>}
                </TableCell>
                <TableCell>
                  <span className={`badge ${accionTone(a.accion)}`}>
                    <span className="bdot" />
                    {accionLabel(a.accion)}
                  </span>
                </TableCell>
                <TableCell className="muted">
                  {a.entidadTipo}
                  {a.entidadId ? `: ${a.entidadId.slice(0, 8)}` : ''}
                </TableCell>
                <TableCell className="actions">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelected(a);
                    }}
                  >
                    Detalle
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <DetalleDialog item={selected} onClose={() => setSelected(null)} />
    </>
  );
}

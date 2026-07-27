'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Lock, RotateCcw, Save } from 'lucide-react';
import type { ListarPermisosOutput, PermisoOutput } from '@app/contracts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import {
  asignarPermisosRolAction,
} from '@/app/(admin-plaza)/admin/usuarios-plaza/permisos/actions';
import { confirmAction } from '@/lib/sweetalert';
import { ShieldCheck } from 'lucide-react';

/**
 * T-RBAC-1 · Matriz de permisos por rol.
 *
 * Render: filas = módulos del catálogo, columnas = roles de la plaza, celdas
 * = un checkbox por permiso del módulo.
 *
 * Estado local: `Map<rolId, Set<permisoId>>` con los permisos asignados
 * actualmente. Cada checkbox toggle actualiza el set y marca el rol como
 * "pendiente de guardar" si difiere del snapshot original.
 *
 * Acciones:
 *  - "Guardar cambios" → llama `asignarPermisosRolAction(rolId, permisoIds[])`
 *    (PUT idempotente; reemplaza el set completo del rol).
 *  - "Descartar" → revierte al snapshot del server.
 *  - "Marcar todos" / "Ninguno" en columna → bulk toggle (NO guardan; siguen
 *    siendo cambios pendientes hasta pulsar "Guardar cambios" de la columna).
 *
 * Roles `es_sistema = true` (rol "admin"):
 *  - Checkboxes todos marcados + `disabled` con tooltip.
 *  - Botones "Guardar/Descartar" ocultos.
 *  - Badge "Sistema" en la cabecera de la columna.
 */
export interface MatrizPermisosProps {
  /** Catálogo global (server-rendered). */
  catalogo: ListarPermisosOutput;
  /** Lista de roles de la plaza (para cabeceras de columna). */
  roles: Array<{ id: string; codigo: string; nombre: string }>;
  /**
   * Set de IDs de roles del sistema (inamovibles, no editables).
   * Por convención del seed: `codigo === 'admin'`.
   * Detectado server-side para que el frontend no tenga que hardcodearlo.
   */
  rolesSistemaIds: ReadonlySet<string>;
  /** Snapshot actual de permisos por rol (server-rendered). */
  permisosPorRol: Array<{ rolStaffId: string; permisos: PermisoOutput[] }>;
}

type Draft = Map<string, Set<string>>;

export function MatrizPermisos({ catalogo, roles, permisosPorRol, rolesSistemaIds }: MatrizPermisosProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState<Draft>(() => snapshotToDraft(permisosPorRol));
  /** Snapshot al cargar para detectar cambios pendientes. */
  const initial = useMemo(() => snapshotToDraft(permisosPorRol), [permisosPorRol]);

  const permisosPorModulo = useMemo(() => {
    const filtered = catalogo.modulos.map((m) => ({
      ...m,
      permisos: m.permisos.filter(
        (p) =>
          !search ||
          p.codigo.toLowerCase().includes(search.toLowerCase()) ||
          p.descripcion?.toLowerCase().includes(search.toLowerCase()) ||
          p.accion.toLowerCase().includes(search.toLowerCase()),
      ),
    }));
    return filtered.filter((m) => m.permisos.length > 0);
  }, [catalogo, search]);

  const isDirty = useCallback(
    (rolId: string) => {
      const a = initial.get(rolId) ?? new Set<string>();
      const b = draft.get(rolId) ?? new Set<string>();
      return !setsEqual(a, b);
    },
    [initial, draft],
  );

  const togglePermiso = useCallback((rolId: string, permisoId: string, checked: boolean) => {
    setDraft((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(rolId) ?? []);
      if (checked) set.add(permisoId);
      else set.delete(permisoId);
      next.set(rolId, set);
      return next;
    });
  }, []);

  const toggleAll = useCallback(
    (rolId: string, moduloPermisos: PermisoOutput[], checked: boolean) => {
      setDraft((prev) => {
        const next = new Map(prev);
        const set = new Set(next.get(rolId) ?? []);
        for (const p of moduloPermisos) {
          if (checked) set.add(p.id);
          else set.delete(p.id);
        }
        next.set(rolId, set);
        return next;
      });
    },
    [],
  );

  const descartar = useCallback(
    (rolId: string) => {
      const original = initial.get(rolId);
      if (!original) return;
      setDraft((prev) => {
        const next = new Map(prev);
        next.set(rolId, new Set(original));
        return next;
      });
    },
    [initial],
  );

  const guardar = useCallback(
    async (rolId: string) => {
      const rol = roles.find((r) => r.id === rolId);
      if (!rol || rolesSistemaIds.has(rol.id)) return;

      const permisoIds = Array.from(draft.get(rolId) ?? []);
      const ok = await confirmAction({
        title: `¿Guardar permisos del rol "${rol.nombre}"?`,
        text:
          permisoIds.length === 0
            ? 'El rol quedará sin permisos asignados (los usuarios con este rol no podrán hacer nada).'
            : `Se asignarán ${permisoIds.length} permiso(s). Los cambios afectan a TODOS los usuarios con este rol.`,
        icon: 'warning',
        confirmButtonText: 'Sí, guardar',
      });
      if (!ok) return;

      setPending((p) => ({ ...p, [rolId]: true }));
      const result = await asignarPermisosRolAction(rolId, permisoIds);
      setPending((p) => ({ ...p, [rolId]: false }));

      if (result.ok) {
        toast.success(`Permisos del rol "${rol.nombre}" actualizados`);
        router.refresh();
      } else {
        toast.error(result.error ?? 'Error al guardar permisos');
      }
    },
    [roles, rolesSistemaIds, draft, router],
  );

  if (roles.length === 0) {
    return (
      <Card pad>
        <EmptyState
          icon={ShieldCheck}
          title="Sin roles de staff"
          body="Crea primero un rol en la pestaña «Roles de staff». Luego podrás asignarle permisos aquí."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="search"
          placeholder="Buscar permiso (código o descripción)…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <p className="muted text-sm">
          {catalogo.total} permisos · {roles.length} rol(es) · {roles.filter((r) => rolesSistemaIds.has(r.id)).length} de sistema
        </p>
      </div>

      {permisosPorModulo.map((m) => (
        <Card key={m.modulo}>
          <div className="card-head">
            <div>
              <div className="card-title">{m.modulo}</div>
              <div className="muted text-xs">
                {m.permisos.length} permiso(s)
              </div>
            </div>
          </div>
          <div className="card-body matriz-scroll">
            <table className="matriz-tbl" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <colgroup>
                <col className="matriz-col-permiso" />
                {roles.map((r) => (
                  <col key={r.id} className="matriz-col-rol" />
                ))}
              </colgroup>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th
                    className="matriz-th-permiso"
                    style={{
                      textAlign: 'left',
                      padding: '8px 12px',
                      minWidth: 220,
                      fontWeight: 600,
                    }}
                  >
                    Permiso
                  </th>
                  {roles.map((r) => {
                    const isSistema = rolesSistemaIds.has(r.id);
                    const dirty = isDirty(r.id);
                    const moduloPermIds = m.permisos.map((p) => p.id);
                    const allChecked = moduloPermIds.every((id) =>
                      (draft.get(r.id) ?? new Set()).has(id),
                    );
                    const someChecked =
                      !allChecked && moduloPermIds.some((id) => (draft.get(r.id) ?? new Set()).has(id));
                    return (
                      <th
                        key={r.id}
                        style={{
                          textAlign: 'center',
                          padding: '8px 6px',
                          minWidth: 140,
                          fontWeight: 600,
                          position: 'relative',
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {isSistema && (
                              <Lock size={12} aria-label="Rol del sistema" />
                            )}
                            <span>{r.nombre}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {isSistema ? (
                              <span className="badge b-info">
                                <span className="bdot" />
                                Sistema
                              </span>
                            ) : (
                              <label className="muted text-xs" style={{ cursor: 'pointer' }}>
                                <input
                                  type="checkbox"
                                  checked={allChecked}
                                  ref={(el) => {
                                    if (el) el.indeterminate = someChecked;
                                  }}
                                  onChange={(e) =>
                                    toggleAll(r.id, m.permisos, e.target.checked)
                                  }
                                  style={{ marginRight: 4 }}
                                />
                                todos
                              </label>
                            )}
                            {dirty && !isSistema && (
                              <span
                                className="badge b-warn"
                                title="Cambios sin guardar"
                              >
                                <span className="bdot" />
                              </span>
                            )}
                          </div>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {m.permisos.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="matriz-td-permiso" style={{ padding: '8px 12px', verticalAlign: 'top' }}>
                      <div className="mono" style={{ fontWeight: 500 }}>
                        {p.codigo}
                      </div>
                      {p.descripcion && (
                        <div className="muted text-xs" style={{ marginTop: 2 }}>
                          {p.descripcion}
                        </div>
                      )}
                    </td>
                    {roles.map((r) => {
                      const isSistema = rolesSistemaIds.has(r.id);
                      const checked = (draft.get(r.id) ?? new Set()).has(p.id);
                      return (
                        <td
                          key={r.id}
                          style={{ textAlign: 'center', padding: '8px 6px', verticalAlign: 'middle' }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={isSistema}
                            onChange={(e) => togglePermiso(r.id, p.id, e.target.checked)}
                            aria-label={`${p.codigo} → ${r.nombre}`}
                            title={
                              isSistema
                                ? 'El rol del sistema es inamovible (siempre tiene todos los permisos)'
                                : checked
                                  ? 'Quitar permiso'
                                  : 'Asignar permiso'
                            }
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}

      {/* Barra de acciones por rol (sticky al final) */}
      <Card pad>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="muted text-sm">
            {roles.filter((r) => !rolesSistemaIds.has(r.id) && isDirty(r.id)).length} rol(es) con cambios pendientes
          </div>
          <div className="flex flex-wrap gap-2">
            {roles
              .filter((r) => !rolesSistemaIds.has(r.id))
              .map((r) => {
                const dirty = isDirty(r.id);
                if (!dirty) return null;
                return (
                  <div key={r.id} className="flex items-center gap-2">
                    <span className="text-sm font-medium">{r.nombre}:</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => descartar(r.id)}
                      disabled={pending[r.id]}
                    >
                      <RotateCcw />
                      Descartar
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => guardar(r.id)}
                      disabled={pending[r.id]}
                    >
                      <Save />
                      {pending[r.id] ? 'Guardando…' : 'Guardar'}
                    </Button>
                  </div>
                );
              })}
          </div>
        </div>
      </Card>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function snapshotToDraft(
  permisosPorRol: Array<{ rolStaffId: string; permisos: PermisoOutput[] }>,
): Draft {
  const m = new Map<string, Set<string>>();
  for (const r of permisosPorRol) {
    m.set(r.rolStaffId, new Set(r.permisos.map((p) => p.id)));
  }
  return m;
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

/**
 * Notificaciones in-app (campana del topbar, PLANIFICACION/16). Bandeja propia
 * de cada usuario (admin_plaza / inquilino); superadmin no recibe.
 */
import { z } from 'zod';

export const NOTIFICACION_TIPOS = [
  'solicitud_asignada',
  'solicitud_nueva_supervisor',
  'solicitud_reasignada',
  'solicitud_desasignada',
  'solicitud_en_revision',
  'solicitud_aprobada',
  'solicitud_rechazada',
  'solicitud_subsanacion',
  'solicitud_cerrada',
  'solicitud_pausada',
  'solicitud_reanudada',
  'solicitud_liberada',
  'solicitud_cancelada',
  'solicitud_reenviada',
  'comentario_nuevo',
  'contrato_por_vencer',
] as const;
export const NotificacionTipoSchema = z.enum(NOTIFICACION_TIPOS);
export type NotificacionTipo = z.infer<typeof NotificacionTipoSchema>;

export const NOTIFICACIONES_INBOX_LIMIT_DEFAULT = 20;

export const NotificacionesInboxQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(NOTIFICACIONES_INBOX_LIMIT_DEFAULT),
});
export type NotificacionesInboxQuery = z.infer<typeof NotificacionesInboxQuerySchema>;

export interface NotificacionOutput {
  id: string;
  tipo: NotificacionTipo;
  titulo: string;
  mensaje: string;
  solicitudId: string | null;
  contratoId: string | null;
  leida: boolean;
  createdAt: string;
}

export interface NotificacionesInboxOutput {
  items: NotificacionOutput[];
  noLeidas: number;
}

export interface NotificacionesConteoOutput {
  noLeidas: number;
}

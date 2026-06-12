import {
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  FileText,
  Inbox,
  LayoutDashboard,
  type LucideIcon,
  ScrollText,
  Settings,
  Shapes,
  Store,
  Tags,
  UserCog,
  UsersRound,
} from 'lucide-react';

export type AppRole = 'admin_plaza' | 'superadmin' | 'inquilino';

export interface NavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  href: string;
}

export interface NavGroup {
  /** Etiqueta de sección en mayúsculas; ausente = grupo sin título (Dashboard). */
  label?: string;
  items: NavItem[];
}

/** Navegación de la sidebar por rol (mapea `js/app.js` del handoff). */
export const NAV: Record<AppRole, NavGroup[]> = {
  admin_plaza: [
    { items: [{ key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/admin/dashboard' }] },
    {
      label: 'Operación',
      items: [
        { key: 'solicitudes', label: 'Solicitudes', icon: Inbox, href: '/admin/solicitudes' },
        { key: 'calendario', label: 'Calendario', icon: CalendarDays, href: '/admin/calendario' },
      ],
    },
    {
      label: 'Catálogo',
      items: [
        { key: 'locales', label: 'Locales', icon: Store, href: '/admin/locales' },
        { key: 'inquilinos', label: 'Inquilinos', icon: UsersRound, href: '/admin/inquilinos' },
        { key: 'contratos', label: 'Contratos', icon: FileText, href: '/admin/contratos' },
        { key: 'categorias', label: 'Categorías', icon: Tags, href: '/admin/categorias' },
        { key: 'tipos-solicitud', label: 'Tipos de solicitud', icon: Shapes, href: '/admin/catalogos/tipos-solicitud' },
      ],
    },
    {
      label: 'Plataforma',
      items: [
        { key: 'usuarios-plaza', label: 'Usuarios de plaza', icon: UserCog, href: '/admin/usuarios-plaza' },
        { key: 'reportes', label: 'Reportes', icon: BarChart3, href: '/admin/reportes' },
        { key: 'auditoria', label: 'Auditoría', icon: ScrollText, href: '/admin/auditoria' },
        { key: 'notificaciones', label: 'Notificaciones', icon: Bell, href: '/admin/notificaciones' },
        { key: 'config', label: 'Configuración', icon: Settings, href: '/admin/configuracion' },
      ],
    },
  ],
  superadmin: [
    { items: [{ key: 'sa-dashboard', label: 'Dashboard global', icon: LayoutDashboard, href: '/superadmin/dashboard' }] },
    {
      label: 'Plataforma',
      items: [{ key: 'plazas', label: 'Plazas', icon: Building2, href: '/superadmin/plazas' }],
    },
    // El superadmin también puede operar la consola de plaza (el guard de
    // /admin/* lo permite). Estas secciones son plaza-scoped en el backend.
    {
      label: 'Operación',
      items: [
        { key: 'solicitudes', label: 'Solicitudes', icon: Inbox, href: '/admin/solicitudes' },
        { key: 'calendario', label: 'Calendario', icon: CalendarDays, href: '/admin/calendario' },
      ],
    },
    {
      label: 'Catálogo',
      items: [
        { key: 'locales', label: 'Locales', icon: Store, href: '/admin/locales' },
        { key: 'inquilinos', label: 'Inquilinos', icon: UsersRound, href: '/admin/inquilinos' },
        { key: 'contratos', label: 'Contratos', icon: FileText, href: '/admin/contratos' },
        { key: 'categorias', label: 'Categorías', icon: Tags, href: '/admin/categorias' },
        { key: 'tipos-solicitud', label: 'Tipos de solicitud', icon: Shapes, href: '/admin/catalogos/tipos-solicitud' },
      ],
    },
    {
      label: 'Gestión',
      items: [
        { key: 'usuarios-plaza', label: 'Usuarios de plaza', icon: UserCog, href: '/admin/usuarios-plaza' },
        { key: 'reportes', label: 'Reportes', icon: BarChart3, href: '/admin/reportes' },
        { key: 'auditoria', label: 'Auditoría', icon: ScrollText, href: '/admin/auditoria' },
        { key: 'notificaciones', label: 'Notificaciones', icon: Bell, href: '/admin/notificaciones' },
        { key: 'config', label: 'Configuración', icon: Settings, href: '/admin/configuracion' },
      ],
    },
  ],
  inquilino: [
    {
      label: 'Portal',
      items: [
        { key: 'i-solicitudes', label: 'Mis solicitudes', icon: Inbox, href: '/inquilino/solicitudes' },
        { key: 'i-contratos', label: 'Mis contratos', icon: FileText, href: '/inquilino/contratos' },
        { key: 'i-calendario', label: 'Calendario', icon: CalendarDays, href: '/inquilino/calendario' },
      ],
    },
  ],
};

export interface ShellMeta {
  /** Texto bajo "Plazapp" en la cabecera de la sidebar. */
  brandSub: string;
  /** Etiqueta de rol mostrada en el footer. */
  roleLabel: string;
  /** Si muestra el selector de plaza en el topbar. */
  tenant: boolean;
}

export const SHELL_META: Record<AppRole, ShellMeta> = {
  admin_plaza: { brandSub: 'Admin de plaza', roleLabel: 'Admin de plaza', tenant: true },
  superadmin: { brandSub: 'Consola de plataforma', roleLabel: 'Superadmin', tenant: false },
  inquilino: { brandSub: 'Portal de inquilino', roleLabel: 'Inquilino', tenant: true },
};

/** Iniciales para avatares (1–2 letras). */
export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0];
  if (!first) return '?';
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1] ?? first;
  return ((first[0] ?? '') + (last[0] ?? '')).toUpperCase();
}

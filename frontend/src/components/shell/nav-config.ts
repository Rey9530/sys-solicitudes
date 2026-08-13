import {
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  FileText,
  Globe,
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

/**
 * T-RBAC-1 · Permisos por ítem de navegación.
 *
 * Convención: los códigos coinciden EXACTAMENTE con el catálogo de
 * `backend/prisma/seed-data/permisos.ts` (formato `<modulo>.<accion>`).
 * Si un ítem NO lleva `permisoRequerido` significa que es visible para
 * todos los usuarios del rol (ej. Dashboard).
 */
export type PermisoCodigo =
  | 'usuarios_plaza.listar'
  | 'solicitudes.bandeja.ver'
  | 'calendario.ver'
  | 'locales.listar'
  | 'inquilinos.listar'
  | 'contratos.listar'
  | 'categorias.listar'
  | 'tipos_solicitud.listar'
  | 'reportes.dashboard.ver'
  | 'auditoria.ver'
  | 'notificaciones.ver_log'
  | 'configuracion.ver';

export interface NavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  href: string;
  /**
   * Permiso granular requerido para que el ítem sea visible en la sidebar.
   * Si es `undefined` → siempre visible para el rol correspondiente.
   * Si el usuario NO lo tiene (y no es superadmin), el ítem se oculta.
   */
  permisoRequerido?: PermisoCodigo;
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
        {
          key: 'solicitudes',
          label: 'Solicitudes',
          icon: Inbox,
          href: '/admin/solicitudes',
          permisoRequerido: 'solicitudes.bandeja.ver',
        },
        {
          key: 'calendario',
          label: 'Calendario',
          icon: CalendarDays,
          href: '/admin/calendario',
          permisoRequerido: 'calendario.ver',
        },
      ],
    },
    {
      label: 'Catálogo',
      items: [
        {
          key: 'locales',
          label: 'Locales',
          icon: Store,
          href: '/admin/locales',
          permisoRequerido: 'locales.listar',
        },
        {
          key: 'inquilinos',
          label: 'Inquilinos',
          icon: UsersRound,
          href: '/admin/inquilinos',
          permisoRequerido: 'inquilinos.listar',
        },
        {
          key: 'contratos',
          label: 'Contratos',
          icon: FileText,
          href: '/admin/contratos',
          permisoRequerido: 'contratos.listar',
        },
        {
          key: 'categorias',
          label: 'Categorías',
          icon: Tags,
          href: '/admin/categorias',
          permisoRequerido: 'categorias.listar',
        },
        {
          key: 'tipos-solicitud',
          label: 'Tipos de solicitud',
          icon: Shapes,
          href: '/admin/catalogos/tipos-solicitud',
          permisoRequerido: 'tipos_solicitud.listar',
        },
      ],
    },
    {
      label: 'Plataforma',
      items: [
        {
          key: 'usuarios-plaza',
          label: 'Usuarios | Roles',
          icon: UserCog,
          href: '/admin/usuarios-plaza',
          permisoRequerido: 'usuarios_plaza.listar',
        },
        {
          key: 'reportes',
          label: 'Reportes',
          icon: BarChart3,
          href: '/admin/reportes',
          permisoRequerido: 'reportes.dashboard.ver',
        },
        {
          key: 'auditoria',
          label: 'Auditoría',
          icon: ScrollText,
          href: '/admin/auditoria',
          permisoRequerido: 'auditoria.ver',
        },
        {
          key: 'notificaciones',
          label: 'Notificaciones',
          icon: Bell,
          href: '/admin/notificaciones',
          permisoRequerido: 'notificaciones.ver_log',
        },
        {
          key: 'config',
          label: 'Configuración',
          icon: Settings,
          href: '/admin/configuracion',
          permisoRequerido: 'configuracion.ver',
        },
      ],
    },
  ],
  superadmin: [
    { items: [{ key: 'sa-dashboard', label: 'Dashboard global', icon: LayoutDashboard, href: '/superadmin/dashboard' }] },
    {
      label: 'Plataforma',
      items: [{ key: 'plazas', label: 'Plazas', icon: Building2, href: '/superadmin/plazas' }],
    },
    // T-V25: vistas cross-plaza (sin scope de plaza). Separadas visualmente
    // del grupo "Operación" (que sí es plaza-scoped y usa impersonación).
    {
      label: 'Operación global',
      items: [
        {
          key: 'sa-solicitudes',
          label: 'Solicitudes globales',
          icon: Globe,
          href: '/superadmin/solicitudes',
        },
      ],
    },
    // El superadmin también puede operar la consola de plaza (el guard de
    // /admin/* lo permite). Estas secciones son plaza-scoped en el backend.
    // No llevan permisoRequerido: superadmin tiene wildcard '*' y siempre ve.
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
        {
          key: 'tipos-solicitud',
          label: 'Tipos de solicitud',
          icon: Shapes,
          href: '/admin/catalogos/tipos-solicitud',
        },
      ],
    },
    {
      label: 'Gestión',
      items: [
        { key: 'usuarios-plaza', label: 'Usuarios | Roles', icon: UserCog, href: '/admin/usuarios-plaza' },
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

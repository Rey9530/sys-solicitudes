/**
 * Registro de plantillas de email (T-120/T-121/T-125) — fuente única de verdad.
 *
 * - `subject`: template Handlebars (mismas variables que el body).
 * - `critico`: se encola/envía aunque `usuario.email_invalido = true` y NUNCA
 *   lleva link de unsubscribe (reset, aprobada, rechazada, subsanacion — plan
 *   T-121/T-125).
 * - `unsubscribe`: el footer incluye `{{unsubscribeUrl}}` (solo no críticos).
 */
export interface EmailTemplateDef {
  /** Nombre de archivo en templates/ (sin extensión). */
  archivo: string;
  /** Template Handlebars del subject. */
  subject: string;
  /** Se envía aunque email_invalido=true; sin unsubscribe. */
  critico: boolean;
  /** Lleva link de desuscripción en el footer (T-125). */
  unsubscribe: boolean;
}

export const EMAIL_TEMPLATES: Record<string, EmailTemplateDef> = {
  'solicitud-asignada-responsable': {
    archivo: 'solicitud-asignada-responsable',
    subject: 'Solicitud {{solicitudCodigo}} asignada a ti · {{plaza.nombreComercial}}',
    critico: false,
    unsubscribe: true,
  },
  'solicitud-nueva-supervisor': {
    archivo: 'solicitud-nueva-supervisor',
    subject: 'Nueva solicitud {{solicitudCodigo}} en tu subcategoría · {{plaza.nombreComercial}}',
    critico: false,
    unsubscribe: true,
  },
  'solicitud-recibida': {
    archivo: 'solicitud-recibida',
    subject: 'Tu solicitud {{solicitudCodigo}} está en revisión · {{plaza.nombreComercial}}',
    critico: false,
    unsubscribe: true,
  },
  'solicitud-aprobada': {
    archivo: 'solicitud-aprobada',
    subject: '✓ Solicitud {{solicitudCodigo}} aprobada · {{plaza.nombreComercial}}',
    critico: true,
    unsubscribe: false,
  },
  'solicitud-rechazada': {
    archivo: 'solicitud-rechazada',
    subject: 'Solicitud {{solicitudCodigo}} rechazada · {{plaza.nombreComercial}}',
    critico: true,
    unsubscribe: false,
  },
  'solicitud-subsanacion': {
    archivo: 'solicitud-subsanacion',
    subject: 'Tu solicitud {{solicitudCodigo}} requiere cambios · {{plaza.nombreComercial}}',
    critico: true,
    unsubscribe: false,
  },
  'solicitud-reasignada': {
    archivo: 'solicitud-reasignada',
    subject: 'Solicitud {{solicitudCodigo}} reasignada a ti · {{plaza.nombreComercial}}',
    critico: false,
    unsubscribe: true,
  },
  'reset-password': {
    archivo: 'reset-password',
    subject: 'Restablecer tu contraseña · Plazapp',
    critico: true,
    unsubscribe: false,
  },
  bienvenida: {
    archivo: 'bienvenida',
    subject: 'Bienvenido a Plazapp · {{plaza.nombreComercial}}',
    critico: false,
    unsubscribe: true,
  },
  'contrato-por-vencer': {
    archivo: 'contrato-por-vencer',
    subject: '⚠️ Contratos por vencer ({{ventana}}) · {{plaza.nombreComercial}}',
    critico: false,
    unsubscribe: true,
  },
};

export function getTemplateDef(plantilla: string): EmailTemplateDef | undefined {
  return EMAIL_TEMPLATES[plantilla];
}

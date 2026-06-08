/* ============================================================
   Plazapp — Sample data
   ============================================================ */
const DB = {};

DB.session = {
  user: { name: "María Fuentes", email: "mfuentes@galeriacentral.com", role: "admin_plaza", initials: "MF" },
  plaza: { name: "Galería Central", slug: "galeria-central", color: "#2f62e6", logo: null, tz: "America/El_Salvador" },
};

DB.tenants = [
  { name: "Galería Central", slug: "galeria-central", color: "#2f62e6", contacto: "ops@galeriacentral.com", creada: "2024-02-11", activa: true },
  { name: "Plaza Mundo Apopa", slug: "plaza-mundo-apopa", color: "#0ea371", contacto: "admin@plazamundo.com", creada: "2024-05-03", activa: true },
  { name: "Metrocentro Lourdes", slug: "metrocentro-lourdes", color: "#7c3aed", contacto: "—", creada: "2024-09-21", activa: true },
  { name: "Las Cascadas", slug: "las-cascadas", color: "#e0463a", contacto: "contacto@cascadas.com", creada: "2025-01-15", activa: true },
  { name: "Plaza Merliot", slug: "plaza-merliot", color: "#d6a811", contacto: "info@merliot.com", creada: "2025-03-30", activa: true },
];

DB.locales = [
  { id:"l1", codigo:"L-101", nombre:"Café Aroma", piso:"1", sector:"Norte", m2:48.5, estado:"alquilado" },
  { id:"l2", codigo:"L-102", nombre:"Óptica Visión", piso:"1", sector:"Norte", m2:32.0, estado:"alquilado" },
  { id:"l3", codigo:"L-118", nombre:"—", piso:"1", sector:"Centro", m2:65.2, estado:"disponible" },
  { id:"l4", codigo:"L-205", nombre:"Boutique Lila", piso:"2", sector:"Este", m2:41.0, estado:"alquilado" },
  { id:"l5", codigo:"L-210", nombre:"Tech Store", piso:"2", sector:"Este", m2:58.7, estado:"en_mantenimiento" },
  { id:"l6", codigo:"L-220", nombre:"—", piso:"2", sector:"Oeste", m2:38.4, estado:"disponible" },
  { id:"l7", codigo:"L-301", nombre:"Food Court A", piso:"3", sector:"Sur", m2:120.0, estado:"alquilado" },
  { id:"l8", codigo:"L-315", nombre:"Gimnasio Pulse", piso:"3", sector:"Sur", m2:210.5, estado:"fuera_de_servicio" },
];

DB.inquilinos = [
  { id:"i1", razon:"Inversiones Aroma S.A. de C.V.", ident:"0614-110820-101-2", contacto:"Carlos Méndez", email:"carlos@cafearoma.com", tel:"+503 7777-1010" },
  { id:"i2", razon:"Óptica Visión Ltda.", ident:"0614-220519-102-5", contacto:"Ana Beltrán", email:"ana@opticavision.com", tel:"+503 7777-2020" },
  { id:"i3", razon:"Comercial Lila S.A.", ident:"0511-030317-103-1", contacto:"Lucía Ramos", email:"lucia@boutiquelila.com", tel:"+503 7777-3030" },
  { id:"i4", razon:"TechStore El Salvador", ident:"0614-090221-104-9", contacto:"Diego Soto", email:"diego@techstore.sv", tel:"+503 7777-4040" },
  { id:"i5", razon:"Grupo Gastronómico FC", ident:"0614-150618-105-3", contacto:"Patricia Nieto", email:"pnieto@fcgroup.com", tel:"+503 7777-5050" },
];

DB.contratos = [
  { id:"c1", local:"L-101", inquilino:"Inversiones Aroma S.A. de C.V.", inicio:"2024-03-01", fin:null, monto:850, moneda:"USD", estado:"vigente" },
  { id:"c2", local:"L-102", inquilino:"Óptica Visión Ltda.", inicio:"2024-04-15", fin:"2026-04-14", monto:620, moneda:"USD", estado:"vigente" },
  { id:"c3", local:"L-205", inquilino:"Comercial Lila S.A.", inicio:"2024-06-01", fin:"2026-06-15", monto:740, moneda:"USD", estado:"vigente" },
  { id:"c4", local:"L-301", inquilino:"Grupo Gastronómico FC", inicio:"2023-11-01", fin:"2026-06-12", monto:2100, moneda:"USD", estado:"vigente" },
  { id:"c5", local:"L-210", inquilino:"TechStore El Salvador", inicio:"2023-01-10", fin:"2025-01-09", monto:980, moneda:"USD", estado:"finalizado" },
  { id:"c6", local:"L-118", inquilino:"Comercial Lila S.A.", inicio:"2022-08-01", fin:"2024-02-28", monto:560, moneda:"USD", estado:"cancelado" },
];

DB.categorias = [
  { id:"ca1", nombre:"Mantenimiento eléctrico", desc:"Fallas, instalaciones y revisión de sistema eléctrico.", activa:true, subs:4 },
  { id:"ca2", nombre:"Climatización (HVAC)", desc:"Aire acondicionado, ventilación y refrigeración.", activa:true, subs:3 },
  { id:"ca3", nombre:"Plomería", desc:"Fugas, drenajes y suministro de agua.", activa:true, subs:2 },
  { id:"ca4", nombre:"Obra civil y remodelación", desc:"Adecuaciones, acabados y trabajos estructurales menores.", activa:true, subs:5 },
  { id:"ca5", nombre:"Eventos y activaciones", desc:"Solicitudes para eventos en áreas comunes.", activa:false, subs:2 },
];

DB.subcategorias = [
  { id:"s1", nombre:"Tableros y breakers", prio:"A", responsable:"Luis Argueta", supervisores:3, activa:true },
  { id:"s2", nombre:"Iluminación de local", prio:"C", responsable:"Luis Argueta", supervisores:1, activa:true },
  { id:"s3", nombre:"Tomacorrientes", prio:"D", responsable:"—", supervisores:0, activa:true },
  { id:"s4", nombre:"Emergencia eléctrica", prio:"A", responsable:"Sofía Cruz", supervisores:5, activa:true },
];

DB.staff = [
  { name:"Luis Argueta", email:"largueta@galeriacentral.com", rol:"Ingeniero" },
  { name:"Sofía Cruz", email:"scruz@galeriacentral.com", rol:"Supervisor" },
  { name:"Mario Pineda", email:"mpineda@galeriacentral.com", rol:"Técnico" },
  { name:"María Fuentes", email:"mfuentes@galeriacentral.com", rol:"Supervisor" },
];

DB.solicitudes = [
  { id:"r1", codigo:"SOL-1042", tipo:"Mantenimiento", titulo:"Falla intermitente en tablero principal", local:"L-101", inquilino:"Café Aroma", estado:"enviada", prio:"A", sla:"red", slaLabel:"Vencido 4h", asignada:"—", enviada:"2026-06-07 08:12", decision:"—" },
  { id:"r2", codigo:"SOL-1041", tipo:"Evento", titulo:"Activación de marca en pasillo central", local:"L-205", inquilino:"Boutique Lila", estado:"asignado", prio:"C", sla:"amber", slaLabel:"6h restantes", asignada:"Luis Argueta", enviada:"2026-06-06 16:40", decision:"—" },
  { id:"r3", codigo:"SOL-1039", tipo:"Mantenimiento", titulo:"Fuga de agua en baño de empleados", local:"L-301", inquilino:"Food Court A", estado:"en_revision", prio:"B", sla:"amber", slaLabel:"1d restante", asignada:"María Fuentes", enviada:"2026-06-06 09:05", decision:"—" },
  { id:"r4", codigo:"SOL-1036", tipo:"Remodelación", titulo:"Adecuación de fachada y vitrina", local:"L-205", inquilino:"Boutique Lila", estado:"requerida_subsanacion", prio:"D", sla:"green", slaLabel:"5d restantes", asignada:"Sofía Cruz", enviada:"2026-06-04 11:20", decision:"Subsanación" },
  { id:"r5", codigo:"SOL-1031", tipo:"Mantenimiento", titulo:"Cambio de luminarias LED en local", local:"L-102", inquilino:"Óptica Visión", estado:"aprobada", prio:"C", sla:"green", slaLabel:"—", asignada:"Luis Argueta", enviada:"2026-06-02 14:00", decision:"Aprobada" },
  { id:"r6", codigo:"SOL-1028", tipo:"Otro", titulo:"Solicitud de permiso para rótulo exterior", local:"L-101", inquilino:"Café Aroma", estado:"rechazada", prio:"F", sla:"green", slaLabel:"—", asignada:"María Fuentes", enviada:"2026-05-30 10:30", decision:"Rechazada" },
  { id:"r7", codigo:"SOL-1025", tipo:"Evento", titulo:"Show navideño en plaza central", local:"L-301", inquilino:"Food Court A", estado:"borrador", prio:"E", sla:"none", slaLabel:"—", asignada:"—", enviada:"—", decision:"—" },
];

DB.notificaciones = [
  { dest:"carlos@cafearoma.com", plantilla:"solicitud_enviada", estado:"enviado", reintentos:0, creado:"2026-06-07 08:12", enviado:"2026-06-07 08:12" },
  { dest:"largueta@galeriacentral.com", plantilla:"solicitud_asignada", estado:"enviado", reintentos:0, creado:"2026-06-06 16:41", enviado:"2026-06-06 16:41" },
  { dest:"ana@opticavision.com", plantilla:"solicitud_aprobada", estado:"enviado", reintentos:1, creado:"2026-06-02 14:02", enviado:"2026-06-02 14:05" },
  { dest:"diego@techstore.sv", plantilla:"contrato_por_vencer", estado:"fallido", reintentos:3, creado:"2026-06-05 06:00", enviado:"—" },
  { dest:"pnieto@fcgroup.com", plantilla:"subsanacion_requerida", estado:"pendiente", reintentos:0, creado:"2026-06-07 09:10", enviado:"—" },
];

DB.timeline = [
  { ev:"Comentario interno", icon:"message-square", who:"Luis Argueta", time:"Hoy · 10:24", body:"Solicité al técnico inspección del tablero antes de aprobar." },
  { ev:"Tomada para revisión", icon:"hand", who:"Luis Argueta", time:"Hoy · 09:50", body:"" },
  { ev:"Asignada", icon:"user-check", who:"Sistema · regla de subcategoría", time:"Hoy · 08:13", body:"Asignada a Luis Argueta (responsable de «Tableros y breakers»)." },
  { ev:"Enviada", icon:"send", who:"Carlos Méndez", time:"Hoy · 08:12", body:"" },
  { ev:"Creada", icon:"file-plus", who:"Carlos Méndez", time:"Hoy · 08:05", body:"Borrador inicial creado desde el portal de inquilino." },
];

DB.comentarios = [
  { who:"Carlos Méndez", tipo:"Inquilino", time:"Hoy · 08:14", body:"La falla ocurre sobre todo en horas pico. Adjunto foto del tablero." },
  { who:"Luis Argueta", tipo:"Interno", time:"Hoy · 10:24", body:"Recibido. Programamos visita técnica para confirmar el alcance antes de la decisión." },
];

/* ---- helpers ---- */
const STATE_SOLICITUD = {
  borrador:{ label:"Borrador", cls:"b-neutral" },
  enviada:{ label:"Enviada", cls:"b-info" },
  asignado:{ label:"Asignado", cls:"b-indigo" },
  en_revision:{ label:"En revisión", cls:"b-warn" },
  requerida_subsanacion:{ label:"Subsanación", cls:"b-orange" },
  aprobada:{ label:"Aprobada", cls:"b-ok" },
  rechazada:{ label:"Rechazada", cls:"b-danger" },
  cancelada:{ label:"Cancelada", cls:"b-neutral" },
};
const STATE_LOCAL = {
  disponible:{ label:"Disponible", cls:"b-ok" },
  alquilado:{ label:"Alquilado", cls:"b-info" },
  en_mantenimiento:{ label:"En mantenimiento", cls:"b-warn" },
  fuera_de_servicio:{ label:"Fuera de servicio", cls:"b-neutral" },
};
const STATE_CONTRATO = {
  vigente:{ label:"Vigente", cls:"b-ok" },
  finalizado:{ label:"Finalizado", cls:"b-neutral" },
  cancelado:{ label:"Cancelado", cls:"b-danger" },
};
const STATE_NOTIF = {
  pendiente:{ label:"Pendiente", cls:"b-warn" },
  enviado:{ label:"Enviado", cls:"b-ok" },
  fallido:{ label:"Fallido", cls:"b-danger" },
};

function money(n, m="USD"){ return n==null ? "—" : m+" "+n.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}); }
function dotColor(estado){
  return ({disponible:"var(--ok-fg)",alquilado:"var(--info-fg)",en_mantenimiento:"var(--warn-fg)",fuera_de_servicio:"var(--text-muted)"})[estado]||"var(--text-muted)";
}

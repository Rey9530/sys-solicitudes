/* ============================================================
   Plazapp — App shell, router, theme
   ============================================================ */
const ROUTES = [];
function page(path, meta, render){ ROUTES.push({ path, meta, render }); }

function matchRoute(hash){
  const clean = (hash||"").replace(/^#/,"") || "/login";
  for(const r of ROUTES){
    if(r.path===clean) return { r, params:{} };
  }
  for(const r of ROUTES){
    if(!r.path.includes(":")) continue;
    const pp=r.path.split("/"), hp=clean.split("/");
    if(pp.length!==hp.length) continue;
    const params={}; let ok=true;
    for(let i=0;i<pp.length;i++){
      if(pp[i].startsWith(":")) params[pp[i].slice(1)]=decodeURIComponent(hp[i]);
      else if(pp[i]!==hp[i]){ ok=false; break; }
    }
    if(ok) return { r, params };
  }
  return null;
}

/* ---------------- Nav config ---------------- */
const NAV = {
  admin: [
    { items:[ {k:"dashboard",label:"Dashboard",icon:"layout-dashboard",href:"/admin/dashboard"} ] },
    { label:"Operación", items:[
      {k:"solicitudes",label:"Solicitudes",icon:"inbox",href:"/admin/solicitudes",badge:"4"},
      {k:"calendario",label:"Calendario",icon:"calendar-days",href:"/admin/calendario"},
    ]},
    { label:"Catálogo", items:[
      {k:"locales",label:"Locales",icon:"store",href:"/admin/locales"},
      {k:"inquilinos",label:"Inquilinos",icon:"users-round",href:"/admin/inquilinos"},
      {k:"contratos",label:"Contratos",icon:"file-text",href:"/admin/contratos"},
      {k:"categorias",label:"Categorías",icon:"tags",href:"/admin/categorias"},
    ]},
    { label:"Plataforma", items:[
      {k:"reportes",label:"Reportes",icon:"bar-chart-3",href:"/admin/reportes"},
      {k:"notificaciones",label:"Notificaciones",icon:"bell",href:"/admin/notificaciones",badge:"1",badgeMuted:true},
      {k:"config",label:"Configuración",icon:"settings",href:"/admin/configuracion"},
    ]},
  ],
  superadmin: [
    { items:[ {k:"sa-dashboard",label:"Dashboard global",icon:"layout-dashboard",href:"/superadmin/dashboard"} ]},
    { label:"Plataforma", items:[
      {k:"plazas",label:"Plazas",icon:"building-2",href:"/superadmin/plazas",badge:"5",badgeMuted:true},
    ]},
  ],
  inquilino: [
    { label:"Portal", items:[
      {k:"i-solicitudes",label:"Mis solicitudes",icon:"inbox",href:"/inquilino/solicitudes"},
      {k:"i-contratos",label:"Mis contratos",icon:"file-text",href:"/inquilino/contratos"},
      {k:"i-calendario",label:"Calendario",icon:"calendar-days",href:"/inquilino/calendario"},
    ]},
  ],
};

const SHELL_META = {
  admin:      { brandSub:"Galería Central", role:"Admin de plaza", tenant:true },
  superadmin: { brandSub:"Consola de plataforma", role:"Superadmin", tenant:false },
  inquilino:  { brandSub:"Galería Central", role:"Inquilino", tenant:true },
};

/* ---------------- State ---------------- */
const ST = {
  theme: localStorage.getItem("pz-theme") || "light",
  collapsed: localStorage.getItem("pz-collapsed")==="1",
};

function applyTheme(){ document.documentElement.setAttribute("data-theme", ST.theme); }
function toggleTheme(){ ST.theme = ST.theme==="dark"?"light":"dark"; localStorage.setItem("pz-theme",ST.theme); applyTheme(); render(); }
function toggleCollapse(){ ST.collapsed=!ST.collapsed; localStorage.setItem("pz-collapsed",ST.collapsed?"1":"0"); render(); }

/* ---------------- Sidebar ---------------- */
function sidebar(role, navKey){
  const groups = NAV[role]||[];
  const meta = SHELL_META[role];
  const groupsHtml = groups.map(g=>`
    <div class="side-sec">
      ${g.label?`<div class="side-sec-label">${g.label}</div>`:""}
      ${g.items.map(it=>`
        <a class="nav-link ${it.k===navKey?"active":""}" href="#${it.href}">
          ${ic(it.icon)}<span>${it.label}</span>
          ${it.badge?`<span class="nav-badge ${it.badgeMuted?"muted":""}">${it.badge}</span>`:""}
        </a>`).join("")}
    </div>`).join("");
  return `<aside class="side">
    <div class="side-head">
      <div class="side-logo">P</div>
      <div class="side-brand"><b>Plazapp</b><span>${meta.brandSub}</span></div>
    </div>
    <div class="side-scroll">${groupsHtml}</div>
    <div class="side-foot">
      <div class="side-user">
        ${avatar(DB.session.user.name)}
        <div class="side-foot-txt"><b>${DB.session.user.name}</b><span>${meta.role}</span></div>
      </div>
    </div>
  </aside>`;
}

/* ---------------- Topbar ---------------- */
function topbar(role){
  const meta=SHELL_META[role];
  return `<header class="topbar">
    <button class="top-toggle" onclick="toggleCollapse()" title="Contraer menú">${ic("panel-left")}</button>
    <div class="top-search">
      ${ic("search")}<input placeholder="Buscar solicitudes, locales, inquilinos…"><kbd>⌘K</kbd>
    </div>
    <div class="top-right">
      ${meta.tenant?`<div class="top-tenant"><span class="dot" style="background:var(--primary)"></span>${DB.session.plaza.name}${ic("chevron-down")}</div>`:`<div class="top-tenant">${ic("globe")}Plataforma${ic("chevron-down")}</div>`}
      <button class="icon-btn" onclick="toggleTheme()" title="Cambiar tema">${ic(ST.theme==="dark"?"sun":"moon")}</button>
      <a class="icon-btn" href="#/admin/notificaciones" title="Notificaciones">${ic("bell")}<span class="ping"></span></a>
      <div class="top-avatar">${DB.session.user.initials}</div>
    </div>
  </header>`;
}

/* ---------------- Render ---------------- */
function render(){
  applyTheme();
  const m = matchRoute(location.hash);
  const root = document.getElementById("app");
  if(!m){ root.innerHTML = `<div class="shell public"><div style="display:grid;place-items:center;min-height:100vh">${emptyState({icon:"compass",title:"Pantalla no encontrada",body:"Esta ruta no existe en el prototipo.",action:`<a class="btn btn-primary" href="#/admin/dashboard">Ir al dashboard</a>`})}</div></div>`; lucide.createIcons(); return; }

  const { r, params } = m;
  const shell = r.meta.shell;

  if(shell==="public"){
    root.innerHTML = `<div class="shell public">${r.render(params)}</div>`;
  } else {
    root.innerHTML = `
    <div class="shell ${ST.collapsed?"collapsed":""}" id="shell">
      ${sidebar(shell, r.meta.nav)}
      <div class="main-col">
        ${topbar(shell)}
        <main class="main">${r.render(params)}</main>
      </div>
    </div>`;
  }
  if(window.lucide) lucide.createIcons();
  document.querySelector(".main")?.scrollTo?.(0,0);
  window.scrollTo(0,0);
  bindTabs();
}

/* lightweight tab switching within a page (visual) */
function bindTabs(){
  document.querySelectorAll(".tabs").forEach(group=>{
    group.querySelectorAll(".tab").forEach((tab,i)=>{
      tab.addEventListener("click",()=>{
        group.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));
        tab.classList.add("active");
        const panels=group.parentElement.querySelectorAll("[data-tabpanel]");
        panels.forEach((p,j)=>p.classList.toggle("hide", j!==i));
      });
    });
  });
}

window.addEventListener("hashchange", render);
window.addEventListener("DOMContentLoaded", ()=>{ applyTheme(); render(); });

/* ---------------- Modals ---------------- */
const MODALS = {};
function modal(key, builder){ MODALS[key]=builder; }
function openModal(key, arg){
  const b = MODALS[key]; if(!b) return;
  closeModal();
  const host = document.createElement("div");
  host.className = "modal-overlay";
  host.id = "modal-host";
  host.innerHTML = b(arg);
  host.addEventListener("click", e=>{ if(e.target===host) closeModal(); });
  document.body.appendChild(host);
  if(window.lucide) lucide.createIcons();
  bindTabs();
}
function closeModal(){ document.getElementById("modal-host")?.remove(); }
document.addEventListener("keydown", e=>{ if(e.key==="Escape") closeModal(); });

function modalShell({icon, tint, title, sub, body, foot, lg}){
  return `<div class="modal ${lg?"lg":""}" onclick="event.stopPropagation()">
    <div class="modal-head">
      ${icon?`<span class="mh-ic tint-${tint||"primary"}">${ic(icon)}</span>`:""}
      <div><h3>${title}</h3>${sub?`<p>${sub}</p>`:""}</div>
      <button class="icon-btn mh-close" onclick="closeModal()">${ic("x")}</button>
    </div>
    <div class="modal-body">${body}</div>
    ${foot?`<div class="modal-foot">${foot}</div>`:""}
  </div>`;
}

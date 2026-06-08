/* ============================================================
   Plazapp — UI helpers (HTML string builders)
   ============================================================ */

function ic(name, cls){ return `<i data-lucide="${name}"${cls?` class="${cls}"`:""}></i>`; }

function avatar(name, sm){
  const init = name.split(" ").map(w=>w[0]).slice(0,2).join("").toUpperCase();
  const hues = [210,150,275,12,45,330];
  let h=0; for(const c of name) h=(h+c.charCodeAt(0))%hues.length;
  const hue = hues[h];
  return `<span class="avatar${sm?" avatar-sm":""}" style="background:linear-gradient(150deg,oklch(.68 .14 ${hue}),oklch(.55 .16 ${hue}))">${init}</span>`;
}

function badgeSolicitud(estado){ const s=STATE_SOLICITUD[estado]||STATE_SOLICITUD.borrador; return `<span class="badge ${s.cls}"><span class="bdot"></span>${s.label}</span>`; }
function badgeLocal(estado){ const s=STATE_LOCAL[estado]; return `<span class="badge ${s.cls}"><span class="bdot"></span>${s.label}</span>`; }
function badgeContrato(estado){ const s=STATE_CONTRATO[estado]; return `<span class="badge ${s.cls}"><span class="bdot"></span>${s.label}</span>`; }
function badgeNotif(estado){ const s=STATE_NOTIF[estado]; return `<span class="badge ${s.cls}"><span class="bdot"></span>${s.label}</span>`; }
function prioChip(p){ return `<span class="prio prio-${p}" title="Prioridad ${p}">${p}</span>`; }
function slaCell(sla, label){
  if(sla==="none"||!sla) return `<span class="muted">—</span>`;
  return `<span class="sla sla-${sla}"><span class="slap"></span>${label||""}</span>`;
}

function breadcrumb(items){
  return `<nav class="breadcrumb">${items.map((it,i)=>
    `${i>0?ic("chevron-right"):""}${it.href?`<a href="#${it.href}">${it.label}</a>`:`<span>${it.label}</span>`}`
  ).join("")}</nav>`;
}

function pageHead({title, sub, badges, actions, breadcrumb:bc}){
  return `${bc?breadcrumb(bc):""}
  <header class="page-head">
    <div class="ph-main">
      <h1 class="page-title">${title}${badges?` ${badges}`:""}</h1>
      ${sub?`<p class="page-sub">${sub}</p>`:""}
    </div>
    ${actions?`<div class="page-actions">${actions}</div>`:""}
  </header>`;
}

function kpiCard({label, value, tint, icon, delta, deltaDir, spark}){
  return `<div class="card kpi">
    <div class="kpi-top">
      <span class="kpi-label">${label}</span>
      <span class="kpi-ic tint-${tint}">${ic(icon)}</span>
    </div>
    <div class="kpi-val">${value}</div>
    ${delta?`<div class="kpi-delta ${deltaDir}">${ic(deltaDir==="up"?"trending-up":"trending-down")}${delta}</div>`:""}
    ${spark?`<div class="kpi-spark">${spark}</div>`:""}
  </div>`;
}

function pager(active, total){
  let btns="";
  for(let i=1;i<=total;i++) btns+=`<button class="${i===active?"on":""}">${i}</button>`;
  return `<div class="pager">
    <button ${active===1?"disabled":""}>${ic("chevron-left")}</button>
    ${btns}
    <button ${active===total?"disabled":""}>${ic("chevron-right")}</button>
  </div>`;
}

function tabs(items, activeIdx){
  return `<div class="tabs">${items.map((t,i)=>
    `<button class="tab ${i===(activeIdx||0)?"active":""}">${t.icon?ic(t.icon):""}${t.label}${t.count!=null?`<span class="cnt">${t.count}</span>`:""}</button>`
  ).join("")}</div>`;
}

function emptyState({icon, title, body, action}){
  return `<div class="empty">
    <div class="empty-ic">${ic(icon||"inbox")}</div>
    <h4>${title}</h4>
    ${body?`<p>${body}</p>`:""}
    ${action||""}
  </div>`;
}

function filterBar(fields){
  return `<div class="card"><div class="filters">${fields}</div></div>`;
}
function ffield(label, control){ return `<div class="field"><label>${label}</label>${control}</div>`; }
function fselect(label, opts){ return ffield(label, `<select class="select">${opts.map(o=>`<option>${o}</option>`).join("")}</select>`); }
function finput(label, ph, w){ return ffield(label, `<input class="input" placeholder="${ph||""}"${w?` style="width:${w}"`:""}>`); }

function tableCard({head, cols, rows, foot}){
  return `<div class="card">
    ${head||""}
    <div class="table-wrap">
      <table class="tbl">
        <thead><tr>${cols.map(c=>`<th class="${c.cls||""}">${c.label}</th>`).join("")}</tr></thead>
        <tbody>${Array.isArray(rows)?rows.join(""):rows}</tbody>
      </table>
    </div>
    ${foot?`<div class="tbl-foot">${foot}</div>`:""}
  </div>`;
}

/* simple inline SVG sparkline */
function sparkline(points, color){
  const w=160, h=34, max=Math.max(...points), min=Math.min(...points);
  const rng=(max-min)||1;
  const step=w/(points.length-1);
  const pts=points.map((p,i)=>`${(i*step).toFixed(1)},${(h-2-((p-min)/rng)*(h-6)).toFixed(1)}`).join(" ");
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:100%">
    <polyline points="${pts}" fill="none" stroke="${color||'var(--primary)'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

/* simple bar chart */
function barChart(data, color){
  const max=Math.max(...data.map(d=>d.v));
  return `<div style="display:flex;align-items:flex-end;gap:14px;height:200px;padding-top:10px">
    ${data.map(d=>`<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:8px;height:100%;justify-content:flex-end">
      <div style="font-size:12px;font-weight:600;color:var(--text-2)">${d.v}</div>
      <div style="width:100%;max-width:54px;height:${Math.max(6,(d.v/max)*150)}px;background:linear-gradient(180deg,${color||'var(--primary)'},color-mix(in srgb,${color||'var(--primary)'} 60%,transparent));border-radius:6px 6px 0 0"></div>
      <div style="font-size:11.5px;color:var(--text-muted);text-align:center">${d.k}</div>
    </div>`).join("")}
  </div>`;
}

/* line chart (multi-series) */
function lineChart(series, labels){
  const w=560,h=200,pad=28;
  const all=series.flatMap(s=>s.data);
  const max=Math.max(...all), min=0;
  const sx=i=>pad+(i*(w-pad*2)/(labels.length-1));
  const sy=v=>h-pad-((v-min)/((max-min)||1))*(h-pad*2);
  let grid="";
  for(let g=0;g<=4;g++){ const y=pad+g*(h-pad*2)/4; grid+=`<line x1="${pad}" y1="${y}" x2="${w-pad}" y2="${y}" stroke="var(--border)" stroke-width="1"/>`; }
  const lines=series.map(s=>{
    const pts=s.data.map((v,i)=>`${sx(i)},${sy(v)}`).join(" ");
    return `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      ${s.data.map((v,i)=>`<circle cx="${sx(i)}" cy="${sy(v)}" r="3" fill="var(--surface)" stroke="${s.color}" stroke-width="2"/>`).join("")}`;
  }).join("");
  const xlabels=labels.map((l,i)=>`<text x="${sx(i)}" y="${h-8}" text-anchor="middle" font-size="10" fill="var(--text-muted)">${l}</text>`).join("");
  return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto" font-family="var(--font-sans)">${grid}${lines}${xlabels}</svg>`;
}

/* donut */
function donut(data){
  const total=data.reduce((a,d)=>a+d.v,0);
  let acc=0; const R=54, C=2*Math.PI*R;
  const segs=data.map(d=>{
    const frac=d.v/total; const dash=frac*C;
    const seg=`<circle r="${R}" cx="80" cy="80" fill="none" stroke="${d.color}" stroke-width="20" stroke-dasharray="${dash} ${C-dash}" stroke-dashoffset="${-acc*C}" transform="rotate(-90 80 80)"/>`;
    acc+=frac; return seg;
  }).join("");
  return `<div style="display:flex;align-items:center;gap:22px;flex-wrap:wrap">
    <svg viewBox="0 0 160 160" style="width:140px;height:140px">${segs}
      <text x="80" y="76" text-anchor="middle" font-size="13" fill="var(--text-muted)">Total</text>
      <text x="80" y="96" text-anchor="middle" font-size="22" font-weight="700" fill="var(--text)">${total}</text>
    </svg>
    <div class="legend" style="flex-direction:column;gap:9px">
      ${data.map(d=>`<span><i style="background:${d.color}"></i>${d.k} · <b style="color:var(--text-2)">${d.v}</b></span>`).join("")}
    </div>
  </div>`;
}

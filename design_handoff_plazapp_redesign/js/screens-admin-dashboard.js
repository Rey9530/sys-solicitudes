/* ============================================================
   Plazapp — Admin dashboard (10) + Superadmin dashboard (7)
   ============================================================ */

function dashboardContent(scope){
  const linkable = scope!=="global";
  const kpis = [
    kpiCard({label:"Pendientes", value:"12", tint:"warn", icon:"clock", spark:sparkline([8,10,9,11,10,12],"var(--warn-fg)")}),
    kpiCard({label:"Aprobadas hoy", value:"5", tint:"ok", icon:"check-circle-2", delta:"+2 vs ayer", deltaDir:"up"}),
    kpiCard({label:"Rechazadas hoy", value:"1", tint:"danger", icon:"x-circle"}),
    kpiCard({label:"Eventos próx. 7d", value:"8", tint:"info", icon:"calendar-days", spark:sparkline([2,3,1,4,3,5],"var(--info-fg)")}),
    kpiCard({label:"Contratos x vencer 30d", value:"3", tint:"violet", icon:"file-warning"}),
  ];
  const kpis2 = [
    `<div class="card card-pad"><div class="kpi-label">Tasa de aprobación</div><div class="row" style="align-items:flex-end;gap:14px;margin-top:10px"><div class="kpi-val" style="margin:0">82<span style="font-size:18px;color:var(--text-3)">%</span></div><div class="kpi-delta up" style="margin:0">${ic("trending-up")}+4 pts</div></div><div style="height:7px;border-radius:99px;background:var(--surface-3);margin-top:14px;overflow:hidden"><div style="width:82%;height:100%;background:var(--ok-fg)"></div></div></div>`,
    `<div class="card card-pad"><div class="kpi-label">Tiempo medio de respuesta</div><div class="kpi-val" style="margin-top:10px">6.4<span style="font-size:18px;color:var(--text-3)"> h</span></div><div class="muted" style="font-size:12px;margin-top:8px">Meta SLA: < 8 h · ${ic("circle-check")} dentro de meta</div></div>`,
    `<div class="card card-pad"><div class="kpi-label">Solicitudes con subsanación</div><div class="kpi-val" style="margin-top:10px">4</div><div class="muted" style="font-size:12px;margin-top:8px">9% del total en curso</div></div>`,
  ];

  const codeCell = (c)=> linkable ? `<a class="cellcode" href="#/admin/solicitudes/${c}">${c}</a>` : `<span class="cellcode" style="color:var(--text-2)">${c}</span>`;

  const charts = `
  <div class="grid" style="grid-template-columns:1.5fr 1fr">
    <div class="card">
      <div class="card-head"><h3>Tendencia mensual por estado</h3><span class="muted">Últimos 6 meses</span></div>
      <div class="card-body">
        <div class="legend" style="margin-bottom:8px">
          <span><i style="background:var(--ok-fg)"></i>Aprobadas</span>
          <span><i style="background:var(--warn-fg)"></i>En revisión</span>
          <span><i style="background:var(--danger-fg)"></i>Rechazadas</span>
        </div>
        ${lineChart([
          {data:[18,22,20,26,24,31],color:"var(--ok-fg)"},
          {data:[10,9,12,11,14,12],color:"var(--warn-fg)"},
          {data:[3,4,2,5,3,4],color:"var(--danger-fg)"},
        ], ["Ene","Feb","Mar","Abr","May","Jun"])}
      </div>
    </div>
    <div class="card">
      <div class="card-head"><h3>Por prioridad</h3></div>
      <div class="card-body" style="display:grid;place-items:center;min-height:200px">
        ${donut([
          {k:"A",v:6,color:"#e0463a"},{k:"B",v:9,color:"#e8852c"},{k:"C",v:14,color:"#d6a811"},
          {k:"D",v:8,color:"#3f9e5a"},{k:"E",v:4,color:"#2f8fb0"},{k:"F",v:3,color:"#7a8499"},
        ])}
      </div>
    </div>
  </div>
  <div class="card">
    <div class="card-head"><h3>Solicitudes por tipo</h3><span class="muted">Mes actual</span></div>
    <div class="card-body">
      ${barChart([{k:"Mantenimiento",v:34},{k:"Evento",v:18},{k:"Remodelación",v:9},{k:"Otro",v:6}],"var(--primary)")}
    </div>
  </div>`;

  const top5 = DB.solicitudes.filter(s=>["enviada","asignado","en_revision","requerida_subsanacion"].includes(s.estado)).slice(0,5).map(s=>`
    <div class="list-row">
      ${prioChip(s.prio)}
      <div style="flex:1;min-width:0">
        <div class="row" style="gap:8px">${codeCell(s.codigo)} ${badgeSolicitud(s.estado)}</div>
        <div class="cellsub" style="margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.titulo}</div>
      </div>
      <span class="sla sla-${s.sla==='none'?'green':s.sla}" style="flex:none"><span class="slap"></span>${s.slaLabel}</span>
    </div>`).join("");

  const activity = DB.timeline.slice(0,5).map(t=>`
    <div class="list-row">
      <span class="kpi-ic tint-primary" style="width:30px;height:30px">${ic(t.icon)}</span>
      <div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:550">${t.ev}</div><div class="cellsub">${t.who}</div></div>
      <span class="tl-time">${t.time}</span>
    </div>`).join("");

  return `
    <div class="kpi-grid">${kpis.join("")}</div>
    <div class="kpi-grid c3" style="margin-top:16px">${kpis2.join("")}</div>
    <div class="grid" style="margin-top:16px">${charts}</div>
    <div class="grid" style="grid-template-columns:1fr 1fr;margin-top:16px">
      <div class="card">
        <div class="card-head"><h3>Top 5 por antigüedad</h3>${linkable?`<a class="muted" href="#/admin/solicitudes" style="font-size:12.5px">Ver bandeja →</a>`:""}</div>
        <div class="card-body" style="padding:8px 12px">${top5}</div>
      </div>
      <div class="card">
        <div class="card-head"><h3>Actividad reciente</h3></div>
        <div class="card-body" style="padding:8px 12px">${activity}</div>
      </div>
    </div>`;
}

page("/admin/dashboard", { shell:"admin", nav:"dashboard" }, ()=>`
  <div class="page wide">
    ${pageHead({
      title:"Dashboard",
      sub:"Resumen operativo de Galería Central · actualizado hace 2 min",
      actions:`<span class="badge b-neutral">${ic("refresh-cw")} Auto-refresh 5 min</span><a class="btn btn-primary" href="#/admin/solicitudes">${ic("inbox")} Ir a bandeja</a>`
    })}
    ${dashboardContent("plaza")}
  </div>
`);

page("/superadmin/dashboard", { shell:"superadmin", nav:"sa-dashboard" }, ()=>`
  <div class="page wide">
    ${pageHead({
      title:"Dashboard global",
      sub:"Métricas agregadas de las 5 plazas activas en la plataforma",
      actions:`<span class="badge b-neutral">${ic("refresh-cw")} Auto-refresh 5 min</span>`
    })}
    ${dashboardContent("global")}
  </div>
`);

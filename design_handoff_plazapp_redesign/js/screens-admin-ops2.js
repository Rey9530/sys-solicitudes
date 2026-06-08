/* ============================================================
   Plazapp — Admin: Calendario (27), Reportes (28),
   Notificaciones (29), Configuración (24)
   ============================================================ */

/* ---------------- 27. Calendario admin ---------------- */
function calendarGrid(interactive){
  // June 2026 — starts Monday Jun 1; today = Jun 7
  const dow = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];
  const events = {
    3:[{t:"evento",l:"Activación Lila"}],
    6:[{t:"mant",l:"Mant. eléctrico L-101"}],
    7:[{t:"hito",l:"Vence contrato L-301"},{t:"evento",l:"Show plaza"}],
    11:[{t:"mant",l:"HVAC L-210"}],
    12:[{t:"hito",l:"Renovación L-205"}],
    15:[{t:"evento",l:"Feria gastronómica",solape:true},{t:"mant",l:"Plomería",solape:true}],
    19:[{t:"evento",l:"Activación TechStore"}],
    24:[{t:"mant",l:"Luminarias food court"}],
  };
  let cells="";
  // 30 days, starts Mon (col0)
  for(let d=1; d<=30; d++){
    const evs = events[d]||[];
    cells += `<div class="cal-cell ${d===7?'today':''}">
      <span class="cal-num">${d}</span>
      ${evs.map(e=>`<span class="cal-ev ${e.t} ${e.solape?'solape':''}" ${interactive?`onclick="openModal('cal-event',{l:'${e.l}',t:'${e.t}'})"`:`onclick="openModal('cal-event-ro',{l:'${e.l}',t:'${e.t}'})"`}>${e.l}</span>`).join("")}
    </div>`;
  }
  // trailing to fill 5 rows (35) — Jun 30 is Tuesday, so add 5 trailing
  for(let d=1; d<=5; d++) cells += `<div class="cal-cell dim"><span class="cal-num">${d}</span></div>`;
  return `<div class="cal-grid">${dow.map(d=>`<div class="cal-dow">${d}</div>`).join("")}${cells}</div>`;
}

function calendarScreen(interactive, nav){
  return `<div class="page wide">
    ${pageHead({
      title:"Calendario",
      sub:interactive?"Eventos, mantenimientos e hitos contractuales · arrastra para reprogramar":"Eventos y mantenimientos de tus locales",
      actions:`<div class="segment"><button class="on">Mes</button><button>Semana</button><button>Lista</button></div>${interactive?`<button class="btn btn-primary" onclick="openModal('nueva-solicitud-cal')">${ic("plus")} Nuevo evento</button>`:""}`
    })}
    <div class="cal-wrap">
      <div class="col" style="gap:16px">
        <div class="card card-pad">
          <div class="row" style="justify-content:space-between;margin-bottom:14px"><b style="font-size:15px">Junio 2026</b><div class="row" style="gap:4px"><button class="icon-btn" style="width:30px;height:30px">${ic("chevron-left")}</button><button class="icon-btn" style="width:30px;height:30px">${ic("chevron-right")}</button></div></div>
          <div class="legend" style="flex-direction:column;gap:10px">
            <span><i style="background:#10b981"></i>Eventos</span>
            <span><i style="background:#f59e0b"></i>Mantenimientos</span>
            <span><i style="background:#8b5cf6"></i>Hitos contractuales</span>
            <span><i style="background:transparent;outline:1.5px solid var(--danger-fg)"></i>Solape detectado</span>
          </div>
        </div>
        <div class="card card-pad">
          <b style="font-size:13px">Filtros</b>
          <div class="form-grid" style="margin-top:12px;gap:12px">
            ${fselect("Locales","Todos los locales,L-101,L-205,L-301".split(","))}
            ${fselect("Tipos","Todos,Solo eventos,Solo mantenimientos".split(","))}
            <div class="check" style="justify-content:space-between"><span>Zona horaria de la plaza</span><span class="switch on"></span></div>
          </div>
        </div>
      </div>
      <div class="card card-pad">${calendarGrid(interactive)}</div>
    </div>
  </div>`;
}

page("/admin/calendario", { shell:"admin", nav:"calendario" }, ()=> calendarScreen(true));

modal("cal-event", (a)=> modalShell({
  icon: a?.t==="mant"?"wrench":a?.t==="hito"?"file-signature":"calendar-check", tint: a?.t==="mant"?"warn":a?.t==="hito"?"violet":"ok",
  title:a?.l||"Evento", sub:"7 de junio de 2026 · 09:00 – 12:00",
  body:`<dl class="dl c2">
    <div><div class="dt">Local</div><div class="dd mono">L-101</div></div>
    <div><div class="dt">Tipo</div><div class="dd">${a?.t==="mant"?"Mantenimiento":a?.t==="hito"?"Hito contractual":"Evento"}</div></div>
    <div><div class="dt">Solicitud</div><div class="dd"><a class="cellcode" href="#/admin/solicitudes/SOL-1042">SOL-1042</a></div></div>
    <div><div class="dt">Responsable</div><div class="dd">Luis Argueta</div></div>
  </dl>`,
  foot:`<button class="btn btn-ghost" onclick="closeModal()">Cerrar</button><a class="btn btn-primary" href="#/admin/solicitudes/SOL-1042" onclick="closeModal()">${ic("arrow-right")} Ver solicitud</a>`
}));
modal("cal-event-ro", (a)=> modalShell({
  icon:"calendar-check", tint:"ok", title:a?.l||"Evento", sub:"7 de junio de 2026 · 09:00 – 12:00",
  body:`<dl class="dl c2"><div><div class="dt">Local</div><div class="dd mono">L-101</div></div><div><div class="dt">Tipo</div><div class="dd">Evento</div></div></dl>`,
  foot:`<button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>`
}));
modal("nueva-solicitud-cal", ()=> modalShell({
  icon:"calendar-plus", tint:"primary", title:"Nueva solicitud de evento", sub:"Prefilled desde el calendario.",
  body:`<div class="banner banner-info">${ic("info")}<div>Se abrirá el asistente de nueva solicitud con tipo <b>Evento</b>, fecha y local precargados.</div></div>`,
  foot:`<button class="btn btn-ghost" onclick="closeModal()">Cancelar</button><a class="btn btn-primary" href="#/inquilino/solicitudes/nueva" onclick="closeModal()">${ic("arrow-right")} Abrir asistente</a>`
}));

/* ---------------- 28. Reportes ---------------- */
page("/admin/reportes", { shell:"admin", nav:"reportes" }, ()=>{
  const prevRows = DB.solicitudes.slice(0,5).map(s=>`<tr><td class="mono">${s.codigo}</td><td>${s.tipo}</td><td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.titulo}</td><td>${s.local}</td><td>${STATE_SOLICITUD[s.estado].label}</td><td>${s.enviada}</td></tr>`).join("");
  return `<div class="page">
    ${pageHead({ title:"Reportes", sub:"Exporta solicitudes, locales e inquilinos a CSV, XLSX o PDF · rango máximo 12 meses." })}
    <div class="card card-pad" style="margin-bottom:18px">
      <div class="filters" style="padding:0">
        ${fselect("Entidad",["Solicitudes","Locales","Inquilinos"])}
        ${fselect("Estado",["Todos","Enviada","Aprobada","Rechazada"])}
        ${fselect("Tipo",["Todos","Mantenimiento","Evento","Remodelación"])}
        ${ffield("Desde",`<input class="input" type="date" value="2026-01-01">`)}
        ${ffield("Hasta",`<input class="input" type="date" value="2026-06-07">`)}
        ${fselect("Formato",["CSV","XLSX","PDF"])}
        <div class="field"><label>&nbsp;</label><div class="row"><button class="btn btn-secondary btn-sm">${ic("eye")} Previsualizar</button><button class="btn btn-primary btn-sm">${ic("download")} Generar</button></div></div>
      </div>
    </div>
    <div class="card">
      <div class="card-head"><h3>Vista previa</h3><span class="muted">Primeros 5 de 142 registros</span></div>
      <div class="table-wrap"><table class="tbl report-preview"><thead><tr><th>Código</th><th>Tipo</th><th>Título</th><th>Local</th><th>Estado</th><th>Enviada</th></tr></thead><tbody>${prevRows}</tbody></table></div>
    </div>
    <div class="placeholder" style="height:64px;margin-top:18px">Reportes programados e historial · fuera de v1</div>
  </div>`;
});

/* ---------------- 29. Notificaciones ---------------- */
page("/admin/notificaciones", { shell:"admin", nav:"notificaciones" }, ()=>{
  const rows = DB.notificaciones.map(n=>`<tr>
    <td class="lead">${n.dest}</td>
    <td><span class="row" style="gap:7px">${ic("mail")}<span class="mono cellsub">${n.plantilla}</span></span></td>
    <td>${badgeNotif(n.estado)}</td>
    <td class="num">${n.reintentos}</td>
    <td class="cellsub">${n.creado}</td>
    <td class="cellsub">${n.enviado}</td>
    <td class="actions"><button class="btn btn-sm btn-ghost" onclick="openModal('notif-preview',{dest:'${n.dest}',pl:'${n.plantilla}'})" title="Ver">${ic("eye")}</button>${n.estado==="fallido"?`<button class="btn btn-sm btn-ghost" title="Reintentar">${ic("refresh-cw")}</button>`:""}</td>
  </tr>`).join("");
  const unsub = [["diego@techstore.sv","contrato_por_vencer","2026-05-20"],["pnieto@fcgroup.com","subsanacion_requerida","2026-04-11"]];
  return `<div class="page wide">
    ${pageHead({ title:"Notificaciones", sub:"Registro de emails enviados por el sistema." })}
    ${filterBar(`${fselect("Estado",["Todos","Pendiente","Enviado","Fallido"])}${fselect("Plantilla",["Todas","solicitud_enviada","solicitud_aprobada"])}${finput("Destinatario","Email…","200px")}${ffield("Desde",`<input class="input" type="date">`)}<div class="field"><label>&nbsp;</label><button class="btn btn-ghost btn-sm">${ic("x")} Limpiar</button></div>`)}
    <div style="height:16px"></div>
    ${tableCard({ cols:[{label:"Destinatario"},{label:"Plantilla"},{label:"Estado"},{label:"Reintentos",cls:"num"},{label:"Creado"},{label:"Enviado"},{label:"Acciones",cls:"actions"}], rows, foot:`<span>${DB.notificaciones.length} registros</span>${pager(1,4)}` })}
    <div class="card" style="margin-top:18px">
      <div class="card-head"><h3>Desuscripciones</h3><span class="muted">${unsub.length} registros</span></div>
      <div class="card-body" style="padding:8px 12px">${unsub.map(u=>`<div class="list-row"><span class="kpi-ic tint-warn" style="width:30px;height:30px">${ic("bell-off")}</span><div style="flex:1"><div style="font-weight:550;font-size:13px">${u[0]}</div><div class="cellsub mono">${u[1]} · ${u[2]}</div></div><button class="btn btn-sm btn-secondary">${ic("rotate-ccw")} Resetear</button></div>`).join("")}</div>
    </div>
  </div>`;
});

modal("notif-preview", (a)=> modalShell({
  icon:"mail", tint:"primary", title:"Vista previa del email", sub:`Para: ${a?.dest||""}`,
  body:`<div class="kv" style="margin-bottom:14px"><div class="kv-row"><span class="kv-k">Plantilla</span><span class="kv-v mono">${a?.pl||""}</span></div><div class="kv-row"><span class="kv-k">Asunto</span><span class="kv-v">Tu solicitud SOL-1042 ha sido recibida</span></div></div>
  <div class="card" style="background:var(--surface-2);padding:16px;font-size:13px;color:var(--text-2);line-height:1.6;white-space:pre-wrap">Hola Carlos,

Hemos recibido tu solicitud SOL-1042 "Falla intermitente en tablero principal". Nuestro equipo la revisará y te notificaremos cualquier actualización.

— Galería Central</div>`,
  foot:`<button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>`
}));

/* ---------------- 24. Configuración ---------------- */
page("/admin/configuracion", { shell:"admin", nav:"config" }, ()=>{
  const slaMatrix = ()=>{
    const tipos=["Mantenimiento","Evento","Remodelación","Otro"];
    const dias={Mantenimiento:[2,2,3,5,7,10],Evento:[3,4,5,6,8,10],"Remodelación":[5,6,8,10,12,15],Otro:[4,5,6,8,10,12]};
    const cls=v=>v<3?"red":v<=7?"amber":"green";
    return `<table class="sla-matrix"><thead><tr><th>Tipo \\ Prioridad</th>${["A","B","C","D","E","F"].map(p=>`<th>${p}</th>`).join("")}</tr></thead><tbody>${tipos.map(t=>`<tr><td>${t}</td>${dias[t].map(v=>`<td><span class="sla-cell ${cls(v)}">${v}d</span></td>`).join("")}</tr>`).join("")}</tbody></table>`;
  };
  return `<div class="page">
    ${pageHead({ title:"Configuración", sub:"Ajustes de la plaza · branding, SLA, adjuntos y calendario." })}
    ${tabs([{label:"General",icon:"settings"},{label:"Branding",icon:"palette"},{label:"SLA",icon:"timer"},{label:"Adjuntos",icon:"paperclip"},{label:"Calendario",icon:"calendar-days"}])}

    <div data-tabpanel><div class="card card-pad" style="max-width:480px"><form class="form-grid">
      <div class="field"><label>Nombre comercial</label><input class="input" value="Galería Central"></div>
      <div class="field"><label>Email</label><input class="input" value="ops@galeriacentral.com"></div>
      <div class="field"><label>Teléfono</label><input class="input" value="+503 2222-0000"></div>
      <div class="field"><label>Zona horaria <span class="hint">· fija en v1</span></label><input class="input" value="America/El_Salvador" disabled></div>
      <div class="form-actions"><div class="spacer"></div><button class="btn btn-primary">${ic("check")} Guardar</button></div>
    </form></div></div>

    <div data-tabpanel class="hide"><div class="grid split">
      <div class="card card-pad"><form class="form-grid">
        <div class="field"><label>Color primario</label><div class="input-group"><input type="color" class="swatch" value="#2f62e6" oninput="document.documentElement.style.setProperty('--primary',this.value);document.getElementById('cfg-hex').value=this.value"><input id="cfg-hex" class="input mono" value="#2f62e6"></div><div class="hint">Cambia el acento en vivo en toda la consola.</div></div>
        <div class="field"><label>Logo</label><div class="dropzone" style="padding:18px"><div class="dz-ic">${ic("image")}</div><div style="font-weight:550;font-size:13px">PNG o SVG · máx 2 MB</div></div></div>
        <div class="form-actions"><div class="spacer"></div><button class="btn btn-primary">${ic("check")} Guardar color</button></div>
      </form></div>
      <div class="card card-pad"><b style="font-size:13px">Vista previa</b>
        <div class="brand-preview" style="margin-top:12px"><div class="bp-bar" style="background:var(--primary)"><span style="font-weight:600">P</span> <b style="font-weight:600">Galería Central</b></div><div class="bp-body"><button class="btn btn-primary btn-sm">Botón primario</button><span class="badge b-info"><span class="bdot"></span>Acento</span></div></div>
        <p class="hint" style="margin-top:12px">Prueba distintos colores — el sistema mantiene contraste y armonía con cualquier acento.</p>
      </div>
    </div></div>

    <div data-tabpanel class="hide"><div class="grid split">
      <div class="card card-pad"><b style="font-size:13px">Días por tipo & multiplicador por prioridad</b>
        <div class="form-grid c2" style="margin-top:14px">
          ${["Mantenimiento","Evento","Remodelación","Otro"].map(t=>`<div class="field"><label>${t} (días)</label><input class="input" type="number" value="${({Mantenimiento:2,Evento:3,"Remodelación":5,Otro:4})[t]}"></div>`).join("")}
        </div>
        <div class="form-actions" style="margin-top:14px"><div class="spacer"></div><button class="btn btn-primary">${ic("check")} Guardar SLA</button></div>
      </div>
      <div class="card card-pad"><b style="font-size:13px">Preview Tipo × Prioridad</b><p class="hint" style="margin:4px 0 14px">Días hábiles resultantes · <span style="color:var(--danger-fg)">&lt;3</span> · <span style="color:var(--warn-fg)">3–7</span> · <span style="color:var(--ok-fg)">&gt;7</span></p>${slaMatrix()}</div>
    </div></div>

    <div data-tabpanel class="hide"><div class="card card-pad" style="max-width:520px">
      <b style="font-size:13px">Tipos MIME permitidos</b>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:14px 0">
        ${["PDF","JPG","PNG","WebP","XLS","XLSX","DOCX","DWG"].map((m,i)=>`<label class="check"><input type="checkbox" ${i<6?"checked":""}> ${m}</label>`).join("")}
      </div>
      <div class="field" style="max-width:200px"><label>Tamaño máximo (MB)</label><input class="input" type="number" value="10"></div>
      <div class="form-actions" style="margin-top:14px"><div class="spacer"></div><button class="btn btn-primary">${ic("check")} Guardar adjuntos</button></div>
    </div></div>

    <div data-tabpanel class="hide"><div class="card card-pad" style="max-width:480px">
      <label class="check" style="justify-content:space-between"><span><b style="font-weight:600;font-size:13px">Mostrar hitos contractuales</b><br><span class="hint">Inicios, vencimientos y renovaciones en el calendario.</span></span><span class="switch on"></span></label>
      <div class="form-actions" style="margin-top:18px"><div class="spacer"></div><button class="btn btn-primary">${ic("check")} Guardar calendario</button></div>
    </div></div>
  </div>`;
});

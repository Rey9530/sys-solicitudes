/* ============================================================
   Plazapp — Admin operación: Bandeja (25) + Solicitud detalle (26)
   ============================================================ */

/* ---------------- 25. Bandeja de solicitudes ---------------- */
function solicitudRow(s, opts={}){
  return `<tr>
    <td><a class="cellcode" href="#/admin/solicitudes/${s.codigo}">${s.codigo}</a></td>
    <td><span class="badge b-neutral">${s.tipo}</span></td>
    <td class="lead" style="max-width:240px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.titulo}</td>
    <td class="mono cellsub">${s.local}</td>
    <td>${badgeSolicitud(s.estado)}</td>
    <td>${prioChip(s.prio)}</td>
    ${opts.sla!==false?`<td>${slaCell(s.sla,s.slaLabel)}</td>`:""}
    ${opts.asignada!==false?`<td>${s.asignada==="—"?'<span class="muted">—</span>':`<div class="row" style="gap:7px">${avatar(s.asignada,true)}<span style="font-size:12.5px">${s.asignada.split(" ")[0]}</span></div>`}</td>`:""}
    <td class="cellsub">${s.enviada}</td>
    <td class="cellsub">${s.decision}</td>
  </tr>`;
}

page("/admin/solicitudes", { shell:"admin", nav:"solicitudes" }, ()=>{
  const enCurso = DB.solicitudes.filter(s=>!["aprobada","rechazada","cancelada","borrador"].includes(s.estado));
  const rows = DB.solicitudes.map(s=>solicitudRow(s)).join("");
  return `<div class="page wide">
    ${pageHead({
      title:"Bandeja de solicitudes",
      sub:`${enCurso.length} solicitudes en curso · cola priorizada`,
      actions:`<div class="segment"><button class="on">Todas</button><button>Asignadas a mí</button></div><span class="badge b-neutral">${ic("refresh-cw")} 60 s</span>`
    })}
    ${filterBar(`${fselect("Estado",["Las 3 colas","Enviada","Asignado","En revisión"])}${fselect("Tipo",["Todos","Mantenimiento","Evento","Remodelación","Otro"])}${fselect("Prioridad",["Todas","A","B","C","D","F"])}<div class="field"><label>&nbsp;</label><button class="btn btn-secondary btn-sm">${ic("filter")} Filtrar</button></div>`)}
    <div style="height:16px"></div>
    ${tableCard({
      cols:[{label:"Código"},{label:"Tipo"},{label:"Título"},{label:"Local"},{label:"Estado"},{label:"Prio"},{label:"SLA"},{label:"Asignada"},{label:"Enviada"},{label:"Decisión"}],
      rows, foot:`<span>${DB.solicitudes.length} solicitudes</span>${pager(1,3)}`
    })}
  </div>`;
});

/* ---------------- 26. Solicitud — detalle (admin) ---------------- */
page("/admin/solicitudes/:id", { shell:"admin", nav:"solicitudes" }, (p)=>{
  const s = DB.solicitudes.find(x=>x.codigo===p.id) || DB.solicitudes[0];
  const esCreador = false;

  const detalle = `
    <div class="card card-pad">
      <h3 style="font-size:15px;font-weight:600;margin-bottom:10px">Descripción</h3>
      <p style="color:var(--text-2);line-height:1.65">El tablero principal del local presenta cortes intermitentes de energía, especialmente en horas pico. Se requiere inspección y posible reemplazo de breakers. La falla afecta refrigeradores y el sistema de punto de venta.</p>
      <div class="divider"></div>
      <dl class="dl c2">
        <div><div class="dt">Solicitante</div><div class="dd">Carlos Méndez · Café Aroma</div></div>
        <div><div class="dt">Local</div><div class="dd mono">${s.local}</div></div>
        <div><div class="dt">Categoría</div><div class="dd">Mantenimiento eléctrico</div></div>
        <div><div class="dt">Subcategoría</div><div class="dd">Tableros y breakers</div></div>
        <div><div class="dt">Área afectada</div><div class="dd">Cocina / cuarto eléctrico</div></div>
        <div><div class="dt">Requiere ingreso</div><div class="dd">Sí · coordinación previa</div></div>
        <div><div class="dt">Enviada</div><div class="dd">${s.enviada}</div></div>
        <div><div class="dt">Decisión</div><div class="dd">${s.decision}</div></div>
      </dl>
    </div>`;

  const comentarios = `
    <div class="card card-pad">
      <div style="display:flex;flex-direction:column;gap:16px;margin-bottom:18px">
        ${DB.comentarios.map(c=>`<div class="row" style="align-items:flex-start;gap:12px">
          ${avatar(c.who)}
          <div style="flex:1"><div class="row" style="gap:8px"><b style="font-size:13px">${c.who}</b><span class="badge ${c.tipo==='Interno'?'b-warn':'b-info'}" style="font-size:10px;padding:2px 7px">${c.tipo}</span><span class="tl-time">${c.time}</span></div><p style="color:var(--text-2);margin-top:5px;font-size:13.5px;line-height:1.55">${c.body}</p></div>
        </div>`).join("")}
      </div>
      <div class="divider"></div>
      <div class="field"><label>Nuevo comentario</label><textarea class="textarea" placeholder="Comentario para el inquilino…" maxlength="4000"></textarea></div>
      <div class="form-actions" style="justify-content:flex-end;margin-top:12px"><button class="btn btn-primary">${ic("send")} Comentar</button></div>
    </div>`;

  const historial = `
    <div class="card card-pad">
      <div class="timeline">
        ${DB.timeline.map(t=>`<div class="tl-item">
          <div class="tl-dot">${ic(t.icon)}</div>
          <div class="tl-head"><b>${t.ev}</b><span class="tl-time">${t.time}</span></div>
          <div class="tl-body">${t.who}${t.body?` · ${t.body}`:""}</div>
        </div>`).join("")}
      </div>
    </div>`;

  const adjuntos = `<div style="max-width:100%">${adjuntosBlock(["PDF","JPG","PNG","WebP","XLSX","DOCX","DWG"],2)}</div>`;

  const actionPanel = `
    <div class="card action-panel">
      <h4>Panel de decisión</h4>
      <p class="ap-sub">Estás asignado a esta solicitud.</p>
      <div class="action-stack">
        <button class="btn btn-success btn-block" onclick="openModal('decision',{tipo:'aprobar'})">${ic("check-circle-2")} Aprobar</button>
        <button class="btn btn-danger btn-block" onclick="openModal('decision',{tipo:'rechazar'})">${ic("x-circle")} Rechazar</button>
        <button class="btn btn-secondary btn-block" onclick="openModal('decision',{tipo:'subsanar'})">${ic("file-edit")} Pedir subsanación</button>
      </div>
      <div class="divider" style="margin:16px 0"></div>
      <div class="kv">
        <div class="kv-row"><span class="kv-ic">${ic("flag")}</span><span class="kv-k">Prioridad</span><span class="kv-v">${prioChip(s.prio)} <button class="btn btn-sm btn-ghost" style="padding:0 6px">${ic("chevron-down")}</button></span></div>
        <div class="kv-row"><span class="kv-ic">${ic("user-check")}</span><span class="kv-k">Asignada a</span><span class="kv-v">${s.asignada}</span></div>
        <div class="kv-row"><span class="kv-ic">${ic("timer")}</span><span class="kv-k">SLA</span><span class="kv-v">${slaCell(s.sla,s.slaLabel)}</span></div>
      </div>
      <div class="divider" style="margin:16px 0"></div>
      <div class="row wrap" style="gap:8px">
        <button class="btn btn-sm btn-secondary" onclick="openModal('reasignar')">${ic("repeat")} Reasignar</button>
        <button class="btn btn-sm btn-ghost">${ic("unlock")} Liberar</button>
        <button class="btn btn-sm btn-ghost" style="color:var(--danger-fg)">${ic("ban")} Cancelar</button>
      </div>
    </div>`;

  return `<div class="page wide">
    ${pageHead({
      breadcrumb:[{label:"Solicitudes",href:"/admin/solicitudes"},{label:s.codigo}],
      title:s.codigo,
      badges:`${badgeSolicitud(s.estado)} ${prioChip(s.prio)} ${slaCell(s.sla,s.slaLabel)}`,
      sub:`${s.titulo} · ${s.local} · ${s.inquilino} · Asignada a ${s.asignada}`,
      actions: s.estado==="enviada"?`<button class="btn btn-primary" onclick="openModal('reasignar')">${ic("hand")} Tomar</button>`:""
    })}
    ${esCreador?`<div class="banner banner-danger" style="margin-bottom:18px">${ic("shield-alert")}<div><b>SC-4:</b> eres el creador de esta solicitud — no puedes aprobarla ni rechazarla.</div></div>`:""}
    <div class="detail-grid">
      <div>
        ${tabs([{label:"Detalle",icon:"file-text"},{label:"Comentarios",icon:"message-square",count:2},{label:"Historial",icon:"history",count:5},{label:"Adjuntos",icon:"paperclip",count:2}])}
        <div data-tabpanel>${detalle}</div>
        <div data-tabpanel class="hide">${comentarios}</div>
        <div data-tabpanel class="hide">${historial}</div>
        <div data-tabpanel class="hide">${adjuntos}</div>
      </div>
      <div class="side-panel">${actionPanel}</div>
    </div>
  </div>`;
});

modal("decision", (a)=>{
  const cfg = {
    aprobar:{icon:"check-circle-2",tint:"ok",title:"Aprobar solicitud",btn:"Aprobar",bcls:"btn-success",req:false,ph:"Comentario opcional para el inquilino…"},
    rechazar:{icon:"x-circle",tint:"danger",title:"Rechazar solicitud",btn:"Rechazar",bcls:"btn-danger-solid",req:true,ph:"Explica el motivo del rechazo (obligatorio)…"},
    subsanar:{icon:"file-edit",tint:"warn",title:"Pedir subsanación",btn:"Solicitar subsanación",bcls:"btn-primary",req:true,ph:"Indica qué debe corregir el inquilino (obligatorio)…"},
  }[a?.tipo||"aprobar"];
  return modalShell({
    icon:cfg.icon, tint:cfg.tint, title:cfg.title,
    sub:"Esta decisión se notifica al inquilino y queda en el historial.",
    body:`<div class="field"><label>Comentario ${cfg.req?'<span class="req">*</span>':'<span class="hint">· opcional</span>'}</label><textarea class="textarea" placeholder="${cfg.ph}"></textarea></div>`,
    foot:`<button class="btn btn-ghost" onclick="closeModal()">Cancelar</button><button class="btn ${cfg.bcls}" onclick="closeModal()">${ic(cfg.icon)} ${cfg.btn}</button>`
  });
});

modal("reasignar", ()=> modalShell({
  icon:"repeat", tint:"primary",
  title:"Reasignar solicitud", sub:"Transfiere la solicitud a otro miembro del staff.",
  body:`<div class="form-grid">
    <div class="field"><label>Asignar a</label><select class="select">${DB.staff.map(s=>`<option>${s.name} · ${s.rol}</option>`).join("")}</select></div>
    <div class="field"><label>Motivo</label><textarea class="textarea" placeholder="Motivo de la reasignación…"></textarea></div>
  </div>`,
  foot:`<button class="btn btn-ghost" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="closeModal()">${ic("check")} Reasignar</button>`
}));

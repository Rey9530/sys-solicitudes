/* ============================================================
   Plazapp — Inquilino: solicitudes, wizard, contratos, calendario (30–37)
   ============================================================ */

/* ---------------- 31. Mis solicitudes ---------------- */
page("/inquilino/solicitudes", { shell:"inquilino", nav:"i-solicitudes" }, ()=>{
  const mine = DB.solicitudes;
  const rows = mine.map(s=>`<tr>
    <td><a class="cellcode" href="#/inquilino/solicitudes/${s.codigo}">${s.codigo}</a></td>
    <td><span class="badge b-neutral">${s.tipo}</span></td>
    <td class="lead" style="max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.titulo}</td>
    <td class="mono cellsub">${s.local}</td>
    <td>${badgeSolicitud(s.estado)}</td>
    <td>${prioChip(s.prio)}</td>
    <td class="cellsub">${s.enviada}</td>
    <td class="cellsub">${s.decision}</td>
  </tr>`).join("");
  return `<div class="page">
    ${pageHead({ title:"Mis solicitudes", sub:`${mine.length} solicitudes`, actions:`<a class="btn btn-primary" href="#/inquilino/solicitudes/nueva">${ic("plus")} Nueva solicitud</a>` })}
    ${filterBar(`${fselect("Estado",["Todos","Borrador","Enviada","En revisión","Aprobada","Rechazada"])}${fselect("Tipo",["Todos","Mantenimiento","Evento","Remodelación","Otro"])}${fselect("Prioridad",["Todas","A","B","C","D","F"])}<div class="field"><label>&nbsp;</label><button class="btn btn-secondary btn-sm">${ic("filter")} Filtrar</button></div>`)}
    <div style="height:16px"></div>
    ${tableCard({ cols:[{label:"Código"},{label:"Tipo"},{label:"Título"},{label:"Local"},{label:"Estado"},{label:"Prio"},{label:"Enviada"},{label:"Decisión"}], rows, foot:`<span>${mine.length} solicitudes</span>${pager(1,2)}` })}
  </div>`;
});

/* ---------------- 32. Nueva solicitud — wizard ---------------- */
function wizardStepper(active){
  const steps=[["Tipo y categoría","Clasifica tu solicitud"],["Detalles","Describe la necesidad"],["Adjuntos y revisión","Confirma y envía"]];
  return `<div class="stepper">${steps.map((s,i)=>{
    const cls = i+1<active?"done":i+1===active?"active":"";
    return `${i>0?`<div class="step-line ${i<active?'done-line':''}"></div>`:""}<div class="step ${cls}" style="flex:none"><div class="num">${i+1<active?'<i data-lucide="check" style="width:15px;height:15px"></i>':i+1}</div><div class="lab"><b>${s[0]}</b><span>${s[1]}</span></div></div>`;
  }).join("")}</div>`;
}

function wizardScreen(editMode){
  return `<div class="page narrow">
    ${pageHead({
      breadcrumb:[{label:"Mis solicitudes",href:"/inquilino/solicitudes"},{label:editMode?"Editar":"Nueva"}],
      title: editMode?"Editar solicitud":"Nueva solicitud",
      sub: editMode?"Modo edición · borrador / subsanación":"Crea una solicitud para tu local en 3 pasos."
    })}
    <div id="wz-stepper">${wizardStepper(1)}</div>

    <div class="card card-pad" data-wz="1">
      <h3 style="font-size:15px;font-weight:600;margin-bottom:16px">Tipo y categoría</h3>
      <div class="field" style="margin-bottom:16px"><label>Tipo de solicitud <span class="req">*</span></label>
        <div class="type-grid">
          ${[["Mantenimiento","wrench"],["Evento","party-popper"],["Remodelación","hammer"],["Otro","more-horizontal"]].map((t,i)=>`<label class="type-opt ${i===0?'sel':''}"><input type="radio" name="tipo" ${i===0?'checked':''} onchange="wzType('${t[0]}')" hidden><span class="kpi-ic tint-primary">${ic(t[1])}</span><b>${t[0]}</b></label>`).join("")}
        </div>
      </div>
      <div class="form-grid c2" id="wz-cat">
        <div class="field"><label>Categoría <span class="req">*</span></label><select class="select"><option>Mantenimiento eléctrico</option><option>Climatización (HVAC)</option><option>Plomería</option></select></div>
        <div class="field"><label>Subcategoría <span class="req">*</span></label><select class="select"><option>Tableros y breakers</option><option>Iluminación de local</option></select></div>
      </div>
      <div class="form-actions" style="justify-content:flex-end;margin-top:18px"><button class="btn btn-primary" onclick="wzGo(2)">Siguiente ${ic("arrow-right")}</button></div>
    </div>

    <div class="card card-pad hide" data-wz="2">
      <h3 style="font-size:15px;font-weight:600;margin-bottom:16px">Detalles</h3>
      <div class="form-grid">
        <div class="form-grid c2">
          <div class="field"><label>Local <span class="req">*</span></label><select class="select"><option>L-101 · Café Aroma</option></select></div>
          <div class="field"><label>Título <span class="req">*</span></label><input class="input" placeholder="Resumen breve"></div>
        </div>
        <div class="field"><label>Descripción <span class="req">*</span></label><textarea class="textarea" placeholder="Describe la necesidad con detalle…"></textarea></div>
        <div id="wz-extra-Mantenimiento" class="wz-extra"><div class="form-grid c2"><div class="field"><label>Área afectada <span class="req">*</span></label><input class="input" placeholder="Ej. Cocina"></div><div class="field"><label>&nbsp;</label><label class="check" style="height:40px"><input type="checkbox"> Requiere ingreso al local</label></div></div></div>
        <div id="wz-extra-Evento" class="wz-extra hide"><div class="form-grid c3"><div class="field"><label>Asistentes <span class="req">*</span></label><input class="input" type="number"></div><div class="field"><label>Fecha inicio <span class="req">*</span></label><input class="input" type="date"></div><div class="field"><label>Fecha fin</label><input class="input" type="date"></div></div><div class="row wrap" style="margin-top:12px;gap:18px"><label class="check"><input type="checkbox"> Corte de calle</label><label class="check"><input type="checkbox"> Amplificación</label></div></div>
        <div id="wz-extra-Remodelación" class="wz-extra hide"><div class="form-grid c2"><div class="field"><label>Fecha inicio est. <span class="req">*</span></label><input class="input" type="date"></div><div class="field"><label>Duración (días) <span class="req">*</span></label><input class="input" type="number"></div><div class="field"><label>Empresa constructora <span class="req">*</span></label><input class="input"></div><div class="field"><label>Presupuesto <span class="req">*</span></label><input class="input mono" placeholder="USD 0.00"></div></div></div>
        <div id="wz-extra-Otro" class="wz-extra hide"><div class="field"><label>Categoría libre <span class="req">*</span></label><input class="input" placeholder="Describe la categoría"></div></div>
        <div class="banner banner-warn">${ic("copy")}<div>Hay <b>1 solicitud similar</b> reciente en este local (SOL-1031). Revisa antes de continuar — no es bloqueante.</div></div>
      </div>
      <div class="form-actions" style="margin-top:18px"><button class="btn btn-ghost" onclick="wzGo(1)">${ic("arrow-left")} Atrás</button><div class="spacer"></div><button class="btn btn-primary" onclick="wzGo(3)">Siguiente ${ic("arrow-right")}</button></div>
    </div>

    <div class="card card-pad hide" data-wz="3">
      <h3 style="font-size:15px;font-weight:600;margin-bottom:16px">Adjuntos y revisión</h3>
      <div class="dropzone" style="margin-bottom:18px"><div class="dz-ic">${ic("upload-cloud")}</div><div style="font-weight:550">Arrastra archivos o haz clic para subir</div><div class="cellsub" style="margin-top:4px">PDF, JPG, PNG, WebP, XLSX, DOCX, DWG · máx 10 archivos</div></div>
      <div class="section-label" style="font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--text-muted);margin-bottom:14px">Resumen</div>
      <div class="wz-summary">
        <div><div class="dt" style="font-size:11.5px;color:var(--text-muted);text-transform:uppercase">Tipo</div><div class="dd" style="font-weight:500;margin-top:3px">Mantenimiento</div></div>
        <div><div class="dt" style="font-size:11.5px;color:var(--text-muted);text-transform:uppercase">Local</div><div class="dd" style="font-weight:500;margin-top:3px">L-101 · Café Aroma</div></div>
        <div class="full"><div class="dt" style="font-size:11.5px;color:var(--text-muted);text-transform:uppercase">Categoría</div><div class="dd" style="font-weight:500;margin-top:3px">Mantenimiento eléctrico · Tableros y breakers</div></div>
      </div>
      <div class="form-actions" style="margin-top:22px"><button class="btn btn-ghost" onclick="wzGo(2)">${ic("arrow-left")} Atrás</button><div class="spacer"></div><button class="btn btn-secondary" onclick="location.hash='#/inquilino/solicitudes'">${ic("save")} Guardar borrador</button><button class="btn btn-success" onclick="location.hash='#/inquilino/solicitudes'">${ic("send")} Enviar ahora</button></div>
    </div>
  </div>`;
}

function wzGo(n){
  document.querySelectorAll("[data-wz]").forEach(el=>el.classList.toggle("hide", el.dataset.wz!=String(n)));
  document.getElementById("wz-stepper").innerHTML = wizardStepper(n);
  if(window.lucide) lucide.createIcons();
  window.scrollTo({top:0,behavior:"smooth"});
}
function wzType(t){
  document.querySelectorAll(".type-opt").forEach(o=>o.classList.toggle("sel", o.querySelector("b").textContent===t));
  document.querySelectorAll(".wz-extra").forEach(e=>e.classList.add("hide"));
  document.getElementById("wz-extra-"+t)?.classList.remove("hide");
  document.getElementById("wz-cat").style.display = t==="Otro"?"none":"";
}

page("/inquilino/solicitudes/nueva", { shell:"inquilino", nav:"i-solicitudes" }, ()=> wizardScreen(false));
page("/inquilino/solicitudes/:id/editar", { shell:"inquilino", nav:"i-solicitudes" }, ()=> wizardScreen(true));

/* ---------------- 33. Solicitud — detalle (inquilino) ---------------- */
page("/inquilino/solicitudes/:id", { shell:"inquilino", nav:"i-solicitudes" }, (p)=>{
  const s = DB.solicitudes.find(x=>x.codigo===p.id) || DB.solicitudes[0];
  const acciones = s.estado==="borrador"
    ? `<a class="btn btn-secondary" href="#/inquilino/solicitudes/${s.codigo}/editar">${ic("pencil")} Editar</a><button class="btn btn-success">${ic("send")} Enviar</button>`
    : s.estado==="requerida_subsanacion"
    ? `<a class="btn btn-secondary" href="#/inquilino/solicitudes/${s.codigo}/editar">${ic("pencil")} Editar</a><button class="btn btn-primary">${ic("send")} Reenviar subsanada</button>`
    : `<button class="btn btn-secondary">${ic("copy")} Duplicar</button><button class="btn btn-danger">${ic("ban")} Cancelar</button>`;
  return `<div class="page wide">
    ${pageHead({
      breadcrumb:[{label:"Mis solicitudes",href:"/inquilino/solicitudes"},{label:s.codigo}],
      title:s.codigo,
      badges:`${badgeSolicitud(s.estado)} ${prioChip(s.prio)}`,
      sub:`${s.titulo} · ${s.local} · Asignada a ${s.asignada}`,
      actions:acciones
    })}
    <div class="detail-grid">
      <div>
        ${tabs([{label:"Detalle",icon:"file-text"},{label:"Comentarios",icon:"message-square",count:2},{label:"Historial",icon:"history",count:5},{label:"Adjuntos",icon:"paperclip",count:2}])}
        <div data-tabpanel>
          <div class="card card-pad">
            <h3 style="font-size:15px;font-weight:600;margin-bottom:10px">Descripción</h3>
            <p style="color:var(--text-2);line-height:1.65">El tablero principal del local presenta cortes intermitentes de energía. Se requiere inspección y posible reemplazo de breakers.</p>
            <div class="divider"></div>
            <dl class="dl c2">
              <div><div class="dt">Local</div><div class="dd mono">${s.local}</div></div>
              <div><div class="dt">Categoría</div><div class="dd">Mantenimiento eléctrico</div></div>
              <div><div class="dt">Enviada</div><div class="dd">${s.enviada}</div></div>
              <div><div class="dt">Estado</div><div class="dd">${STATE_SOLICITUD[s.estado].label}</div></div>
            </dl>
          </div>
        </div>
        <div data-tabpanel class="hide">
          <div class="card card-pad">
            ${DB.comentarios.map(c=>`<div class="row" style="align-items:flex-start;gap:12px;margin-bottom:16px">${avatar(c.who)}<div style="flex:1"><div class="row" style="gap:8px"><b style="font-size:13px">${c.who}</b><span class="tl-time">${c.time}</span></div><p style="color:var(--text-2);margin-top:5px;font-size:13.5px">${c.body}</p></div></div>`).join("")}
            <div class="divider"></div>
            <div class="field"><label>Nuevo comentario</label><textarea class="textarea" placeholder="Escribe un comentario…"></textarea></div>
            <div class="form-actions" style="justify-content:flex-end;margin-top:12px"><button class="btn btn-primary">${ic("send")} Comentar</button></div>
          </div>
        </div>
        <div data-tabpanel class="hide"><div class="card card-pad"><div class="timeline">${DB.timeline.map(t=>`<div class="tl-item"><div class="tl-dot">${ic(t.icon)}</div><div class="tl-head"><b>${t.ev}</b><span class="tl-time">${t.time}</span></div><div class="tl-body">${t.who}</div></div>`).join("")}</div></div></div>
        <div data-tabpanel class="hide">${adjuntosBlock(["PDF","JPG","PNG"],2)}</div>
      </div>
      <div class="side-panel">
        <div class="card action-panel">
          <h4>Estado</h4><p class="ap-sub">Seguimiento de tu solicitud</p>
          <div class="kv">
            <div class="kv-row"><span class="kv-ic">${ic("activity")}</span><span class="kv-k">Estado</span><span class="kv-v">${badgeSolicitud(s.estado)}</span></div>
            <div class="kv-row"><span class="kv-ic">${ic("user-check")}</span><span class="kv-k">Asignada</span><span class="kv-v">${s.asignada}</span></div>
            <div class="kv-row"><span class="kv-ic">${ic("flag")}</span><span class="kv-k">Prioridad</span><span class="kv-v">${prioChip(s.prio)}</span></div>
            <div class="kv-row"><span class="kv-ic">${ic("calendar")}</span><span class="kv-k">Enviada</span><span class="kv-v">${s.enviada}</span></div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
});

/* ---------------- 35. Mis contratos ---------------- */
page("/inquilino/contratos", { shell:"inquilino", nav:"i-contratos" }, ()=>{
  const mine = DB.contratos.filter(c=>["c1","c6"].includes(c.id));
  const rows = mine.map(c=>`<tr>
    <td><a class="cellcode" href="#/inquilino/contratos/${c.id}">${c.local}</a></td>
    <td>${c.inicio}</td>
    <td>${c.fin||'<span class="muted">Indefinido</span>'}</td>
    <td class="num mono">${money(c.monto,c.moneda)}</td>
    <td>${badgeContrato(c.estado)}</td>
  </tr>`).join("");
  return `<div class="page">
    ${pageHead({ title:"Mis contratos", sub:`${mine.length} contratos` })}
    ${tableCard({ cols:[{label:"Local"},{label:"Inicio"},{label:"Fin"},{label:"Monto/mes",cls:"num"},{label:"Estado"}], rows })}
  </div>`;
});

/* ---------------- 36. Contrato — detalle (inquilino) ---------------- */
page("/inquilino/contratos/:id", { shell:"inquilino", nav:"i-contratos" }, (p)=>{
  const c = DB.contratos.find(x=>x.id===p.id) || DB.contratos[0];
  return `<div class="page">
    ${breadcrumb([{label:"Mis contratos",href:"/inquilino/contratos"},{label:c.local}])}
    ${pageHead({ title:`Local ${c.local}`, badges:badgeContrato(c.estado), sub:"Contrato de arrendamiento" })}
    <div class="grid split">
      <div class="card card-pad"><dl class="dl">
        <div><div class="dt">Inicio</div><div class="dd">${c.inicio}</div></div>
        <div><div class="dt">Fin</div><div class="dd">${c.fin||"Indefinido"}</div></div>
        <div><div class="dt">Monto / mes</div><div class="dd mono">${money(c.monto,c.moneda)}</div></div>
        <div><div class="dt">Moneda</div><div class="dd">${c.moneda}</div></div>
        <div class="full"><div class="dt">Condiciones</div><div class="dd" style="font-weight:400;color:var(--text-2);white-space:pre-wrap">Renta mensual pagadera los primeros 5 días de cada mes. Mantenimiento de áreas comunes incluido.</div></div>
      </dl></div>
      <div class="card"><div class="card-head"><h3>Contrato firmado</h3><span class="muted">PDF</span></div><div class="card-body" style="display:flex;flex-direction:column;gap:12px">
        <div class="file-row"><span class="file-ic" style="color:var(--danger-fg)">${ic("file-text")}</span><div style="flex:1"><div style="font-weight:550;font-size:13px">contrato-${c.local}.pdf</div><div class="cellsub">1.2 MB</div></div><button class="btn btn-sm btn-ghost">${ic("download")}</button></div>
        <button class="btn btn-secondary btn-sm">${ic("upload")} Subir documento</button>
      </div></div>
    </div>
  </div>`;
});

/* ---------------- 37. Calendario inquilino (read-only) ---------------- */
page("/inquilino/calendario", { shell:"inquilino", nav:"i-calendario" }, ()=> calendarScreen(false));

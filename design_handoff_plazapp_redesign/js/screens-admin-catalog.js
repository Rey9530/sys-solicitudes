/* ============================================================
   Plazapp — Admin catálogo: Locales, Inquilinos, Contratos (11–19)
   ============================================================ */

function formPage({bc, title, sub, body, submit, cancelHref}){
  return `<div class="page narrow">
    ${pageHead({ breadcrumb:bc, title, sub })}
    <div class="card card-pad">
      <form class="form-grid" onsubmit="location.hash='${cancelHref}';return false">
        ${body}
        <div class="form-actions">
          <a class="btn btn-ghost" href="#${cancelHref}">Cancelar</a>
          <div class="spacer"></div>
          <button class="btn btn-primary" type="submit">${submit}</button>
        </div>
      </form>
    </div>
  </div>`;
}

/* ---------------- 11. Locales — listado ---------------- */
page("/admin/locales", { shell:"admin", nav:"locales" }, ()=>{
  const rows = DB.locales.map(l=>`
    <tr>
      <td><a class="cellcode" href="#/admin/locales/${l.id}">${l.codigo}</a></td>
      <td class="lead">${l.nombre==="—"?'<span class="muted">Sin nombre</span>':l.nombre}</td>
      <td>${l.piso}</td>
      <td>${l.sector}</td>
      <td class="num mono">${l.m2.toFixed(1)}</td>
      <td>${badgeLocal(l.estado)}</td>
      <td class="actions"><button class="btn btn-sm btn-ghost" style="color:var(--danger-fg)" onclick="openModal('confirm-desactivar',{name:'${l.codigo}'})">Desactivar</button></td>
    </tr>`).join("");
  return `<div class="page">
    ${pageHead({ title:"Locales", sub:`${DB.locales.length} locales registrados`, actions:`<a class="btn btn-primary" href="#/admin/locales/nuevo">${ic("plus")} Nuevo local</a>` })}
    ${filterBar(`${fselect("Estado",["Todos","Disponible","Alquilado","En mantenimiento","Fuera de servicio"])}${finput("Piso","Ej. 2","110px")}${finput("Sector","Ej. Norte","150px")}<div class="field"><label>&nbsp;</label><button class="btn btn-ghost btn-sm">${ic("x")} Limpiar</button></div>`)}
    <div style="height:16px"></div>
    ${tableCard({
      cols:[{label:"Código"},{label:"Nombre"},{label:"Piso"},{label:"Sector"},{label:"m²",cls:"num"},{label:"Estado"},{label:"Acciones",cls:"actions"}],
      rows, foot:`<span>${DB.locales.length} de ${DB.locales.length}</span>${pager(1,2)}`
    })}
  </div>`;
});

/* ---------------- 12. Local — detalle ---------------- */
page("/admin/locales/:id", { shell:"admin", nav:"locales" }, (p)=>{
  const l = DB.locales.find(x=>x.id===p.id) || DB.locales[0];
  const contratos = DB.contratos.filter(c=>c.local===l.codigo);
  return `<div class="page">
    ${pageHead({
      breadcrumb:[{label:"Locales",href:"/admin/locales"},{label:l.codigo}],
      title:`${l.codigo} · ${l.nombre==="—"?"Sin nombre":l.nombre}`,
      badges: badgeLocal(l.estado),
      sub:`Piso ${l.piso} · Sector ${l.sector} · ${l.m2.toFixed(1)} m²`,
      actions:`<button class="btn btn-secondary">${ic("paperclip")} Adjuntos</button>`
    })}
    ${tabs([{label:"Datos",icon:"file-text"},{label:"Contratos",icon:"file-signature",count:contratos.length},{label:"Adjuntos",icon:"image",count:3},{label:"Solicitudes",icon:"inbox",count:2}])}
    <div data-tabpanel>
      <div class="card card-pad" style="max-width:560px">
        <form class="form-grid">
          <div class="form-grid c2">
            <div class="field"><label>Código</label><input class="input mono" value="${l.codigo}" disabled></div>
            <div class="field"><label>Estado ${l.estado==='alquilado'?'<span class="hint">· bloqueado por contrato vigente</span>':''}</label><select class="select" ${l.estado==='alquilado'?'disabled':''}><option>${STATE_LOCAL[l.estado].label}</option></select></div>
          </div>
          <div class="field"><label>Nombre</label><input class="input" value="${l.nombre==='—'?'':l.nombre}" placeholder="Nombre del local"></div>
          <div class="form-grid c3">
            <div class="field"><label>Metraje (m²)</label><input class="input" type="number" step="0.01" value="${l.m2}"></div>
            <div class="field"><label>Piso</label><input class="input" value="${l.piso}"></div>
            <div class="field"><label>Sector</label><input class="input" value="${l.sector}"></div>
          </div>
          <div class="field"><label>Descripción</label><textarea class="textarea" placeholder="Notas del local…"></textarea></div>
          <div class="form-actions"><div class="spacer"></div><button class="btn btn-primary">${ic("check")} Guardar cambios</button></div>
        </form>
      </div>
      <div class="meta-foot"><span>Creado <b>11 feb 2024</b></span><span>Actualizado <b>2 jun 2026</b></span></div>
    </div>
    <div data-tabpanel class="hide">
      <div class="grid two">${contratos.length?contratos.map(c=>contratoMini(c)).join(""):emptyState({icon:"file-x",title:"Sin contratos",body:"Este local no tiene contratos registrados."})}</div>
    </div>
    <div data-tabpanel class="hide">${adjuntosBlock(["JPEG","PNG","WebP"],3)}</div>
    <div data-tabpanel class="hide">${emptyState({icon:"inbox",title:"Solicitudes del local",body:"Aquí aparecerán las solicitudes asociadas a este local."})}</div>
  </div>`;
});

function contratoMini(c){
  return `<a class="mini-card ${c.estado==='vigente'?'vigente':''}" href="#/admin/contratos/${c.id}">
    <span class="mc-ic">${ic("file-signature")}</span>
    <div class="mc-main"><b>${c.inquilino}</b><span>${c.inicio} → ${c.fin||"Indefinido"} · ${money(c.monto,c.moneda)}/mes</span></div>
    ${badgeContrato(c.estado)}
  </a>`;
}

function adjuntosBlock(types, count){
  const files = Array.from({length:count},(_,i)=>`
    <div class="file-row">
      <span class="file-ic">${ic("file-image")}</span>
      <div style="flex:1"><div style="font-weight:550;font-size:13px">imagen-local-${i+1}.jpg</div><div class="cellsub">${(Math.random()*2+0.4).toFixed(1)} MB · 2 jun 2026</div></div>
      <button class="btn btn-sm btn-ghost">${ic("download")}</button>
      <button class="btn btn-sm btn-ghost" style="color:var(--danger-fg)">${ic("trash-2")}</button>
    </div>`).join("");
  return `<div class="card card-pad" style="max-width:620px;display:flex;flex-direction:column;gap:14px">
    <div class="dropzone"><div class="dz-ic">${ic("upload-cloud")}</div><div style="font-weight:550">Arrastra archivos o haz clic para subir</div><div class="cellsub" style="margin-top:4px">Permitidos: ${types.join(", ")} · máx 10 MB</div></div>
    ${files}
  </div>`;
}

/* ---------------- 13. Nuevo local ---------------- */
page("/admin/locales/nuevo", { shell:"admin", nav:"locales" }, ()=> formPage({
  bc:[{label:"Locales",href:"/admin/locales"},{label:"Nuevo"}],
  title:"Nuevo local", sub:"Se crea en estado «disponible».",
  cancelHref:"/admin/locales", submit:`${ic("check")} Crear local`,
  body:`
    <div class="form-grid c2">
      <div class="field"><label>Código <span class="req">*</span></label><input class="input mono" placeholder="L-101"></div>
      <div class="field"><label>Metraje (m²)</label><input class="input" type="number" step="0.01" placeholder="0.00"></div>
    </div>
    <div class="field"><label>Nombre</label><input class="input" placeholder="Nombre comercial del local"></div>
    <div class="form-grid c2">
      <div class="field"><label>Piso</label><input class="input" placeholder="1"></div>
      <div class="field"><label>Sector</label><input class="input" placeholder="Norte"></div>
    </div>
    <div class="field"><label>Descripción</label><textarea class="textarea" placeholder="Notas opcionales…"></textarea></div>`
}));

/* ---------------- 14. Inquilinos — listado ---------------- */
page("/admin/inquilinos", { shell:"admin", nav:"inquilinos" }, ()=>{
  const rows = DB.inquilinos.map(i=>`
    <tr>
      <td><a class="lead" href="#/admin/inquilinos/${i.id}">${i.razon}</a></td>
      <td><span class="mono cellsub">${i.ident}</span></td>
      <td>${i.contacto}</td>
      <td>${i.email}</td>
      <td class="actions"><button class="btn btn-sm btn-ghost" style="color:var(--danger-fg)" onclick="openModal('confirm-desactivar',{name:'${i.contacto}'})">Desactivar</button></td>
    </tr>`).join("");
  return `<div class="page">
    ${pageHead({ title:"Inquilinos", sub:`${DB.inquilinos.length} inquilinos registrados`, actions:`<a class="btn btn-primary" href="#/admin/inquilinos/nuevo">${ic("plus")} Nuevo inquilino</a>` })}
    ${filterBar(`${finput("Razón social","Buscar…","230px")}${finput("Identificación","RUC / NIT","180px")}<div class="field"><label>&nbsp;</label><button class="btn btn-ghost btn-sm">${ic("x")} Limpiar</button></div>`)}
    <div style="height:16px"></div>
    ${tableCard({ cols:[{label:"Razón social"},{label:"Identificación"},{label:"Contacto"},{label:"Email"},{label:"Acciones",cls:"actions"}], rows, foot:`<span>${DB.inquilinos.length} de ${DB.inquilinos.length}</span>${pager(1,1)}` })}
  </div>`;
});

/* ---------------- 15. Inquilino — detalle ---------------- */
page("/admin/inquilinos/:id", { shell:"admin", nav:"inquilinos" }, (p)=>{
  const it = DB.inquilinos.find(x=>x.id===p.id) || DB.inquilinos[0];
  const contratos = DB.contratos.filter(c=>c.inquilino===it.razon);
  return `<div class="page">
    ${pageHead({
      breadcrumb:[{label:"Inquilinos",href:"/admin/inquilinos"},{label:it.contacto}],
      title:it.razon,
      sub:`ID: ${it.ident}`,
      actions:`<button class="btn btn-secondary" onclick="openModal('alta-usuario',{name:'${it.contacto}',email:'${it.email}'})">${ic("user-plus")} Alta rápida de usuario</button>`
    })}
    ${tabs([{label:"Datos",icon:"file-text"},{label:"Contratos",icon:"file-signature",count:contratos.length},{label:"Solicitudes",icon:"inbox",count:3}])}
    <div data-tabpanel>
      <div class="card card-pad" style="max-width:560px">
        <form class="form-grid">
          <div class="form-grid c2">
            <div class="field"><label>Razón social <span class="hint">· inmutable</span></label><input class="input" value="${it.razon}" disabled></div>
            <div class="field"><label>Identificación <span class="hint">· inmutable</span></label><input class="input mono" value="${it.ident}" disabled></div>
          </div>
          <div class="field"><label>Dirección</label><input class="input" placeholder="Dirección fiscal"></div>
          <div class="form-grid c2">
            <div class="field"><label>Contacto</label><input class="input" value="${it.contacto}"></div>
            <div class="field"><label>Teléfono</label><input class="input" value="${it.tel}"></div>
          </div>
          <div class="field"><label>Email de contacto</label><input class="input" value="${it.email}"></div>
          <div class="form-actions"><button class="btn btn-danger" type="button">${ic("power")} Desactivar</button><div class="spacer"></div><button class="btn btn-primary">${ic("check")} Guardar cambios</button></div>
        </form>
      </div>
    </div>
    <div data-tabpanel class="hide"><div class="grid two">${contratos.map(c=>contratoMini(c)).join("")||emptyState({icon:"file-x",title:"Sin contratos"})}</div></div>
    <div data-tabpanel class="hide">${emptyState({icon:"inbox",title:"Solicitudes del inquilino",body:"Aquí aparecerán las solicitudes de este inquilino."})}</div>
  </div>`;
});

modal("alta-usuario", (a)=> modalShell({
  icon:"user-plus", tint:"primary",
  title:"Alta rápida de usuario", sub:"Crea credenciales de acceso para el inquilino.",
  body:`
    <div class="form-grid">
      <div class="field"><label>Email</label><input class="input" value="${a?.email||""}"></div>
      <div class="field"><label>Nombre</label><input class="input" value="${a?.name||""}"></div>
    </div>
    <div id="alta-result" class="hide" style="margin-top:18px">
      <div class="section-label">Contraseña temporal</div>
      <div class="temp-pass">Pz-9K4w!t2</div>
      <div class="banner banner-warn" style="margin-top:12px">${ic("shield-alert")}<div>Se muestra <b>una sola vez</b>. Compártela de forma segura con el inquilino.</div></div>
    </div>`,
  foot:`<button class="btn btn-ghost" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="document.getElementById('alta-result').classList.remove('hide');this.textContent='Entendido';this.setAttribute('onclick','closeModal()')">${ic("check")} Crear usuario</button>`
}));

/* ---------------- 16. Nuevo inquilino ---------------- */
page("/admin/inquilinos/nuevo", { shell:"admin", nav:"inquilinos" }, ()=> formPage({
  bc:[{label:"Inquilinos",href:"/admin/inquilinos"},{label:"Nuevo"}],
  title:"Nuevo inquilino", sub:"Registra la razón social y los datos de contacto.",
  cancelHref:"/admin/inquilinos", submit:`${ic("check")} Crear inquilino`,
  body:`
    <div class="form-grid c2">
      <div class="field"><label>Razón social <span class="req">*</span></label><input class="input" placeholder="Empresa S.A. de C.V."></div>
      <div class="field"><label>Identificación</label><input class="input mono" placeholder="RUC / NIT"></div>
    </div>
    <div class="field"><label>Dirección</label><input class="input" placeholder="Dirección fiscal"></div>
    <div class="form-grid c2">
      <div class="field"><label>Contacto</label><input class="input" placeholder="Nombre del contacto"></div>
      <div class="field"><label>Teléfono</label><input class="input" placeholder="+503 0000-0000"></div>
    </div>
    <div class="field"><label>Email de contacto</label><input class="input" type="email" placeholder="contacto@empresa.com"></div>`
}));

/* ---------------- 17. Contratos — listado ---------------- */
page("/admin/contratos", { shell:"admin", nav:"contratos" }, ()=>{
  const rows = DB.contratos.map(c=>`
    <tr>
      <td><a class="cellcode" href="#/admin/contratos/${c.id}">${c.local}</a></td>
      <td class="lead">${c.inquilino}</td>
      <td>${c.inicio}</td>
      <td>${c.fin||'<span class="muted">Indefinido</span>'}</td>
      <td class="num mono">${money(c.monto,c.moneda)}</td>
      <td>${badgeContrato(c.estado)}</td>
    </tr>`).join("");
  return `<div class="page">
    ${pageHead({ title:"Contratos", sub:`${DB.contratos.length} contratos · 4 vigentes`, actions:`<a class="btn btn-primary" href="#/admin/contratos/nuevo">${ic("plus")} Nuevo contrato</a>` })}
    ${filterBar(`${fselect("Local",["Todos","L-101","L-102","L-205","L-301"])}${fselect("Inquilino",["Todos","Café Aroma","Óptica Visión","Boutique Lila"])}${fselect("Estado",["Todos","Vigente","Finalizado","Cancelado"])}<div class="field"><label>&nbsp;</label><button class="btn btn-ghost btn-sm">${ic("x")} Limpiar</button></div>`)}
    <div style="height:16px"></div>
    ${tableCard({ cols:[{label:"Local"},{label:"Inquilino"},{label:"Inicio"},{label:"Fin"},{label:"Monto/mes",cls:"num"},{label:"Estado"}], rows, foot:`<span>${DB.contratos.length} de ${DB.contratos.length}</span>${pager(1,1)}` })}
  </div>`;
});

/* ---------------- 18. Contrato — detalle ---------------- */
page("/admin/contratos/:id", { shell:"admin", nav:"contratos" }, (p)=>{
  const c = DB.contratos.find(x=>x.id===p.id) || DB.contratos[0];
  const vence = c.estado==="vigente" && c.fin;
  const banner = vence ? `<div class="banner banner-warn" style="margin-bottom:18px">${ic("calendar-clock")}<div><b>Vence pronto.</b> Este contrato finaliza el ${c.fin} (en 30 días o menos). Considera renovarlo.</div></div>` : "";
  return `<div class="page">
    ${breadcrumb([{label:"Contratos",href:"/admin/contratos"},{label:c.local}])}
    ${banner}
    ${pageHead({
      title:`${c.local} · ${c.inquilino}`,
      badges: badgeContrato(c.estado),
      sub:`Contrato de arrendamiento`,
      actions: c.estado==="vigente" ? `<button class="btn btn-secondary" onclick="openModal('renovar',{c:'${c.id}'})">${ic("refresh-cw")} Renovar</button><button class="btn btn-danger" onclick="openModal('cerrar',{c:'${c.id}'})">${ic("x-circle")} Cerrar contrato</button>` : ""
    })}
    <div class="grid split">
      <div class="card card-pad">
        <dl class="dl">
          <div><div class="dt">Inicio</div><div class="dd">${c.inicio}</div></div>
          <div><div class="dt">Fin</div><div class="dd">${c.fin||"Indefinido"}</div></div>
          <div><div class="dt">Monto / mes</div><div class="dd mono">${money(c.monto,c.moneda)}</div></div>
          <div><div class="dt">Moneda</div><div class="dd">${c.moneda}</div></div>
          <div class="full"><div class="dt">Condiciones</div><div class="dd" style="font-weight:400;color:var(--text-2);white-space:pre-wrap">Renta mensual pagadera los primeros 5 días de cada mes. Incremento anual del 4%. Depósito de garantía equivalente a dos meses de renta. Mantenimiento de áreas comunes incluido.</div></div>
        </dl>
      </div>
      <div class="card">
        <div class="card-head"><h3>Adjuntos</h3><span class="muted">Solo PDF</span></div>
        <div class="card-body" style="display:flex;flex-direction:column;gap:12px">
          <div class="file-row"><span class="file-ic" style="color:var(--danger-fg)">${ic("file-text")}</span><div style="flex:1"><div style="font-weight:550;font-size:13px">contrato-firmado.pdf</div><div class="cellsub">1.2 MB · 1 mar 2024</div></div><button class="btn btn-sm btn-ghost">${ic("download")}</button></div>
          <button class="btn btn-secondary btn-sm">${ic("upload")} Subir PDF</button>
        </div>
      </div>
    </div>
  </div>`;
});

modal("renovar", ()=> modalShell({
  icon:"refresh-cw", tint:"ok",
  title:"Renovar contrato", sub:"Genera un nuevo periodo a partir de las condiciones actuales.",
  body:`<div class="form-grid">
    <div class="form-grid c2">
      <div class="field"><label>Nueva fecha inicio <span class="req">*</span></label><input class="input" type="date" value="2026-06-15"></div>
      <div class="field"><label>Fecha fin</label><input class="input" type="date" value="2027-06-14"></div>
    </div>
    <div class="field"><label>Monto mensual</label><input class="input mono" value="884.00"></div>
    <div class="banner banner-info">${ic("info")}<div>Vista previa: nuevo contrato <b>2026-06-15 → 2027-06-14</b> por <b>USD 884.00</b>/mes.</div></div>
  </div>`,
  foot:`<button class="btn btn-ghost" onclick="closeModal()">Cancelar</button><button class="btn btn-success" onclick="closeModal()">${ic("check")} Renovar</button>`
}));

modal("cerrar", ()=> modalShell({
  icon:"x-circle", tint:"danger",
  title:"Cerrar contrato", sub:"Finaliza o cancela el contrato vigente.",
  body:`<div class="form-grid">
    <div class="field"><label>Tipo de cierre</label><div class="segment" style="width:100%"><button class="on" style="flex:1">Finalizado</button><button style="flex:1">Cancelado</button></div></div>
    <div class="field"><label>Motivo <span class="req">*</span></label><textarea class="textarea" placeholder="Describe el motivo del cierre…"></textarea></div>
    <div class="field"><label>Fecha fin efectiva</label><input class="input" type="date" value="2026-06-07"></div>
  </div>`,
  foot:`<button class="btn btn-ghost" onclick="closeModal()">Cancelar</button><button class="btn btn-danger-solid" onclick="closeModal()">${ic("x-circle")} Cerrar contrato</button>`
}));

/* ---------------- 19. Nuevo contrato ---------------- */
page("/admin/contratos/nuevo", { shell:"admin", nav:"contratos" }, ()=> formPage({
  bc:[{label:"Contratos",href:"/admin/contratos"},{label:"Nuevo"}],
  title:"Nuevo contrato", sub:"Al crear el contrato, el local pasa a «alquilado».",
  cancelHref:"/admin/contratos", submit:`${ic("check")} Crear contrato`,
  body:`
    <div class="form-grid c2">
      <div class="field"><label>Local <span class="req">*</span></label><select class="select"><option>L-118 · Disponible</option><option>L-220 · Disponible</option></select></div>
      <div class="field"><label>Inquilino <span class="req">*</span></label><select class="select"><option>Selecciona…</option>${DB.inquilinos.map(i=>`<option>${i.razon}</option>`).join("")}</select></div>
    </div>
    <div class="form-grid c2">
      <div class="field"><label>Fecha inicio</label><input class="input" type="date"></div>
      <div class="field"><label>Fecha fin</label><input class="input" type="date"></div>
    </div>
    <div class="form-grid c2">
      <div class="field"><label>Monto mensual <span class="req">*</span></label><input class="input mono" placeholder="0.00"></div>
      <div class="field"><label>Moneda</label><input class="input mono" value="USD" maxlength="3"></div>
    </div>
    <div class="field"><label>Condiciones</label><textarea class="textarea" placeholder="Condiciones del contrato…"></textarea></div>`
}));

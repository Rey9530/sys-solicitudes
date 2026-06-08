/* ============================================================
   Plazapp — Admin: Categorías & Subcategorías (20–23)
   ============================================================ */

/* ---------------- 20. Categorías — listado ---------------- */
page("/admin/categorias", { shell:"admin", nav:"categorias" }, ()=>{
  const rows = DB.categorias.map(c=>`
    <tr>
      <td><a class="lead" href="#/admin/categorias/${c.id}">${c.nombre}</a></td>
      <td class="muted" style="max-width:320px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.desc}</td>
      <td>${c.subs}</td>
      <td>${c.activa?'<span class="badge b-ok"><span class="bdot"></span>Activa</span>':'<span class="badge b-neutral"><span class="bdot"></span>Inactiva</span>'}</td>
      <td class="actions">
        <a class="btn btn-sm btn-ghost" href="#/admin/categorias/${c.id}/subcategorias">${ic("list-tree")} Subcategorías</a>
        <button class="btn btn-sm btn-ghost" style="color:var(--danger-fg)" onclick="openModal('confirm-desactivar',{name:'${c.nombre}'})">Desactivar</button>
      </td>
    </tr>`).join("");
  return `<div class="page">
    ${pageHead({ title:"Categorías", sub:`${DB.categorias.length} categorías de solicitud`, actions:`<a class="btn btn-primary" href="#/admin/categorias/nueva">${ic("plus")} Nueva categoría</a>` })}
    ${filterBar(`<div class="field"><label>Buscar</label><div class="inline-icon" style="width:280px">${ic("search")}<input class="input" placeholder="Nombre de categoría…"></div></div>${fselect("Estado",["Activas","Inactivas","Todas"])}<div class="field"><label>&nbsp;</label><button class="btn btn-secondary btn-sm">${ic("filter")} Filtrar</button></div>`)}
    <div style="height:16px"></div>
    ${tableCard({ cols:[{label:"Nombre"},{label:"Descripción"},{label:"Subcat."},{label:"Estado"},{label:"Acciones",cls:"actions"}], rows, foot:`<span>${DB.categorias.length} de ${DB.categorias.length}</span>${pager(1,1)}` })}
  </div>`;
});

/* ---------------- 21. Nueva categoría ---------------- */
page("/admin/categorias/nueva", { shell:"admin", nav:"categorias" }, ()=> formPage({
  bc:[{label:"Categorías",href:"/admin/categorias"},{label:"Nueva"}],
  title:"Nueva categoría", sub:"Agrupa las solicitudes por área de trabajo.",
  cancelHref:"/admin/categorias", submit:`${ic("check")} Crear categoría`,
  body:`
    <div class="field"><label>Nombre <span class="req">*</span></label><input class="input" placeholder="Ej. Mantenimiento eléctrico" maxlength="80"><div class="hint">Máximo 80 caracteres</div></div>
    <div class="field"><label>Descripción</label><textarea class="textarea" placeholder="Describe el alcance de la categoría…" maxlength="500"></textarea><div class="hint">Máximo 500 caracteres</div></div>`
}));

/* ---------------- 22. Categoría — detalle ---------------- */
page("/admin/categorias/:id", { shell:"admin", nav:"categorias" }, (p)=>{
  const c = DB.categorias.find(x=>x.id===p.id) || DB.categorias[0];
  const subsList = DB.subcategorias.map(s=>`
    <div class="list-row">
      <span class="mc-ic" style="width:34px;height:34px">${ic("git-branch")}</span>
      <div style="flex:1;min-width:0"><b style="font-size:13.5px">${s.nombre}</b><div class="cellsub">Responsable: ${s.responsable} · Supervisores: ${s.supervisores}/5</div></div>
      ${prioChip(s.prio)}
    </div>`).join("");
  return `<div class="page">
    ${pageHead({
      breadcrumb:[{label:"Categorías",href:"/admin/categorias"},{label:c.nombre}],
      title:c.nombre,
      badges: c.activa?'<span class="badge b-ok"><span class="bdot"></span>Activa</span>':'<span class="badge b-neutral"><span class="bdot"></span>Inactiva</span>',
      sub:`${c.subs} subcategorías`,
      actions:`<a class="btn btn-primary" href="#/admin/categorias/${c.id}/subcategorias">${ic("list-tree")} Gestionar subcategorías</a>`
    })}
    <div class="grid split">
      <div class="card">
        <div class="card-head"><h3>Editar categoría</h3></div>
        <div class="card-body">
          <form class="form-grid">
            <div class="field"><label>Nombre</label><input class="input" value="${c.nombre}"></div>
            <div class="field"><label>Descripción</label><textarea class="textarea">${c.desc}</textarea></div>
            <div class="form-actions"><div class="spacer"></div><button class="btn btn-primary">${ic("check")} Guardar cambios</button></div>
          </form>
        </div>
      </div>
      <div class="card">
        <div class="card-head"><h3>Subcategorías activas</h3><span class="cnt" style="font-size:11px;font-family:var(--font-mono);background:var(--surface-3);color:var(--text-3);border-radius:99px;padding:2px 7px">${DB.subcategorias.length}</span></div>
        <div class="card-body" style="padding:8px 12px">${subsList}</div>
      </div>
    </div>
  </div>`;
});

/* ---------------- 23. Subcategorías — gestor ---------------- */
page("/admin/categorias/:id/subcategorias", { shell:"admin", nav:"categorias" }, (p)=>{
  const c = DB.categorias.find(x=>x.id===p.id) || DB.categorias[0];
  const rows = DB.subcategorias.map(s=>`
    <tr>
      <td class="lead">${s.nombre}</td>
      <td>${prioChip(s.prio)}</td>
      <td>${s.responsable==="—"?'<span class="muted">Sin asignar</span>':s.responsable}</td>
      <td><span class="badge ${s.supervisores===5?'b-danger':'b-neutral'}">${s.supervisores}/5</span></td>
      <td>${s.activa?'<span class="badge b-ok"><span class="bdot"></span>Activa</span>':'<span class="badge b-neutral"><span class="bdot"></span>Inactiva</span>'}</td>
      <td class="actions">
        <button class="btn btn-sm btn-ghost" onclick="openModal('sub-edit',{name:'${s.nombre}'})" title="Editar">${ic("pencil")}</button>
        <button class="btn btn-sm btn-ghost" onclick="openModal('sub-resp',{name:'${s.nombre}',resp:'${s.responsable}'})" title="Responsable">${ic("user-cog")}</button>
        <button class="btn btn-sm btn-ghost" onclick="openModal('sub-sup',{name:'${s.nombre}',n:${s.supervisores}})" title="Supervisores">${ic("users")}</button>
        <button class="btn btn-sm btn-ghost" style="color:var(--danger-fg)" title="Desactivar">${ic("power")}</button>
      </td>
    </tr>`).join("");
  return `<div class="page">
    ${pageHead({
      breadcrumb:[{label:"Categorías",href:"/admin/categorias"},{label:c.nombre,href:"/admin/categorias/"+c.id},{label:"Subcategorías"}],
      title:`Subcategorías de ${c.nombre}`,
      sub:"Define prioridad, responsable y supervisores por subcategoría.",
      actions:`<button class="btn btn-primary" onclick="openModal('sub-edit',{nuevo:true})">${ic("plus")} Nueva subcategoría</button>`
    })}
    ${tableCard({ cols:[{label:"Nombre"},{label:"Prioridad"},{label:"Responsable"},{label:"Supervisores"},{label:"Estado"},{label:"Acciones",cls:"actions"}], rows, foot:`<span>${DB.subcategorias.length} subcategorías</span>` })}
  </div>`;
});

modal("sub-edit", (a)=> modalShell({
  icon:"git-branch", tint:"primary",
  title:(a?.nuevo?"Nueva subcategoría":"Editar "+(a?.name||"subcategoría")),
  sub:"Las solicitudes de esta subcategoría usarán su prioridad y responsable.",
  body:`<div class="form-grid">
    <div class="field"><label>Nombre <span class="req">*</span></label><input class="input" value="${a?.name||""}" placeholder="Ej. Tableros y breakers" maxlength="80"></div>
    <div class="field"><label>Descripción</label><textarea class="textarea" placeholder="Alcance de la subcategoría…"></textarea></div>
    <div class="form-grid c2">
      <div class="field"><label>Prioridad</label><select class="select"><option>B</option><option>A</option><option>C</option><option>D</option><option>E</option><option>F</option></select></div>
      ${a?.nuevo?`<div class="field"><label>Responsable <span class="req">*</span></label><select class="select">${DB.staff.map(s=>`<option>${s.name}</option>`).join("")}</select></div>`:`<div class="field"><label>&nbsp;</label></div>`}
    </div>
  </div>`,
  foot:`<button class="btn btn-ghost" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="closeModal()">${ic("check")} Guardar</button>`
}));

modal("sub-resp", (a)=> modalShell({
  icon:"user-cog", tint:"primary",
  title:"Responsable", sub:`Subcategoría: ${a?.name||""}`,
  body:`<div class="form-grid">
    <div class="field"><label>Responsable actual</label><div class="row" style="gap:10px">${avatar(a?.resp||"N N",true)}<b>${a?.resp||"Sin asignar"}</b></div></div>
    <div class="field"><label>Nuevo responsable</label><select class="select">${DB.staff.map(s=>`<option>${s.name} · ${s.email}</option>`).join("")}</select></div>
  </div>`,
  foot:`<button class="btn btn-ghost" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="closeModal()">Cambiar responsable</button>`
}));

modal("sub-sup", (a)=> modalShell({
  icon:"users", tint:"primary",
  title:`Supervisores (${a?.n||0}/5)`, sub:`Subcategoría: ${a?.name||""}`,
  body:`
    <div class="section-label" style="border:none;padding-top:0">Actuales</div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${DB.staff.slice(0,a?.n||0).map(s=>`<div class="file-row">${avatar(s.name,true)}<div style="flex:1"><div style="font-weight:550;font-size:13px">${s.name}</div><div class="cellsub">${s.email}</div></div><button class="btn btn-sm btn-ghost" style="color:var(--danger-fg)">${ic("x")} Quitar</button></div>`).join("")||'<div class="muted" style="font-size:13px">Sin supervisores asignados.</div>'}
    </div>
    <div class="section-label">Añadir supervisor</div>
    ${(a?.n||0)>=5
      ? `<div class="banner banner-warn">${ic("info")}<div>Límite de 5 supervisores alcanzado.</div></div>`
      : `<div class="row" style="gap:10px"><select class="select">${DB.staff.map(s=>`<option>${s.name}</option>`).join("")}</select><button class="btn btn-primary">${ic("plus")} Agregar</button></div>`}`,
  foot:`<button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>`
}));

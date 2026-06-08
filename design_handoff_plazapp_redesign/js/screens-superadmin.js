/* ============================================================
   Plazapp — Superadmin: Plazas (8)
   ============================================================ */

page("/superadmin/plazas", { shell:"superadmin", nav:"plazas" }, ()=>{
  const rows = DB.tenants.map(t=>`
    <tr>
      <td>
        <div class="rowdot">
          <span class="dot" style="background:${t.color};box-shadow:0 0 0 3px color-mix(in srgb,${t.color} 18%,transparent)"></span>
          <a class="lead" href="#/superadmin/plazas">${t.name}</a>
        </div>
      </td>
      <td><span class="mono" style="color:var(--text-3)">${t.slug}</span></td>
      <td>${t.contacto}</td>
      <td>${t.creada}</td>
      <td class="actions"><button class="btn btn-sm btn-ghost" style="color:var(--danger-fg)" onclick="openModal('confirm-desactivar',{name:'${t.name}'})">${ic("power")} Desactivar</button></td>
    </tr>`).join("");

  return `<div class="page">
    ${pageHead({
      title:"Plazas",
      sub:"Gestiona los tenants de la plataforma · 5 plazas activas",
      actions:`<button class="btn btn-primary" onclick="openModal('nueva-plaza')">${ic("plus")} Nueva plaza</button>`
    })}
    ${tableCard({
      cols:[{label:"Plaza"},{label:"Slug"},{label:"Contacto"},{label:"Creada"},{label:"Acciones",cls:"actions"}],
      rows,
      foot:`<span>5 de 5 plazas</span>${pager(1,1)}`
    })}
  </div>`;
});

modal("nueva-plaza", ()=> modalShell({
  icon:"building-2", tint:"primary", lg:true,
  title:"Nueva plaza", sub:"Crea un tenant y su administrador inicial.",
  body:`
    <div class="section-label">Datos de la plaza</div>
    <div class="form-grid c2">
      <div class="field"><label>Nombre comercial <span class="req">*</span></label><input class="input" placeholder="Plaza Galería Central" oninput="document.getElementById('np-slug').value=this.value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');document.getElementById('bp-name').textContent=this.value||'Nombre comercial'"></div>
      <div class="field"><label>Slug</label><input id="np-slug" class="input mono" placeholder="plaza-galeria-central"></div>
      <div class="field"><label>Color primario</label><div class="input-group"><input type="color" class="swatch" value="#2f62e6" oninput="document.getElementById('bp-bar').style.background=this.value;document.getElementById('bp-dot').style.background=this.value;document.getElementById('np-hex').value=this.value"><input id="np-hex" class="input mono" value="#2f62e6"></div></div>
      <div class="field"><label>Email de contacto</label><input class="input" type="email" placeholder="contacto@plaza.com"></div>
    </div>
    <div class="field" style="margin-top:14px"><label>Vista previa de marca</label>
      <div class="brand-preview">
        <div class="bp-bar" id="bp-bar" style="background:#2f62e6"><span style="font-weight:600">P</span> <b id="bp-name" style="font-weight:600">Nombre comercial</b></div>
        <div class="bp-body"><span id="bp-dot" class="dot" style="width:10px;height:10px;border-radius:99px;background:#2f62e6"></span><span class="muted" style="font-size:12.5px">Así verán el acento los usuarios de esta plaza</span></div>
      </div>
    </div>
    <div class="section-label">Administrador inicial</div>
    <div class="form-grid c2">
      <div class="field"><label>Nombre <span class="req">*</span></label><input class="input" placeholder="Nombre del administrador"></div>
      <div class="field"><label>Rol</label><select class="select"><option>Supervisor</option><option>Ingeniero</option><option>Técnico</option></select></div>
      <div class="field"><label>Email <span class="req">*</span></label><input class="input" type="email" placeholder="admin@plaza.com"></div>
      <div class="field"><label>Contraseña temporal <span class="req">*</span></label><input class="input mono" value="Pz-7Q2m!x"></div>
    </div>`,
  foot:`<button class="btn btn-ghost" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="closeModal()">${ic("check")} Crear plaza</button>`
}));

modal("confirm-desactivar", (a)=> modalShell({
  icon:"alert-triangle", tint:"danger",
  title:"Desactivar "+(a?.name||"registro"), sub:"Esta acción inhabilita el acceso. Podrás reactivarlo más tarde.",
  body:`<div class="banner banner-danger">${ic("info")}<div>Los usuarios de <b>${a?.name||""}</b> perderán acceso hasta que se reactive. No se eliminan datos.</div></div>`,
  foot:`<button class="btn btn-ghost" onclick="closeModal()">Cancelar</button><button class="btn btn-danger-solid" onclick="closeModal()">${ic("power")} Desactivar</button>`
}));

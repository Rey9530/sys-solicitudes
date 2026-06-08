/* ============================================================
   Plazapp — Public / auth screens (2–5)
   ============================================================ */

function authLayout(formHtml, opts={}){
  return `<div class="auth">
    <aside class="auth-brand">
      <div class="auth-brand-top">
        <div class="auth-logo"><div class="side-logo" style="width:38px;height:38px">P</div><b>Plazapp</b></div>
        <button class="icon-btn" onclick="toggleTheme()" style="color:rgba(255,255,255,.7)">${ic(ST.theme==="dark"?"sun":"moon")}</button>
      </div>
      <div class="auth-brand-mid">
        <h2>La operación de tu plaza,<br>bajo control.</h2>
        <p>Solicitudes, contratos, locales y calendario en una sola consola — con la identidad de cada plaza.</p>
        <div class="auth-feats">
          <span>${ic("shield-check")} Acceso por roles y plaza</span>
          <span>${ic("zap")} Flujos de solicitud con SLA</span>
          <span>${ic("calendar-check")} Calendario operativo en vivo</span>
        </div>
      </div>
      <div class="auth-brand-foot">
        <span class="dot" style="background:var(--primary)"></span> Galería Central · El Salvador
      </div>
    </aside>
    <main class="auth-form-col">
      <div class="auth-card">${formHtml}</div>
      <p class="auth-legal">© 2026 Plazapp · <a href="#/reset-password">¿Olvidaste tu contraseña?</a></p>
    </main>
  </div>`;
}

/* 3 — Login */
page("/login", { shell:"public" }, ()=> authLayout(`
  <div class="auth-head">
    <h1>Inicia sesión</h1>
    <p>Accede a la consola de tu plaza para continuar.</p>
  </div>
  <form class="form-grid" onsubmit="location.hash='#/admin/dashboard';return false">
    <div class="field">
      <label>Correo electrónico</label>
      <div class="inline-icon">${ic("mail")}<input class="input" type="email" placeholder="tucorreo@plazapp.com" value="mfuentes@galeriacentral.com"></div>
    </div>
    <div class="field">
      <label>Contraseña</label>
      <div class="inline-icon">${ic("lock")}<input class="input" type="password" placeholder="••••••••" value="demo1234"></div>
    </div>
    <div class="row" style="justify-content:space-between">
      <label class="check"><input type="checkbox" checked> Recordarme</label>
      <a href="#/reset-password" style="font-size:13px;color:var(--primary);font-weight:550">¿Olvidaste tu contraseña?</a>
    </div>
    <button class="btn btn-primary btn-lg btn-block" type="submit">Iniciar sesión ${ic("arrow-right")}</button>
  </form>
  <div class="auth-roles">
    <span class="muted">Entrar como (demo):</span>
    <a class="btn btn-sm btn-secondary" href="#/admin/dashboard">Admin</a>
    <a class="btn btn-sm btn-secondary" href="#/superadmin/dashboard">Superadmin</a>
    <a class="btn btn-sm btn-secondary" href="#/inquilino/solicitudes">Inquilino</a>
  </div>
`));

/* 4 — Reset request */
page("/reset-password", { shell:"public" }, ()=> authLayout(`
  <div class="auth-head">
    <h1>Restablecer contraseña</h1>
    <p>Te enviaremos un enlace para crear una nueva contraseña.</p>
  </div>
  <form class="form-grid" onsubmit="this.closest('.auth-card').querySelector('.auth-sent').classList.remove('hide');this.classList.add('hide');return false">
    <div class="field">
      <label>Correo electrónico</label>
      <div class="inline-icon">${ic("mail")}<input class="input" type="email" placeholder="tucorreo@plazapp.com"></div>
    </div>
    <button class="btn btn-primary btn-lg btn-block" type="submit">Enviar enlace ${ic("send")}</button>
    <a href="#/login" class="btn btn-ghost btn-block">${ic("arrow-left")} Volver a iniciar sesión</a>
  </form>
  <div class="auth-sent hide">
    <div class="banner banner-ok" style="margin-bottom:18px">${ic("mail-check")}<div>Si el email existe, recibirás un enlace para restablecer tu contraseña. <b>Expira en 30 minutos.</b></div></div>
    <a href="#/login" class="btn btn-secondary btn-block">${ic("arrow-left")} Volver a iniciar sesión</a>
  </div>
`));

/* 5 — Reset confirm */
page("/reset-password/:token", { shell:"public" }, ()=> authLayout(`
  <div class="auth-head">
    <h1>Elige una nueva contraseña</h1>
    <p>Tu enlace es válido. Define una contraseña segura.</p>
  </div>
  <form class="form-grid" onsubmit="location.hash='#/login';return false">
    <div class="field">
      <label>Nueva contraseña</label>
      <div class="inline-icon">${ic("lock")}<input class="input" type="password" placeholder="Mínimo 8 caracteres"></div>
    </div>
    <div class="field">
      <label>Confirmar contraseña</label>
      <div class="inline-icon">${ic("lock")}<input class="input" type="password" placeholder="Repite la contraseña"></div>
    </div>
    <button class="btn btn-primary btn-lg btn-block" type="submit">Restablecer contraseña</button>
  </form>
`));

/* 2 — Home / entry (with session, role chooser) */
page("/", { shell:"public" }, ()=>`
  <div class="home-entry">
    <button class="icon-btn home-theme" onclick="toggleTheme()">${ic(ST.theme==="dark"?"sun":"moon")}</button>
    <div class="auth-card home-card">
      <div class="home-plaza">
        <div class="side-logo" style="width:46px;height:46px;font-size:19px">P</div>
        <div><b>Galería Central</b><span>Plazapp · Consola de gestión</span></div>
      </div>
      <h1 class="home-greet">Hola, María 👋</h1>
      <p class="muted" style="margin-bottom:22px">mfuentes@galeriacentral.com · Admin de plaza</p>
      <div class="home-dest">
        <a class="home-dest-card" href="#/admin/dashboard">
          <span class="kpi-ic tint-primary">${ic("layout-dashboard")}</span>
          <div><b>Entrar como Admin</b><span>Operación, catálogo y reportes de la plaza</span></div>${ic("arrow-right")}
        </a>
        <a class="home-dest-card" href="#/inquilino/solicitudes">
          <span class="kpi-ic tint-ok">${ic("store")}</span>
          <div><b>Portal de inquilino</b><span>Solicitudes, contratos y calendario</span></div>${ic("arrow-right")}
        </a>
        <a class="home-dest-card" href="#/superadmin/dashboard">
          <span class="kpi-ic tint-violet">${ic("building-2")}</span>
          <div><b>Consola de plataforma</b><span>Gestión de todas las plazas (superadmin)</span></div>${ic("arrow-right")}
        </a>
      </div>
      <a href="#/login" class="btn btn-ghost btn-block" style="margin-top:18px">${ic("log-out")} Cerrar sesión</a>
    </div>
  </div>
`);

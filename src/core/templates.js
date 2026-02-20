import { escapeHtml, estadoLabel, estadoBadgeClass, pageUrl } from "./state.js";
import { ESTADOS } from "./keys.js";

export function viewMissingConfig(){
  return `
  <div class="card">
    <h2>Falta configuración</h2>
    <p>Completá <code>config.js</code> con tus credenciales de Supabase.</p>
    <p>Luego recargá la página.</p>
  </div>`;
}

export function homeTemplate({ email, areaName, role }){
  return `
  <div class="card">
    <h2>SIPRA</h2>
    <p><strong>Usuario:</strong> ${escapeHtml(email||"")}</p>
    <p><strong>Área activa:</strong> ${escapeHtml(areaName||"—")}</p>
    <p><strong>Rol:</strong> ${escapeHtml(role||"—")}</p>
    <div class="row">
      <a class="btn" href="#/events">Registro Operativo</a>
      <a class="btn btn-secondary" href="#/admin">Administración</a>
    </div>
    <p class="muted" style="margin-top:12px">Base estable modular v0.7</p>
  </div>`;
}

export function noAccessTemplate(msg){
  return `
  <div class="card">
    <h2>Sin acceso</h2>
    <p>${escapeHtml(msg||"No tenés permisos para continuar.")}</p>
    <a class="btn" href="#/">Volver</a>
  </div>`;
}

export function loginTemplate(flash, email){
  return `
  <div class="card">
    <h2>Iniciar sesión</h2>
    ${flash ? `<div class="flash ${flash.type}">${escapeHtml(flash.text)}</div>` : ""}
    <label>Email</label>
    <input id="email" type="email" placeholder="tu@email" value="${escapeHtml(email||"")}" />
    <label>Contraseña</label>
    <input id="pass" type="password" placeholder="••••••••" />
    <button id="btnLogin" class="btn">Ingresar</button>
  </div>`;
}

export function inviteTemplate(token, flash){
  const link = token ? pageUrl(`/invite?token=${encodeURIComponent(token)}`) : "";
  return `
  <div class="card">
    <h2>Invitación</h2>
    ${flash ? `<div class="flash ${flash.type}">${escapeHtml(flash.text)}</div>` : ""}
    ${token ? `<p>Token: <code>${escapeHtml(token)}</code></p>` : ""}
    ${link ? `<p class="muted">Link: <code>${escapeHtml(link)}</code></p>` : ""}
    <label>Contraseña</label>
    <input id="invitePass" type="password" placeholder="Elegí una contraseña" />
    <button id="btnAcceptInvite" class="btn">Aceptar invitación</button>
    <a class="btn btn-secondary" href="#/login" style="margin-top:10px">Volver</a>
  </div>`;
}

export function adminTemplate({ email, memberships, activeAreaId, flash, inviteLink }){
  const options = (memberships||[]).map(m => `
    <option value="${escapeHtml(m.area_id)}" ${m.area_id===activeAreaId ? "selected" : ""}>
      ${escapeHtml(m.area_name)} — ${escapeHtml(m.role)}
    </option>`).join("");

  return `
  <div class="card">
    <h2>Administración</h2>
    ${flash ? `<div class="flash ${flash.type}">${escapeHtml(flash.text)}</div>` : ""}
    <p><strong>${escapeHtml(email||"")}</strong></p>

    <label>Área activa</label>
    <select id="selArea">${options}</select>

    <div class="row" style="margin-top:12px">
      <button id="btnCopyInvite" class="btn btn-secondary">Copiar link de invitación</button>
      <button id="btnCreateInvite" class="btn">Crear invitación</button>
    </div>

    ${inviteLink ? `<p class="muted" style="margin-top:10px"><code>${escapeHtml(inviteLink)}</code></p>` : ""}

    <div class="row" style="margin-top:14px">
      <a class="btn btn-secondary" href="#/">Inicio</a>
      <button id="btnLogout" class="btn btn-danger">Cerrar sesión</button>
    </div>
  </div>`;
}

export function eventsTemplate({ areaName, role, events, flash }){
  const rows = (events||[]).map(ev => `
    <div class="event-row" data-id="${escapeHtml(ev.id)}">
      <div class="event-main">
        <div class="event-title">${escapeHtml(ev.titulo || "(sin título)")}</div>
        <div class="event-meta">
          <span class="badge ${estadoBadgeClass(ev.estado)}">${estadoLabel(ev.estado)}</span>
          <span class="muted">${escapeHtml(ev.tipo || "—")}</span>
          <span class="muted">${escapeHtml(new Date(ev.fecha_evento || ev.created_at).toLocaleString())}</span>
        </div>
      </div>
      <div class="event-actions">
        <button class="btn btn-secondary btnView">Ver</button>
      </div>
    </div>
  `).join("");

  return `
  <div class="card">
    <h2>Registro Operativo</h2>
    <p class="muted">${escapeHtml(areaName||"")} — ${escapeHtml(role||"")}</p>
    ${flash ? `<div class="flash ${flash.type}">${escapeHtml(flash.text)}</div>` : ""}
    <div class="row">
      <button id="btnNewEvent" class="btn">Nuevo evento</button>
      <a class="btn btn-secondary" href="#/">Inicio</a>
    </div>
    <div class="events-list" style="margin-top:12px">
      ${rows || `<p class="muted">Sin eventos aún.</p>`}
    </div>
  </div>

  <!-- Modal foto -->
  <div id="photoModal" class="modal hidden">
    <div class="modal-inner">
      <button id="photoModalClose" class="btn btn-secondary">Cerrar</button>
      <img id="photoModalImg" alt="Foto" />
    </div>
  </div>

  <!-- Modal evento -->
  <div id="eventModal" class="modal hidden">
    <div class="modal-inner wide">
      <div id="eventModalBody"></div>
    </div>
  </div>
  `;
}

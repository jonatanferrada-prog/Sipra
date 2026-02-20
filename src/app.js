// SIPRA – Core estable (v0.7.9)
// Base robusta: estado único, rutas por hash, modales en stack,
// invitaciones por token (sin email) + membresías por área.

const APP_VERSION = "0.7.9";

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// -----------------------------
// Helpers
// -----------------------------

const qs = (sel, el = document) => el.querySelector(sel);
const qsa = (sel, el = document) => Array.from(el.querySelectorAll(sel));
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));

function formatDate(dateStr) {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString();
  } catch {
    return String(dateStr);
  }
}

function nowIso() {
  return new Date().toISOString();
}

function showBootError(msg) {
  try {
    window.__sipraShowBootError && window.__sipraShowBootError(msg);
  } catch {}
  console.error(msg);
}

// -----------------------------
// Config + Supabase
// -----------------------------

function getConfig() {
  const cfg = window.SIPRA_CONFIG || {};
  return {
    url: (cfg.SUPABASE_URL || "").trim(),
    key: (cfg.SUPABASE_ANON_KEY || "").trim(),
    photoBucket: (cfg.EVENT_PHOTO_BUCKET || "event_photos").trim(),
  };
}

function hasValidConfig(cfg) {
  return Boolean(cfg.url) && Boolean(cfg.key);
}

// -----------------------------
// App State
// -----------------------------

const LS_ACTIVE_AREA = "sipra.active_area_id";

const state = {
  cfg: getConfig(),
  sb: null,
  user: null,
  memberships: [], // [{area_id, role, area_name}]
  activeAreaId: null,
  activeAreaName: null,
  activeRole: null,
  events: [],
  ui: {
    busy: false,
    // modales
    detailOpen: false,
    photoOpen: false,
    detailEvent: null,
    photoUrl: null,
  },
};

// -----------------------------
// Router
// -----------------------------

function route() {
  const raw = window.location.hash || "#/";
  const hash = raw.startsWith("#") ? raw.slice(1) : raw;
  const [path, query] = hash.split("?");
  return { path: path || "/", params: new URLSearchParams(query || "") };
}

function go(path) {
  window.location.hash = "#" + path;
}

// -----------------------------
// Views
// -----------------------------

function viewMissingConfig() {
  return `
    <div class="h1">Config incompleta</div>
    <p class="p">Editá <span class="pill">config.js</span> y pegá tu <strong>SUPABASE_URL</strong> y <strong>SUPABASE_ANON_KEY</strong>.</p>
  `;
}

function viewLogin(msg = null, email = "") {
  const note = msg ? `<div class="${msg.type === "error" ? "warn" : "notice"}">${esc(msg.text)}</div>` : "";
  return `
    <div class="h1">Ingreso</div>
    <p class="p">Ingresá con tu usuario.</p>
    ${note}
    <div class="field">
      <label>Email</label>
      <input id="loginEmail" type="email" placeholder="tu@email.com" value="${esc(email)}" />
    </div>
    <div class="field">
      <label>Contraseña</label>
      <input id="loginPass" type="password" placeholder="••••••••" />
    </div>
    <div class="actions">
      <button class="btn btnPrimary" id="btnLogin">Entrar</button>
      <button class="btn" id="btnHaveInvite">Tengo link/token</button>
    </div>
    <div class="hr"></div>
    <div class="small">v${APP_VERSION}</div>
  `;
}

function viewHome() {
  return `
    <div class="h1">Inicio</div>
    <p class="p">Sesión: <strong>${esc(state.user?.email || "")}</strong></p>
    <div class="row">
      <span class="pill">Área: ${esc(state.activeAreaName || state.activeAreaId || "—")}</span>
      <span class="pill">Rol: ${esc(state.activeRole || "—")}</span>
    </div>
    <div class="actions">
      <a class="btn btnPrimary" href="#/events">Eventos</a>
      <a class="btn" href="#/admin">Administración</a>
      <button class="btn btnDanger" id="btnLogout">Salir</button>
    </div>
  `;
}

function areaSelectHtml() {
  if (!state.memberships.length) return "";
  const opts = state.memberships
    .map((m) => {
      const name = m.area_name || m.area_id;
      const sel = m.area_id === state.activeAreaId ? "selected" : "";
      return `<option value="${esc(m.area_id)}" ${sel}>${esc(name)} (${esc(m.role)})</option>`;
    })
    .join("");
  return `
    <div class="row" style="justify-content:space-between; gap:12px; margin-bottom:10px">
      <div class="small">Área activa</div>
      <select id="areaSelect" style="min-width:220px">${opts}</select>
    </div>
  `;
}

function viewEvents() {
  const rows = state.events
    .map((ev) => {
      const thumb = ev.foto_url ? `<img class="thumb" src="${esc(ev.foto_url)}" alt="foto" />` : "";
      const fecha = ev.fecha_evento ? formatDate(ev.fecha_evento) : ev.created_at ? new Date(ev.created_at).toLocaleString() : "—";
      return `
        <tr>
          <td>${thumb}</td>
          <td>
            <div><strong>${esc(ev.titulo || "(sin título)")}</strong></div>
            <div class="small">${esc(ev.tipo || "—")} · ${esc(fecha)}</div>
          </td>
          <td><span class="pill">${esc((ev.estado || "abierto").toLowerCase())}</span></td>
          <td><button class="btn" data-open="${esc(ev.id)}">Abrir</button></td>
        </tr>
      `;
    })
    .join("");

  return `
    <div class="row" style="justify-content:space-between; align-items:flex-end">
      <div>
        <div class="h1">Eventos</div>
        <p class="p">Registro operativo del área.</p>
      </div>
      <div class="row">
        <button class="btn btnPrimary" id="btnNew">Nuevo</button>
        <button class="btn" id="btnRefresh">Actualizar</button>
      </div>
    </div>
    ${areaSelectHtml()}
    <div id="eventsMsg"></div>
    <table class="table">
      <thead><tr><th></th><th>Evento</th><th>Estado</th><th></th></tr></thead>
      <tbody>${rows || `<tr><td colspan="4" class="small">Sin registros todavía.</td></tr>`}</tbody>
    </table>
  `;
}

function viewAdmin() {
  const canInvite = state.activeRole === "admin" || state.activeRole === "coordinacion";
  return `
    <div class="h1">Administración</div>
    <p class="p">Invitaciones por token.</p>
    ${areaSelectHtml()}
    ${canInvite ? "" : `<div class="warn">Tu rol actual no puede crear invitaciones.</div>`}
    <div class="field">
      <label>Rol a asignar</label>
      <select id="inviteRole" ${canInvite ? "" : "disabled"}>
        <option value="agente">agente</option>
        <option value="admin">admin</option>
        <option value="visor">visor</option>
      </select>
    </div>
    <div class="actions">
      <button class="btn btnPrimary" id="btnInvite" ${canInvite ? "" : "disabled"}>Crear invitación</button>
      <a class="btn" href="#/events">Volver</a>
    </div>
    <div class="hr"></div>
    <div id="inviteOut"></div>
  `;
}

function viewInvite(token, msg = null) {
  const note = msg ? `<div class="${msg.type === "error" ? "warn" : "notice"}">${esc(msg.text)}</div>` : "";
  return `
    <div class="h1">Invitación</div>
    <p class="p">Unite a un área con token.</p>
    ${note}
    <div class="code">token=${esc(token || "")}</div>
    <div class="actions">
      <button class="btn btnPrimary" id="btnAccept">Aceptar</button>
      <a class="btn" href="#/login">Volver</a>
    </div>
  `;
}

function viewInviteOk(areaName, role) {
  return `
    <div class="h1">Listo</div>
    <div class="notice">Te uniste a <strong>${esc(areaName || "el área")}</strong> como <strong>${esc(role)}</strong>.</div>
    <div class="actions">
      <a class="btn btnPrimary" href="#/events">Ir a eventos</a>
      <a class="btn" href="#/">Inicio</a>
    </div>
  `;
}

function viewNoAccess(msg) {
  return `
    <div class="h1">Sin acceso</div>
    <div class="warn">${esc(msg || "No tenés permisos.")}</div>
    <div class="actions"><a class="btn" href="#/login">Volver</a></div>
  `;
}

// -----------------------------
// Modales (stack)
// -----------------------------

function openDetail(ev) {
  state.ui.detailOpen = true;
  state.ui.detailEvent = ev;
  renderModals();
}

function closeDetail() {
  state.ui.detailOpen = false;
  state.ui.detailEvent = null;
  state.ui.photoOpen = false;
  state.ui.photoUrl = null;
  renderModals();
}

function openPhoto(url) {
  state.ui.photoOpen = true;
  state.ui.photoUrl = url;
  renderModals();
}

function closePhoto() {
  state.ui.photoOpen = false;
  state.ui.photoUrl = null;
  renderModals();
}

function renderModals() {
  const modal = qs("#eventModal");
  const body = qs("#eventModalBody");
  const photoModal = qs("#photoModal");
  const photoImg = qs("#photoModalImg");
  const photoOpen = qs("#photoModalOpen");

  // Detail
  if (state.ui.detailOpen && state.ui.detailEvent && !state.ui.detailEvent.__create) {
    const ev = state.ui.detailEvent;
    const foto = ev.foto_url
      ? `<div style="margin-top:10px"><img class="thumb" id="detailThumb" style="width:140px;height:100px;cursor:pointer" src="${esc(ev.foto_url)}" alt="foto" /></div>`
      : `<div class="small" style="margin-top:10px">Sin foto</div>`;

    body.innerHTML = `
      <div class="h2">${esc(ev.titulo || "(sin título)")}</div>
      <div class="small">${esc(ev.tipo || "—")} · ${esc(formatDate(ev.fecha_evento) || "—")}</div>
      <div class="hr"></div>
      <div class="row" style="justify-content:space-between">
        <div class="small"><strong>Estado</strong></div>
        <select id="detailEstado" style="min-width:180px">
          ${["abierto","seguimiento","cerrado"].map((s) => `<option value="${s}" ${String(ev.estado||"abierto").toLowerCase()===s?"selected":""}>${s}</option>`).join("")}
        </select>
      </div>
      <div class="field" style="margin-top:10px">
        <label>Descripción</label>
        <div style="white-space:pre-wrap;line-height:1.45">${esc(ev.descripcion || "")}</div>
      </div>
      ${foto}
      <div class="actions">
        <button class="btn btnPrimary" id="btnSaveEstado">Guardar estado</button>
        <button class="btn" id="btnCloseDetail">Cerrar</button>
      </div>
    `;

    modal.classList.remove("hidden");

    qs("#btnCloseDetail")?.addEventListener("click", closeDetail);
    qs("#eventModalClose")?.addEventListener("click", closeDetail);
    qsa(".eventModal__backdrop").forEach((b) => b.addEventListener("click", closeDetail));

    qs("#detailThumb")?.addEventListener("click", () => ev.foto_url && openPhoto(ev.foto_url));
    qs("#btnSaveEstado")?.addEventListener("click", async () => {
      const estado = (qs("#detailEstado")?.value || "abierto").toLowerCase();
      await updateEstado(ev.id, estado);
    });
  } else {
    if (!state.ui.detailOpen) modal?.classList.add("hidden");
  }

  // Photo
  if (state.ui.photoOpen && state.ui.photoUrl) {
    if (photoImg) photoImg.src = state.ui.photoUrl;
    if (photoOpen) photoOpen.href = state.ui.photoUrl;
    photoModal?.classList.remove("hidden");
  } else {
    photoModal?.classList.add("hidden");
    if (photoImg) photoImg.src = "";
  }

  qs("#photoModalClose")?.addEventListener("click", closePhoto);
  qsa(".photoModal__backdrop").forEach((b) => b.addEventListener("click", closePhoto));
}

// -----------------------------
// Data
// -----------------------------

async function refreshUser() {
  const { data } = await state.sb.auth.getSession();
  state.user = data?.session?.user || null;
}

async function memberships() {
  // Try join areas(name)
  let res = await state.sb.from("area_members").select("area_id, role, areas(name)").eq("user_id", state.user.id);
  if (res.error) res = await state.sb.from("area_members").select("area_id, role").eq("user_id", state.user.id);
  if (res.error) throw res.error;
  return (res.data || []).map((r) => ({ area_id: r.area_id, role: r.role, area_name: r.areas?.name || null }));
}

function pickArea(ms) {
  const stored = localStorage.getItem(LS_ACTIVE_AREA);
  if (stored && ms.some((m) => m.area_id === stored)) return stored;
  return ms[0]?.area_id || null;
}

async function fetchEvents() {
  const { data, error } = await state.sb
    .from("events")
    .select("*")
    .eq("area_id", state.activeAreaId)
    .order("created_at", { ascending: false })
    .limit(250);
  if (error) throw error;
  return data || [];
}

async function updateEstado(id, estado) {
  const { error } = await state.sb.from("events").update({ estado }).eq("id", id);
  if (error) {
    alert("No se pudo actualizar: " + error.message);
    return;
  }
  state.events = state.events.map((e) => (e.id === id ? { ...e, estado } : e));
  if (state.ui.detailEvent?.id === id) state.ui.detailEvent = { ...state.ui.detailEvent, estado };
  await render();
  renderModals();
}

async function uploadPhoto(file) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${state.activeAreaId}/${state.user.id}/${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`;
  const { error: upErr } = await state.sb.storage.from(state.cfg.photoBucket).upload(path, file, { upsert: false });
  if (upErr) throw upErr;
  const { data } = state.sb.storage.from(state.cfg.photoBucket).getPublicUrl(path);
  return data?.publicUrl || null;
}

async function insertEvent(payload) {
  const { data, error } = await state.sb.from("events").insert(payload).select("*").single();
  if (error) throw error;
  return data;
}

async function createInvite(role) {
  const token = crypto.randomUUID();
  const payload = { area_id: state.activeAreaId, role, token, created_by: state.user.id };
  const { error } = await state.sb.from("invitations").insert(payload);
  if (error) throw error;
  return token;
}

async function acceptInvite(token) {
  const invRes = await state.sb
    .from("invitations")
    .select("id, area_id, role, accepted_at, areas(name)")
    .eq("token", token)
    .maybeSingle();
  if (invRes.error) throw invRes.error;
  const inv = invRes.data;
  if (!inv) throw new Error("Token inválido.");
  if (inv.accepted_at) throw new Error("Este token ya fue usado.");

  const mem = { area_id: inv.area_id, user_id: state.user.id, role: inv.role, joined_at: nowIso() };
  let m = await state.sb.from("area_members").upsert(mem, { onConflict: "area_id,user_id" });
  if (m.error) {
    m = await state.sb.from("area_members").insert(mem);
    if (m.error) throw m.error;
  }

  const { error: accErr } = await state.sb.from("invitations").update({ accepted_at: nowIso(), accepted_by: state.user.id }).eq("id", inv.id);
  if (accErr) throw accErr;

  return { areaId: inv.area_id, areaName: inv.areas?.name || null, role: inv.role };
}

// -----------------------------
// UI binders
// -----------------------------

function mount(html) {
  const app = qs("#app");
  if (app) app.innerHTML = html;
}

function bindLogin() {
  qs("#btnLogin")?.addEventListener("click", async () => {
    const email = (qs("#loginEmail")?.value || "").trim().toLowerCase();
    const pass = qs("#loginPass")?.value || "";
    if (!email || !pass) {
      mount(viewLogin({ type: "error", text: "Completá email y contraseña." }, email));
      bindLogin();
      return;
    }
    const { error } = await state.sb.auth.signInWithPassword({ email, password: pass });
    if (error) {
      mount(viewLogin({ type: "error", text: error.message }, email));
      bindLogin();
      return;
    }
    await bootAfterAuth();
  });

  qs("#btnHaveInvite")?.addEventListener("click", () => {
    const raw = prompt("Pegá token o link:") || "";
    const token = raw.includes("token=") ? new URLSearchParams((raw.split("?")[1] || "")).get("token") : raw.trim();
    if (token) go(`/invite?token=${encodeURIComponent(token)}`);
  });
}

async function bootAfterAuth() {
  await refreshUser();
  if (!state.user) {
    go("/login");
    return;
  }

  state.memberships = await memberships();
  if (!state.memberships.length) {
    mount(viewNoAccess("Tu usuario no está asignado a ningún área."));
    return;
  }

  state.activeAreaId = pickArea(state.memberships);
  localStorage.setItem(LS_ACTIVE_AREA, state.activeAreaId);
  const m = state.memberships.find((x) => x.area_id === state.activeAreaId) || state.memberships[0];
  state.activeRole = m.role;
  state.activeAreaName = m.area_name;

  state.events = await fetchEvents();
  go("/events");
}

function bindLogout() {
  qs("#btnLogout")?.addEventListener("click", async () => {
    await state.sb.auth.signOut();
    state.user = null;
    state.memberships = [];
    state.events = [];
    go("/login");
  });
}

function bindAreaSelect() {
  qs("#areaSelect")?.addEventListener("change", async (e) => {
    state.activeAreaId = e.target.value;
    localStorage.setItem(LS_ACTIVE_AREA, state.activeAreaId);
    const m = state.memberships.find((x) => x.area_id === state.activeAreaId);
    state.activeRole = m?.role || null;
    state.activeAreaName = m?.area_name || null;
    state.events = await fetchEvents();
    await render();
  });
}

function openCreateModal() {
  state.ui.detailOpen = true;
  state.ui.detailEvent = { __create: true };

  const modal = qs("#eventModal");
  const body = qs("#eventModalBody");
  modal.classList.remove("hidden");

  const tipos = ["incidente", "patrullaje", "monitoreo", "varamiento", "pesca", "mantenimiento", "educacion", "observacion"];
  body.innerHTML = `
    <div class="h2">Nuevo evento</div>
    <div class="field"><label>Tipo</label><select id="evTipo">${tipos.map((t) => `<option value="${t}">${t}</option>`).join("")}</select></div>
    <div class="field"><label>Título</label><input id="evTitulo" placeholder="Ej: Patrullaje zona norte" /></div>
    <div class="field"><label>Descripción</label><textarea id="evDesc" placeholder="Qué pasó, dónde, evidencia, acciones…"></textarea></div>
    <div class="row">
      <div class="field" style="flex:1; min-width:220px"><label>Fecha</label><input id="evFecha" type="date" /></div>
      <div class="field" style="flex:1; min-width:220px"><label>Estado</label>
        <select id="evEstado"><option value="abierto">abierto</option><option value="seguimiento">seguimiento</option><option value="cerrado">cerrado</option></select>
      </div>
    </div>
    <div class="field"><label>Foto (cámara o galería)</label><input id="evFoto" type="file" accept="image/*" />
      <img id="evPreview" class="thumb hidden" style="width:120px;height:90px;margin-top:8px" alt="preview" />
    </div>
    <div class="actions">
      <button class="btn btnPrimary" id="btnSaveEvent">Guardar</button>
      <button class="btn" id="btnCancel">Cancelar</button>
    </div>
  `;

  // default date today
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  qs("#evFecha").value = `${yyyy}-${mm}-${dd}`;

  qs("#btnCancel")?.addEventListener("click", closeDetail);
  qs("#eventModalClose")?.addEventListener("click", closeDetail);
  qsa(".eventModal__backdrop").forEach((b) => b.addEventListener("click", closeDetail));

  qs("#evFoto")?.addEventListener("change", (ev) => {
    const file = ev.target.files?.[0];
    const img = qs("#evPreview");
    if (!file) {
      img.classList.add("hidden");
      img.src = "";
      return;
    }
    img.classList.remove("hidden");
    img.src = URL.createObjectURL(file);
  });

  qs("#btnSaveEvent")?.addEventListener("click", async () => {
    try {
      const tipo = qs("#evTipo")?.value || "incidente";
      const titulo = (qs("#evTitulo")?.value || "").trim();
      const descripcion = (qs("#evDesc")?.value || "").trim();
      const fecha_evento = qs("#evFecha")?.value || null;
      const estado = (qs("#evEstado")?.value || "abierto").toLowerCase();
      const file = qs("#evFoto")?.files?.[0] || null;

      if (!titulo) {
        alert("Poné un título.");
        return;
      }

      let foto_url = null;
      if (file) foto_url = await uploadPhoto(file);

      const evInserted = await insertEvent({
        area_id: state.activeAreaId,
        user_id: state.user.id,
        tipo,
        titulo,
        descripcion,
        fecha_evento,
        estado,
        foto_url,
      });

      state.events = [evInserted, ...state.events];
      closeDetail();
      await render();
    } catch (e) {
      alert("No se pudo guardar: " + (e?.message || String(e)));
    }
  });
}

function bindEvents() {
  qs("#btnNew")?.addEventListener("click", openCreateModal);
  qs("#btnRefresh")?.addEventListener("click", async () => {
    state.events = await fetchEvents();
    await render();
  });
  bindAreaSelect();
  qsa("button[data-open]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-open");
      const ev = state.events.find((x) => x.id === id);
      if (ev) openDetail(ev);
    });
  });
  renderModals();
}

function bindAdmin() {
  qs("#btnInvite")?.addEventListener("click", async () => {
    const out = qs("#inviteOut");
    if (out) out.innerHTML = "";
    try {
      const role = qs("#inviteRole")?.value || "agente";
      const token = await createInvite(role);
      const link = `${location.origin}${location.pathname}#/invite?token=${encodeURIComponent(token)}`;
      out.innerHTML = `
        <div class="notice"><strong>Invitación creada</strong></div>
        <div class="field"><label>Link</label><input id="inviteLink" value="${esc(link)}" readonly /></div>
        <div class="actions"><button class="btn btnPrimary" id="btnCopy">Copiar link</button></div>
      `;
      qs("#btnCopy")?.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(link);
          alert("Copiado.");
        } catch {
          alert("Copialo a mano.");
        }
      });
    } catch (e) {
      out.innerHTML = `<div class="warn">No se pudo crear: ${esc(e?.message || String(e))}</div>`;
    }
  });
  bindAreaSelect();
}

function bindInvite(token) {
  qs("#btnAccept")?.addEventListener("click", async () => {
    await refreshUser();
    if (!state.user) {
      go(`/login?token=${encodeURIComponent(token)}`);
      return;
    }
    try {
      const info = await acceptInvite(token);
      state.memberships = await memberships();
      state.activeAreaId = info.areaId;
      localStorage.setItem(LS_ACTIVE_AREA, state.activeAreaId);
      const m = state.memberships.find((x) => x.area_id === state.activeAreaId);
      state.activeRole = m?.role || info.role;
      state.activeAreaName = m?.area_name || info.areaName;
      mount(viewInviteOk(state.activeAreaName, state.activeRole));
    } catch (e) {
      mount(viewInvite(token, { type: "error", text: e?.message || String(e) }));
      bindInvite(token);
    }
  });
}

// -----------------------------
// Render
// -----------------------------

async function render() {
  // version badge
  try {
    const v = qs("#sipra-version");
    if (v) v.textContent = `v${APP_VERSION}`;
  } catch {}

  state.cfg = getConfig();
  if (!hasValidConfig(state.cfg)) {
    mount(viewMissingConfig());
    return;
  }

  if (!state.sb) state.sb = createClient(state.cfg.url, state.cfg.key);

  await refreshUser();

  const { path, params } = route();

  // login?token= -> invite
  if (path === "/login" && params.get("token")) {
    go(`/invite?token=${encodeURIComponent(params.get("token"))}`);
    return;
  }

  if (path === "/login") {
    mount(viewLogin());
    bindLogin();
    return;
  }

  if (path === "/invite") {
    const token = params.get("token") || "";
    if (!token) {
      mount(viewInvite("", { type: "error", text: "Falta token." }));
      return;
    }
    mount(viewInvite(token));
    bindInvite(token);
    return;
  }

  if (!state.user) {
    go("/login");
    return;
  }

  // memberships
  if (!state.memberships.length) {
    try {
      state.memberships = await memberships();
    } catch (e) {
      mount(viewNoAccess(e?.message || String(e)));
      return;
    }
    if (!state.memberships.length) {
      mount(viewNoAccess("Tu usuario no está asignado a ningún área."));
      return;
    }
    state.activeAreaId = pickArea(state.memberships);
    localStorage.setItem(LS_ACTIVE_AREA, state.activeAreaId);
    const m = state.memberships.find((x) => x.area_id === state.activeAreaId) || state.memberships[0];
    state.activeRole = m.role;
    state.activeAreaName = m.area_name;
  }

  if (path === "/") {
    mount(viewHome());
    bindLogout();
    return;
  }

  if (path === "/admin") {
    mount(viewAdmin());
    bindAdmin();
    return;
  }

  // events default
  if (!state.events.length || path === "/events") {
    try {
      state.events = await fetchEvents();
    } catch {}
  }
  mount(viewEvents());
  bindEvents();
}

window.addEventListener("hashchange", () => {
  render().catch((e) => showBootError(e?.message || String(e)));
});

render().catch((e) => showBootError(e?.message || String(e)));

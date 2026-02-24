import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

(function(){
  const $app = document.getElementById('app');
  document.getElementById('year').textContent = new Date().getFullYear();

  const cfg = window.SIPRA_CONFIG || {};
  const SUPABASE_URL = (cfg.SUPABASE_URL || "").trim();
  const SUPABASE_ANON_KEY = (cfg.SUPABASE_ANON_KEY || "").trim();
  const hasConfig = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
  const supabase = hasConfig ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

  const LS_PENDING_INVITE = "sipra_pending_invite_token";
  const LS_ACTIVE_AREA = "sipra_active_area_id";
  const BUCKET_PRIMARY = "event-photos";
  const BUCKET_FALLBACK = "event_photos";
  const BUCKET = BUCKET_PRIMARY; // Storage bucket

  const LS_EVENT_DRAFT = "sipra_event_draft";

  
  const ESTADOS = ["abierto","en_seguimiento","derivado","cerrado"];
  function normalizeEstado(s){
    const v = (s||"").toString().trim().toLowerCase();
    if(v === "en seguimiento") return "en_seguimiento";
    if(ESTADOS.includes(v)) return v;
    return "abierto";
  }
  function estadoLabel(v){
    const n = normalizeEstado(v);
    return n === "abierto" ? "Abierto"
      : n === "en_seguimiento" ? "En seguimiento"
      : n === "derivado" ? "Derivado"
      : n === "cerrado" ? "Cerrado"
      : "Abierto";
  }
  function estadoBadgeClass(v){
    const n = normalizeEstado(v);
    return n === "abierto" ? "badge--abierto"
      : n === "en_seguimiento" ? "badge--seguimiento"
      : n === "derivado" ? "badge--derivado"
      : "badge--cerrado";
  }

  function loadEventDraft(){
    try { return JSON.parse(localStorage.getItem(LS_EVENT_DRAFT) || "{}") || {}; }
    catch(e){ return {}; }
  }
  function saveEventDraft(patch){
    const cur = loadEventDraft();
    const next = { ...cur, ...patch, _ts: Date.now() };
    localStorage.setItem(LS_EVENT_DRAFT, JSON.stringify(next));
    return next;
  }
  function clearEventDraft(){
    localStorage.removeItem(LS_EVENT_DRAFT);
  }
  function setVal(id, v){
    const el = document.getElementById(id);
    if(el && typeof v !== "undefined" && v !== null) el.value = v;
  }
  function getVal(id){
    const el = document.getElementById(id);
    return el ? el.value : "";
  }
  function setPreview(url, opts = {}){
  const box = document.getElementById("evFotoPreview");
  const btn = document.getElementById("btnClearFoto");
  if(!box) return;
  const label = opts.label || "";
  if(url){
    const safe = escapeHtml(url);
    box.innerHTML = `
      <div class="previewRow">
        <img class="thumbPreview" src="${safe}" alt="foto" />
        <div>
          <div class="small">${escapeHtml(label || "Foto lista ✓")}</div>
          <a href="${safe}" target="_blank" rel="noopener">Ver</button></div>
      </div>
    `;
    if(btn) btn.style.display = "inline-block";
  } else {
    box.textContent = "";
    if(btn) btn.style.display = "none";
  }
}

  function escapeHtml(s){
    return (s||'').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function pageUrl(){ return window.location.origin + window.location.pathname; }
  async function normalizeImageFile(file){
    if(!file) return file;
    const name = file.name || '';
    const lower = name.toLowerCase();
    const isHeic = (file.type === 'image/heic' || file.type === 'image/heif' || lower.endsWith('.heic') || lower.endsWith('.heif'));
    if(!isHeic) return file;

    if(typeof heic2any !== 'function'){
      throw new Error('La foto está en HEIC y este navegador no puede convertirla. Probá sacar la foto en modo JPG o elegir otra desde galería.');
    }
    const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 });
    const outBlob = Array.isArray(converted) ? converted[0] : converted;
    const outName = (name ? name.replace(/\.(heic|heif)$/i, '.jpg') : 'foto.jpg');
    return new File([outBlob], outName, { type: 'image/jpeg' });
  }

  
    function bindPhotoThumbs(root){
      root.querySelectorAll('.photoThumbBtn').forEach(btn=>{
        btn.addEventListener('click', ()=> openPhotoModal(btn.dataset.url));
      });
    }
function openPhotoModal(url){
    const modal = document.getElementById('photoModal');
    const img = document.getElementById('photoModalImg');
    const a = document.getElementById('photoModalOpen');
    if(!modal || !img || !a) return;
    img.src = url;
    a.href = url;
    modal.classList.remove('hidden');
  }
  function closePhotoModal(){
    const modal = document.getElementById('photoModal');
    const img = document.getElementById('photoModalImg');
    if(!modal) return;
    modal.classList.add('hidden');
    if(img) img.src = '';
  }


function initPhotoModalHandlers(){
  // Open modal when tapping the thumbnail/link in the table
  document.addEventListener('click', (ev) => {
    const a = ev.target.closest && ev.target.closest('a.photoLink');
    if (!a) return;
    ev.preventDefault();
    const url = a.getAttribute('data-url') || a.getAttribute('href');
    openPhotoModal(url);
  });

  // Close modal on button or backdrop
  const closeBtn = document.getElementById('photoModalClose');
  const backdrop = document.querySelector('#photoModal .photoModal__backdrop');
  if (closeBtn) closeBtn.addEventListener('click', closePhotoModal);
  if (backdrop) backdrop.addEventListener('click', closePhotoModal);

  // ESC closes
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') closePhotoModal();
  });
}

// A) Downscale & compress before upload (más rápido y menos consumo en campo)
async function downscaleImage(file, opts = {}){
  const maxDim = opts.maxDim || 1600;      // límite de lado mayor
  const quality = opts.quality || 0.82;    // JPEG quality
  // Si es muy liviana, no la tocamos
  if (file.size && file.size < 450 * 1024) return file;

  const src = await fileToDataURL(file);
  const img = await loadImage(src);

  let {width:w, height:h} = img;
  const scale = Math.min(1, maxDim / Math.max(w, h));
  const tw = Math.round(w * scale);
  const th = Math.round(h * scale);

  const canvas = document.createElement('canvas');
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, tw, th);

  // Convertimos a JPEG por compatibilidad (HEIC ya se normaliza antes)
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  const nameBase = (file.name || 'foto').replace(/\.[^.]+$/, '');
  const out = new File([blob], `${nameBase}.jpg`, { type: 'image/jpeg' });
  return out;
}

function loadImage(src){
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function fileToDataURL(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}


  function route(){
    const hash = window.location.hash || "#/";
    const [pathPart, queryPart] = hash.replace(/^#/, "").split("?");
    return { path: pathPart || "/", params: new URLSearchParams(queryPart || "") };
  }
  function setHash(path){ window.location.hash = "#" + path; }

  function viewMissingConfig(){
    return `
      <h1 class="h1">Falta configurar Supabase</h1>
      <div class="warn">Editá <b>config.js</b> y completá <b>SUPABASE_URL</b> y <b>SUPABASE_ANON_KEY</b>.</div>
    `;
  }

  async function getSession(){
    if(!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session || null;
  }
  async function signOut(){ await supabase.auth.signOut(); setHash("/login"); }

  async function myMemberships(){
    const { data, error } = await supabase
      .from("area_memberships")
      // En la BD, la tabla 'areas' usa columnas 'nombre' y 'codigo'
      .select("role, area_id, areas(nombre, codigo)")
      .order("created_at", { ascending: true });
    if(error) throw error;
    return data || [];
  }

  function pickActiveAreaId(memberships){
    const saved = localStorage.getItem(LS_ACTIVE_AREA);
    if(saved && memberships.some(m => m.area_id === saved)) return saved;
    const first = memberships[0]?.area_id || "";
    if(first) localStorage.setItem(LS_ACTIVE_AREA, first);
    return first;
  }

  function homeTemplate(session, memberships){
    const email = session?.user?.email || "";
    const activeAreaId = pickActiveAreaId(memberships);
    const active = memberships.find(m => m.area_id === activeAreaId) || memberships[0];
    const areaName = active?.areas?.nombre || "(sin área)";
    const role = active?.role || "(sin rol)";

    const areaOptions = memberships.map(m => {
      const name = m.areas?.nombre || m.area_id;
      const selected = (m.area_id === activeAreaId) ? "selected" : "";
      return `<option value="${escapeHtml(m.area_id)}" ${selected}>${escapeHtml(name)}</option>`;
    }).join("");

    return `
      <div data-role="${escapeHtml(role)}" data-area-id="${escapeHtml(activeAreaId)}" class="row" style="justify-content:space-between">
        <div>
          <h1 class="h1">Inicio</h1>
          <div class="small">Usuario: <b>${escapeHtml(email)}</b> · <span class="pill">${escapeHtml(role)}</span></div>
        </div>
        <div class="actions">
          <a class="btn btnPrimary" href="#/events">Registrar evento</a>
          <a class="btn" href="#/admin">Admin</a>
          <button class="btn btnDanger" id="btnSignOut">Salir</button>
        </div>
      </div>

      <div class="notice">
        Área activa: <b>${escapeHtml(areaName)}</b>
        ${memberships.length > 1 ? `
          <div class="field" style="margin-top:10px;">
            <label>Cambiar área</label>
            <select id="areaSelect">${areaOptions}</select>
          </div>
        ` : ""}
      </div>

      <div class="hr"></div>
      <p class="p">SIPRA v0.7.1 · Login y áreas (compatibilidad con columnas <i>nombre/codigo</i>).</p>
    `;
  }

  function noAccessTemplate(session){
    const email = session?.user?.email || "";
    return `
      <h1 class="h1">Sin acceso asignado</h1>
      <p class="p">Tu cuenta está activa (<b>${escapeHtml(email)}</b>), pero todavía no tenés acceso a un área.</p>
      <div class="actions"><a class="btn btnPrimary" href="#/login">Volver</button></div>
    `;
  }

  function loginTemplate(msg, emailValue=""){
    return `
      <h1 class="h1">Ingreso</h1>
      ${msg ? `<div class="${msg.type==='error'?'warn':'notice'}">${escapeHtml(msg.text)}</div>` : ""}
      <div class="field"><label>Email</label><input id="email" value="${escapeHtml(emailValue)}" autocomplete="email" /></div>
      <div class="field"><label>Contraseña</label><input id="pass" type="password" autocomplete="current-password" /></div>
      <div class="actions">
        <button class="btn btnPrimary" id="btnLogin">Ingresar</button>
        <a class="btn" href="#/">Inicio</button></div>
      <div class="hr"></div>
      <div class="small">Usuarios se crean en Supabase → Authentication → Users.</div>
    `;
  }

  function inviteTemplate(token, statusMsg){
    const masked = token ? (token.length <= 12 ? token : token.slice(0,6) + '…' + token.slice(-6)) : "(sin token)";
    return `
      <h1 class="h1">Aceptar invitación</h1>
      <div class="field"><label>Token</label><div class="code">${escapeHtml(masked)}</div></div>
      ${statusMsg ? `<div class="${statusMsg.type==='error'?'warn':'notice'}">${escapeHtml(statusMsg.text)}</div>` : ""}
      <div class="actions">
        <button class="btn btnPrimary" id="btnAccept">Aceptar</button>
        <a class="btn" href="#/">Inicio</button></div>
      <div class="small">Si no estás logueado, primero te manda a Ingreso y guarda el token.</div>
    `;
  }

  function adminTemplate(memberships, msg, inviteLink){
    const isAdmin = memberships.some(m => m.role === 'admin');
    const firstArea = memberships.find(m => m.role === 'admin') || memberships[0];
    return `
      <div class="row" style="justify-content:space-between">
        <div><h1 class="h1">Panel Admin</h1><div class="small">Invitaciones (token/link)</div></div>
        <div class="actions"><a class="btn" href="#/">Inicio</a><button class="btn btnDanger" id="btnSignOut">Salir</button></div>
      </div>
      ${msg ? `<div class="${msg.type==='error'?'warn':'notice'}">${escapeHtml(msg.text)}</div>` : ""}
      ${!isAdmin ? `
        <div class="warn">No sos admin de ningún área.</div>
      ` : `
        <div class="notice">Área admin: <b>${escapeHtml(firstArea?.areas?.nombre || '')}</b></div>
        <div class="field"><label>Email del invitado</label><input id="invEmail" autocomplete="email" /></div>
        <div class="field"><label>Rol</label>
          <select id="invRole">
            <option value="agent">agent</option>
            <option value="viewer">viewer</option>
            <option value="admin">admin</option>
          </select>
        </div>
        <div class="actions"><button class="btn btnPrimary" id="btnCreateInvite">Crear invitación</button></div>
        ${inviteLink ? `
          <div class="field">
            <label>Link para copiar</label>
            <div class="code" id="inviteLink">${escapeHtml(inviteLink)}</div>
            <div class="actions"><button class="btn" id="btnCopy">Copiar link</button></div>
          </div>
        ` : ""}
      `}
    `;
  }

  function eventsTemplate(session, memberships, areaId, msg, rows){
    const active = memberships.find(m => m.area_id === areaId) || memberships[0];
    const areaName = active?.areas?.nombre || "(sin área)";
    const role = active?.role || "";
    const today = new Date().toISOString().slice(0,10);

    const table = (rows && rows.length) ? `
      <table class="table" aria-label="Eventos">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Tipo</th>
            <th>Estado</th>
            <th>Título</th>
            <th>Descripción</th>
            <th>Foto</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td>${escapeHtml(r.fecha || '')}</td>
              <td><span class="pill">${escapeHtml(r.tipo || '')}</span></td>
              <td><span class="badge ${estadoBadgeClass(r.estado)}" data-badge-event-id="${escapeHtml(r.id)}">${estadoLabel(r.estado)}</span></td>
              <td><span class="titleLink" role="button" tabindex="0" data-event-id="${escapeHtml(r.id)}">${escapeHtml(r.titulo || '')}</span></td>
              <td>${escapeHtml(r.descripcion || '')}</td>
              <td>
                ${r.foto_url
                  ? `<button type="button" class="photoThumbBtn" data-url="${escapeHtml(r.foto_url)}"><img class="thumb" src="${escapeHtml(r.foto_url)}" alt="foto" />
                     </button>`
                  : '-'
                }
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    ` : `<div class="notice">Todavía no hay eventos cargados para esta área.</div>`;

    return `
      <div class="row" style="justify-content:space-between">
        <div>
          <h1 class="h1">Eventos</h1>
          <div class="small">Área: <b>${escapeHtml(areaName)}</b> · <span class="pill">${escapeHtml(role)}</span></div>
        </div>
        <div class="actions">
          <a class="btn" href="#/">Inicio</a>
          <button class="btn btnDanger" id="btnSignOut">Salir</button>
        </div>
      </div>

      ${msg ? `<div class="${msg.type==='error'?'warn':'notice'}">${escapeHtml(msg.text)}</div>` : ""}

      <div class="hr"></div>

      <h2 class="h2">Registrar nuevo evento</h2>
      <div class="field">
        <label>Tipo</label>
        <select id="evTipo">
          <option value="pesca">pesca</option>
          <option value="varamiento">varamiento</option>
          <option value="incidente">incidente</option>
          <option value="monitoreo">monitoreo</option>
        </select>
      </div>
      <div class="field">
        <label>Fecha del evento</label>
        <input id="evFecha" type="date" value="${today}" />
      </div>
      <div class="field">
        <label>Título</label>
        <input id="evTitulo" placeholder="Ej: Varamiento de delfín" />
      </div>
      <div class="field">
        <label>Descripción</label>
        <textarea id="evDesc" placeholder="Qué, dónde, acciones tomadas..."></textarea>
      </div>
      <div class="field">
        <label>Foto (desde el celular) – opcional</label>
          <input id="evFotoFile" type="file" accept="image/*" capture="environment" />
        <div class="small">Si no te ofrece cámara, igual podés elegir desde galería.</div>
        <div id="evFotoPreview" class="small"></div>
        <button id="btnClearFoto" class="btn btnSmall" type="button" style="margin-top:6px; display:none;">Quitar foto</button>
      </div>

      <div class="actions">
        <button class="btn btnPrimary" id="btnSaveEvent">Guardar evento</button>
        <button class="btn" id="btnRefresh">Refrescar</button>
      </div>

      <div class="hr"></div>
      <h2 class="h2">Últimos eventos</h2>
      ${table}
    `;
  }

  async function acceptPendingInviteIfAny(){
    const pending = localStorage.getItem(LS_PENDING_INVITE);
    if(!pending) return false;
    localStorage.removeItem(LS_PENDING_INVITE);
    try{ await supabase.rpc("accept_invitation", { p_token: pending }); }
    catch(e){ console.warn(e); }
    return true;
  }

  async function bootstrap(){
    if(!hasConfig){ $app.innerHTML = viewMissingConfig(); return; }
    const session = await getSession();
    if(!session){
      const { path, params } = route();
      if(path === "/invite"){
        const t = params.get("token") || "";
        if(t) localStorage.setItem(LS_PENDING_INVITE, t);
      }
      setHash("/login");
      return;
    }

    const didAccept = await acceptPendingInviteIfAny();
    if(didAccept){ setHash("/"); return; }

    const memberships = await myMemberships();
    if(!memberships.length){ $app.innerHTML = noAccessTemplate(session); return; }

    $app.innerHTML = homeTemplate(session, memberships);
    document.getElementById("btnSignOut")?.addEventListener("click", signOut);
    const areaSel = document.getElementById("areaSelect");
    if(areaSel){
      areaSel.addEventListener("change", () => {
        localStorage.setItem(LS_ACTIVE_AREA, areaSel.value);
        setHash("/");
      });
    }
  }

  async function loadEvents(areaId){
    // Try to load with estado (v0.6+). If column is not present yet, fallback gracefully.
    let q = supabase
      .from("events")
      .select("id, tipo, titulo, descripcion, fecha, foto_url, estado, created_at")
      .eq("area_id", areaId)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50);
    let { data, error } = await q;
    if(error && /estado/i.test(String(error.message||error))){
      // Column missing: fallback
      ({ data, error } = await supabase
        .from("events")
        .select("id, tipo, titulo, descripcion, fecha, foto_url, created_at")
        .eq("area_id", areaId)
        .order("fecha", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(50));
      if(error) throw error;
      // normalize to keep UI stable
      return (data||[]).map(r => ({...r, estado: "abierto"}));
    }
    if(error) throw error;
    return (data || []).map(r => ({...r, estado: normalizeEstado(r.estado)}));
  }

  async function uploadEventPhoto(areaId, userId, file){
    if(!file) return { publicUrl: null, path: null };
    file = await normalizeImageFile(file);
    file = await downscaleImage(file);
    const ext = (file.name || "jpg").split(".").pop() || "jpg";
    const safeExt = ext.replace(/[^a-zA-Z0-9]/g, "").slice(0,6) || "jpg";
    const rand = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
    const path = `area_${areaId}/user_${userId}/${rand}.${safeExt}`;

    const { data, error } = await supabase
      .storage
      .from(BUCKET)
      .upload(path, file, { upsert: false, contentType: file.type || "image/jpeg", cacheControl: "3600" });

    if(error) throw error;

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
    return { publicUrl: (pub?.publicUrl || null), path };
  }

  async function saveEvent(){
    const user = await requireAuth();
    if(!user) return;

    const fechaEl = document.getElementById("evFecha");
    const tituloEl = document.getElementById("evTitulo");
    const descEl = document.getElementById("evDesc");
    const fileEl = document.getElementById("evFoto");

    const fecha = (fechaEl?.value || "").trim();
    const titulo = (tituloEl?.value || "").trim();
    const descripcion = (descEl?.value || "").trim();
    const file = fileEl?.files?.[0] || null;

    if(!fecha || !titulo){
      toast("Completá fecha y título.", "warn");
      return;
    }

    try{
      setBusy(true);

      // 1) subir foto (si hay) ANTES de insertar, así evitamos depender de UPDATE RLS
      let photo = { publicUrl: null, path: null };
      if(file){
        photo = await uploadEventPhoto(user.area_id, user.id, file);
      }

      // 2) insertar evento con foto_url / foto_path ya listos
      const payload = {
        area_id: user.area_id,
        user_id: user.id,
        fecha,
        titulo,
        descripcion: descripcion || null,
        foto_url: photo.publicUrl,
        foto_path: photo.path
      };

      const { data: inserted, error: insErr } = await supabase
        .from("events")
        .insert(payload)
        .select("id")
        .single();

      if(insErr) throw insErr;

      // limpiar form
      if(tituloEl) tituloEl.value = "";
      if(descEl) descEl.value = "";
      if(fileEl) fileEl.value = "";

      toast("Evento guardado ✔", "ok");
      await loadEvents(); // refrescar lista
    }catch(e){
      console.error(e);
      toast("No se pudo guardar el evento. Revisá permisos/policies y volvé a intentar.", "err");
    }finally{
      setBusy(false);
    }
  }


  async function render(){
    if(!hasConfig){ $app.innerHTML = viewMissingConfig(); return; }
    const session = await getSession();
    const { path, params } = route();

    if(path === "/login"){
      $app.innerHTML = loginTemplate(null, "");
      const bind = () => {
        document.getElementById("btnLogin")?.addEventListener("click", async () => {
          const email = (document.getElementById("email").value || "").trim().toLowerCase();
          const pass = (document.getElementById("pass").value || "");
          if(!email || !pass){
            $app.innerHTML = loginTemplate({ type:'error', text:'Completá email y contraseña.' }, email);
            bind(); return;
          }
          const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
          if(error){
            $app.innerHTML = loginTemplate({ type:'error', text: error.message }, email);
            bind(); return;
          }
          await bootstrap();
        });
      };
      bind();
      return;
    }

    if(path === "/invite"){
      const token = params.get("token") || "";
      if(!token){ $app.innerHTML = inviteTemplate("", { type:'error', text:'Falta token.' }); return; }
      if(!session){ localStorage.setItem(LS_PENDING_INVITE, token); setHash("/login"); return; }
      $app.innerHTML = inviteTemplate(token, null);
      document.getElementById("btnAccept")?.addEventListener("click", async () => {
        try{
          const { error } = await supabase.rpc("accept_invitation", { p_token: token });
          if(error) throw error;
          setHash("/");
        }catch(e){
          $app.innerHTML = inviteTemplate(token, { type:'error', text: e.message || 'Error aceptando invitación' });
        }
      });
      return;
    }

    if(path === "/admin"){
      if(!session){ setHash("/login"); return; }
      const memberships = await myMemberships();
      let msg = null;
      let inviteLink = "";
      $app.innerHTML = adminTemplate(memberships, msg, inviteLink);
      document.getElementById("btnSignOut")?.addEventListener("click", signOut);

      const btnCreate = document.getElementById("btnCreateInvite");
      if(btnCreate){
        btnCreate.addEventListener("click", async () => {
          const email = (document.getElementById("invEmail").value || "").trim().toLowerCase();
          const role = (document.getElementById("invRole").value || "agent").trim();
          const firstArea = memberships.find(m => m.role === 'admin') || memberships[0];
          const areaId = firstArea?.area_id;
          if(!email){
            msg = { type:'error', text:'Completá el email.' };
            $app.innerHTML = adminTemplate(memberships, msg, inviteLink);
            document.getElementById("btnSignOut")?.addEventListener("click", signOut);
            return;
          }
          try{
            const { data, error } = await supabase.rpc("create_invitation", { p_area_id: areaId, p_email: email, p_role: role });
            if(error) throw error;
            const token = data?.[0]?.token || data?.token;
            if(!token) throw new Error("No se recibió token.");
            inviteLink = `${pageUrl()}#/invite?token=${token}`;
            msg = { type:'ok', text:'Invitación creada. Copiá el link.' };
            $app.innerHTML = adminTemplate(memberships, msg, inviteLink);
            document.getElementById("btnSignOut")?.addEventListener("click", signOut);
            document.getElementById("btnCopy")?.addEventListener("click", async () => {
              try{ await navigator.clipboard.writeText(inviteLink); alert("Link copiado."); }
              catch{ alert("Copiá manual."); }
            });
          }catch(e){
            msg = { type:'error', text: e.message || 'Error creando invitación' };
            $app.innerHTML = adminTemplate(memberships, msg, inviteLink);
            document.getElementById("btnSignOut")?.addEventListener("click", signOut);
          }
        });
      }
      return;
    }

    if(path === "/events"){
      if(!session){ setHash("/login"); return; }
      const memberships = await myMemberships();
      if(!memberships.length){ $app.innerHTML = noAccessTemplate(session); return; }
      const areaId = pickActiveAreaId(memberships);

      let msg = null;
      let rows = [];
      try{ rows = await loadEvents(areaId); }
      catch(e){ msg = { type:'error', text: e.message || 'No pude cargar eventos.' }; }

      $app.innerHTML = eventsTemplate(session, memberships, areaId, msg, rows);
      document.getElementById("btnSignOut")?.addEventListener("click", signOut);

      const refresh = async (m=null) => {
        try{ rows = await loadEvents(areaId); }
        catch(e){ m = { type:'error', text: e.message || 'No pude recargar.' }; }
        $app.innerHTML = eventsTemplate(session, memberships, areaId, m, rows);
        document.getElementById("btnSignOut")?.addEventListener("click", signOut);
        document.getElementById("btnSaveEvent")?.addEventListener("click", onSave);
        document.getElementById("btnRefresh")?.addEventListener("click", () => refresh({type:'ok', text:'Refrescado.'}));

        // --- Detalle de evento (modal) ---
        // 1) Soporta el botón inline onclick="openEventDetails(id)".
        // 2) Soporta el click en el título (delegación en initEventModalHandlers).
        window.openEventDetails = (id) => showEventDetail(id);
        initEventModalHandlers();

        // Habilita click en miniaturas (lista y detalle)
        bindPhotoThumbs($app);

        // Abrir fotos sin descargar (modal)
        document.addEventListener("click", (e)=>{
          const link = e.target && e.target.closest ? e.target.closest("a.photoLink") : null;
          if(link){
            e.preventDefault();
            openPhotoModal(link.dataset.url || link.href);
            return;
          }
          if(e.target && (e.target.id === "btnClosePhoto" || (e.target.getAttribute && e.target.getAttribute("data-close") === "1"))){
            e.preventDefault();
            closePhotoModal();
          }
        });
        document.addEventListener("keydown", (e)=>{ if(e.key === "Escape") closePhotoModal(); });


        // Abrir fotos sin descargar (modal)
        document.addEventListener("click", (e)=>{
          const link = e.target && e.target.closest ? e.target.closest("a.photoLink") : null;
          if(link){
            e.preventDefault();
            openPhotoModal(link.dataset.url || link.href);
            return;
          }
          if(e.target && (e.target.id === "btnClosePhoto" || (e.target.getAttribute && e.target.getAttribute("data-close") === "1"))){
            e.preventDefault();
            closePhotoModal();
          }
        });
        document.addEventListener("keydown", (e)=>{ if(e.key === "Escape") closePhotoModal(); });


        // --- Draft persistente (evita perder datos al sacar foto en móvil) ---
        const draft = loadEventDraft();
        // Si el draft es de otro área, lo ignoramos
        if(draft.area_id && draft.area_id !== areaId){ clearEventDraft(); }
        const d = loadEventDraft();
        setVal("evTipo", d.tipo || "pesca");
        setVal("evFecha", d.fecha || today);
        setVal("evTitulo", d.titulo || "");
        setVal("evDesc", d.descripcion || "");
        setPreview(d.foto_url || null);

        const saveDraftFromInputs = () => saveEventDraft({
          area_id: areaId,
          tipo: getVal("evTipo"),
          fecha: getVal("evFecha"),
          titulo: getVal("evTitulo"),
          descripcion: getVal("evDesc"),
        });

        ["evTipo","evFecha","evTitulo","evDesc"].forEach((id) => {
          document.getElementById(id)?.addEventListener("input", saveDraftFromInputs);
          document.getElementById(id)?.addEventListener("change", saveDraftFromInputs);
        });

        document.getElementById("btnClearFoto")?.addEventListener("click", () => {
          saveEventDraft({ foto_url: null, foto_path: null });
          setPreview(null);
        });

        // Subida inmediata: seleccionás la foto y ya queda guardada (y el formulario no se pierde)
        document.getElementById("evFotoFile")?.addEventListener("change", async (e) => {
  const file = e.target?.files?.[0] || null;
  if(!file) return;

  // Preview local inmediato (antes de subir)
  try{
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl, { label: "Vista previa (aún no guardada)" });
  }catch(_){}

  const box = document.getElementById("evFotoPreview");
  if(box){
    // mantenemos la miniatura y actualizamos el texto
    const small = box.querySelector('.small');
    if(small) small.textContent = "Subiendo foto...";
  }

  try{
    const up = await uploadEventPhoto(areaId, session.user.id, file);
    if(!up?.publicUrl) throw new Error('No se pudo obtener URL pública');
    saveEventDraft({ area_id: areaId, foto_url: up.publicUrl, foto_path: up.path });
    setPreview(up.publicUrl, { label: "Foto lista ✓" });
  }catch(err){
    console.error(err);
    if(box) box.textContent = "No se pudo subir la foto. Reintentá (se guarda el resto del formulario).";
  }
});
      };

      const onSave = async () => {
        const tipo = (document.getElementById("evTipo").value || "").trim();
        const fecha = (document.getElementById("evFecha").value || "").trim();
        const titulo = (document.getElementById("evTitulo").value || "").trim();
        const descripcion = (document.getElementById("evDesc").value || "").trim();
        const file = document.getElementById("evFotoFile")?.files?.[0] || null;

        if(!tipo || !fecha || !titulo){
          await refresh({ type:'error', text:'Completá Tipo, Fecha y Título.' });
          return;
        }

        try{
          // Guardar draft por si el móvil recarga la página en algún momento
          saveEventDraft({ area_id: areaId, tipo, fecha, titulo, descripcion });

          // 1) si ya hay foto subida desde el draft, úsala
          const d = loadEventDraft();
          let foto_url = d.foto_url || null;

          let foto_path = d.foto_path || null;

          // 2) si no, y hay archivo seleccionado, subilo ahora
          if(!foto_url && file){
            const up = await uploadEventPhoto(areaId, session.user.id, file);
            foto_url = up?.publicUrl || null;
            foto_path = up?.path || null;
            if(foto_url) saveEventDraft({ foto_url, foto_path });
          }

          await saveEvent(areaId, session, {
            tipo,
            fecha,
            titulo,
            descripcion,
            // si ya subimos como draft, evitamos re-subir
            file: foto_url ? null : file,
            foto_url,
            foto_path
          });

          // Limpieza: evento guardado => borramos draft y reseteamos preview
          clearEventDraft();
          setPreview(null);

          await refresh({ type:'ok', text: foto_url ? 'Evento guardado (con foto).' : 'Evento guardado.' });
        }catch(e){
          await refresh({ type:'error', text: e.message || 'No pude guardar el evento.' });
        }
      };

      document.getElementById("btnSaveEvent")?.addEventListener("click", onSave);
      document.getElementById("btnRefresh")?.addEventListener("click", () => refresh({type:'ok', text:'Refrescado.'}));
      return;
    }

    return bootstrap();
  }

  if(hasConfig){
    supabase.auth.onAuthStateChange(() => { render(); });
  }
  window.addEventListener("hashchange", render);
  render();
})()
  function openEventModal(){ 
    const modal = document.getElementById('eventModal');
    if(!modal) return;
    modal.classList.remove('hidden');
  }
  function closeEventModal(){
    const modal = document.getElementById('eventModal');
    if(!modal) return;
    modal.classList.add('hidden');
    const body = document.getElementById('eventModalBody');
    if(body) body.innerHTML = '<div class="notice">Cerrado.</div>';
  }
  function getActiveRoleFromDOM(){
    const root = document.querySelector('#app [data-role]');
    return root ? (root.getAttribute('data-role') || '') : '';
  }
  async function fetchEventById(id){
    // try with estado, fallback if column missing
    let { data, error } = await window.SIPRA_SUPABASE.from('events')
      .select('id, tipo, titulo, descripcion, fecha, foto_url, estado, created_at')
      .eq('id', id).limit(1).maybeSingle();
    if(error && /estado/i.test(String(error.message||error))){
      ({ data, error } = await window.SIPRA_SUPABASE.from('events')
        .select('id, tipo, titulo, descripcion, fecha, foto_url, created_at')
        .eq('id', id).limit(1).maybeSingle());
      if(error) throw error;
      data = { ...data, estado: 'abierto' };
    }
    if(error) throw error;
    return { ...data, estado: normalizeEstado(data?.estado) };
  }

  // Estado: control de operaciones para evitar rebotes (la última acción manda)
  const estadoOps = new Map(); // eventId -> opId
  function setBadgeForEvent(eventId, estado){
    const norm = normalizeEstado(estado);
    document.querySelectorAll(`[data-badge-event-id="${eventId}"]`).forEach(el => {
      el.classList.remove('badge--abierto','badge--seguimiento','badge--derivado','badge--cerrado');
      el.classList.add(estadoBadgeClass(norm));
      el.textContent = estadoLabel(norm);
    });
  }
  async function updateEventEstado(id, nuevoEstado){
    const estado = normalizeEstado(nuevoEstado);
    const { error } = await window.SIPRA_SUPABASE.from('events').update({ estado }).eq('id', id);
    if(error) throw error;
  }
  function eventDetailHTML(ev, role){
    const est = normalizeEstado(ev.estado);
    const canEditEstado = (est !== 'cerrado') && (role === 'admin' || role === 'coordinador' || role === 'owner');
    const canCerrar = (role === 'admin' || role === 'coordinador' || role === 'owner');
    const options = [
      { v:'abierto', label:'Abierto', disabled:false },
      { v:'en_seguimiento', label:'En seguimiento', disabled:false },
      { v:'derivado', label:'Derivado', disabled:false },
      { v:'cerrado', label:'Cerrado', disabled: !canCerrar }
    ];
    return `
      <div>
        ${ev.foto_url ? `
          <button type="button" class="photoThumbBtn" data-url="${escapeHtml(ev.foto_url)}"><img class="viewer" style="width:100%; height:auto; border-radius:12px; border:1px solid var(--border);" src="${escapeHtml(ev.foto_url)}" alt="foto" />
          </button>
        ` : ``}
        <div class="kv">
          <div class="k">Estado</div>
          <div class="v">
            <span id="evEstadoBadge" class="badge ${estadoBadgeClass(est)}" style="margin-right:8px" data-badge-event-id="${escapeHtml(ev.id)}">${estadoLabel(est)}</span>
            <select id="evEstadoSel" class="input" style="max-width: 240px; display:${canEditEstado ? 'inline-block' : 'none'}">
              ${options.map(o => `<option value="${o.v}" ${o.v===est?'selected':''} ${o.disabled?'disabled':''}>${o.label}</option>`).join('')}
            </select>
            ${canEditEstado ? `<span id="evEstadoStatus" class="small" style="margin-left:10px;color:var(--muted)"></span>` : ``}${!canEditEstado ? `<span class="small" style="color:var(--muted)">Evento cerrado: bloqueado.</span>` : ``}
          </div>
          <div class="k">Fecha</div><div class="v">${escapeHtml((ev.fecha||'').toString())}</div>
          <div class="k">Tipo</div><div class="v"><span class="pill">${escapeHtml(ev.tipo||'')}</span></div>
          <div class="k">Título</div><div class="v"><strong>${escapeHtml(ev.titulo||'')}</strong></div>
          <div class="k">Descripción</div><div class="v" style="white-space:pre-wrap">${escapeHtml(ev.descripcion||'')}</div>
        </div>
      </div>
    `;
  }
  async function showEventDetail(id){
    openEventModal();
    const body = document.getElementById('eventModalBody');
    if(body) body.innerHTML = '<div class="notice">Cargando…</div>';
    try{
      const role = getActiveRoleFromDOM();
      const ev = await fetchEventById(id);
      if(body) {
        body.innerHTML = eventDetailHTML(ev, role);
        bindPhotoThumbs(body);
      }
      const sel = document.getElementById('evEstadoSel');
      if(sel){
        sel.addEventListener('change', async (e) => {
          const next = e.target.value;
          const eventId = ev.id;
          const prev = normalizeEstado(ev.estado);
          const opId = Date.now() + Math.random();
          estadoOps.set(eventId, opId);

          // Optimistic UI: actualizar al instante
          setBadgeForEvent(eventId, next);
          const statusEl = document.getElementById('evEstadoStatus');
          if(statusEl) statusEl.textContent = 'Guardando…';
          sel.disabled = true;

          try{
            await updateEventEstado(eventId, next);
            if(estadoOps.get(eventId) === opId){
              ev.estado = normalizeEstado(next);
              if(statusEl) statusEl.textContent = 'Guardado ✓';
              setTimeout(() => { if(statusEl) statusEl.textContent = ''; }, 1400);
            }
          }catch(err){
            if(estadoOps.get(eventId) === opId){
              setBadgeForEvent(eventId, prev);
              e.target.value = prev;
              if(statusEl) statusEl.textContent = 'Error al guardar';
              setTimeout(() => { if(statusEl) statusEl.textContent = ''; }, 2400);
            }
            alert('No se pudo actualizar el estado: ' + (err.message||err));
          }finally{
            if(estadoOps.get(eventId) === opId){
              sel.disabled = false;
            }
          }
        });
      }
    }catch(err){
      if(body) body.innerHTML = '<div class="notice">No se pudo cargar el detalle: ' + escapeHtml(err.message||String(err)) + '</div>';
    }
  }
  function initEventModalHandlers(){
    // Evitar duplicar listeners si refrescamos la vista varias veces
    if(window.__sipraEventModalInit) return;
    window.__sipraEventModalInit = true;

    document.addEventListener('click', (ev) => {
      const t = ev.target.closest && ev.target.closest('.titleLink[data-event-id]');
      if(!t) return;
      const id = t.getAttribute('data-event-id');
      if(!id) return;
      showEventDetail(id);
    });
    const closeBtn = document.getElementById('eventModalClose');
    const backdrop = document.querySelector('#eventModal .eventModal__backdrop');
    if(closeBtn) closeBtn.addEventListener('click', closeEventModal);
    if(backdrop) backdrop.addEventListener('click', closeEventModal);
    document.addEventListener('keydown', (e) => {
      if(e.key === 'Escape'){
        const modal = document.getElementById('eventModal');
        if(modal && !modal.classList.contains('hidden')) closeEventModal();
      }
    });
  }

  ;
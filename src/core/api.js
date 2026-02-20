import { LS_PENDING_INVITE, LS_ACTIVE_AREA, BUCKET } from "./keys.js";
import { downscaleImage } from "./photo.js";

export async function getSession(supabase){
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function signOut(supabase){
  await supabase.auth.signOut();
}

export async function myMemberships(supabase){
  const session = await getSession(supabase);
  if(!session) return [];
  const { data, error } = await supabase
    .from("area_memberships")
    .select("area_id, role, areas(name)")
    .eq("user_id", session.user.id);
  if(error) throw error;
  return (data||[]).map(r => ({ area_id: r.area_id, role: r.role, area_name: r.areas?.name || r.area_id }));
}

export function pickActiveAreaId(memberships){
  const saved = localStorage.getItem(LS_ACTIVE_AREA);
  if(saved && memberships.some(m => m.area_id === saved)) return saved;
  return memberships[0]?.area_id || null;
}

export async function acceptPendingInviteIfAny(supabase){
  const token = localStorage.getItem(LS_PENDING_INVITE);
  if(!token) return { ok:false };
  try{
    const { data, error } = await supabase.rpc("accept_invitation", { token });
    if(error) throw error;
    localStorage.removeItem(LS_PENDING_INVITE);
    return { ok:true, data };
  }catch(e){
    return { ok:false, error: e };
  }
}

export async function loadEvents(supabase, areaId){
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("area_id", areaId)
    .order("created_at", { ascending:false });
  if(error) throw error;
  return data || [];
}

export async function uploadEventPhoto(supabase, file){
  const small = await downscaleImage(file);
  const filename = `${Date.now()}_${Math.random().toString(16).slice(2)}.jpg`;
  const path = `${filename}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, small, { upsert:false, contentType:"image/jpeg" });
  if(error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function saveEvent(supabase, payload){
  // Map to existing DB schema (v0.6.x): events(area_id, user_id, tipo, titulo, descripcion, fecha_evento, foto_url, estado)
  const session = await getSession(supabase);
  if(!session) throw new Error("Sin sesión activa.");

  const row = {
    area_id: payload.area_id,
    user_id: session.user.id,
    tipo: payload.tipo,
    titulo: payload.titulo,
    descripcion: payload.descripcion || null,
    fecha_evento: payload.fecha_evento,
    foto_url: payload.foto_url || null,
    estado: payload.estado || "abierto"
  };

  const { data, error } = await supabase.from("events").insert(row).select("*").single();
  if(error) throw error;
  return data;
}


export async function createInvitation(supabase, areaId, role){
  const { data, error } = await supabase.rpc("create_invitation", { p_area_id: areaId, p_role: role });
  if(error) throw error;
  return data; // expected token
}

export async function acceptInvitation(supabase, token, password){
  // accept_invitation RPC may create user or attach membership depending on backend
  const { data, error } = await supabase.rpc("accept_invitation", { token, password });
  if(error) throw error;
  return data;
}

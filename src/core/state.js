import { ESTADOS, LS_EVENT_DRAFT } from "./keys.js";

export function normalizeEstado(v){
  const s = (v||"").toLowerCase().trim();
  return ESTADOS.includes(s) ? s : "abierto";
}
export function estadoLabel(v){
  const s = normalizeEstado(v);
  if(s==="abierto") return "Abierto";
  if(s==="en_seguimiento") return "En seguimiento";
  if(s==="derivado") return "Derivado";
  if(s==="cerrado") return "Cerrado";
  return s;
}
export function estadoBadgeClass(v){
  const s = normalizeEstado(v);
  if(s==="abierto") return "badge-open";
  if(s==="en_seguimiento") return "badge-follow";
  if(s==="derivado") return "badge-deriv";
  if(s==="cerrado") return "badge-closed";
  return "badge-open";
}

export function loadEventDraft(){
  try{
    const raw = localStorage.getItem(LS_EVENT_DRAFT);
    return raw ? JSON.parse(raw) : null;
  }catch{ return null; }
}
export function saveEventDraft(draft){
  try{ localStorage.setItem(LS_EVENT_DRAFT, JSON.stringify(draft||{})); }catch{}
}
export function clearEventDraft(){
  try{ localStorage.removeItem(LS_EVENT_DRAFT); }catch{}
}

export function setVal(id, val){
  const el = document.getElementById(id);
  if(!el) return;
  el.value = val ?? "";
}
export function getVal(id){
  const el = document.getElementById(id);
  return el ? (el.value ?? "") : "";
}
export function setPreview(imgId, src){
  const el = document.getElementById(imgId);
  if(!el) return;
  if(src){
    el.src = src;
    el.classList.remove("hidden");
  }else{
    el.src = "";
    el.classList.add("hidden");
  }
}

export function escapeHtml(s){
  return (s ?? "").toString()
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}

export function pageUrl(hashPath){
  const base = location.href.split("#")[0];
  return `${base}#${hashPath}`;
}

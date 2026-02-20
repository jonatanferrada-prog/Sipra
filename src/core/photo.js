import { BUCKET } from "./keys.js";

export function normalizeImageFile(file){
  if(!file) return null;
  const type = (file.type||"").toLowerCase();
  if(type.startsWith("image/")) return file;
  return null;
}

export function openPhotoModal(url){
  const modal = document.getElementById("photoModal");
  const img = document.getElementById("photoModalImg");
  if(!modal || !img) return;
  img.src = url || "";
  modal.classList.remove("hidden");
}
export function closePhotoModal(){
  const modal = document.getElementById("photoModal");
  const img = document.getElementById("photoModalImg");
  if(!modal || !img) return;
  img.src = "";
  modal.classList.add("hidden");
}

export function initPhotoModalHandlers(){
  document.getElementById("photoModalClose")?.addEventListener("click", closePhotoModal);
  document.getElementById("photoModal")?.addEventListener("click", (e) => {
    if(e.target?.id === "photoModal") closePhotoModal();
  });
  document.addEventListener("keydown", (e) => {
    if(e.key === "Escape") closePhotoModal();
  });
}

export async function downscaleImage(file, maxW=1600, maxH=1600, quality=0.85){
  // Keep identical behavior to v0.6.1: downscale large images before upload
  const img = await loadImage(file);
  const { width, height } = img;
  const ratio = Math.min(maxW/width, maxH/height, 1);
  const targetW = Math.round(width * ratio);
  const targetH = Math.round(height * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, targetW, targetH);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  return new File([blob], "photo.jpg", { type: "image/jpeg" });
}

export function loadImage(file){
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export function fileToDataURL(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

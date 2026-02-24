# SIPRA v0.5 (Fotos desde el celular)
Esta versión agrega **subida directa de fotos** a Supabase Storage (bucket `event-photos`).

## 1) Crear bucket
Supabase → Storage → Create bucket:
- Name: event-photos
- Public bucket: ON (MVP)

## 2) Policies (MVP simple)
Si el bucket es público, alcanza con permitir upload a usuarios autenticados.
Ver instrucciones en el chat (SQL para storage.objects).

## 3) App
- Editar `config.js` (SUPABASE_URL + SUPABASE_ANON_KEY)
- Subir archivos a GitHub Pages (main / root)
- En Eventos: elegir foto → Guardar → listo (sube y guarda el link)

## Nota
Más adelante: bucket privado + signed URLs + múltiples fotos por evento.

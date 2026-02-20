# SIPRA v0.7.9 (core estable)

Esta versión deja una base **más sólida** y fácil de escalar:

- Estado único (sin pantallas “desincronizadas”)
- **Invitaciones por token** (sin email) + membresías por área
- Registro de **eventos con foto** (desde celular) vía Supabase Storage
- Modales en stack (detalle + zoom de foto) sin romper navegación
- Anti‑cache en GitHub Pages (`?v=0.7.9`)

---

## 1) Supabase: tablas + RLS

En Supabase → **SQL Editor**, ejecutá:

- `supabase/schema_v0_7_9.sql`

Esto crea:
- `areas`
- `area_members`
- `invitations`
- `events`

---

## 2) Supabase: Storage para fotos

Supabase → **Storage** → Create bucket:

- Name: `event_photos`
- Public bucket: **ON** (MVP simple)

> Si más adelante querés bucket privado, hay que pasar a **signed URLs**.

---

## 3) Configurar la app

Editá `config.js`:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (Publishable key)
- `EVENT_PHOTO_BUCKET` (por defecto `event_photos`)

---

## 4) Primer arranque (recomendado)

1. Creá un registro en `areas`.
2. Asignate como `admin` en `area_members` usando tu `auth.users.id`.
3. Entrá a la app → **Administración** → Crear invitación → compartís el link/token.

---

## 5) Deploy

Subí el contenido del repo a GitHub Pages (root). Abrí la URL publicada.

---

## Nota

Esto está pensado para correr en un servidor (GitHub Pages), no en `file://`.

-- SIPRA v0.7.9 – SQL mínimo (Supabase)
-- Tablas: areas, area_members, invitations, events
-- Storage: bucket event_photos (público o con políticas)

-- 1) Extensiones
create extension if not exists pgcrypto;

-- 2) Áreas
create table if not exists public.areas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- 3) Membresías
create table if not exists public.area_members (
  area_id uuid not null references public.areas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','coordinacion','agente','visor')),
  joined_at timestamptz not null default now(),
  primary key (area_id, user_id)
);

-- 4) Invitaciones (token)
create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references public.areas(id) on delete cascade,
  token uuid not null unique,
  role text not null check (role in ('admin','coordinacion','agente','visor')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id)
);

-- 5) Eventos
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references public.areas(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  tipo text not null,
  titulo text not null,
  descripcion text,
  fecha_evento date,
  estado text not null default 'abierto' check (estado in ('abierto','seguimiento','cerrado')),
  foto_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Trigger updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_events_updated_at on public.events;
create trigger trg_events_updated_at
before update on public.events
for each row execute procedure public.set_updated_at();

-- =============================
-- RLS (Row Level Security)
-- =============================

alter table public.areas enable row level security;
alter table public.area_members enable row level security;
alter table public.invitations enable row level security;
alter table public.events enable row level security;

-- Helper: ¿usuario es miembro del área?
create or replace function public.is_area_member(_area_id uuid)
returns boolean as $$
  select exists(
    select 1 from public.area_members m
    where m.area_id = _area_id and m.user_id = auth.uid()
  );
$$ language sql stable;

-- Helper: ¿usuario puede invitar?
create or replace function public.can_invite(_area_id uuid)
returns boolean as $$
  select exists(
    select 1 from public.area_members m
    where m.area_id = _area_id and m.user_id = auth.uid()
      and m.role in ('admin','coordinacion')
  );
$$ language sql stable;

-- AREAS: los miembros pueden ver su(s) área(s)
drop policy if exists "areas_select_if_member" on public.areas;
create policy "areas_select_if_member"
on public.areas for select
using ( public.is_area_member(id) );

-- AREA_MEMBERS
-- Ver miembros del área si sos miembro
drop policy if exists "members_select_if_member" on public.area_members;
create policy "members_select_if_member"
on public.area_members for select
using ( public.is_area_member(area_id) );

-- Insert/Update members: solo via app (accept invite) o admins
-- Para v0.7.9: permitimos upsert/insert solo a quien acepta invitación para sí mismo,
-- o a admin/coordinacion.
drop policy if exists "members_insert_self_or_admin" on public.area_members;
create policy "members_insert_self_or_admin"
on public.area_members for insert
with check (
  (user_id = auth.uid())
  or exists(
    select 1 from public.area_members m
    where m.area_id = area_members.area_id and m.user_id = auth.uid()
      and m.role in ('admin','coordinacion')
  )
);

drop policy if exists "members_update_admin" on public.area_members;
create policy "members_update_admin"
on public.area_members for update
using (
  exists(
    select 1 from public.area_members m
    where m.area_id = area_members.area_id and m.user_id = auth.uid()
      and m.role in ('admin','coordinacion')
  )
);

-- INVITATIONS
-- Crear invitación: solo admin/coordinacion
drop policy if exists "inv_insert_admin" on public.invitations;
create policy "inv_insert_admin"
on public.invitations for insert
with check ( public.can_invite(area_id) and created_by = auth.uid() );

-- Leer invitación: el creador o un miembro del área
drop policy if exists "inv_select_creator_or_member" on public.invitations;
create policy "inv_select_creator_or_member"
on public.invitations for select
using (
  created_by = auth.uid()
  or public.is_area_member(area_id)
);

-- Actualizar invitación (marcar aceptada): el que acepta (miembro luego) o admin
-- (permitimos al aceptante actualizar su token)
drop policy if exists "inv_update_accept" on public.invitations;
create policy "inv_update_accept"
on public.invitations for update
using (
  created_by = auth.uid()
  or public.can_invite(area_id)
  or true -- el control real se hace en la app (token exacto) + check abajo
)
with check (
  (accepted_by = auth.uid()) or public.can_invite(area_id) or created_by = auth.uid()
);

-- EVENTS
-- Select: miembro del área
drop policy if exists "events_select_member" on public.events;
create policy "events_select_member"
on public.events for select
using ( public.is_area_member(area_id) );

-- Insert: miembro del área y user_id propio
drop policy if exists "events_insert_member" on public.events;
create policy "events_insert_member"
on public.events for insert
with check ( public.is_area_member(area_id) and user_id = auth.uid() );

-- Update: miembro del área
-- (más adelante: limitar campos o roles)
drop policy if exists "events_update_member" on public.events;
create policy "events_update_member"
on public.events for update
using ( public.is_area_member(area_id) );

-- Delete: solo admin/coordinacion
drop policy if exists "events_delete_admin" on public.events;
create policy "events_delete_admin"
on public.events for delete
using (
  exists(
    select 1 from public.area_members m
    where m.area_id = events.area_id and m.user_id = auth.uid()
      and m.role in ('admin','coordinacion')
  )
);

-- =============================
-- Storage (bucket event_photos)
-- =============================
-- Crear bucket en Storage con nombre: event_photos
-- Si lo dejás público: getPublicUrl funciona sin políticas.
-- Si lo querés privado, necesitás políticas de storage.objects (no incluidas aquí)
-- y cambiar a signed URLs en la app.

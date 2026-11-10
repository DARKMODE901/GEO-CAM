-- ============================================================================
-- GeoCam - Migración Supabase: Sincronización Bidireccional y Borrado Lógico
-- Ejecuta este script en el SQL Editor de tu proyecto Supabase.
-- Es idempotente: se puede ejecutar de forma segura sobre tablas ya creadas.
-- ============================================================================

-- 1. Añadir columnas obligatorias para cursor de bajada y borrado lógico
alter table public.photos
  add column if not exists server_updated_at timestamptz not null default now(),
  add column if not exists deleted_at timestamptz;

-- 2. Función y Trigger PostgreSQL obligatorio para actualizar server_updated_at
-- Cada vez que llegue un INSERT o UPDATE (incluso cambios con reloj local antiguo),
-- el servidor sella server_updated_at con now() para que el cursor Pull lo detecte.
create or replace function public.set_server_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.server_updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_photos_server_updated_at on public.photos;
create trigger trg_photos_server_updated_at
  before insert or update on public.photos
  for each row
  execute function public.set_server_updated_at();

-- 3. Índices requeridos para Pull eficiente por cursor y paginación del muro remoto
create index if not exists idx_photos_user_server_updated_at
  on public.photos (user_id, server_updated_at);

create index if not exists idx_photos_user_created_at
  on public.photos (user_id, created_at desc);

-- 4. Verificar políticas RLS (incluyendo FOR UPDATE requerida por upsert)
alter table public.photos enable row level security;

drop policy if exists "ver las mías" on public.photos;
create policy "ver las mías" on public.photos
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "crear las mías" on public.photos;
create policy "crear las mías" on public.photos
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "actualizar las mías" on public.photos;
create policy "actualizar las mías" on public.photos
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "borrar las mías" on public.photos;
create policy "borrar las mías" on public.photos
  for delete to authenticated
  using ((select auth.uid()) = user_id);

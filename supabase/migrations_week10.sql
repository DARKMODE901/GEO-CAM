-- ============================================================================
-- GeoCam - Migración Semana 10: Inteligencia Artificial Multimodal y Rate Limiting
-- Ejecuta este script en el SQL Editor de tu proyecto Supabase.
-- ============================================================================

-- 1. Añadir columna ai_description a public.photos
alter table public.photos
  add column if not exists ai_description text;

-- 2. Crear tabla de control de uso de IA (Rate Limiting C5)
create table if not exists public.uso_ia (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  funcion text not null,
  created_at timestamp with time zone default now() not null
);

-- 3. Habilitar Row Level Security (RLS) en uso_ia
alter table public.uso_ia enable row level security;

-- Política SELECT: el usuario autenticado solo puede consultar sus propios registros
drop policy if exists "Users can select own ai usage" on public.uso_ia;
create policy "Users can select own ai usage" on public.uso_ia
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- Política INSERT: el usuario autenticado solo puede insertar sus propios registros
drop policy if exists "Users can insert own ai usage" on public.uso_ia;
create policy "Users can insert own ai usage" on public.uso_ia
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- IMPORTANTE (Regla C5): NO se crea política para DELETE ni UPDATE.
-- El usuario autenticado nunca tiene permisos para eliminar o manipular registros de uso_ia.

-- 4. Índice para conteo eficiente de uso por usuario en las últimas 24 horas
create index if not exists idx_uso_ia_user_created_at
  on public.uso_ia (user_id, created_at desc);

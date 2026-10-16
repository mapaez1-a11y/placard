-- Placard · esquema de Supabase
-- Pegá todo esto en Supabase → SQL Editor → New query → Run.
-- Se puede volver a correr sin problema (por ejemplo, para sumar la tabla de viajes).

-- Marca de tiempo del servidor: la app la usa para bajar solo lo que cambió.
create or replace function public.tocar_server_updated_at()
returns trigger language plpgsql as $$
begin
  new.server_updated_at = now();
  return new;
end $$;

-- PRENDAS
create table if not exists public.prendas (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  nombre text not null default '',
  tipo text not null,
  parte text not null,
  color text not null default '',
  tela text not null default '',
  clima text[] not null default '{}',
  ocasiones text[] not null default '{}',
  veces_usada int not null default 0,
  ultimo_uso bigint,
  fecha_alta bigint not null,
  foto_path text,
  updated_at bigint not null,
  deleted boolean not null default false,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- LOOKS
create table if not exists public.looks (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  prenda_ids text[] not null default '{}',
  ocasion text not null,
  nota text not null default '',
  fecha bigint not null,
  favorito boolean not null default false,
  guardado boolean not null default false,
  updated_at bigint not null,
  deleted boolean not null default false,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- USOS (historial)
create table if not exists public.usos (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  fecha bigint not null,
  look_id text not null,
  updated_at bigint not null,
  deleted boolean not null default false,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- VIAJES (destino, fechas y valija; el pronóstico se calcula en el celular)
create table if not exists public.viajes (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  nombre text not null default '',
  destino text not null,
  lat double precision not null,
  lon double precision not null,
  desde date not null,
  hasta date not null,
  prenda_ids text[] not null default '{}',
  ocasion text not null default 'Finde',
  updated_at bigint not null,
  deleted boolean not null default false,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

do $$
declare t text;
begin
  foreach t in array array['prendas', 'looks', 'usos', 'viajes'] loop
    execute format('drop trigger if exists tocar on public.%I', t);
    execute format('create trigger tocar before insert or update on public.%I for each row execute function public.tocar_server_updated_at()', t);
    execute format('create index if not exists %I on public.%I (user_id, server_updated_at)', t || '_sync_idx', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "solo lo mío" on public.%I', t);
    execute format('create policy "solo lo mío" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- FOTOS: bucket privado, cada usuaria solo ve su carpeta (fotos/<user_id>/...)
insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', false)
on conflict (id) do nothing;

drop policy if exists "fotos: leer las mías" on storage.objects;
drop policy if exists "fotos: subir las mías" on storage.objects;
drop policy if exists "fotos: cambiar las mías" on storage.objects;
drop policy if exists "fotos: borrar las mías" on storage.objects;

create policy "fotos: leer las mías" on storage.objects for select to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "fotos: subir las mías" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "fotos: cambiar las mías" on storage.objects for update to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "fotos: borrar las mías" on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = auth.uid()::text);

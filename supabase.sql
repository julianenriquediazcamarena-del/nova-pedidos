-- Nova Pedidos: base de datos compartida del equipo.
-- Pega esto completo en Supabase → SQL Editor → New query → Run.
-- Se puede volver a correr sin perder datos (por ejemplo, al actualizar la app).

-- ============================================================
-- 1. Registros: todos los datos de la app en una sola tabla
-- ============================================================
create table if not exists public.registros (
  coleccion   text        not null,
  id          text        not null,
  datos       jsonb       not null,
  actualizado text        not null,           -- fecha de modificación que pone la app (decide qué cambio gana)
  borrado     boolean     not null default false,
  servidor_ts timestamptz not null default clock_timestamp(), -- cuándo llegó al servidor (para bajar solo lo nuevo)
  primary key (coleccion, id)
);

-- Quién creó cada registro (lo pone el servidor; nadie lo puede falsificar ni cambiar).
alter table public.registros add column if not exists autor uuid;
create index if not exists registros_servidor_ts on public.registros (servidor_ts);
create index if not exists registros_autor on public.registros (autor);

-- Si llega un cambio más viejo que el guardado, se ignora (gana el más reciente).
create or replace function public.registros_antes_de_guardar() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    if new.actualizado < old.actualizado then
      return old;
    end if;
    new.autor := old.autor;
  else
    new.autor := coalesce(auth.uid(), new.autor);
  end if;
  new.servidor_ts := clock_timestamp();
  return new;
end $$;

drop trigger if exists registros_antes_de_guardar on public.registros;
create trigger registros_antes_de_guardar
  before insert or update on public.registros
  for each row execute function public.registros_antes_de_guardar();

-- ============================================================
-- 2. Perfiles del equipo: nombre y rol
--    dueno: todo · colaborador: empleados · vendedor: externos por comisión · pendiente: sin acceso
-- ============================================================
create table if not exists public.perfiles (
  id      uuid primary key references auth.users (id) on delete cascade,
  email   text,
  nombre  text,
  rol     text not null default 'pendiente',
  creado  timestamptz not null default now()
);
alter table public.perfiles add column if not exists codigo text; -- prefijo de folios del vendedor (ej. JV)

alter table public.perfiles drop constraint if exists perfiles_rol_check;
alter table public.perfiles add constraint perfiles_rol_check check (rol in ('dueno', 'colaborador', 'vendedor', 'pendiente'));
alter table public.perfiles alter column rol set default 'pendiente';

-- Funciones de rol (security definer para usarlas dentro de las reglas)
create or replace function public.es_dueno() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol = 'dueno');
$$;

create or replace function public.es_miembro() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol in ('dueno', 'colaborador'));
$$;

create or replace function public.es_vendedor() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol = 'vendedor');
$$;

-- Nadie sin sesión puede llamar estas funciones.
revoke all on function public.es_dueno() from public, anon;
revoke all on function public.es_miembro() from public, anon;
revoke all on function public.es_vendedor() from public, anon;
grant execute on function public.es_dueno() to authenticated;
grant execute on function public.es_miembro() to authenticated;
grant execute on function public.es_vendedor() to authenticated;

-- Cada usuario nuevo recibe su perfil. El primero que exista es el dueño; los demás quedan SIN ACCESO
-- hasta que el dueño les asigne un rol en la app (Ajustes → Equipo).
create or replace function public.nuevo_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, email, nombre, rol)
  values (new.id, new.email, split_part(new.email, '@', 1),
          case when exists (select 1 from public.perfiles where rol = 'dueno') then 'pendiente' else 'dueno' end)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.nuevo_perfil();

-- Usuarios que ya existían antes de correr esto (el más antiguo queda como dueño si no hay ninguno).
insert into public.perfiles (id, email, nombre, rol)
select u.id, u.email, split_part(u.email, '@', 1),
       case when not exists (select 1 from public.perfiles where rol = 'dueno')
                 and u.id = (select id from auth.users order by created_at limit 1)
            then 'dueno' else 'pendiente' end
from auth.users u
on conflict (id) do nothing;

alter table public.perfiles enable row level security;

drop policy if exists "ver perfiles" on public.perfiles;
create policy "ver perfiles" on public.perfiles
  for select to authenticated using (id = auth.uid() or public.es_dueno());

drop policy if exists "dueno edita perfiles" on public.perfiles;
create policy "dueno edita perfiles" on public.perfiles
  for update to authenticated using (public.es_dueno()) with check (public.es_dueno());

-- ============================================================
-- 3. Quién ve y cambia qué
--    Sin aprobar: nada.
--    Colaboradores: todo menos gastos, bitácora, costos y comisiones; crean y cambian pedidos,
--                   cotizaciones y clientes; no pueden borrar.
--    Vendedores: el catálogo, y SOLO los pedidos, cotizaciones y clientes que ellos crearon,
--                más sus propias comisiones. No ven la cartera del negocio ni ningún costo.
--    Dueño: todo.
-- ============================================================
alter table public.registros enable row level security;

drop policy if exists "usuarios con sesion" on public.registros;
drop policy if exists "leer registros" on public.registros;
drop policy if exists "crear registros" on public.registros;
drop policy if exists "cambiar registros" on public.registros;

create policy "leer registros" on public.registros
  for select to authenticated
  using (
    public.es_dueno()
    or (public.es_miembro() and coleccion not in ('gastos', 'bitacora', 'costos', 'comisiones'))
    or (public.es_vendedor() and (
          coleccion in ('productos', 'playeras', 'ajustes')
          or (coleccion in ('pedidos', 'cotizaciones', 'contactos') and autor = auth.uid())
          or (coleccion = 'comisiones' and datos ->> 'vendedorId' = auth.uid()::text)))
  );

create policy "crear registros" on public.registros
  for insert to authenticated
  with check (
    public.es_dueno()
    or ((public.es_miembro() or public.es_vendedor())
        and coleccion in ('pedidos', 'cotizaciones', 'contactos') and not borrado)
  );

create policy "cambiar registros" on public.registros
  for update to authenticated
  using (
    public.es_dueno()
    or (public.es_miembro() and coleccion in ('pedidos', 'cotizaciones', 'contactos'))
    or (public.es_vendedor() and coleccion in ('pedidos', 'cotizaciones', 'contactos') and autor = auth.uid())
  )
  with check (
    public.es_dueno()
    or (public.es_miembro() and coleccion in ('pedidos', 'cotizaciones', 'contactos') and not borrado)
    or (public.es_vendedor() and coleccion in ('pedidos', 'cotizaciones', 'contactos') and not borrado)
  );

-- Permisos de tabla: solo usuarios con sesión, y solo lo necesario (las reglas de arriba deciden qué filas).
-- Sin sesión (clave pública sola) no se puede leer ni escribir nada.
grant usage on schema public to authenticated;
revoke all on public.registros from anon, authenticated;
revoke all on public.perfiles from anon, authenticated;
grant select, insert, update on public.registros to authenticated;
grant select, update (nombre, rol, codigo) on public.perfiles to authenticated;

-- ============================================================
-- 4. Fotos de los pedidos (logos, dibujos, constancias fiscales)
--    Carpeta privada: solo la ve el equipo con sesión. Un vendedor solo ve las fotos que él subió.
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('adjuntos', 'adjuntos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "ver adjuntos" on storage.objects;
drop policy if exists "subir adjuntos" on storage.objects;
drop policy if exists "borrar adjuntos" on storage.objects;

create policy "ver adjuntos" on storage.objects
  for select to authenticated
  using (bucket_id = 'adjuntos' and (public.es_miembro() or owner_id = auth.uid()::text));

create policy "subir adjuntos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'adjuntos' and (public.es_miembro() or public.es_vendedor()));

create policy "borrar adjuntos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'adjuntos' and (public.es_dueno() or owner_id = auth.uid()::text));

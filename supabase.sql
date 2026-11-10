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

create index if not exists registros_servidor_ts on public.registros (servidor_ts);

-- Si llega un cambio más viejo que el guardado, se ignora (gana el más reciente).
create or replace function public.registros_antes_de_guardar() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.actualizado < old.actualizado then
    return old;
  end if;
  new.servidor_ts := clock_timestamp();
  return new;
end $$;

drop trigger if exists registros_antes_de_guardar on public.registros;
create trigger registros_antes_de_guardar
  before insert or update on public.registros
  for each row execute function public.registros_antes_de_guardar();

-- ============================================================
-- 2. Perfiles del equipo: nombre y rol (dueño o colaborador)
-- ============================================================
create table if not exists public.perfiles (
  id      uuid primary key references auth.users (id) on delete cascade,
  email   text,
  nombre  text,
  rol     text not null default 'pendiente',
  creado  timestamptz not null default now()
);

-- Roles: dueno (todo), colaborador (pedidos, cotizaciones y clientes), pendiente (sin acceso hasta que el dueño lo apruebe).
alter table public.perfiles drop constraint if exists perfiles_rol_check;
alter table public.perfiles add constraint perfiles_rol_check check (rol in ('dueno', 'colaborador', 'pendiente'));
alter table public.perfiles alter column rol set default 'pendiente';

-- ¿El usuario con sesión es dueño? ¿Es miembro aprobado? (security definer para usarlas dentro de las reglas)
create or replace function public.es_dueno() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol = 'dueno');
$$;

create or replace function public.es_miembro() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol in ('dueno', 'colaborador'));
$$;

-- Nadie fuera del sistema puede llamar estas funciones directamente.
revoke all on function public.es_dueno() from public, anon;
revoke all on function public.es_miembro() from public, anon;
grant execute on function public.es_dueno() to authenticated;
grant execute on function public.es_miembro() to authenticated;

-- Cada usuario nuevo recibe su perfil. El primero que exista es el dueño; los demás quedan SIN ACCESO
-- hasta que el dueño los apruebe en la app (Ajustes → Equipo). Así, aunque alguien lograra crearse una
-- cuenta, no vería nada.
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
--    Colaboradores: leen todo menos gastos y bitácora; crean y cambian pedidos, cotizaciones y clientes;
--                   no pueden borrar.
--    Dueño: todo.
-- ============================================================
alter table public.registros enable row level security;

drop policy if exists "usuarios con sesion" on public.registros;
drop policy if exists "leer registros" on public.registros;
drop policy if exists "crear registros" on public.registros;
drop policy if exists "cambiar registros" on public.registros;

create policy "leer registros" on public.registros
  for select to authenticated
  using (public.es_dueno() or (public.es_miembro() and coleccion not in ('gastos', 'bitacora')));

create policy "crear registros" on public.registros
  for insert to authenticated
  with check (public.es_dueno() or (public.es_miembro() and coleccion in ('pedidos', 'cotizaciones', 'contactos') and not borrado));

create policy "cambiar registros" on public.registros
  for update to authenticated
  using (public.es_dueno() or (public.es_miembro() and coleccion in ('pedidos', 'cotizaciones', 'contactos')))
  with check (public.es_dueno() or (public.es_miembro() and coleccion in ('pedidos', 'cotizaciones', 'contactos') and not borrado));

-- Sin sesión (clave pública sola) no se puede leer ni escribir nada.
revoke all on public.registros from anon;
revoke all on public.perfiles from anon;

-- Passachave: esquema para Supabase
-- Execute no SQL Editor do seu projeto. Ative também Authentication > Providers > Email (magic link).

create extension if not exists btree_gist;

create table public.vehicles (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  owner_name  text not null,
  name        text not null,
  type        text not null check (type in ('Compacto','Sedã','SUV','Minivan')),
  city        text not null,
  price       numeric(10,2) not null check (price > 0),
  seats       int  not null default 5,
  gear        text not null default 'Manual',
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.bookings (
  id          uuid primary key default gen_random_uuid(),
  vehicle_id  uuid not null references public.vehicles(id) on delete cascade,
  renter_id   uuid not null default auth.uid() references auth.users(id),
  renter_name text not null,
  from_date   date not null,
  to_date     date not null check (to_date > from_date),
  sub         numeric(10,2) not null,
  total       numeric(10,2) not null,
  status      text not null default 'pending'
              check (status in ('pending','accepted','declined','cancelled')),
  created_at  timestamptz not null default now(),
  -- impede duas reservas confirmadas no mesmo período para o mesmo veículo
  constraint no_overlap exclude using gist (
    vehicle_id with =, daterange(from_date, to_date) with &&
  ) where (status = 'accepted')
);

alter table public.vehicles enable row level security;
alter table public.bookings enable row level security;

-- Veículos: todos veem anúncios ativos; o dono vê e gerencia os seus.
create policy "vehicles_select" on public.vehicles for select
  using (active or owner_id = auth.uid());
create policy "vehicles_insert" on public.vehicles for insert
  with check (owner_id = auth.uid());
create policy "vehicles_update" on public.vehicles for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "vehicles_delete" on public.vehicles for delete
  using (owner_id = auth.uid());

-- Reservas: locatário e dono do veículo enxergam a reserva.
create policy "bookings_select" on public.bookings for select
  using (
    renter_id = auth.uid()
    or exists (select 1 from public.vehicles v
               where v.id = vehicle_id and v.owner_id = auth.uid())
  );
-- O locatário só cria solicitações pendentes em seu nome.
create policy "bookings_insert" on public.bookings for insert
  with check (renter_id = auth.uid() and status = 'pending');
-- O locatário só pode manter a solicitação pendente ou cancelá-la.
create policy "bookings_renter_update" on public.bookings for update
  using (renter_id = auth.uid())
  with check (renter_id = auth.uid() and status in ('pending','cancelled'));
-- O dono do veículo só pode aceitar ou recusar.
create policy "bookings_owner_update" on public.bookings for update
  using (exists (select 1 from public.vehicles v
                 where v.id = vehicle_id and v.owner_id = auth.uid()))
  with check (status in ('accepted','declined'));

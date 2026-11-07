-- =====================================================================
-- Passachave – banco de dados (Supabase / PostgreSQL)
-- Cole tudo isso no SQL Editor do seu projeto Supabase e clique em "Run".
-- =====================================================================

create extension if not exists btree_gist;

-- ---------------------------------------------------------------------
-- PERFIS: dados extras de cada usuário (o login fica em auth.users)
-- ---------------------------------------------------------------------
create table public.perfis (
  id          uuid primary key references auth.users(id) on delete cascade,
  nome        text not null,
  tipo        text not null check (tipo in ('locatario', 'proprietario')),
  created_at  timestamptz not null default now()
);

-- Cria o perfil automaticamente quando alguém se cadastra.
-- O nome e o tipo vêm do signUp() feito na tela de cadastro.
create or replace function public.criar_perfil()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.perfis (id, nome, tipo)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'tipo', 'locatario')
  );
  return new;
end;
$$;

create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil();

-- ---------------------------------------------------------------------
-- VEÍCULOS: anúncios dos proprietários
-- ---------------------------------------------------------------------
create table public.veiculos (
  id          uuid primary key default gen_random_uuid(),
  dono_id     uuid not null default auth.uid() references public.perfis(id) on delete cascade,
  modelo      text not null,
  tipo        text not null check (tipo in ('Compacto', 'Sedã', 'SUV', 'Minivan')),
  cidade      text not null,
  cambio      text not null default 'Manual' check (cambio in ('Manual', 'Automático')),
  lugares     int  not null default 5 check (lugares between 2 and 9),
  preco_dia   numeric(10,2) not null check (preco_dia > 0),
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- RESERVAS: pedidos dos locatários
-- status: pendente -> aceita / recusada (pelo dono) ou cancelada (pelo locatário)
-- ---------------------------------------------------------------------
create table public.reservas (
  id            uuid primary key default gen_random_uuid(),
  veiculo_id    uuid not null references public.veiculos(id) on delete cascade,
  locatario_id  uuid not null default auth.uid() references public.perfis(id) on delete cascade,
  data_inicio   date not null,
  data_fim      date not null check (data_fim > data_inicio),
  subtotal      numeric(10,2) not null,
  total         numeric(10,2) not null,
  status        text not null default 'pendente'
                check (status in ('pendente', 'aceita', 'recusada', 'cancelada')),
  created_at    timestamptz not null default now(),
  -- impede duas reservas ACEITAS no mesmo período para o mesmo carro
  constraint sem_conflito exclude using gist (
    veiculo_id with =, daterange(data_inicio, data_fim) with &&
  ) where (status = 'aceita')
);

-- ---------------------------------------------------------------------
-- SEGURANÇA (Row Level Security)
-- ---------------------------------------------------------------------
alter table public.perfis   enable row level security;
alter table public.veiculos enable row level security;
alter table public.reservas enable row level security;

-- Perfis: usuários logados podem ver nomes; cada um edita só o seu.
create policy "perfis_ver" on public.perfis for select
  to authenticated using (true);
create policy "perfis_editar" on public.perfis for update
  to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Veículos: todos os logados veem; só proprietários anunciam; só o dono altera.
create policy "veiculos_ver" on public.veiculos for select
  to authenticated using (true);
create policy "veiculos_criar" on public.veiculos for insert
  to authenticated with check (
    dono_id = auth.uid()
    and exists (select 1 from public.perfis p where p.id = auth.uid() and p.tipo = 'proprietario')
  );
create policy "veiculos_editar" on public.veiculos for update
  to authenticated using (dono_id = auth.uid()) with check (dono_id = auth.uid());
create policy "veiculos_apagar" on public.veiculos for delete
  to authenticated using (dono_id = auth.uid());

-- Reservas: veem o locatário e o dono do carro.
create policy "reservas_ver" on public.reservas for select
  to authenticated using (
    locatario_id = auth.uid()
    or exists (select 1 from public.veiculos v where v.id = veiculo_id and v.dono_id = auth.uid())
  );
-- Locatário cria pedidos pendentes em seu nome.
create policy "reservas_criar" on public.reservas for insert
  to authenticated with check (locatario_id = auth.uid() and status = 'pendente');
-- Locatário só pode cancelar.
create policy "reservas_locatario_editar" on public.reservas for update
  to authenticated using (locatario_id = auth.uid())
  with check (locatario_id = auth.uid() and status in ('pendente', 'cancelada'));
-- Dono do carro só pode aceitar ou recusar.
create policy "reservas_dono_editar" on public.reservas for update
  to authenticated using (
    exists (select 1 from public.veiculos v where v.id = veiculo_id and v.dono_id = auth.uid())
  )
  with check (status in ('aceita', 'recusada'));

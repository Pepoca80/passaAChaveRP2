-- =====================================================================
-- Carros de exemplo (dados fictícios) para testar a vitrine.
-- Pré-requisito: já existe pelo menos uma conta do tipo "proprietario"
-- (crie uma pela tela de cadastro antes de rodar este script).
-- Execute no SQL Editor do Supabase. Pode rodar mais de uma vez sem problema
-- só se você apagar os carros de exemplo antes (veja o final do arquivo).
-- =====================================================================

do $$
declare
  dono uuid;
begin
  select id into dono from public.perfis where tipo = 'proprietario' limit 1;
  if dono is null then
    raise exception 'Nenhum proprietário cadastrado. Crie uma conta de proprietário primeiro.';
  end if;

  insert into public.veiculos (dono_id, modelo, tipo, cidade, cambio, lugares, preco_dia, ativo) values
    (dono, 'Honda Civic 2019',          'Sedã',     'São Paulo', 'Automático', 5, 180.00, true),
    (dono, 'Fiat Mobi 2021',            'Compacto', 'São Paulo', 'Manual',     4,  95.00, true),
    (dono, 'Jeep Renegade 2020',        'SUV',      'Campinas',  'Automático', 5, 210.00, true),
    (dono, 'Chevrolet Spin 2018',       'Minivan',  'São Paulo', 'Manual',     7, 150.00, true),
    (dono, 'Toyota Corolla Cross 2022', 'SUV',      'Santos',    'Automático', 5, 260.00, true),
    (dono, 'Renault Kwid 2022',         'Compacto', 'Campinas',  'Manual',     4,  80.00, true);
end $$;

-- Para apagar os carros de exemplo depois, rode:
-- delete from public.veiculos where modelo in (
--   'Honda Civic 2019','Fiat Mobi 2021','Jeep Renegade 2020',
--   'Chevrolet Spin 2018','Toyota Corolla Cross 2022','Renault Kwid 2022');

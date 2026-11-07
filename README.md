# Passachave

Aluguel de carros entre pessoas. Projeto acadêmico em HTML, CSS e JavaScript puro, com banco de dados e login no [Supabase](https://supabase.com).

## Telas

| Arquivo | Tela |
|---|---|
| `index.html` | Início: explicação do projeto e carrossel de anúncios (visível sem login) |
| `login.html` | Login |
| `cadastro.html` | Cadastro (escolhe "Quero alugar" ou "Sou proprietário") |
| `locatario.html` | Buscar carros, ver detalhes, pedir reserva, acompanhar "Minhas reservas" |
| `proprietario.html` | Ver e responder pedidos (com resumo de ganhos), anunciar/pausar/remover carros |

Depois do login, cada usuário vai automaticamente para a tela do seu tipo de conta.

## Estrutura

```
index.html, login.html, cadastro.html, locatario.html, proprietario.html
css/style.css          estilos
js/config.js           URL e chave do Supabase
js/comum.js            cliente Supabase e funções compartilhadas
js/inicio.js           carrossel da página inicial
js/locatario.js        lógica da tela do locatário
js/proprietario.js     lógica da tela do proprietário
supabase/schema.sql    tabelas e regras de segurança
```

## Banco de dados

- **perfis**: nome e tipo (`locatario` ou `proprietario`) de cada usuário. É criado automaticamente no cadastro por um trigger.
- **veiculos**: carros anunciados (modelo, tipo, cidade, câmbio, lugares, preço por dia, ativo).
- **reservas**: pedidos de aluguel (datas, valores, status `pendente`, `aceita`, `recusada` ou `cancelada`).

O Row Level Security garante que só proprietários anunciem carros, que cada um altere apenas o que é seu e que o banco recuse duas reservas aceitas no mesmo período para o mesmo carro.

## Como rodar

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Em **SQL Editor**, cole o conteúdo de `supabase/schema.sql` e clique em **Run**.
3. Em **Authentication > Sign In / Providers > Email**, desative **Confirm email** para facilitar os testes. Se deixar ativado, o usuário precisa clicar no link do e-mail antes de entrar.
4. Em **Project Settings > API**, copie a *Project URL* e a chave *anon public* para `js/config.js`.
5. Abra o `index.html` no navegador. Pode usar a extensão Live Server do VS Code ou publicar no GitHub Pages.

Para testar o fluxo completo, crie uma conta de **proprietário** e anuncie um carro. Depois crie uma conta de **locatário** (com outro e-mail) e peça a reserva desse carro.

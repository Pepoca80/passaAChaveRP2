// Página inicial: explicação + carrossel de anúncios visível para todos.
// Para ver detalhes ou reservar, a pessoa precisa entrar.

async function carregarVitrine() {
  const { data, error } = await sb
    .from('veiculos')
    .select('*, dono:perfis(nome)')
    .eq('ativo', true)
    .order('created_at', { ascending: false })
    .limit(20);

  const area = $('#carrossel');
  if (error) {
    area.innerHTML = `<div class="vazio">Não foi possível carregar os anúncios agora.</div>`;
    return;
  }
  if (!data.length) {
    area.innerHTML = `<div class="vazio">Ainda não há carros anunciados. Seja o primeiro a anunciar!</div>`;
    return;
  }

  area.innerHTML = data.map(v => `
    <a class="slide" href="login.html" aria-label="Entrar para ver ${esc(v.modelo)}">
      ${desenhoCarro(v.id)}
      <div class="b">
        <h3>${esc(v.modelo)}</h3>
        <div class="mu">${esc(v.cidade)} · ${v.cambio} · ${v.lugares} lugares</div>
        <div class="row" style="margin-top:6px">
          <span><b>${dinheiro(v.preco_dia)}</b> <span class="mu">/ dia</span></span>
        </div>
        <div class="mu">Proprietário: ${esc(v.dono?.nome || '—')}</div>
      </div>
    </a>`).join('');
}

// Se já estiver logado, troca os botões do topo por "Minha área"
async function ajustarTopo() {
  const { data } = await sb.auth.getSession();
  if (!data.session) return;
  const perfil = await buscarPerfil(data.session.user.id);
  if (!perfil) return;
  $('#acoes-topo').innerHTML = `
    <span class="mu">Olá, ${esc(perfil.nome)}</span>
    <a class="btn s p" href="${paginaDoTipo(perfil.tipo)}">Minha área</a>`;
}

// Setas do carrossel: andam o tamanho de um card
const andar = (direcao) => {
  const car = $('#carrossel');
  car.scrollBy({ left: direcao * (car.firstElementChild?.offsetWidth + 16 || 280) });
};
$('#seta-esq').addEventListener('click', () => andar(-1));
$('#seta-dir').addEventListener('click', () => andar(1));

ajustarTopo();
carregarVitrine();

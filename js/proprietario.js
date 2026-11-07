// Tela do proprietário: responder pedidos de reserva e gerenciar seus carros

let usuario = null;
let veiculos = [];
let reservas = [];
let aba = 'solicitacoes';   // 'solicitacoes' | 'veiculos'

async function iniciar() {
  const sessao = await exigirLogin('proprietario');
  if (!sessao) return;
  usuario = sessao.usuario;
  await carregar();
  render();
}

async function carregar() {
  const [v, r] = await Promise.all([
    sb.from('veiculos')
      .select('*')
      .eq('dono_id', usuario.id)
      .order('created_at', { ascending: false }),
    // !inner + filtro = só reservas de carros deste proprietário
    sb.from('reservas')
      .select('*, veiculo:veiculos!inner(modelo, dono_id), locatario:perfis!locatario_id(nome)')
      .eq('veiculo.dono_id', usuario.id)
      .order('created_at', { ascending: false })
  ]);
  if (v.error || r.error) toast('Erro ao carregar: ' + (v.error || r.error).message);
  veiculos = v.data || [];
  reservas = r.data || [];
}

// ---------------- Telas ----------------
function telaSolicitacoes() {
  const aceitas = reservas.filter(r => r.status === 'aceita');
  const pendentes = reservas.filter(r => r.status === 'pendente');
  const ganhos = aceitas.reduce((soma, r) => soma + Number(r.subtotal), 0);

  // pendentes primeiro
  const lista = [...pendentes, ...reservas.filter(r => r.status !== 'pendente')];

  return `
    <div class="kpis">
      <div class="box kpi"><span class="mu">Ganhos confirmados</span><b>${dinheiro(ganhos)}</b></div>
      <div class="box kpi"><span class="mu">Pedidos pendentes</span><b>${pendentes.length}</b></div>
      <div class="box kpi"><span class="mu">Reservas confirmadas</span><b>${aceitas.length}</b></div>
    </div>
    ${lista.length ? `<div class="list">${lista.map(r => `
      <div class="box">
        <div class="row">
          <h3>${esc(r.locatario?.nome)}</h3>
          <span class="st ${r.status}">${STATUS[r.status]}</span>
        </div>
        <div class="mu">${esc(r.veiculo.modelo)} · ${dataBR(r.data_inicio)} a ${dataBR(r.data_fim)} · ${dinheiro(r.subtotal)}</div>
        ${r.status === 'pendente' ? `
          <div class="row" style="justify-content:flex-start">
            <button class="btn s p" data-acao="aceitar" data-id="${r.id}">Aceitar</button>
            <button class="btn s" data-acao="recusar" data-id="${r.id}">Recusar</button>
          </div>` : ''}
      </div>`).join('')}</div>`
    : `<div class="vazio">Nenhum pedido por enquanto. Quando alguém pedir um dos seus carros, ele aparece aqui.</div>`}`;
}

function telaVeiculos() {
  const lista = veiculos.length
    ? veiculos.map(v => `
      <div class="box">
        <div class="row">
          <h3>${esc(v.modelo)}</h3>
          <span class="st ${v.ativo ? 'ativo' : 'pendente'}">${v.ativo ? 'Anúncio ativo' : 'Pausado'}</span>
        </div>
        <div class="mu">${esc(v.cidade)} · ${v.tipo} · ${v.cambio} · ${v.lugares} lugares · ${dinheiro(v.preco_dia)} / dia</div>
        <div class="row" style="justify-content:flex-start">
          <button class="btn s" data-acao="alternar" data-id="${v.id}">${v.ativo ? 'Pausar anúncio' : 'Reativar anúncio'}</button>
          <button class="btn s" data-acao="remover" data-id="${v.id}">Remover</button>
        </div>
      </div>`).join('')
    : `<div class="vazio">Você ainda não anunciou nenhum carro.</div>`;

  return `
    <div class="lado">
      <div class="list">${lista}</div>
      <form class="box" id="form-anuncio">
        <h3>Anunciar carro</h3>
        <label class="fld">Modelo e ano
          <input name="modelo" required placeholder="Ex.: Volkswagen Polo 2021">
        </label>
        <label class="fld">Cidade
          <input name="cidade" required placeholder="Ex.: São Paulo">
        </label>
        <div class="duas">
          <label class="fld">Tipo
            <select name="tipo"><option>Compacto</option><option>Sedã</option><option>SUV</option><option>Minivan</option></select>
          </label>
          <label class="fld">Câmbio
            <select name="cambio"><option>Manual</option><option>Automático</option></select>
          </label>
        </div>
        <div class="duas">
          <label class="fld">Lugares
            <input name="lugares" type="number" min="2" max="9" value="5" required>
          </label>
          <label class="fld">Preço / dia (R$)
            <input name="preco_dia" type="number" min="1" step="0.01" required placeholder="120">
          </label>
        </div>
        <button class="btn p" type="submit">Publicar anúncio</button>
      </form>
    </div>`;
}

function render() {
  $('#conteudo').innerHTML = aba === 'solicitacoes' ? telaSolicitacoes() : telaVeiculos();

  document.querySelectorAll('.abas button').forEach(b => {
    b.setAttribute('aria-current', b.dataset.aba === aba);
  });

  const pendentes = reservas.filter(r => r.status === 'pendente').length;
  $('#qtd-pendentes').textContent = pendentes;
  $('#qtd-pendentes').hidden = pendentes === 0;
}

// ---------------- Ações ----------------
document.addEventListener('click', async (e) => {
  const alvo = e.target.closest('[data-acao]');
  if (!alvo) return;
  const acao = alvo.dataset.acao;
  const id = alvo.dataset.id;

  if (acao === 'aba') {
    aba = alvo.dataset.aba;
  }

  if (acao === 'aceitar' || acao === 'recusar') {
    const status = acao === 'aceitar' ? 'aceita' : 'recusada';
    const { error } = await sb.from('reservas').update({ status }).eq('id', id);
    if (error) {
      // 23P01 = violou a regra "sem_conflito" do banco
      toast(error.code === '23P01'
        ? 'Já existe uma reserva confirmada nessas datas. Recuse este pedido.'
        : 'Erro: ' + error.message);
      return;
    }
    toast(status === 'aceita' ? 'Reserva confirmada.' : 'Pedido recusado.');
    await carregar();
  }

  if (acao === 'alternar') {
    const v = veiculos.find(x => x.id === id);
    const { error } = await sb.from('veiculos').update({ ativo: !v.ativo }).eq('id', id);
    if (error) return toast('Erro: ' + error.message);
    await carregar();
  }

  if (acao === 'remover') {
    if (!confirm('Remover este carro? As reservas dele também serão apagadas.')) return;
    const { error } = await sb.from('veiculos').delete().eq('id', id);
    if (error) return toast('Erro: ' + error.message);
    toast('Carro removido.');
    await carregar();
  }

  render();
});

document.addEventListener('submit', async (e) => {
  if (e.target.id !== 'form-anuncio') return;
  e.preventDefault();
  const dados = Object.fromEntries(new FormData(e.target));
  dados.lugares = Number(dados.lugares);
  dados.preco_dia = Number(dados.preco_dia);

  const { error } = await sb.from('veiculos').insert(dados);
  if (error) return toast('Erro ao publicar: ' + error.message);

  toast('Anúncio publicado!');
  await carregar();
  render();
});

iniciar();

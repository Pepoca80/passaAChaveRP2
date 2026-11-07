// Tela do locatário: buscar carros, ver detalhes, pedir reserva e acompanhar reservas

let usuario = null;
let veiculos = [];
let reservas = [];

let aba = 'buscar';        // 'buscar' | 'detalhe' | 'reservas'
let selecionado = null;    // carro aberto na tela de detalhe
const filtro = { q: '', tipo: '', max: '' };
let pedido = { inicio: '', fim: '', protecao: 'basica' };

const TAXA = 0.12;          // taxa da plataforma (12%)
const PROTECAO_DIA = 18;    // proteção completa por dia

async function iniciar() {
  const sessao = await exigirLogin('locatario');
  if (!sessao) return;
  usuario = sessao.usuario;
  await carregar();
  render();
}

async function carregar() {
  const [v, r] = await Promise.all([
    sb.from('veiculos')
      .select('*, dono:perfis!dono_id(nome)')
      .eq('ativo', true)
      .order('created_at', { ascending: false }),
    sb.from('reservas')
      .select('*, veiculo:veiculos(id, modelo, cidade, dono:perfis!dono_id(nome))')
      .eq('locatario_id', usuario.id)
      .order('created_at', { ascending: false })
  ]);
  if (v.error || r.error) toast('Erro ao carregar: ' + (v.error || r.error).message);
  veiculos = v.data || [];
  reservas = r.data || [];
}

// ---------------- Cálculo do valor ----------------
function calcular() {
  const { inicio, fim, protecao } = pedido;
  if (!inicio || !fim || fim <= inicio) return null;
  const dias = Math.round((new Date(fim) - new Date(inicio)) / 86400000);
  const subtotal = dias * Number(selecionado.preco_dia);
  const taxa = Math.round(subtotal * TAXA * 100) / 100;
  const extra = protecao === 'completa' ? dias * PROTECAO_DIA : 0;
  return { dias, subtotal, taxa, extra, total: subtotal + taxa + extra };
}

// ---------------- Telas ----------------
function telaBusca() {
  const tipos = ['Compacto', 'Sedã', 'SUV', 'Minivan'];
  return `
    <div class="filtros">
      <input data-filtro="q" placeholder="Cidade ou modelo" value="${esc(filtro.q)}" aria-label="Cidade ou modelo">
      <select data-filtro="tipo" aria-label="Tipo">
        <option value="">Todos os tipos</option>
        ${tipos.map(t => `<option ${filtro.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}
      </select>
      <input data-filtro="max" type="number" min="0" placeholder="Preço máx. / dia" value="${esc(filtro.max)}" style="max-width:170px" aria-label="Preço máximo por dia">
    </div>
    <div id="resultados">${listaCarros()}</div>`;
}

function listaCarros() {
  const q = filtro.q.toLowerCase();
  const lista = veiculos.filter(v =>
    (!q || (v.modelo + ' ' + v.cidade).toLowerCase().includes(q)) &&
    (!filtro.tipo || v.tipo === filtro.tipo) &&
    (!filtro.max || Number(v.preco_dia) <= Number(filtro.max))
  );

  if (!lista.length) {
    return `<div class="vazio">Nenhum carro encontrado. Tente outra cidade ou aumente o preço máximo.</div>`;
  }

  return `<div class="grid">${lista.map(v => `
    <article class="card">
      ${desenhoCarro(v.id)}
      <div class="b">
        <h3>${esc(v.modelo)}</h3>
        <div class="mu">${esc(v.cidade)} · ${v.cambio} · ${v.lugares} lugares</div>
        <div class="row" style="margin-top:auto">
          <span><b>${dinheiro(v.preco_dia)}</b> <span class="mu">/ dia</span></span>
          <button class="btn s p" data-acao="abrir" data-id="${v.id}">Ver detalhes</button>
        </div>
      </div>
    </article>`).join('')}</div>`;
}

function telaDetalhe() {
  const v = selecionado;
  return `
    <button class="btn s" data-acao="voltar">‹ Voltar</button>
    <div class="det">
      <div class="list">
        ${desenhoCarro(v.id, true)}
        <h1>${esc(v.modelo)}</h1>
        <div class="mu">${esc(v.cidade)} · ${v.tipo} · ${v.cambio} · ${v.lugares} lugares</div>
        <div class="box">
          <b>Proprietário: ${esc(v.dono?.nome)}</b>
          <span class="mu">Retirada em local combinado com o proprietário.</span>
        </div>
      </div>

      <div class="box">
        <div><b style="font-size:24px">${dinheiro(v.preco_dia)}</b> <span class="mu">/ dia</span></div>
        <label class="fld">Retirada
          <input type="date" data-pedido="inicio" min="${hoje()}" value="${pedido.inicio}">
        </label>
        <label class="fld">Devolução
          <input type="date" data-pedido="fim" min="${hoje()}" value="${pedido.fim}">
        </label>
        <label class="fld">Proteção
          <select data-pedido="protecao">
            <option value="basica">Básica (incluída)</option>
            <option value="completa" ${pedido.protecao === 'completa' ? 'selected' : ''}>Completa (+ ${dinheiro(PROTECAO_DIA)} / dia)</option>
          </select>
        </label>
        <div class="list" id="resumo" style="gap:8px">${resumo()}</div>
      </div>
    </div>`;
}

function resumo() {
  const c = calcular();
  if (!c) {
    return `<div class="mu">Escolha as datas de retirada e devolução para ver o valor.</div>
            <button class="btn p" disabled>Solicitar reserva</button>`;
  }
  return `
    <div class="row"><span>${dinheiro(selecionado.preco_dia)} × ${c.dias} diária${c.dias > 1 ? 's' : ''}</span><span>${dinheiro(c.subtotal)}</span></div>
    <div class="row"><span>Taxa da plataforma</span><span>${dinheiro(c.taxa)}</span></div>
    <div class="row"><span>Proteção completa</span><span>${dinheiro(c.extra)}</span></div>
    <div class="row tot"><span>Total</span><span>${dinheiro(c.total)}</span></div>
    <div class="mu">Você só paga se o proprietário aceitar.</div>
    <button class="btn p" data-acao="solicitar">Solicitar reserva</button>`;
}

function telaReservas() {
  if (!reservas.length) {
    return `<div class="vazio">Você ainda não fez nenhuma reserva.<br><br>
      <button class="btn p" data-acao="aba" data-aba="buscar">Buscar carros</button></div>`;
  }
  return `<div class="list">${reservas.map(r => `
    <div class="box">
      <div class="row">
        <h3>${esc(r.veiculo?.modelo || 'Carro removido')}</h3>
        <span class="st ${r.status}">${STATUS[r.status]}</span>
      </div>
      <div class="mu">${dataBR(r.data_inicio)} a ${dataBR(r.data_fim)} · ${dinheiro(r.total)} · ${esc(r.veiculo?.dono?.nome)}</div>
      ${r.status === 'pendente' || r.status === 'aceita'
        ? `<div><button class="btn s" data-acao="cancelar" data-id="${r.id}">Cancelar</button></div>` : ''}
    </div>`).join('')}</div>`;
}

function render() {
  const telas = { buscar: telaBusca, detalhe: telaDetalhe, reservas: telaReservas };
  $('#conteudo').innerHTML = telas[aba]();

  // destaca a aba atual ("detalhe" faz parte de "buscar")
  document.querySelectorAll('.abas button').forEach(b => {
    const atual = b.dataset.aba === aba || (aba === 'detalhe' && b.dataset.aba === 'buscar');
    b.setAttribute('aria-current', atual);
  });
}

// ---------------- Ações ----------------
document.addEventListener('click', async (e) => {
  const alvo = e.target.closest('[data-acao]');
  if (!alvo) return;
  const acao = alvo.dataset.acao;
  const id = alvo.dataset.id;

  if (acao === 'aba') {
    aba = alvo.dataset.aba;
    selecionado = null;
  }

  if (acao === 'abrir') {
    selecionado = veiculos.find(v => v.id === id);
    pedido = { inicio: '', fim: '', protecao: 'basica' };
    aba = 'detalhe';
  }

  if (acao === 'voltar') {
    aba = 'buscar';
  }

  if (acao === 'solicitar') {
    const c = calcular();
    if (!c) return;
    alvo.disabled = true;
    const { error } = await sb.from('reservas').insert({
      veiculo_id: selecionado.id,
      data_inicio: pedido.inicio,
      data_fim: pedido.fim,
      subtotal: c.subtotal,
      total: c.total
    });
    if (error) {
      toast('Erro ao reservar: ' + error.message);
      alvo.disabled = false;
      return;
    }
    toast('Pedido enviado! Você só paga se o proprietário aceitar.');
    await carregar();
    aba = 'reservas';
    selecionado = null;
  }

  if (acao === 'cancelar') {
    if (!confirm('Cancelar esta reserva?')) return;
    const { error } = await sb.from('reservas').update({ status: 'cancelada' }).eq('id', id);
    if (error) return toast('Erro: ' + error.message);
    toast('Reserva cancelada.');
    await carregar();
  }

  render();
});

// Filtros e datas atualizam só um pedaço da tela (para não perder o foco do campo)
document.addEventListener('input', (e) => {
  const campo = e.target;
  if (campo.dataset.filtro) {
    filtro[campo.dataset.filtro] = campo.value;
    $('#resultados').innerHTML = listaCarros();
  }
  if (campo.dataset.pedido) {
    pedido[campo.dataset.pedido] = campo.value;
    $('#resumo').innerHTML = resumo();
  }
});

iniciar();

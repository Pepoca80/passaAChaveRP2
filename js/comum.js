// Funções usadas em todas as páginas

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

if (SUPABASE_URL.includes('SEU-PROJETO')) {
  document.addEventListener('DOMContentLoaded', () => {
    document.body.insertAdjacentHTML('afterbegin',
      '<div class="aviso">Configure o Supabase em <b>js/config.js</b> antes de usar.</div>');
  });
}

const $ = (seletor) => document.querySelector(seletor);

// Evita que textos digitados pelo usuário virem HTML
function esc(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function dinheiro(valor) {
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function dataBR(iso) {
  return new Date(iso + 'T00:00').toLocaleDateString('pt-BR');
}

// Data de hoje no formato AAAA-MM-DD (para o min dos inputs de data)
function hoje() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

const STATUS = {
  pendente: 'Aguardando resposta',
  aceita: 'Confirmada',
  recusada: 'Recusada',
  cancelada: 'Cancelada'
};

let toastTimer;
function toast(mensagem) {
  let t = $('#toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.setAttribute('role', 'status');
    document.body.appendChild(t);
  }
  t.textContent = mensagem;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 3500);
}

// Traduz as mensagens de erro mais comuns do Supabase Auth
function traduzErro(erro) {
  const msg = erro?.message || String(erro);
  if (msg.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (msg.includes('already registered')) return 'Este e-mail já está cadastrado.';
  if (msg.includes('Email not confirmed')) return 'Confirme seu e-mail antes de entrar.';
  if (msg.includes('at least 6')) return 'A senha precisa ter pelo menos 6 caracteres.';
  return msg;
}

function paginaDoTipo(tipo) {
  return tipo === 'proprietario' ? 'proprietario.html' : 'locatario.html';
}

async function buscarPerfil(userId) {
  const { data } = await sb.from('perfis').select('*').eq('id', userId).single();
  return data;
}

// Usado nas telas internas: garante que há alguém logado e com o tipo certo.
// Se não houver, manda para o login (ou para a tela do tipo correto).
async function exigirLogin(tipoEsperado) {
  const { data } = await sb.auth.getSession();
  const usuario = data.session?.user;
  if (!usuario) {
    location.href = 'index.html';
    return null;
  }

  const perfil = await buscarPerfil(usuario.id);
  if (!perfil) {
    await sb.auth.signOut();
    location.href = 'index.html';
    return null;
  }
  if (perfil.tipo !== tipoEsperado) {
    location.href = paginaDoTipo(perfil.tipo);
    return null;
  }

  $('#usuario-nome').textContent = perfil.nome;
  $('#btn-sair').onclick = async () => {
    await sb.auth.signOut();
    location.href = 'index.html';
  };
  return { usuario, perfil };
}

// Ilustração do carro (cor varia de acordo com o id)
function desenhoCarro(id, grande = false) {
  const cor = [...String(id)].reduce((s, c) => s + c.charCodeAt(0), 0) * 47 % 360;
  return `<div class="art${grande ? ' big' : ''}" style="--h:${cor}">
    <svg viewBox="0 0 120 50" aria-hidden="true">
      <path d="M8 34l8-14c2-4 6-6 10-6h40c5 0 9 2 12 6l8 8c6 1 12 3 12 8v4H8z" fill="currentColor"/>
      <circle cx="32" cy="40" r="7" fill="var(--surf)"/>
      <circle cx="92" cy="40" r="7" fill="var(--surf)"/>
    </svg>
  </div>`;
}

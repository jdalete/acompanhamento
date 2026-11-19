/* Link do cliente: entra com e-mail + código, e então mostra a página do cliente (js/portal-app.js) com os dados ao vivo. */
(() => {
  'use strict';
  const view = document.getElementById('view');
  const CFG = window.PORTAL_CONFIG;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const token = () => decodeURIComponent((location.hash || '').replace(/^#\/?/, '').split('/')[0]).trim();
  const chaveSessao = () => 'acompanhamento.sessao.' + token();
  const lerSessao = () => { try { return localStorage.getItem(chaveSessao()); } catch (e) { return null; } };
  async function rpc(fn, body) {
    const r = await fetch(`${CFG.supabaseUrl}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: CFG.supabaseKey, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const out = await r.json().catch(() => null);
    if (!r.ok) throw new Error((out && out.message) || `Erro ${r.status}`);
    return out;
  }
  function mensagem(titulo, texto) { view.innerHTML = `<div class="portal-msg">${BRAND_MARK}<h1>${titulo}</h1><p>${texto}</p></div>`; }

  function telaEntrar(erro = '') {
    document.title = 'Acompanhamento de projetos';
    view.innerHTML = `<div class="acesso-cartao cli-entrar">
      <div class="acesso-marca">${BRAND_MARK}<span>Acompanhamento de projetos</span></div>
      <h1>Entrar<span class="ponto">.</span></h1>
      <p class="acesso-sub">Use o seu e-mail e o código de acesso que você recebeu de quem cuida do seu projeto.</p>
      <form id="cli-form" class="acesso-form" novalidate>
        <label class="field"><span>E-mail</span><input type="email" name="email" autocomplete="email" required></label>
        <label class="field"><span>Código de acesso</span><input name="codigo" autocomplete="one-time-code" placeholder="Ex.: K7M4-Q9TP" required style="text-transform:uppercase;letter-spacing:.08em"></label>
        <p class="acesso-erro" role="alert">${esc(erro)}</p>
        <button class="btn btn-primary" type="submit">Entrar</button>
      </form></div>`;
    const f = document.getElementById('cli-form');
    setTimeout(() => f.elements.email.focus(), 30);
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const email = f.elements.email.value.trim(), codigo = f.elements.codigo.value.replace(/[\s-]/g, '').toUpperCase();
      const err = f.querySelector('.acesso-erro');
      if (!email || !codigo) { err.textContent = 'Preencha o e-mail e o código.'; return; }
      const b = f.querySelector('button'); b.disabled = true; b.textContent = 'Entrando…';
      try {
        const r = await rpc('cli_entrar', { p_token: token(), p_email: email, p_codigo: codigo });
        if (!r || !r.sessao) { b.disabled = false; b.textContent = 'Entrar'; err.textContent = r && r.erro === 'bloqueado' ? 'Muitas tentativas erradas. Espere 15 minutos e tente de novo.' : 'E-mail ou código não conferem.'; return; }
        try { localStorage.setItem(chaveSessao(), r.sessao); } catch (x) { /* sem armazenamento: vale só nesta aba */ }
        sessaoAtual = r.sessao; abrir();
      } catch (x) { b.disabled = false; b.textContent = 'Entrar'; err.textContent = 'Não foi possível entrar agora. Confira a internet e tente de novo.'; }
    });
  }

  let sessaoAtual = null, app = null;
  function sair(msg) {
    const s = sessaoAtual; sessaoAtual = null; app = null;
    try { localStorage.removeItem(chaveSessao()); } catch (e) { /* segue */ }
    if (s) rpc('cli_sair', { p_sessao: s }).catch(() => {});
    telaEntrar(msg || '');
  }
  async function abrir() {
    view.innerHTML = '<div class="portal-msg"><p>Carregando o acompanhamento…</p></div>';
    app = PortalApp.montar(view, {
      carregar: async () => { const d = await rpc('cli_dados', { p_sessao: sessaoAtual }); Cosmos.aplicar(d.tema); document.title = `Acompanhamento | ${d.cliente || ''}`; return d; },
      editar: (tipo, id, campos) => rpc('cli_editar', { p_sessao: sessaoAtual, p_tipo: tipo, p_id: id, p_campos: campos }),
      comentar: (id, texto) => rpc('cli_comentar', { p_sessao: sessaoAtual, p_tarefa: id, p_texto: texto }),
      relatorio: id => rpc('cli_relatorio', { p_sessao: sessaoAtual, p_id: id }),
      sair: () => sair(),
      semSessao: () => sair('Sua sessão terminou. Entre de novo.'),
    });
    await app.iniciar();
  }
  function iniciar() {
    if (!token()) { mensagem('Link incompleto', 'Este endereço está sem o código do cliente. Peça o link de acompanhamento novamente para quem cuida do seu projeto.'); return; }
    sessaoAtual = lerSessao();
    if (sessaoAtual) abrir(); else telaEntrar();
  }
  window.addEventListener('hashchange', iniciar);
  // Busca de novo quando a pessoa volta para a aba e a cada 2 minutos (sem atrapalhar quem está editando)
  document.addEventListener('visibilitychange', () => { if (!document.hidden && app && !app.ocupado()) app.recarregar(); });
  setInterval(() => { if (!document.hidden && app && !app.ocupado()) app.recarregar(); }, 120000);
  iniciar();
})();

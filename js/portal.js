/* Página pública do cliente: lê o código do link e mostra o acompanhamento */
(() => {
  'use strict';
  const view = document.getElementById('view');
  const CFG = window.PORTAL_CONFIG;
  let lastJson = '';

  function message(title, text) {
    view.innerHTML = `<div class="portal-msg">${BRAND_MARK.replace(/bm/g, 'bmm')}<h1>${title}</h1><p>${text}</p></div>`;
  }

  async function load(first) {
    const token = decodeURIComponent((location.hash || '').replace(/^#\/?/, '')).trim();
    if (!token) { message('Link incompleto', 'Este endereço está sem o código do cliente. Peça o link de acompanhamento novamente para quem cuida do seu projeto.'); return; }
    try {
      const r = await fetch(`${CFG.supabaseUrl}/rest/v1/rpc/portal_get`, {
        method: 'POST',
        headers: { apikey: CFG.supabaseKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_token: token }),
      });
      if (!r.ok) throw new Error(String(r.status));
      const res = await r.json();
      if (!res || !res.data) {
        message('Link desativado', 'Este link não está mais ativo. Peça um link novo para quem cuida do seu projeto.');
        document.title = 'Link desativado';
        return;
      }
      const json = JSON.stringify(res);
      if (json === lastJson) return;
      lastJson = json;
      const y = window.scrollY;
      document.body.dataset.accent = res.data.accent || 'ambar';
      view.innerHTML = PortalRender.render(res.data, { updatedAt: res.updated_at });
      document.title = `Acompanhamento | ${res.data.client.name}`;
      if (!first) window.scrollTo(0, y);
    } catch (e) {
      if (first) message('Não foi possível carregar', 'Verifique sua conexão com a internet e recarregue a página.');
    }
  }

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (el) PortalRender.handleClick(el);
  });
  window.addEventListener('hashchange', () => { lastJson = ''; load(true); });
  // Busca de novo quando a pessoa volta para a aba e a cada 2 minutos com a aba aberta
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(false); });
  setInterval(() => { if (!document.hidden) load(false); }, 120000);
  load(true);
})();

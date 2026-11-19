/* Dados do sistema no Supabase (tabela app_state, funções app_state_get/app_state_put).
   O navegador continua guardando uma cópia (abre rápido e funciona sem internet);
   o banco é a versão oficial. Cada gravação leva o número da versão de onde partiu (rev):
   se outra versão chegou antes (outro computador, ou o Claude mexendo pelo banco),
   junta as duas mudanças item por item antes de gravar de novo. */
const Nuvem = (() => {
  'use strict';
  // Endereço do banco: o arquivo local (js/config.js) ou o público (online). Quem abre é a sessão do dono (login).
  const BASE = window.APP_CONFIG || window.PORTAL_CONFIG || null;
  const CFG = BASE && BASE.supabaseUrl && BASE.supabaseKey ? BASE : null;
  const CHAVE_SESSAO = 'gestao-projetos.sessao';
  const lerSessao = () => { try { return JSON.parse(localStorage.getItem(CHAVE_SESSAO) || 'null'); } catch (e) { return null; } };
  let sessao = lerSessao(); // { token, email }
  const COLS = ['team', 'clients', 'companies', 'links', 'projects', 'stages', 'tasks', 'comments', 'history']; // comments e history também chegam do cliente
  let app = null;          // { obter, trocar, aviso, ocupado }
  let meta = { rev: 0, base: null, dirty: false };
  let metaKey = '';
  let timer = null, enviando = null, avisouErro = false, pronto = false;
  let mudancas = 0; // sobe a cada gravação neste navegador: diz se algo mudou enquanto um envio estava no caminho

  /* JSON com as chaves em ordem: o banco devolve as chaves noutra ordem e a comparação não pode depender disso. */
  function canon(v) {
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
    return JSON.stringify(v === undefined ? null : v);
  }
  function hash(v) {
    const s = canon(v); let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36) + s.length.toString(36);
  }
  // Retrato do que foi sincronizado por último: assinatura de cada item, para saber quem mudou o quê.
  function retrato(db) {
    const r = { settings: hash(db.settings || {}) };
    COLS.forEach(c => (db[c] || []).forEach(x => { r[c + ':' + x.id] = hash(x); }));
    return r;
  }
  function lerMeta() { try { Object.assign(meta, JSON.parse(localStorage.getItem(metaKey) || '{}')); } catch (e) { /* começa do zero */ } }
  function gravarMeta() { try { localStorage.setItem(metaKey, JSON.stringify(meta)); } catch (e) { /* sem espaço */ } }

  /* Junta a versão deste navegador (local) com a do banco (remoto), usando o retrato da última sincronização (base).
     Item que só um lado mudou: vale a mudança. Os dois mudaram o mesmo item: vale o deste navegador.
     Item novo de qualquer lado entra; item apagado de um lado sai, a menos que o outro lado o tenha mudado. */
  function juntar(local, remoto, base) {
    base = base || {};
    const out = { ...remoto, ...local };
    out.settings = hash(local.settings || {}) === base.settings ? remoto.settings : local.settings;
    COLS.forEach(c => {
      const L = local[c] || [], R = remoto[c] || [];
      const mapR = new Map(R.map(x => [x.id, x])), mapL = new Map(L.map(x => [x.id, x]));
      const res = [];
      L.forEach(x => {
        const k = c + ':' + x.id, r = mapR.get(x.id), hl = hash(x);
        if (r) res.push(hl === base[k] ? r : x);           // só o banco mudou -> banco; senão, o daqui
        else if (!(k in base) || hl !== base[k]) res.push(x); // novo aqui, ou mudou aqui e foi apagado lá
      });
      R.forEach(r => {
        if (mapL.has(r.id)) return;
        const k = c + ':' + r.id;
        if (!(k in base) || hash(r) !== base[k]) res.push(r); // novo lá, ou mudou lá e foi apagado aqui
      });
      out[c] = res;
    });
    return out;
  }

  async function rpc(fn, body) {
    const r = await fetch(`${CFG.supabaseUrl}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: CFG.supabaseKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_key: sessao && sessao.token, ...body }),
    });
    const out = await r.json().catch(() => null);
    if (!r.ok) {
      if (out && /forbidden/.test(out.message || '')) { sessao = null; try { localStorage.removeItem(CHAVE_SESSAO); } catch (e) { /* segue */ } if (app && app.semAcesso) app.semAcesso(); }
      throw new Error((out && out.message) || `Erro ${r.status}`);
    }
    return out;
  }
  // Chamada sem sessão (entrar, criar o acesso)
  async function rpcLivre(fn, body) {
    const r = await fetch(`${CFG.supabaseUrl}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: CFG.supabaseKey, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const out = await r.json().catch(() => null);
    if (!r.ok) throw new Error((out && out.message) || `Erro ${r.status}`);
    return out;
  }
  function falhou() {
    if (!avisouErro) { avisouErro = true; app.aviso('Sem conexão com o banco: as alterações ficam neste computador e sobem quando a internet voltar.'); }
  }
  function adotar(dados, rev) {
    app.trocar(dados);
    meta.rev = rev; meta.base = retrato(app.obter()); meta.dirty = false; gravarMeta();
  }

  async function enviar() {
    if (!CFG || !pronto || !sessao) return;
    if (enviando) return enviando.then(() => { if (meta.dirty) return enviar(); });
    enviando = (async () => {
      try {
        for (let tentativa = 0; tentativa < 4; tentativa++) {
          const marca = mudancas;
          const db = JSON.parse(JSON.stringify(app.obter())); // cópia: o que foi enviado não muda durante a espera
          const r = await rpc('app_state_put', { p_data: db, p_base_rev: meta.rev });
          if (r && r.ok) {
            meta.rev = r.rev; meta.base = retrato(db); meta.dirty = mudancas !== marca; gravarMeta();
            avisouErro = false;
            if (!meta.dirty) return;
            continue;
          }
          // Outra versão chegou antes: junta e tenta de novo a partir dela.
          const junto = juntar(app.obter(), r.data, meta.base);
          app.trocar(junto);
          meta.rev = r.rev; meta.base = retrato(r.data); meta.dirty = true; gravarMeta();
        }
      } catch (e) { falhou(); }
    })();
    return enviando.finally(() => { enviando = null; });
  }

  async function buscar() {
    if (!CFG || enviando || !sessao) return;
    if (app.ocupado()) return; // uma tarefa ou janela aberta: busca depois, para não trocar os dados no meio da edição
    try {
      const r = await rpc('app_state_get', {});
      avisouErro = false;
      if (!r) { meta.rev = 0; pronto = true; return enviar(); }   // banco vazio: sobe o que está aqui
      if (r.rev === meta.rev) { pronto = true; if (meta.dirty) return enviar(); return; }
      if (!meta.base) {
        // Primeira vez neste navegador e o banco já tem dados. Guarda a cópia daqui por segurança.
        try { localStorage.setItem(metaKey + '.copia-antiga', JSON.stringify(app.obter())); } catch (e) { /* sem espaço */ }
        // Navegador que só tinha os dados de exemplo: o banco vale.
        if (app.novo) { adotar(r.data, r.rev); pronto = true; return; }
        // Navegador com dados de verdade: junta os dois (nada se perde) e sobe o resultado.
        const junto = juntar(app.obter(), r.data, {});
        app.trocar(junto);
        meta.rev = r.rev; meta.base = retrato(r.data); meta.dirty = true; gravarMeta();
        pronto = true;
        return enviar();
      }
      if (!meta.dirty) { adotar(r.data, r.rev); pronto = true; return; }
      const junto = juntar(app.obter(), r.data, meta.base);
      app.trocar(junto);
      meta.rev = r.rev; meta.base = retrato(r.data); meta.dirty = true; gravarMeta();
      pronto = true;
      return enviar();
    } catch (e) { falhou(); }
  }

  let ligado = false;
  function ligar() {
    if (ligado || !CFG || !sessao) return;
    ligado = true;
    buscar();
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') buscar(); });
    window.addEventListener('focus', () => buscar());
    setInterval(() => { if (document.visibilityState === 'visible') buscar(); }, 60000);
  }
  return {
    ativo: !!CFG,
    sessao: () => sessao,
    chave: () => (sessao && sessao.token) || null,
    pendente: () => !!meta.dirty,
    async existeDono() { return !!(await rpcLivre('dono_existe', {})); },
    /* Primeiro acesso: só com a chave privada que está no computador do dono (js/config.js) */
    async criarAcesso(email, senha) {
      const t = await rpcLivre('dono_criar', { p_key: window.APP_CONFIG && window.APP_CONFIG.publishKey, p_email: email, p_senha: senha });
      sessao = { token: t, email: email.trim().toLowerCase() };
      localStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao)); ligar(); return true;
    },
    async entrar(email, senha) {
      const r = await rpcLivre('dono_entrar', { p_email: email, p_senha: senha });
      if (!r || !r.sessao) return r || { erro: 'invalido' };
      sessao = { token: r.sessao, email: email.trim().toLowerCase() };
      localStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao)); ligar(); return { ok: true };
    },
    async sair() {
      if (meta.dirty) { try { await enviar(); } catch (e) { /* segue */ } }
      const t = sessao && sessao.token;
      sessao = null; try { localStorage.removeItem(CHAVE_SESSAO); } catch (e) { /* segue */ }
      if (t) { try { await rpcLivre('dono_sair', { p_sessao: t }); } catch (e) { /* segue */ } }
      return !meta.dirty;
    },
    juntar, retrato, // usados nos testes
    /* chamado uma vez quando o sistema abre */
    iniciar(opcoes) {
      app = opcoes; metaKey = opcoes.chave + '.nuvem'; lerMeta();
      ligar();
    },
    /* chamado sempre que o sistema grava neste navegador */
    salvou() {
      if (!app) return;
      mudancas++; meta.dirty = true; gravarMeta();
      clearTimeout(timer); timer = setTimeout(enviar, 800);
    },
  };
})();
window.Nuvem = Nuvem; // app.js confere window.Nuvem (const no topo não vira propriedade de window)

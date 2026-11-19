/* Gestão de Projetos: aplicação */
(() => {
  'use strict';

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const viewEl = $('#view'), sideEl = $('#side'), topEl = $('#top');
  const drawerRoot = $('#drawer-root'), modalRoot = $('#modal-root'), toastRoot = $('#toast-root');

  // Nome sem acento e sem caixa, para comparar cadastros.
  const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const digits = s => String(s || '').replace(/\D/g, '');

  /* ---------------- Armazenamento ---------------- */
  function migrate(db) {
    const base = emptyDB();
    const out = { ...base, ...db, settings: { ...base.settings, ...(db.settings || {}) } };
    ['team', 'clients', 'companies', 'links', 'projects', 'stages', 'tasks'].forEach(k => { if (!Array.isArray(out[k])) out[k] = []; });
    out.tasks.forEach(t => { if (!Array.isArray(t.deliverables)) t.deliverables = []; });
    if (!Array.isArray(out.comments)) out.comments = [];
    if (!Array.isArray(out.history)) out.history = [];
    // O antigo campo "Empresa" do cliente vira um cadastro de empresa ligado à pessoa.
    out.clients.forEach(c => {
      const nome = String(c.company || '').trim();
      if (nome && nome !== 'Cliente de exemplo') {
        let e = out.companies.find(x => norm(x.name) === norm(nome));
        if (!e) { e = { id: uid(), name: nome, color: c.color, createdAt: new Date().toISOString() }; out.companies.push(e); }
        if (!out.links.some(l => l.clientId === c.id && l.companyId === e.id)) out.links.push({ id: uid(), clientId: c.id, companyId: e.id, role: 'socio' });
      }
      delete c.company;
    });
    out.settings.tema = Cosmos.valido(out.settings.tema);
    delete out.settings.accent;
    return out;
  }
  function persist() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(DB)); }
    catch (e) { toast('Não foi possível salvar neste navegador. Exporte um backup em Ajustes.', 'alert'); }
    if (window.Nuvem) Nuvem.salvou(); // sobe a alteração para o banco (js/nuvem.js)
  }
  let nasceuAgora = false; // este navegador ainda não tinha dados: abriu com os dados de exemplo
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const db = migrate(JSON.parse(raw));
        // Grava já no formato novo, para os cadastros convertidos manterem o mesmo código.
        try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); } catch (e) { /* sem espaço: segue só na memória */ }
        return db;
      }
    } catch (e) { /* segue para os dados de exemplo */ }
    const db = seedDB(); nasceuAgora = true;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); } catch (e) { /* sem armazenamento */ }
    return db;
  }
  let saveTimer;
  function save() { clearTimeout(saveTimer); saveTimer = setTimeout(persist, 120); scheduleSync(); }
  let DB = load();

  const UI = { sel: new Set(), taskView: 'lista', clientTab: 'ativo', cadTab: 'pessoas', cadView: 'cartoes', cadQ: '', cadSit: '', collapsed: {}, projModo: 'lista', gZoom: 'mes', filters: { q: '', client: '', member: '', status: 'abertas', late: false }, projF: { q: '', sit: 'ativo', cliente: '', empresa: '', resp: '', ritmo: '', ordem: 'prazo' }, projView: 'cartoes' };
  try { Object.assign(UI, JSON.parse(localStorage.getItem(STORE_KEY + '.ui') || '{}')); } catch (e) { /* ignora */ }
  function saveUI() {
    try { localStorage.setItem(STORE_KEY + '.ui', JSON.stringify({ taskView: UI.taskView, clientTab: UI.clientTab, cadTab: UI.cadTab, cadView: UI.cadView, collapsed: UI.collapsed, projModo: UI.projModo, gZoom: UI.gZoom, projF: { ...UI.projF, q: '' }, projView: UI.projView })); } catch (e) { /* ignora */ }
  }

  /* ---------------- Consultas ---------------- */
  const byId = (arr, id) => arr.find(x => x.id === id);
  const get = {
    client: id => byId(DB.clients, id),
    company: id => byId(DB.companies, id),
    project: id => byId(DB.projects, id),
    stage: id => byId(DB.stages, id),
    task: id => byId(DB.tasks, id),
    member: id => byId(DB.team, id),
  };
  const projectsOf = cid => DB.projects.filter(p => p.clientId === cid);
  const projectsOfCompany = eid => DB.projects.filter(p => p.companyId === eid);
  const byName = (a, b) => a.name.localeCompare(b.name, 'pt-BR');
  // Ligações pessoa ↔ empresa (uma pessoa pode ter várias empresas e uma empresa, várias pessoas).
  const linksOfClient = cid => DB.links.filter(l => l.clientId === cid).map(l => ({ l, e: get.company(l.companyId) })).filter(x => x.e).sort((a, b) => byName(a.e, b.e));
  const linksOfCompany = eid => DB.links.filter(l => l.companyId === eid).map(l => ({ l, c: get.client(l.clientId) })).filter(x => x.c).sort((a, b) => byName(a.c, b.c));
  const roleName = r => (PAPEIS.find(([k]) => k === r) || [, ''])[1];
  const sitName = s => (SITUACOES.find(([k]) => k === s) || [, ''])[1];
  const stagesOf = pid => DB.stages.filter(s => s.projectId === pid).sort((a, b) => a.order - b.order);
  const tasksOfStage = sid => DB.tasks.filter(t => t.stageId === sid).sort((a, b) => a.order - b.order);
  const tasksOfProject = pid => stagesOf(pid).flatMap(s => tasksOfStage(s.id));
  const today = () => localISO();
  const isDone = t => t.status === 'concluida';
  const isLate = t => !isDone(t) && !!t.dueDate && t.dueDate < today();
  function taskCtx(t) {
    const s = get.stage(t.stageId), p = s && get.project(s.projectId), c = p && get.client(p.clientId);
    return { s, p, c };
  }
  function stageInfo(stage) {
    const tasks = tasksOfStage(stage.id);
    const done = tasks.filter(isDone).length, total = tasks.length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    const moving = tasks.some(t => t.status === 'em_andamento' || t.status === 'em_revisao');
    const state = total && done === total ? 'concluida' : (done > 0 || moving) ? 'andamento' : 'pendente';
    return { stage, tasks, done, total, pct, state };
  }
  function projectInfo(p) {
    const stages = stagesOf(p.id).map(stageInfo);
    const tasks = stages.flatMap(x => x.tasks);
    const done = tasks.filter(isDone).length, total = tasks.length;
    const stagesDone = stages.filter(x => x.state === 'concluida').length;
    return {
      stages, tasks, done, total,
      pct: total ? Math.round((done / total) * 100) : 0,
      stagesDone, stagesLeft: stages.length - stagesDone,
      late: tasks.filter(isLate).length,
      current: stages.find(x => x.state !== 'concluida'),
    };
  }
  function clientInfo(c) {
    const ps = projectsOf(c.id);
    const active = ps.filter(p => p.status === 'ativo');
    const tasks = active.flatMap(p => tasksOfProject(p.id));
    const done = tasks.filter(isDone).length;
    const open = tasks.filter(t => !isDone(t));
    const next = open.filter(t => t.dueDate).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
    return { ps, active, tasks, open: open.length, late: tasks.filter(isLate).length, pct: tasks.length ? Math.round((done / tasks.length) * 100) : 0, next };
  }

  /* ---------------- Formatação ---------------- */
  const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const MONTHS_FULL = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const parseISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const fmtDate = (s, year = false) => { if (!s) return ''; const d = parseISO(s); return `${d.getDate()} ${MONTHS[d.getMonth()]}${year ? ' ' + d.getFullYear() : ''}`; };
  const fmtLong = d => `${d.getDate()} de ${MONTHS_FULL[d.getMonth()]} de ${d.getFullYear()}`;
  const daysUntil = s => Math.round((parseISO(s) - parseISO(today())) / 86400000);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  function relDue(t) {
    if (!t.dueDate) return { txt: 'Sem prazo', cls: 'dim' };
    if (isDone(t)) return { txt: fmtDate(t.dueDate), cls: '' };
    const n = daysUntil(t.dueDate);
    if (n < 0) return { txt: n === -1 ? 'Atrasada 1 dia' : `Atrasada ${-n} dias`, cls: 'late' };
    if (n === 0) return { txt: 'Hoje', cls: 'soon' };
    if (n === 1) return { txt: 'Amanhã', cls: 'soon' };
    if (n <= 3) return { txt: `Em ${n} dias`, cls: 'soon' };
    return { txt: fmtDate(t.dueDate), cls: '' };
  }
  const initials = name => (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  // Letra escura em cor clara e letra clara em cor escura.
  function inkFor(hex) {
    const h = String(hex || '').replace('#', '');
    if (!/^[0-9a-f]{6}$/i.test(h)) return '#031024';
    const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5 ? '#031024' : '#F6F9FF';
  }
  const safeImg = u => (/^data:image\/(jpeg|png|webp|gif);base64,[a-z0-9+/=]+$/i.test(String(u || '')) ? u : '');
  function avatar(m, cls = '') {
    if (!m) return `<span class="avatar empty ${cls}" title="Sem responsável">${icon('user', 14)}</span>`;
    const foto = safeImg(m.photo);
    if (foto) return `<span class="avatar foto ${cls}" style="background-image:url('${foto}')" role="img" aria-label="${esc(m.name)}" title="${esc(m.name)}"></span>`;
    return `<span class="avatar ${cls}" style="background:${esc(m.color)};color:${inkFor(m.color)}" title="${esc(m.name)}">${esc(initials(m.name))}</span>`;
  }
  // Pessoa ou empresa: mostra a foto quando tem.
  function clientAvatar(c, cls = 'lg') {
    const foto = safeImg(c.photo);
    if (foto) return `<span class="avatar foto ${cls}" style="background-image:url('${foto}')" role="img" aria-label="${esc(c.name)}"></span>`;
    return `<span class="avatar ${cls}" style="background:${esc(c.color || CLIENT_COLORS[0])};color:${inkFor(c.color || CLIENT_COLORS[0])}">${esc(initials(c.name))}</span>`;
  }
  const sitPill = s => s ? `<span class="pill sit-${esc(s)}">${esc(sitName(s))}</span>` : '';
  const statusPill = st => `<span class="pill ${STATUS[st].cls}">${STATUS[st].label}</span>`;
  const STAGE_STATE = { concluida: ['st-done', 'Concluída'], andamento: ['st-doing', 'Em andamento'], pendente: ['st-todo', 'Não iniciada'] };
  const stagePill = state => `<span class="pill ${STAGE_STATE[state][0]}">${STAGE_STATE[state][1]}</span>`;
  const projPill = st => `<span class="pill proj-${st}">${PROJECT_STATUS[st] || st}</span>`;

  /* ---------------- Toast ---------------- */
  function toast(msg, ic = 'check') {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `${icon(ic, 16)}<span>${esc(msg)}</span>`;
    toastRoot.appendChild(el);
    setTimeout(() => el.remove(), 2800);
  }

  /* ---------------- Roteamento ---------------- */
  function route() {
    const h = (location.hash || '#/').replace(/^#\/?/, '');
    const [name = '', id = ''] = h.split('/');
    return { name: name || 'painel', id: decodeURIComponent(id) };
  }
  let lastKey = '';
  let ANIM = false;
  function render() {
    const r = route();
    const key = `${r.name}/${r.id}`;
    ANIM = key !== lastKey;
    const a = document.activeElement;
    const focusId = a && a.id && viewEl.contains(a) ? a.id : null;
    const sel = focusId && typeof a.selectionStart === 'number' ? [a.selectionStart, a.selectionEnd] : null;

    Cosmos.aplicar(DB.settings.tema);
    document.body.classList.toggle('portal-mode', r.name === 'portal');
    document.body.classList.toggle('tela-painel', r.name === 'painel');
    viewEl.innerHTML = VIEWS[r.name] && r.name !== 'naoencontrado' ? VIEWS[r.name](r.id) : VIEWS.naoencontrado();
    renderSide(r);
    renderCrumbs(r);
    document.title = (r.name === 'portal' ? 'Acompanhamento' : 'Gestão de Projetos') + ' | ' + (DB.settings.businessName || '');
    if (ANIM) {
      window.scrollTo(0, 0); lastKey = key;
      // Trocar de tela sai do modo de seleção.
      if (UI.sel.size) { UI.sel = new Set(); viewEl.innerHTML = VIEWS[r.name] && r.name !== 'naoencontrado' ? VIEWS[r.name](r.id) : VIEWS.naoencontrado(); }
    }
    if (focusId) {
      const el = document.getElementById(focusId);
      if (el) { el.focus(); if (sel && el.setSelectionRange) { try { el.setSelectionRange(sel[0], sel[1]); } catch (e) { /* tipo sem seleção */ } } }
    }
    afterRender(r);
  }
  let renderTimer;
  const renderSoon = () => { clearTimeout(renderTimer); renderTimer = setTimeout(render, 250); };

  /* ---------------- Barra lateral e topo ---------------- */
  function renderSide(r) {
    const antes = sideEl.querySelector('.dock-ind.visivel');
    const de = antes ? { t: antes.style.transform, w: antes.style.width } : null;
    const navActive = n => {
      if (n === 'clientes') return ['clientes', 'cliente', 'empresa'].includes(r.name);
      if (n === 'projetos') return ['projetos', 'projeto'].includes(r.name);
      if (n === 'equipe') return ['equipe', 'membro'].includes(r.name);
      return r.name === n;
    };
    const late = DB.tasks.filter(t => { const { p } = taskCtx(t); return p && p.status === 'ativo' && isLate(t); }).length;
    const nav = [['painel', '#/', 'dashboard', 'Painel'], ['clientes', '#/clientes', 'users', 'Clientes'], ['projetos', '#/projetos', 'folder', 'Projetos'], ['tarefas', '#/tarefas', 'tasks', 'Tarefas', late], ['equipe', '#/equipe', 'user', 'Equipe'], ['ajustes', '#/ajustes', 'sliders', 'Ajustes']];
    sideEl.innerHTML = `
      <a class="dock-marca" href="#/" title="${esc(DB.settings.businessName || 'Painel')}" aria-label="Painel"><span class="marca-ponto"></span></a>
      <div class="dock-nav">
        <span class="dock-ind" aria-hidden="true"></span>
        ${nav.map(([n, href, ic, lbl, cont]) => `<a href="${href}" class="${navActive(n) ? 'active' : ''}" title="${lbl}"${navActive(n) ? ' aria-current="page"' : ''}>${icon(ic)}<span class="lbl">${lbl}</span>${cont ? `<span class="cont" title="${plural(cont, 'tarefa atrasada', 'tarefas atrasadas')}">${cont}</span>` : ''}</a>`).join('')}
      </div>
      <div class="menu-wrap">
        <button class="btn btn-primary btn-novo" data-act="new-menu" aria-haspopup="true" title="Novo">${icon('plus', 18)}<span>Novo</span></button>
        <div class="menu hidden" id="new-menu" role="menu">
          <button data-act="new-client" role="menuitem">${icon('users')} Novo cliente</button>
          <button data-act="new-project" role="menuitem">${icon('folder')} Novo projeto</button>
          <button data-act="new-member" role="menuitem">${icon('user')} Nova pessoa na equipe</button>
        </div>
      </div>`;
    const ind = sideEl.querySelector('.dock-ind');
    if (de && ind) {
      ind.style.transition = 'none';
      ind.style.transform = de.t; ind.style.width = de.w; ind.classList.add('visivel');
      void ind.offsetWidth;
      ind.style.transition = '';
    }
    moverIndicador();
  }
  // A pílula acesa desliza até o item ativo do menu.
  function moverIndicador() {
    const ind = sideEl.querySelector('.dock-ind'), ativo = sideEl.querySelector('.dock-nav a.active');
    if (!ind) return;
    if (!ativo) { ind.classList.remove('visivel'); return; }
    ind.style.transform = `translateX(${ativo.offsetLeft}px)`;
    ind.style.width = `${ativo.offsetWidth}px`;
    ind.classList.add('visivel');
  }
  window.addEventListener('resize', moverIndicador);

  function buildTop() {
    topEl.innerHTML = `
      <nav class="crumbs" id="crumbs" aria-label="Você está em"></nav>
      <div class="search">${icon('search', 16)}<input id="gsearch" type="search" placeholder="Buscar pessoa, empresa, projeto ou tarefa" autocomplete="off" aria-label="Buscar"><kbd>⌘K</kbd><div class="search-results hidden" id="gresults"></div></div>`;
  }
  function renderCrumbs(r) {
    const sep = icon('right', 14);
    let parts = [];
    if (r.name === 'painel') parts = [['Painel']];
    else if (r.name === 'clientes') parts = [['Clientes']];
    else if (r.name === 'cliente') { const c = get.client(r.id); parts = [['Clientes', '#/clientes'], [c ? c.name : '']]; }
    else if (r.name === 'empresa') { const e = get.company(r.id); parts = [['Clientes', '#/clientes'], ['Empresas', '#/clientes'], [e ? e.name : '']]; }
    else if (r.name === 'projeto') {
      const p = get.project(r.id), c = p && get.client(p.clientId);
      parts = [['Projetos', '#/projetos'], [c ? c.name : '', c ? `#/cliente/${c.id}` : null], [p ? p.name : '']];
    }
    else if (r.name === 'tarefas') parts = [['Tarefas']];
    else if (r.name === 'projetos') parts = [['Projetos']];
    else if (r.name === 'equipe') parts = [['Equipe']];
    else if (r.name === 'membro') { const m = get.member(r.id); parts = [['Equipe', '#/equipe'], [m ? m.name : '']]; }
    else if (r.name === 'ajustes') parts = [['Ajustes']];
    $('#crumbs').innerHTML = parts.map(([t, href], i) => (i ? sep : '') + (href ? `<a href="${href}">${esc(t)}</a>` : `<span class="cur">${esc(t)}</span>`)).join('');
  }

  /* ---------------- Telas ---------------- */
  const VIEWS = {};

  VIEWS.naoencontrado = (msg = 'Esta página não existe.') => `
    <div class="empty-state" style="margin-top:40px"><h3>${esc(typeof msg === 'string' ? msg : 'Esta página não existe.')}</h3><p>Ela pode ter sido excluída.</p><a class="btn" href="#/">Voltar ao painel</a></div>`;

  /* Painel geral */
  VIEWS.painel = () => {
    const active = DB.projects.filter(p => p.status === 'ativo');
    const infos = active.map(p => ({ p, c: get.client(p.clientId), ...projectInfo(p) }));
    const tasks = infos.flatMap(i => i.tasks);
    const open = tasks.filter(t => !isDone(t));
    const late = tasks.filter(isLate);
    const done = tasks.length - open.length;
    const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
    const weekAgo = Date.now() - 7 * 86400000;
    const weekDone = DB.tasks.filter(t => t.completedAt && new Date(t.completedAt).getTime() >= weekAgo).length;
    const activeClients = new Set(active.map(p => p.clientId)).size;

    const h = new Date().getHours();
    const hello = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
    const now = new Date();

    const counts = STATUS_ORDER.map(s => ({ s, n: tasks.filter(t => t.status === s).length }));
    const colors = { aguardando: 'var(--st-wait)', a_fazer: 'var(--st-todo)', em_andamento: 'var(--st-doing)', em_revisao: 'var(--st-review)', concluida: 'var(--st-done)' };

    // Entregas por semana (8 semanas)
    const monday = new Date(); monday.setHours(0, 0, 0, 0); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const weeks = [], wl = [];
    for (let i = 7; i >= 0; i--) {
      const ws = new Date(monday); ws.setDate(ws.getDate() - i * 7);
      const we = new Date(ws); we.setDate(we.getDate() + 7);
      weeks.push(DB.tasks.filter(t => t.completedAt && new Date(t.completedAt) >= ws && new Date(t.completedAt) < we).length);
      wl.push(i === 0 ? 'Esta' : `${ws.getDate()} ${MONTHS[ws.getMonth()]}`);
    }

    const upcoming = open.slice().sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999')).slice(0, 6);

    const members = DB.team.map(m => {
      const mine = tasks.filter(t => t.assigneeId === m.id);
      return { m, open: mine.filter(t => !isDone(t)).length, done: mine.filter(isDone).length, late: mine.filter(isLate).length, total: mine.length };
    });
    const unassigned = open.filter(t => !t.assigneeId || !get.member(t.assigneeId)).length;

    if (!DB.clients.length) {
      return `
        <div class="page-head"><div><h1>${hello}, ${esc(DB.settings.ownerName || '')}<span class="ponto">.</span></h1><p>Comece cadastrando seu primeiro cliente. Depois crie um projeto para ele, escolha um modelo de etapas e acompanhe tudo por aqui.</p></div></div>
        <div class="empty-state"><h3>Nenhum cliente cadastrado</h3><p>Cada cliente pode ter vários projetos, e cada projeto tem etapas e tarefas.</p><button class="btn btn-primary" data-act="new-client">${icon('plus', 16)} Cadastrar cliente</button></div>`;
    }

    return `
    <div class="grid dash" style="margin-top:22px">
      <section class="panel hero">
        <div class="hero-top">
          <div>
            <p class="hello">${hello}, ${esc(DB.settings.ownerName || '')}</p>
            <h1>${plural(active.length, 'projeto em andamento', 'projetos em andamento')}<span class="ponto">.</span></h1>
            <p class="lead">${plural(open.length, 'tarefa aberta', 'tarefas abertas')}${late.length ? `, ${plural(late.length, 'atrasada', 'atrasadas')}` : ''} e ${plural(weekDone, 'entrega concluída', 'entregas concluídas')} nos últimos 7 dias.</p>
          </div>
          <div class="clock"><div class="t" id="clock-t">${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}</div><div class="d">${now.toLocaleDateString('pt-BR', { weekday: 'long' })}, ${fmtLong(now)}</div></div>
        </div>
        <div class="stats">
          <div class="stat"><span class="k">${icon('users', 16)} Clientes ativos</span><span class="v">${activeClients}</span></div>
          <div class="stat"><span class="k">${icon('folder', 16)} Projetos ativos</span><span class="v">${active.length}</span></div>
          <div class="stat"><span class="k">${icon('tasks', 16)} Tarefas abertas</span><span class="v">${open.length}</span></div>
          <div class="stat ${late.length ? 'alert' : ''}"><span class="k">${icon('alert', 16)} Atrasadas</span><span class="v">${late.length}</span></div>
        </div>
      </section>

      <section class="panel overall">
        ${Charts.anel3d(pct, { tam: 400, sub: 'concluído' })}
        <div class="overall-txt"><h3>Progresso dos projetos ativos</h3><p>${done} de ${plural(tasks.length, 'tarefa concluída', 'tarefas concluídas')} somando todos os projetos em andamento.</p></div>
      </section>

      <section class="panel projects">
        <div class="panel-head"><h3>Projetos ativos</h3><a class="link-more" href="#/projetos">Ver todos os projetos</a></div>
        <div class="proj-rows">
          ${infos.length ? infos.sort((a, b) => b.pct - a.pct).map(i => `
            <a class="proj-row" href="#/projeto/${i.p.id}">
              <div style="min-width:0">
                <div class="t">${esc(i.p.name)}</div>
                <div class="c"><span class="dot" style="color:${esc(i.c?.color)};background:${esc(i.c?.color)}"></span>${esc(i.c?.name || 'Sem cliente')}</div>
              </div>
              <div>
                ${Charts.trilho(i.pct)}
                <div class="meta">${i.stagesDone} de ${plural(i.stages.length, 'etapa', 'etapas')}${i.late ? `. <span style="color:var(--danger)">${plural(i.late, 'tarefa atrasada', 'tarefas atrasadas')}</span>` : ''}</div>
              </div>
              <div class="num">${i.pct}%</div>
            </a>`).join('') : '<p class="muted">Nenhum projeto ativo.</p>'}
        </div>
      </section>

      <section class="panel status">
        <div class="panel-head"><h3>Status das tarefas</h3><span class="sub">${plural(tasks.length, 'tarefa', 'tarefas')} dos projetos ativos</span></div>
        <div class="medidores">${counts.map(x => Charts.meiaLua(tasks.length ? (x.n / tasks.length) * 100 : 0, { cor: x.s === 'a_fazer' ? 'rgba(var(--claro-rgb), .75)' : colors[x.s], rotulo: STATUS[x.s].label, detalhe: `${x.n} de ${tasks.length}` })).join('')}</div>
      </section>

      <section class="panel deadlines">
        <div class="panel-head"><h3>Próximos prazos</h3><a class="link-more" href="#/tarefas">Ver todas as tarefas</a></div>
        <div class="due-list">
          ${upcoming.length ? upcoming.map(t => {
            const { p, c } = taskCtx(t); const late = isLate(t);
            const d = t.dueDate ? parseISO(t.dueDate) : null;
            return `<button class="due-item" data-act="open-task" data-id="${t.id}">
              <span class="due-date ${late ? 'late' : ''}">${d ? `<b>${d.getDate()}</b><span>${MONTHS[d.getMonth()]}</span>` : '<b>–</b><span>sem</span>'}</span>
              <span style="min-width:0"><span class="t" style="display:block">${esc(t.title)}</span><span class="s" style="display:block">${esc(c?.name)} / ${esc(p?.name)}</span></span>
              <span style="display:flex;gap:10px;align-items:center">${avatar(get.member(t.assigneeId))}<span class="due ${relDue(t).cls}">${relDue(t).txt}</span></span>
            </button>`;
          }).join('') : '<p class="muted">Nada pendente. Todas as tarefas estão concluídas.</p>'}
        </div>
      </section>

      <section class="panel load">
        <div class="panel-head"><h3>Tarefas por responsável</h3><a class="link-more" href="#/equipe">Gerenciar equipe</a></div>
        <div class="load-grid">
          ${members.map(x => `
            <div class="load-item">
              <div class="who">${avatar(x.m, '')}<div><b>${esc(x.m.name)}</b><span>${esc(x.m.role)}</span></div></div>
              <div class="stack">${x.total ? `<i style="width:${(x.done / x.total) * 100}%;background:var(--acc)"></i><i style="width:${((x.open - x.late) / x.total) * 100}%;background:var(--st-doing);opacity:.55"></i><i style="width:${(x.late / x.total) * 100}%;background:var(--danger)"></i>` : ''}</div>
              <div class="nums"><span><b>${x.open}</b> abertas</span><span><b>${x.done}</b> concluídas</span>${x.late ? `<span style="color:var(--danger)"><b style="color:inherit">${x.late}</b> atrasadas</span>` : ''}</div>
            </div>`).join('')}
          ${unassigned ? `<div class="load-item"><div class="who">${avatar(null)}<div><b>Sem responsável</b><span>Defina quem vai fazer</span></div></div><div class="nums"><span><b>${unassigned}</b> abertas</span></div></div>` : ''}
        </div>
      </section>
    </div>`;
  };

  /* Contatos rápidos: WhatsApp, e-mail, Instagram e site */
  function waLink(tel) {
    let d = digits(tel);
    if (d.length === 10 || d.length === 11) d = '55' + d;
    return d.length >= 12 ? `https://wa.me/${d}` : '';
  }
  function redeLink(k, v) {
    v = String(v || '').trim(); if (!v) return '';
    if (/^https?:\/\//i.test(v)) return v;
    const h = v.replace(/^@/, '');
    const base = { instagram: 'https://instagram.com/', tiktok: 'https://tiktok.com/@', youtube: 'https://youtube.com/@', facebook: 'https://facebook.com/', linkedin: 'https://linkedin.com/in/' }[k];
    return base ? base + h : PortalRender.safeUrl(v);
  }
  function quickContacts(x) {
    const out = [];
    const wa = waLink(x.phone);
    if (wa) out.push(`<a class="btn sm" href="${esc(wa)}" target="_blank" rel="noopener">${icon('chat', 15)} WhatsApp</a>`);
    if (x.email) out.push(`<a class="btn sm" href="mailto:${esc(x.email)}">${icon('mail', 15)} E-mail</a>`);
    if (x.redes?.instagram) out.push(`<a class="btn sm" href="${esc(redeLink('instagram', x.redes.instagram))}" target="_blank" rel="noopener">${icon('instagram', 15)} Instagram</a>`);
    if (x.site) out.push(`<a class="btn sm" href="${esc(PortalRender.safeUrl(x.site))}" target="_blank" rel="noopener">${icon('globe', 15)} Site</a>`);
    return out.length ? `<div class="contato-rapido">${out.join('')}</div>` : '';
  }
  // Ficha de dados: só aparece o que está preenchido.
  function dadosList(linhas) {
    const ok = linhas.filter(([, v]) => v);
    return ok.length ? `<dl class="dados">${ok.map(([k, v, raw]) => `<div><dt>${k}</dt><dd>${raw ? v : esc(v)}</dd></div>`).join('')}</dl>` : '';
  }
  const enderecoTxt = x => [[x.endereco, x.numero].filter(Boolean).join(', '), x.complemento, x.bairro, [x.cidade, x.uf].filter(Boolean).join(' / '), x.cep].filter(Boolean).join(' · ');
  const redesHTML = x => REDES.filter(([k]) => x.redes?.[k]).map(([k, l]) => `<a href="${esc(redeLink(k, x.redes[k]))}" target="_blank" rel="noopener">${esc(l)}: ${esc(x.redes[k])}</a>`).join('<br>');
  const empresasTxt = cid => linksOfClient(cid).map(({ l, e }) => `${roleName(l.role)} · ${e.name}`).join(', ');

  /* Cadastros: pessoas e empresas */
  function cadMatch(x, extra = '') {
    const q = norm(UI.cadQ);
    if (!q) return true;
    return norm([x.name, x.email, x.phone, x.cidade, x.segmento, x.razaoSocial, x.cnpj, x.cpf, extra].join(' ')).includes(q);
  }
  VIEWS.clientes = () => {
    const tab = UI.cadTab === 'empresas' ? 'empresas' : 'pessoas';
    const lista = UI.cadView === 'lista';
    const pessoas = DB.clients.slice().sort(byName).filter(c => cadMatch(c, empresasTxt(c.id)) && (!UI.cadSit || c.situacao === UI.cadSit));
    const empresas = DB.companies.slice().sort(byName).filter(e => cadMatch(e, linksOfCompany(e.id).map(x => x.c.name).join(' ')));
    const itens = tab === 'pessoas' ? pessoas : empresas;
    const vazioTudo = !DB.clients.length && !DB.companies.length;
    const toolbar = `
      <div class="cad-bar">
        <div class="tabs" role="tablist">
          <button role="tab" class="${tab === 'pessoas' ? 'on' : ''}" data-act="cad-tab" data-v="pessoas">${icon('users', 15)} Pessoas <span class="dim">${DB.clients.length}</span></button>
          <button role="tab" class="${tab === 'empresas' ? 'on' : ''}" data-act="cad-tab" data-v="empresas">${icon('building', 15)} Empresas <span class="dim">${DB.companies.length}</span></button>
        </div>
        <input type="search" class="field-inline cad-busca" id="cad-q" data-cad="cadQ" value="${esc(UI.cadQ)}" placeholder="${tab === 'pessoas' ? 'Buscar pessoa, empresa, cidade…' : 'Buscar empresa, CNPJ, segmento…'}" aria-label="Buscar nos cadastros">
        ${tab === 'pessoas' ? `<select class="field-inline" data-cad="cadSit" aria-label="Situação"><option value="">Todas as situações</option>${SITUACOES.map(([k, l]) => `<option value="${k}" ${UI.cadSit === k ? 'selected' : ''}>${l}</option>`).join('')}</select>` : ''}
        <div class="tabs cad-vista" role="group" aria-label="Forma de ver">
          <button class="${lista ? '' : 'on'}" data-act="cad-view" data-v="cartoes" title="Cartões" aria-label="Ver em cartões">${icon('grid', 16)}</button>
          <button class="${lista ? 'on' : ''}" data-act="cad-view" data-v="lista" title="Lista" aria-label="Ver em lista">${icon('list', 16)}</button>
        </div>
      </div>`;
    let corpo;
    if (vazioTudo) corpo = `<div class="empty-state"><h3>Nenhum cadastro ainda</h3><p>Cadastre as pessoas que contratam você e as empresas delas. Se já usa o Orbe, traga os cadastros em Ajustes.</p><div class="actions" style="justify-content:center"><button class="btn btn-primary" data-act="new-client">${icon('plus', 16)} Nova pessoa</button><a class="btn" href="#/ajustes">${icon('upload', 16)} Importar do Orbe</a></div></div>`;
    else if (!itens.length) corpo = `<div class="empty-state"><h3>Nada encontrado</h3><p>${UI.cadQ || UI.cadSit ? 'Nenhum cadastro com esse filtro. Limpe a busca para ver todos.' : tab === 'pessoas' ? 'Nenhuma pessoa cadastrada ainda.' : 'Nenhuma empresa cadastrada ainda.'}</p>${UI.cadQ || UI.cadSit ? `<button class="btn" data-act="cad-clear">Limpar busca</button>` : `<button class="btn btn-primary" data-act="${tab === 'pessoas' ? 'new-client' : 'new-company'}">${icon('plus', 16)} ${tab === 'pessoas' ? 'Nova pessoa' : 'Nova empresa'}</button>`}</div>`;
    else if (lista) corpo = tab === 'pessoas' ? `<div class="panel table cad-table">
        <div class="cad-row head"><span>Pessoa</span><span>Empresas</span><span>Contato</span><span>Projetos ativos</span><span>Situação</span></div>
        ${pessoas.map(c => { const i = clientInfo(c); return `<a class="cad-row" href="#/cliente/${c.id}"><span class="who-cell">${clientAvatar(c, '')}<span>${esc(c.name)}</span></span><span class="where">${esc(empresasTxt(c.id)) || '<span class="dim">Sem empresa</span>'}</span><span class="where">${esc(c.phone || c.email || '')}</span><span>${i.active.length ? `${i.active.length} · ${i.pct}%` : '<span class="dim">Nenhum</span>'}</span><span>${sitPill(c.situacao)}</span></a>`; }).join('')}
      </div>` : `<div class="panel table cad-table">
        <div class="cad-row head"><span>Empresa</span><span>Pessoas</span><span>Segmento</span><span>Projetos ativos</span><span>Cidade</span></div>
        ${empresas.map(e => { const ps = projectsOfCompany(e.id).filter(p => p.status === 'ativo').length; return `<a class="cad-row" href="#/empresa/${e.id}"><span class="who-cell">${clientAvatar(e, '')}<span>${esc(e.name)}</span></span><span class="where">${esc(linksOfCompany(e.id).map(x => x.c.name).join(', ')) || '<span class="dim">Ninguém ligado</span>'}</span><span class="where">${esc(e.segmento || '')}</span><span>${ps || '<span class="dim">Nenhum</span>'}</span><span class="where">${esc([e.cidade, e.uf].filter(Boolean).join(' / '))}</span></a>`; }).join('')}
      </div>`;
    else corpo = tab === 'pessoas' ? `<div class="grid client-grid">${pessoas.map(c => {
        const i = clientInfo(c), ls = linksOfClient(c.id);
        return `<a class="panel client-card" href="#/cliente/${c.id}">
          <div class="row">${clientAvatar(c)}<div style="min-width:0;flex:1"><h3>${esc(c.name)}</h3><div class="sub">${ls.length ? esc(ls.map(x => x.e.name).join(' · ')) : 'Sem empresa'}</div></div>${sitPill(c.situacao)}</div>
          <div class="body">
            ${Charts.ring(i.pct, { size: 96, stroke: 8 })}
            <div class="facts">
              <span><b>${i.active.length}</b> ${i.active.length === 1 ? 'projeto ativo' : 'projetos ativos'}</span>
              <span><b>${i.open}</b> ${i.open === 1 ? 'tarefa aberta' : 'tarefas abertas'}${i.late ? ` <span style="color:var(--danger)">(${i.late} ${i.late === 1 ? 'atrasada' : 'atrasadas'})</span>` : ''}</span>
              <span>Próximo prazo: <b>${i.next ? fmtDate(i.next.dueDate) : 'nenhum'}</b></span>
            </div>
          </div>
        </a>`;
      }).join('')}</div>` : `<div class="grid client-grid">${empresas.map(e => {
        const ls = linksOfCompany(e.id), ps = projectsOfCompany(e.id), at = ps.filter(p => p.status === 'ativo');
        return `<a class="panel client-card" href="#/empresa/${e.id}">
          <div class="row">${clientAvatar(e)}<div style="min-width:0;flex:1"><h3>${esc(e.name)}</h3><div class="sub">${esc([e.segmento, [e.cidade, e.uf].filter(Boolean).join('/')].filter(Boolean).join(' · ')) || 'Empresa'}</div></div></div>
          <div class="pessoas-mini">${ls.length ? ls.slice(0, 4).map(({ l, c }) => `<span class="pm">${clientAvatar(c, '')}<span><b>${esc(c.name)}</b><small>${esc(roleName(l.role))}</small></span></span>`).join('') + (ls.length > 4 ? `<span class="dim">+${ls.length - 4}</span>` : '') : '<span class="dim">Nenhuma pessoa ligada</span>'}</div>
          <div class="facts row-facts"><span><b>${at.length}</b> ${at.length === 1 ? 'projeto ativo' : 'projetos ativos'}</span><span><b>${ps.length}</b> no total</span></div>
        </a>`;
      }).join('')}</div>`;
    return `
      <div class="page-head">
        <div><h1>Clientes<span class="ponto">.</span></h1><p>${plural(DB.clients.length, 'pessoa', 'pessoas')} e ${plural(DB.companies.length, 'empresa', 'empresas')}. Uma pessoa pode ter várias empresas.</p></div>
        <div class="actions">
          <button class="btn ${tab === 'empresas' ? 'btn-primary' : ''}" data-act="new-company">${icon('building', 16)} Nova empresa</button>
          <button class="btn ${tab === 'pessoas' ? 'btn-primary' : ''}" data-act="new-client">${icon('plus', 16)} Nova pessoa</button>
        </div>
      </div>
      ${vazioTudo ? '' : toolbar}
      ${corpo}`;
  };

  // Projetos separados por empresa quando a pessoa tem projetos em mais de uma.
  function projectGroups(list, show = {}) {
    const ids = [...new Set(list.map(p => p.companyId || ''))];
    if (ids.length < 2 && !(ids[0] && show.always)) return `<div class="grid proj-grid">${list.map(p => projectCard(p, show)).join('')}</div>`;
    return ids.sort((a, b) => (a ? get.company(a)?.name || '' : '￿').localeCompare(b ? get.company(b)?.name || '' : '￿', 'pt-BR')).map(id => {
      const e = id && get.company(id);
      return `<div class="grupo-empresa"><h3>${e ? `<a href="#/empresa/${e.id}">${clientAvatar(e, '')}${esc(e.name)}</a>` : `${icon('folder', 16)} Sem empresa definida`}</h3>
        <div class="grid proj-grid">${list.filter(p => (p.companyId || '') === id).map(p => projectCard(p, { ...show, company: false })).join('')}</div></div>`;
    }).join('');
  }

  /* Página da pessoa */
  VIEWS.cliente = id => {
    const c = get.client(id);
    if (!c) return VIEWS.naoencontrado('Cliente não encontrado.');
    const ps = projectsOf(c.id);
    const ls = linksOfClient(c.id);
    const tabs = [['ativo', 'Ativos'], ['pausado', 'Pausados'], ['concluido', 'Concluídos'], ['todos', 'Todos']];
    const tab = UI.clientTab;
    const list = tab === 'todos' ? ps : ps.filter(p => p.status === tab);
    const dados = dadosList([
      ['WhatsApp', c.phone], ['Segundo telefone', c.phone2], ['E-mail', c.email], ['CPF', c.cpf],
      ['Cliente desde', c.since ? fmtDate(c.since, true) : ''], ['Aniversário', c.birthday ? fmtDate(c.birthday) : ''],
      ['Endereço', enderecoTxt(c)], ['Redes', redesHTML(c), true], ['Observações', c.notes],
    ]);
    return `
      <div class="page-head">
        <div class="client-head">
          ${clientAvatar(c, 'xl')}
          <div class="info">
            <div class="nome-linha"><h1>${esc(c.name)}<span class="ponto">.</span></h1>${sitPill(c.situacao)}</div>
            ${ls.length ? `<p class="empresas-linha">${ls.map(({ l, e }) => `<a href="#/empresa/${e.id}">${icon('building', 14)} ${esc(e.name)}<small>${esc(roleName(l.role))}</small></a>`).join('')}</p>` : ''}
            ${quickContacts(c)}
          </div>
        </div>
        <div class="actions">
          <a class="btn" href="#/portal/${c.id}">${icon('eye', 16)} Visão do cliente</a>
          <button class="btn" data-act="share-client" data-id="${c.id}">${icon('link', 16)} ${c.shareToken ? 'Link do cliente' : 'Criar link do cliente'}</button>
          <button class="icon-btn" data-act="edit-client" data-id="${c.id}" title="Editar cadastro" aria-label="Editar cadastro">${icon('edit', 16)}</button>
          <button class="icon-btn danger" data-act="delete-client" data-id="${c.id}" title="Excluir pessoa" aria-label="Excluir pessoa">${icon('trash', 16)}</button>
          <button class="btn btn-primary" data-act="new-project" data-id="${c.id}">${icon('plus', 16)} Novo projeto</button>
        </div>
      </div>
      <div class="grid ficha">
        <section class="panel">
          <div class="panel-head"><h3>Empresas</h3><button class="link-more" data-act="link-company" data-id="${c.id}">${icon('plus', 14)} Ligar a uma empresa</button></div>
          ${ls.length ? `<ul class="vinculos">${ls.map(({ l, e }) => `<li>
            <a class="vinc-nome" href="#/empresa/${e.id}">${clientAvatar(e, '')}<span><b>${esc(e.name)}</b><small>${esc([e.segmento, e.cnpj].filter(Boolean).join(' · '))}</small></span></a>
            <button class="pill plain papel" data-act="edit-link" data-id="${l.id}" title="Trocar o papel">${esc(roleName(l.role))}</button>
            <button class="icon-btn sm ghost danger" data-act="unlink" data-id="${l.id}" title="Desligar da empresa" aria-label="Desligar ${esc(c.name)} de ${esc(e.name)}">${icon('unlink', 15)}</button>
          </li>`).join('')}</ul>` : `<p class="muted vazio-curto">${esc(c.name)} ainda não está ligada a nenhuma empresa.</p>`}
        </section>
        <section class="panel">
          <div class="panel-head"><h3>Cadastro</h3><button class="link-more" data-act="edit-client" data-id="${c.id}">${icon('edit', 14)} Editar</button></div>
          ${dados || `<p class="muted vazio-curto">Só o nome está preenchido. <button class="link-more" data-act="edit-client" data-id="${c.id}">Completar o cadastro</button></p>`}
        </section>
      </div>
      <div class="section-head">
        <h2>Projetos</h2>
        <div class="tabs" role="tablist">${tabs.map(([v, l]) => {
          const n = v === 'todos' ? ps.length : ps.filter(p => p.status === v).length;
          return `<button role="tab" class="${tab === v ? 'on' : ''}" data-act="client-tab" data-v="${v}">${l} <span class="dim">${n}</span></button>`;
        }).join('')}</div>
      </div>
      ${list.length ? projectGroups(list) :
        `<div class="empty-state"><h3>${ps.length ? 'Nenhum projeto nesta aba' : 'Nenhum projeto contratado ainda'}</h3><p>${ps.length ? 'Troque de aba para ver os outros projetos.' : `Crie o primeiro projeto de ${esc(c.name)}. Você pode partir de um modelo pronto de etapas.`}</p>${ps.length ? '' : `<button class="btn btn-primary" data-act="new-project" data-id="${c.id}">${icon('plus', 16)} Criar projeto</button>`}</div>`}`;
  };

  /* Página da empresa */
  VIEWS.empresa = id => {
    const e = get.company(id);
    if (!e) return VIEWS.naoencontrado('Empresa não encontrada.');
    const ls = linksOfCompany(e.id);
    const ps = projectsOfCompany(e.id);
    const dados = dadosList([
      ['CNPJ', e.cnpj], ['Razão social', e.razaoSocial], ['Segmento', e.segmento], ['WhatsApp', e.phone], ['Segundo telefone', e.phone2],
      ['E-mail', e.email], ['E-mail do financeiro', e.emailFinanceiro], ['Site', e.site],
      ['Inscrição municipal', e.inscricaoMunicipal], ['Inscrição estadual', e.inscricaoEstadual],
      ['Endereço', enderecoTxt(e)], ['Redes', redesHTML(e), true],
    ]);
    const negocio = dadosList([['O que faz', e.oQueFaz], ['O que vende', e.oQueVende], ['Público-alvo', e.publico], ['Momento atual', e.momento], ['Objetivos', e.objetivos], ['Desafios e dores', e.desafios], ['Observações', e.notes]]);
    return `
      <div class="page-head">
        <div class="client-head">
          ${clientAvatar(e, 'xl')}
          <div class="info">
            <h1>${esc(e.name)}<span class="ponto">.</span></h1>
            <p class="muted" style="margin-top:4px">${esc([e.razaoSocial !== e.name ? e.razaoSocial : '', e.segmento, [e.cidade, e.uf].filter(Boolean).join('/')].filter(Boolean).join(' · ')) || 'Empresa'}</p>
            ${quickContacts(e)}
          </div>
        </div>
        <div class="actions">
          <button class="icon-btn" data-act="edit-company" data-id="${e.id}" title="Editar empresa" aria-label="Editar empresa">${icon('edit', 16)}</button>
          <button class="icon-btn danger" data-act="delete-company" data-id="${e.id}" title="Excluir empresa" aria-label="Excluir empresa">${icon('trash', 16)}</button>
          <button class="btn btn-primary" data-act="new-project" data-company="${e.id}">${icon('plus', 16)} Novo projeto</button>
        </div>
      </div>
      <div class="grid ficha">
        <section class="panel">
          <div class="panel-head"><h3>Pessoas</h3><button class="link-more" data-act="link-person" data-id="${e.id}">${icon('plus', 14)} Ligar uma pessoa</button></div>
          ${ls.length ? `<ul class="vinculos">${ls.map(({ l, c }) => `<li>
            <a class="vinc-nome" href="#/cliente/${c.id}">${clientAvatar(c, '')}<span><b>${esc(c.name)}</b><small>${esc([c.phone, c.email].filter(Boolean)[0] || '')}</small></span></a>
            <button class="pill plain papel" data-act="edit-link" data-id="${l.id}" title="Trocar o papel">${esc(roleName(l.role))}</button>
            <button class="icon-btn sm ghost danger" data-act="unlink" data-id="${l.id}" title="Desligar da empresa" aria-label="Desligar ${esc(c.name)} de ${esc(e.name)}">${icon('unlink', 15)}</button>
          </li>`).join('')}</ul>` : `<p class="muted vazio-curto">Nenhuma pessoa ligada a esta empresa.</p>`}
        </section>
        <section class="panel">
          <div class="panel-head"><h3>Dados da empresa</h3><button class="link-more" data-act="edit-company" data-id="${e.id}">${icon('edit', 14)} Editar</button></div>
          ${dados || `<p class="muted vazio-curto">Só o nome está preenchido. <button class="link-more" data-act="edit-company" data-id="${e.id}">Completar o cadastro</button></p>`}
        </section>
        ${negocio ? `<section class="panel full"><div class="panel-head"><h3>Sobre o negócio</h3></div>${negocio}</section>` : ''}
      </div>
      <div class="section-head"><h2>Projetos</h2></div>
      ${ps.length ? `<div class="grid proj-grid">${ps.map(p => projectCard(p, { client: true, company: false })).join('')}</div>` :
        `<div class="empty-state"><h3>Nenhum projeto desta empresa</h3><p>Crie um projeto e escolha esta empresa, ou edite um projeto existente.</p><button class="btn btn-primary" data-act="new-project" data-company="${e.id}">${icon('plus', 16)} Criar projeto</button></div>`}`;
  };

  function projectCard(p, show = {}) {
    const i = projectInfo(p);
    const e = show.company !== false && p.companyId && get.company(p.companyId);
    const c = show.client && get.client(p.clientId);
    const quem = [e && `<span class="pw">${icon('building', 13)} ${esc(e.name)}</span>`, c && `<span class="pw">${icon('user', 13)} ${esc(c.name)}</span>`].filter(Boolean).join('<span class="sep"></span>');
    return `<a class="panel proj-card" href="#/projeto/${p.id}">
      <div class="top-line">
        <div style="min-width:0">${projPill(p.status)}<h3 style="margin-top:12px">${esc(p.name)}</h3>${quem ? `<p class="proj-who">${quem}</p>` : ''}</div>
        ${Charts.eclipse(i.pct, { size: 116 })}
      </div>
      ${p.description ? `<p class="desc">${esc(p.description)}</p>` : ''}
      <div class="facts">
        <div class="fact"><div class="k">Etapas concluídas</div><div class="v">${i.stagesDone}<small> de ${i.stages.length}</small></div></div>
        <div class="fact"><div class="k">Etapas restantes</div><div class="v">${i.stagesLeft}</div></div>
        <div class="fact"><div class="k">Tarefas concluídas</div><div class="v">${i.done}<small> de ${i.total}</small></div></div>
        <div class="fact"><div class="k">Entrega prevista</div><div class="v" style="font-size:17px;padding-top:3px">${p.dueDate ? fmtDate(p.dueDate, true) : '<span class="dim">Sem data</span>'}</div></div>
      </div>
      <div>
        <div class="stage-dots">${i.stages.map(s => `<i class="${s.state}" style="--p:${s.pct}%" title="${esc(s.stage.name)}: ${s.pct}%"></i>`).join('')}</div>
        <div class="stage-dots-lbl"><span>${i.current ? `Etapa atual: ${esc(i.current.stage.name)}` : (i.stages.length ? 'Todas as etapas concluídas' : 'Sem etapas')}</span>${i.late ? `<span style="color:var(--danger)">${plural(i.late, 'atrasada', 'atrasadas')}</span>` : ''}</div>
        ${show.ritmo ? `<div class="proj-ritmo"><span class="pill ritmo-${show.ritmo.k}">${esc(show.ritmo.txt)}</span></div>` : ''}
      </div>
    </a>`;
  }

  function pipelineData(info) {
    return info.stages.map((x, i) => ({
      id: x.stage.id, index: i + 1, name: x.stage.name, state: x.state, pct: x.pct,
      meta: x.total ? `${x.done} de ${x.total} ${x.total === 1 ? 'tarefa' : 'tarefas'}` : 'Sem tarefas',
    }));
  }
  function pipelineBlock(info, click) {
    const data = pipelineData(info);
    if (!data.length) return '';
    return `${Charts.pipeline(data, info.pct, { onClick: click })}
      <div class="pipe-ring">${Charts.ring(info.pct, { size: 150, stroke: 12, sub: 'concluído' })}</div>
      <div class="pipe-list">${data.map(s => `<button class="pl-card pl-${s.state}" data-act="${click}" data-id="${s.id}"><span class="pl-name"><span class="pl-num">${s.index}</span><span class="pl-txt">${esc(s.name)}</span></span><span class="pl-meta">${s.meta}</span><span class="pl-bar"><i style="width:${s.pct}%"></i></span></button>`).join('')}</div>`;
  }

  function trendData(p, tasks) {
    const start = p.startDate ? parseISO(p.startDate) : new Date(Math.min(...tasks.map(t => new Date(t.createdAt || Date.now()).getTime()), Date.now()));
    const end = parseISO(today());
    let days = Math.round((end - start) / 86400000) + 1;
    days = Math.max(14, Math.min(120, days));
    const values = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(end); d.setDate(d.getDate() - i); d.setHours(23, 59, 59, 999);
      values.push(tasks.filter(t => t.completedAt && new Date(t.completedAt) <= d).length);
    }
    const first = new Date(end); first.setDate(first.getDate() - (days - 1));
    const mid = new Date(end); mid.setDate(mid.getDate() - Math.floor((days - 1) / 2));
    return { values, labels: [[0, `${first.getDate()} ${MONTHS[first.getMonth()]}`], [Math.floor((days - 1) / 2), `${mid.getDate()} ${MONTHS[mid.getMonth()]}`], [days - 1, 'Hoje']] };
  }

  /* Página do projeto */
  VIEWS.projeto = id => {
    const p = get.project(id);
    if (!p) return VIEWS.naoencontrado('Projeto não encontrado.');
    const c = get.client(p.clientId);
    const info = projectInfo(p);
    const counts = STATUS_ORDER.map(s => ({ s, n: info.tasks.filter(t => t.status === s).length }));
    const colors = { aguardando: 'var(--st-wait)', a_fazer: 'var(--st-todo)', em_andamento: 'var(--st-doing)', em_revisao: 'var(--st-review)', concluida: 'var(--st-done)' };
    const trend = trendData(p, info.tasks);

    const etapas = info.stages.map(x => ({ id: x.stage.id, name: x.stage.name, state: x.state, pct: x.pct }));
    const co = p.companyId && get.company(p.companyId);
    const fatos = { pct: info.pct, stages: etapas, tasksDone: info.done, tasksTotal: info.total, startDate: p.startDate, dueDate: p.dueDate, late: info.late, ritmo: true, animate: ANIM };
    // A primeira tela é o caminho do projeto com o anel aceso; nome e ações numa faixa fina em cima, os números ao lado.
    return `
      <section class="proj-cabeca">
        <div class="proj-cabeca-texto">
          <div class="quem-linha">${c ? `<a class="client-link" href="#/cliente/${c.id}">${clientAvatar(c, '')}${esc(c.name)}</a>` : ''}${co ? `<a class="client-link" href="#/empresa/${co.id}">${clientAvatar(co, '')}${esc(co.name)}</a>` : ''}</div>
          <h1>${esc(p.name)}<span class="ponto">.</span></h1>
          <div class="meta-line proj-meta">${projPill(p.status)}${p.startDate ? `<span class="d">${icon('calendar', 15)} Início em ${fmtDate(p.startDate, true)}</span>` : ''}</div>
          ${p.description ? `<p class="proj-desc">${esc(p.description)}</p>` : ''}
        </div>
        <div class="actions">
          ${c ? `<a class="btn" href="#/portal/${c.id}">${icon('eye', 16)} Visão do cliente</a><button class="btn" data-act="share-client" data-id="${c.id}">${icon('link', 16)} ${c.shareToken ? 'Link do cliente' : 'Criar link do cliente'}</button>` : ''}
          <button class="icon-btn" data-act="edit-project" data-id="${p.id}" title="Editar projeto" aria-label="Editar projeto">${icon('edit', 16)}</button>
          <button class="icon-btn danger" data-act="delete-project" data-id="${p.id}" title="Excluir projeto" aria-label="Excluir projeto">${icon('trash', 16)}</button>
        </div>
      </section>

      <section class="panel pipe-panel palco">
        <div class="palco-grid">
          <div class="palco-caminho">${info.stages.length ? pipelineBlock(info, 'goto-stage') : `<div class="pipe-vazio">${Charts.ring(0, { size: 180, stroke: 14, sub: 'pronto' })}<p>Crie as etapas do projeto para ver o caminho até a entrega.</p></div>`}</div>
        </div>
        ${PortalRender.destaques({ stages: etapas, tasksDone: info.done, tasksTotal: info.total, dueDate: p.dueDate, late: info.late, ritmo: ritmoProjeto(p, info) })}
        ${info.stages.length ? `<p class="palco-dica">${icon('right', 13)} Clique numa etapa do caminho para ver as tarefas dela</p>` : ''}
      </section>

      ${info.stages.length ? `

      <div class="grid proj-charts">
        <section class="panel c-status">
          <div class="panel-head"><h3>Status das tarefas</h3></div>
          <div class="donut-wrap">
            ${Charts.aneis(counts.map(x => ({ value: x.n, color: colors[x.s], label: STATUS[x.s].label })), { size: 170, center: String(info.total), sub: 'tarefas' })}
            <div class="legend">${counts.map(x => `<div><i style="background:${colors[x.s]}"></i><span>${STATUS[x.s].label}</span><b>${x.n}</b></div>`).join('')}</div>
          </div>
        </section>
        <section class="panel c-stages">
          <div class="panel-head"><h3>Progresso por etapa</h3></div>
          <div class="stage-bars">${info.stages.map((s, i) => `<div class="r"><span>${i + 1}. ${esc(s.stage.name)}</span><b>${s.pct}%</b><div class="bar"><i style="width:${s.pct}%"></i></div></div>`).join('')}</div>
        </section>
        <section class="panel c-trend">
          <div class="panel-head"><h3>Tarefas concluídas ao longo do tempo</h3></div>
          ${Charts.area(trend.values, { labels: trend.labels, total: info.total })}
        </section>
      </div>` : ''}

      <div class="section-head">
        <div><h2>Etapas e tarefas</h2>${info.tasks.length ? `<p class="dica-ordem">${info.tasks.length > 1 ? `<span>${icon('grip', 14)} Arraste para mudar a prioridade.</span>` : ''}<span><i class="dica-quadro" aria-hidden="true"></i> Marque o quadrado para editar ou excluir várias de uma vez.</span></p>` : ''}</div>
        <div class="actions">
          ${info.tasks.length ? `<button class="btn" data-act="sel-all" data-id="${p.id}">${icon('tasks', 16)} ${info.tasks.every(t => UI.sel.has(t.id)) ? 'Desmarcar todas' : 'Selecionar todas'}</button>` : ''}
          <div class="tabs" role="tablist" aria-label="Forma de ver"><button role="tab" class="${UI.projModo === 'cronograma' ? '' : 'on'}" data-act="proj-modo" data-v="lista">${icon('list', 15)} Lista</button><button role="tab" class="${UI.projModo === 'cronograma' ? 'on' : ''}" data-act="proj-modo" data-v="cronograma">${icon('calendar', 15)} Cronograma</button></div>
          <button class="btn btn-primary" data-act="new-stage" data-id="${p.id}">${icon('plus', 16)} Nova etapa</button>
        </div>
      </div>
      ${UI.sel.size ? batchBar(p, info) : ''}
      ${UI.projModo === 'cronograma' && info.stages.length ? cronogramaProjeto(info) : info.stages.length ? info.stages.map((s, i) => stageBlock(s, i, info.stages.length)).join('') :
        `<div class="empty-state"><h3>Este projeto ainda não tem etapas</h3><p>Divida o projeto em etapas (por exemplo: briefing, criação, entrega) e coloque as tarefas dentro de cada uma.</p><button class="btn btn-primary" data-act="new-stage" data-id="${p.id}">${icon('plus', 16)} Criar primeira etapa</button></div>`}
      <section class="panel rel-cliente" id="rel-cliente">${relatoriosHTMLDono(p.id)}</section>
      ${relatorioGestao(p, info)}`;
  };

  /* Cronograma do projeto (o mesmo da página do cliente) */
  const etapasGantt = info => info.stages.map(s => ({
    id: s.stage.id, nome: s.stage.name, inicio: s.stage.startDate || '', fim: s.stage.dueDate || '', pct: s.pct, estado: s.state,
    tarefas: s.tasks.map(t => ({ id: t.id, titulo: t.title, inicio: t.startDate || '', fim: t.dueDate || '', status: t.status, quem: get.member(t.assigneeId)?.name || '' })),
  }));
  function cronogramaProjeto(info) {
    const z = UI.gZoom || 'mes';
    return `<section class="panel gantt-painel">
      <div class="panel-head"><h3>Cronograma</h3><div class="tabs" role="group" aria-label="Zoom">${[['semana', 'Semana'], ['mes', 'Mês'], ['projeto', 'Projeto inteiro']].map(([v, l]) => `<button class="${z === v ? 'on' : ''}" data-act="gantt-zoom" data-v="${v}">${l}</button>`).join('')}</div></div>
      ${PortalRender.gantt(etapasGantt(info), { zoom: z, abrirTarefa: 'open-task' })}
      <p class="gantt-dica">Clique numa etapa para recolher as tarefas. Clique numa tarefa para abrir e ajustar as datas.</p>
    </section>`;
  }
  function stageBlock(s, i, n) {
    const st = s.stage;
    const collapsed = !!UI.collapsed[st.id];
    return `
      <section class="panel stage ${s.state} ${collapsed ? 'collapsed' : ''}" id="stage-${st.id}">
        <div class="stage-head">
          <div class="stage-idx">${s.state === 'concluida' ? icon('check', 20) : i + 1}</div>
          <div style="min-width:0">
            <div class="stage-title"><h3>${esc(st.name)}</h3>${stagePill(s.state)}${stageDue(st, s.state)}</div>
            ${st.description ? `<p class="stage-desc">${esc(st.description)}</p>` : ''}
            ${st.expected ? `<p class="stage-esperado"><span>Resultado esperado</span>${esc(st.expected)}</p>` : ''}
            <div class="stage-prog"><div class="bar"><i style="width:${s.pct}%"></i></div><span>${s.done} de ${plural(s.total, 'tarefa', 'tarefas')}</span></div>
          </div>
          <div class="stage-tools">
            ${UI.sel.size && s.tasks.length ? `<button class="btn sm btn-ghost" data-act="sel-stage" data-id="${st.id}">${s.tasks.every(t => UI.sel.has(t.id)) ? 'Desmarcar todas' : 'Marcar todas'}</button>` : ''}
            <button class="icon-btn sm ghost" data-act="stage-up" data-id="${st.id}" ${i === 0 ? 'disabled style="opacity:.3"' : ''} title="Mover etapa para cima" aria-label="Mover etapa para cima">${icon('up', 16)}</button>
            <button class="icon-btn sm ghost" data-act="stage-down" data-id="${st.id}" ${i === n - 1 ? 'disabled style="opacity:.3"' : ''} title="Mover etapa para baixo" aria-label="Mover etapa para baixo">${icon('down', 16)}</button>
            <button class="icon-btn sm ghost" data-act="edit-stage" data-id="${st.id}" title="Editar etapa" aria-label="Editar etapa">${icon('edit', 16)}</button>
            <button class="icon-btn sm ghost danger" data-act="delete-stage" data-id="${st.id}" title="Excluir etapa" aria-label="Excluir etapa">${icon('trash', 16)}</button>
            <button class="icon-btn sm stage-toggle" data-act="toggle-stage" data-id="${st.id}" title="${collapsed ? 'Mostrar' : 'Esconder'} tarefas" aria-label="${collapsed ? 'Mostrar' : 'Esconder'} tarefas" aria-expanded="${!collapsed}">${icon('down', 16)}</button>
          </div>
        </div>
        <div class="task-list" data-stage="${st.id}">${s.tasks.map(taskRow).join('')}</div>
        <div class="stage-add"><button data-act="add-task" data-id="${st.id}">${icon('plus', 16)} Adicionar tarefa</button></div>
      </section>`;
  }

  // Data da etapa: some quando a etapa termina sem atraso; avisa quando passou.
  function stageDue(st, state) {
    if (!st.dueDate) return '';
    const n = daysUntil(st.dueDate);
    const cls = state === 'concluida' ? '' : n < 0 ? 'late' : n <= 3 ? 'soon' : '';
    const txt = state === 'concluida' ? `Entrega ${fmtDate(st.dueDate)}` : n < 0 ? `Atrasada desde ${fmtDate(st.dueDate)}` : n === 0 ? 'Entrega hoje' : n === 1 ? 'Entrega amanhã' : `Entrega ${fmtDate(st.dueDate)}`;
    return `<span class="due ${cls}">${icon('flag', 13)} ${txt}</span>`;
  }

  function taskRow(t) {
    const m = get.member(t.assigneeId);
    const due = relDue(t);
    const firstLine = (t.description || '').split('\n')[0];
    const sel = UI.sel.size > 0, on = UI.sel.has(t.id);
    return `<div class="task ${isDone(t) ? 'done' : ''} ${on ? 'selecionada' : ''} ${sel ? 'modo-sel' : ''}" data-act="${sel ? 'sel-task' : 'open-task'}" data-id="${t.id}" tabindex="0" role="button" aria-label="${sel ? `${on ? 'Desmarcar' : 'Marcar'} ${esc(t.title)}` : `Abrir tarefa ${esc(t.title)}`}">
      <button class="grip" data-grip="${t.id}" title="Arraste para mudar a prioridade (ou use as setas ↑ ↓)" aria-label="Mudar a prioridade de ${esc(t.title)}: use as setas para cima e para baixo">${icon('grip', 16)}</button>
      <button class="sel-box ${on ? 'on' : ''}" data-act="sel-task" data-id="${t.id}" role="checkbox" aria-checked="${on}" title="${on ? 'Desmarcar' : 'Marcar para editar ou excluir junto com outras'}" aria-label="Selecionar ${esc(t.title)}">${icon('check', 13)}</button>
      ${botaoConcluir(t)}
      <div style="min-width:0"><div class="tt">${t.complexity ? botaoCx(t) : ''}<span class="tt-nome" data-titulo="${t.id}" title="Clique duas vezes para renomear">${esc(t.title || 'Tarefa sem nome')}</span>${t.complexity ? '' : botaoCx(t)}</div>${firstLine ? `<div class="td">${esc(firstLine)}</div>` : ''}${linhaEspera(t)}${linhaRevisao(t)}</div>
      <button class="who-cell qe" data-act="qe-resp" data-id="${t.id}" title="Trocar o responsável" aria-haspopup="menu">${avatar(m)}<span>${m ? esc(m.name) : '<span class="dim">Sem responsável</span>'}</span></button>
      <button class="due qe ${due.cls}" data-act="qe-prazo" data-id="${t.id}" title="Mudar o prazo" aria-haspopup="dialog">${icon('calendar', 14)} ${due.txt}</button>
      <button class="deliv-count qe" data-act="qe-entregas" data-id="${t.id}" title="Ver os entregáveis" aria-label="Entregáveis: ${t.deliverables.length}">${t.deliverables.length ? `${icon('paperclip', 14)} ${t.deliverables.length}` : ''}</button>
      <button class="qe qe-status" data-act="qe-status" data-id="${t.id}" title="Mudar a situação" aria-haspopup="menu">${statusPill(t.status)}</button>
      <button class="icon-btn sm ghost qe-mais" data-act="qe-mais" data-id="${t.id}" title="Mais: mover de etapa, renomear" aria-label="Mais ações de ${esc(t.title)}" aria-haspopup="menu">${icon('more', 16)}</button>
    </div>`;
  }

  /* Bolinha de concluir; com a tarefa travada, vira um cadeado que explica o motivo */
  /* No painel da tarefa: de quais tarefas esta depende */
  function caixaEspera(t) {
    const ps = pendencias(t); if (!ps.length) return '';
    return `<div class="espera-caixa">
      <div class="espera-topo">${icon('lock', 16)}<div><b>Aguardando ${ps.length === 1 ? 'esta tarefa' : `estas ${ps.length} tarefas`}</b><small>Só dá para concluir depois que ${ps.length === 1 ? 'ela for concluída' : 'todas forem concluídas'}. Aí esta volta sozinha para A fazer.</small></div></div>
      <ul>${ps.map(x => { const k = taskCtx(x); return `<li><button class="espera-nome" data-act="espera-abrir" data-tarefa="${x.id}" title="Abrir esta tarefa"><b>${esc(x.title)}</b><small>${esc(k.p ? k.p.name : '')}${k.s ? ` / ${esc(k.s.name)}` : ''}</small></button>${statusPill(x.status)}<button class="icon-btn sm ghost" data-act="espera-tirar" data-tarefa="${x.id}" title="Não aguardar mais esta" aria-label="Não aguardar mais ${esc(x.title)}">${icon('x', 14)}</button></li>`; }).join('')}</ul>
      <button class="btn sm" data-act="espera-editar">${icon('edit', 14)} Mudar as tarefas aguardadas</button>
    </div>`;
  }
  // Datas da tarefa: início depois da entrega, ou fora do período da etapa
  const NOMES_CAMPO = { status: 'Situação', startDate: 'Início', dueDate: 'Entrega', description: 'Descrição', title: 'Nome', assigneeId: 'Responsável', reviewerId: 'Quem revisa' };
  const valorCampo = (k, v) => (v == null || v === '' ? 'vazio' : k === 'status' ? (STATUS[v] || {}).label || v : /Date$/.test(k) ? fmtDate(v) : /Id$/.test(k) ? (get.member(v)?.name || v) : String(v).slice(0, 60));
  function conversaTarefa(t) {
    const com = (DB.comments || []).filter(c => c.taskId === t.id);
    const hist = (DB.history || []).filter(h => h.alvo === t.id).slice(0, 8);
    const hora = d => { const x = new Date(d); return `${x.getDate()} ${MONTHS[x.getMonth()]} às ${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`; };
    return `<div class="conversa">
      <h4>Comentários${com.length ? ` <small>${com.length}</small>` : ''}</h4>
      ${com.length ? `<ul class="conversa-lista">${com.map(c => `<li class="${c.deCliente ? 'de-cliente' : ''}"><b>${esc(c.deCliente ? c.autor : (c.autorNome || 'Você'))}</b>${c.deCliente ? '<span class="tag-cliente">Cliente</span>' : ''}<small>${hora(c.em)}</small><p>${esc(c.texto)}</p></li>`).join('')}</ul>` : '<p class="rel-vazio">Nenhum comentário ainda. O que você escrever aqui aparece para o cliente na tarefa.</p>'}
      <div class="ct-novo"><textarea class="input" id="novo-comentario" rows="2" placeholder="Escreva um comentário para o cliente" aria-label="Novo comentário"></textarea><button class="btn sm" data-act="comentar-dono">${icon('chat', 14)} Comentar</button></div>
      ${hist.length ? `<h4 class="conversa-h">Alterações feitas pelo cliente</h4><ul class="hist-lista">${hist.map(h => `<li><div><b>${esc(h.quem)}</b> mudou <b>${esc(NOMES_CAMPO[h.campo] || h.campo)}</b> de <span>${esc(valorCampo(h.campo, h.antes))}</span> para <span>${esc(valorCampo(h.campo, h.depois))}</span><small>${hora(h.em)}</small></div><button class="btn sm btn-ghost" data-act="desfazer-cliente" data-id="${esc(h.id)}">Desfazer</button></li>`).join('')}</ul>` : ''}
    </div>`;
  }
  function avisoDatas(t) {
    const st = get.stage(t.stageId);
    if (t.startDate && t.dueDate && t.startDate > t.dueDate) return `${icon('alert', 13)} A data de início está depois da entrega.`;
    if (st && st.startDate && t.startDate && t.startDate < st.startDate) return `${icon('alert', 13)} Começa antes da etapa, que começa em ${fmtDate(st.startDate)}.`;
    if (st && st.dueDate && t.dueDate && t.dueDate > st.dueDate) return `${icon('alert', 13)} Termina depois da entrega da etapa (${fmtDate(st.dueDate)}).`;
    return '';
  }
  function botaoConcluir(t) {
    if (bloqueada(t)) return `<button class="check travada" data-act="toggle-task" data-id="${t.id}" title="Aguardando outra tarefa" aria-label="Não dá para concluir: aguardando outra tarefa">${icon('lock', 13)}</button>`;
    return `<button class="check ${isDone(t) ? 'on' : ''}" data-act="toggle-task" data-id="${t.id}" aria-label="${isDone(t) ? 'Reabrir tarefa' : 'Marcar como concluída'}">${icon('check', 14)}</button>`;
  }
  // Etiqueta clicável na linha; sem complexidade, um "+ Complexidade" que aparece ao passar o mouse
  function botaoCx(t) {
    const c = COMPLEXIDADE.find(x => x.v === t.complexity);
    return c ? `<button class="cx-tag qe" data-act="qe-cx" data-id="${t.id}" style="--cx:${c.cor}" title="Complexidade: ${c.label}. Clique para mudar" aria-haspopup="menu">${c.label}</button>`
      : `<button class="cx-add qe" data-act="qe-cx" data-id="${t.id}" title="Definir a complexidade" aria-haspopup="menu">+ Complexidade</button>`;
  }
  function etiquetaCx(t) {
    const c = COMPLEXIDADE.find(x => x.v === t.complexity); if (!c) return '';
    return `<span class="cx-tag" style="--cx:${c.cor}" title="Complexidade: ${c.label}">${c.label}</span>`;
  }
  function linhaRevisao(t) {
    if (t.status !== 'em_revisao') return '';
    const m = get.member(t.reviewerId);
    return `<div class="revisao-linha">${icon('eye', 12)} ${m ? `Revisão: ${esc(m.name)}` : 'Revisão sem revisor escolhido'}</div>`;
  }
  function linhaEspera(t) {
    const ps = pendencias(t); if (!ps.length) return '';
    return `<div class="espera-linha">${icon('lock', 12)} Aguardando: ${ps.map(x => esc(nomeEspera(t, x))).join(', ')}</div>`;
  }
  /* Fotos das galerias à vista na linha da tarefa: até 5 miniaturas, o resto vira "+N"; clicar abre o zoom. */
  function galeriasDaTarefa(t) {
    const gals = (t.deliverables || []).filter(d => d.type === 'galeria' && (d.images || []).length);
    const chks = (t.deliverables || []).filter(d => d.type === 'checklist').map(d => (d.items || []).filter(i => i.text.trim())).filter(x => x.length);
    const chk = chks.length ? (() => { const tot = chks.flat().length, ok = chks.flat().filter(i => i.done).length; return `<span class="tarefa-chk ${ok === tot ? 'completo' : ''}" title="Checklist">${icon('listcheck', 13)} ${ok} de ${tot}</span>`; })() : '';
    if (!gals.length) return chk ? `<div class="tarefa-galerias">${chk}</div>` : '';
    return `<div class="tarefa-galerias">${chk}${gals.map(d => {
      const n = d.images.length;
      return `<div class="tarefa-galeria" title="${esc(d.label || 'Galeria')}">${PortalRender.galeriaGrade(d, (im, k) => (k === 4 && n > 5 ? `<span class="gal-mais" aria-hidden="true">+${n - 4}</span>` : ''))}</div>`;
    }).join('')}</div>`;
  }
  /* Ritmo do projeto: % feito comparado com % do tempo que já passou entre início e entrega */
  function ritmoProjeto(p, info) {
    const ts = info.tasks; if (!ts.length || !p.dueDate) return null;
    const hoje = today();
    const criadas = ts.map(t => (t.createdAt || '').slice(0, 10)).filter(Boolean).sort();
    const inicio = p.startDate || criadas[0] || hoje;
    const totalDias = Math.max(1, Math.round((parseISO(p.dueDate) - parseISO(inicio)) / 86400000));
    const passados = Math.max(0, Math.round((parseISO(hoje) - parseISO(inicio)) / 86400000));
    const pctTempo = Math.min(1, passados / totalDias), pctFeito = info.done / info.total;
    const dif = Math.round((pctFeito - pctTempo) * totalDias);
    return { dif, k: Math.abs(dif) <= 1 ? 'ok' : dif > 0 ? 'bom' : 'mau', txt: Math.abs(dif) <= 1 ? 'No prazo' : dif > 0 ? `${dif} ${dif === 1 ? 'dia' : 'dias'} adiantado` : `${-dif} ${dif === -1 ? 'dia' : 'dias'} atrasado` };
  }

  /* ---------------- Projetos: todos, com filtros ---------------- */
  const projMembros = p => { const ts = tasksOfProject(p.id); return DB.team.filter(m => (m.projectIds || []).includes(p.id) || ts.some(t => t.assigneeId === m.id || t.reviewerId === m.id)); };
  VIEWS.projetos = () => {
    const f = UI.projF;
    let lista = DB.projects.map(p => ({ p, i: projectInfo(p), c: get.client(p.clientId), e: p.companyId && get.company(p.companyId) }));
    lista.forEach(x => { x.r = x.p.status === 'ativo' ? ritmoProjeto(x.p, x.i) : null; x.vence = x.p.dueDate ? daysUntil(x.p.dueDate) : null; });
    if (f.sit) lista = lista.filter(x => x.p.status === f.sit);
    if (f.cliente) lista = lista.filter(x => x.p.clientId === f.cliente);
    if (f.empresa) lista = lista.filter(x => x.p.companyId === f.empresa);
    if (f.resp) lista = lista.filter(x => projMembros(x.p).some(m => m.id === f.resp));
    if (f.ritmo === 'atrasado') lista = lista.filter(x => (x.r && x.r.k === 'mau') || x.i.late > 0);
    else if (f.ritmo === 'emdia') lista = lista.filter(x => x.r && x.r.k !== 'mau' && !x.i.late);
    else if (f.ritmo === 'vence') lista = lista.filter(x => x.vence != null && x.vence >= 0 && x.vence <= 14 && x.p.status === 'ativo');
    if (f.q) { const q = norm(f.q); lista = lista.filter(x => norm([x.p.name, x.c?.name, x.e?.name, x.p.description].join(' ')).includes(q)); }
    const ord = {
      prazo: (a, b) => (a.p.dueDate || '9999').localeCompare(b.p.dueDate || '9999'),
      atraso: (a, b) => ((a.r ? a.r.dif : 0) - (b.r ? b.r.dif : 0)) || (b.i.late - a.i.late),
      pct: (a, b) => b.i.pct - a.i.pct,
      nome: (a, b) => a.p.name.localeCompare(b.p.name, 'pt-BR'),
    }[f.ordem] || ((a, b) => 0);
    lista.sort(ord);
    const sel = (campo, rotulo, ops) => `<select class="field-inline" data-projf="${campo}" aria-label="${rotulo}">${ops.map(([v, l]) => `<option value="${esc(v)}" ${f[campo] === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    const filtrando = f.q || f.cliente || f.empresa || f.resp || f.ritmo || f.sit !== 'ativo';
    const barra = `<div class="cad-bar proj-bar">
      <input type="search" class="field-inline cad-busca" id="proj-q" data-projf="q" value="${esc(f.q)}" placeholder="Buscar projeto, cliente ou empresa" aria-label="Buscar projeto">
      ${sel('sit', 'Situação', [['ativo', 'Ativos'], ['pausado', 'Pausados'], ['concluido', 'Concluídos'], ['', 'Todas as situações']])}
      ${sel('cliente', 'Cliente', [['', 'Todos os clientes'], ...DB.clients.filter(c => projectsOf(c.id).length).sort(byName).map(c => [c.id, c.name])])}
      ${sel('empresa', 'Empresa', [['', 'Todas as empresas'], ...DB.companies.filter(e => projectsOfCompany(e.id).length).sort(byName).map(e => [e.id, e.name])])}
      ${sel('resp', 'Responsável', [['', 'Todo o time'], ...DB.team.slice().sort(byName).map(m => [m.id, m.name])])}
      ${sel('ritmo', 'Ritmo', [['', 'Qualquer ritmo'], ['atrasado', 'Atrasados'], ['emdia', 'No prazo ou adiantados'], ['vence', 'Vencem em 14 dias']])}
      ${sel('ordem', 'Ordenar', [['prazo', 'Ordem: prazo de entrega'], ['atraso', 'Ordem: mais atrasado primeiro'], ['pct', 'Ordem: mais concluído'], ['nome', 'Ordem: nome']])}
    </div>`;
    const ritmoPill = x => (x.r ? `<span class="pill ritmo-${x.r.k}">${esc(x.r.txt)}</span>` : x.p.status === 'ativo' ? '<span class="pill">Sem prazo</span>' : '');
    let corpo;
    if (!DB.projects.length) corpo = `<div class="empty-state"><h3>Nenhum projeto ainda</h3><p>Crie o primeiro projeto a partir de um cliente.</p><a class="btn btn-primary" href="#/clientes">${icon('users', 16)} Ir para Clientes</a></div>`;
    else if (!lista.length) corpo = `<div class="empty-state"><h3>Nenhum projeto com esses filtros</h3><p>Mude ou limpe os filtros para ver outros projetos.</p><button class="btn" data-act="proj-limpar">Limpar filtros</button></div>`;
    else if (UI.projView === 'lista') corpo = `<div class="panel table proj-tabela">
        <div class="pt-l pt-cab"><span>Projeto</span><span>Cliente</span><span>Concluído</span><span>Etapa atual</span><span>Entrega</span><span>Ritmo</span></div>
        ${lista.map(x => `<a class="pt-l" href="#/projeto/${x.p.id}"><span class="pt-nome"><b>${esc(x.p.name)}</b>${x.e ? `<small>${esc(x.e.name)}</small>` : ''}</span><span class="who-cell">${x.c ? `${clientAvatar(x.c, '')}<span>${esc(x.c.name)}</span>` : ''}</span><span class="pt-pct"><span class="bar"><i style="width:${x.i.pct}%"></i></span><b>${x.i.pct}%</b></span><span class="where">${x.i.current ? esc(x.i.current.stage.name) : x.i.stages.length ? 'Todas concluídas' : 'Sem etapas'}</span><span class="due ${x.vence != null && x.vence < 0 && x.p.status === 'ativo' ? 'late' : ''}">${x.p.dueDate ? fmtDate(x.p.dueDate, true) : '<span class="dim">Sem data</span>'}</span><span>${ritmoPill(x)}${x.i.late ? ` <span class="pill atraso-pill">${x.i.late} ${x.i.late === 1 ? 'atrasada' : 'atrasadas'}</span>` : ''}</span></a>`).join('')}
      </div>`;
    else corpo = `<div class="grid proj-grid">${lista.map(x => projectCard(x.p, { client: true, ritmo: x.r })).join('')}</div>`;
    const ativos = DB.projects.filter(p => p.status === 'ativo').length;
    return `
      <div class="page-head">
        <div><h1>Projetos<span class="ponto">.</span></h1><p>${plural(DB.projects.length, 'projeto', 'projetos')}, ${ativos} ${ativos === 1 ? 'ativo' : 'ativos'}. ${filtrando ? `Mostrando ${lista.length}.` : ''}</p></div>
        <div class="actions">${filtrando ? `<button class="btn btn-ghost" data-act="proj-limpar">Limpar filtros</button>` : ''}
          <div class="tabs cad-vista" role="group" aria-label="Forma de ver">
        <button class="${UI.projView === 'lista' ? '' : 'on'}" data-act="proj-view" data-v="cartoes" title="Cartões" aria-label="Ver em cartões">${icon('grid', 16)}</button>
        <button class="${UI.projView === 'lista' ? 'on' : ''}" data-act="proj-view" data-v="lista" title="Lista" aria-label="Ver em lista">${icon('list', 16)}</button>
      </div>
        </div>
      </div>
      ${DB.projects.length ? barra : ''}
      ${corpo}`;
  };

  /* ---------------- Relatórios em PDF para o cliente ---------------- */
  const RELS = {}; // projeto -> lista (do banco)
  async function carregarRelatorios(pid) {
    if (!chaveDono()) return;
    try { RELS[pid] = await rpc('relatorios_listar', { p_key: chaveDono(), p_projeto: pid }); } catch (e) { RELS[pid] = RELS[pid] || []; }
  }
  const tamanho = n => (n > 1048576 ? `${(n / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
  function relatoriosHTMLDono(pid) {
    const l = RELS[pid];
    return `<div class="panel-head"><h3>Relatórios para o cliente</h3><label class="btn btn-primary sm">${icon('upload', 14)} Enviar relatório (PDF)<input type="file" accept="application/pdf" class="sr-only" data-rel-pdf="${esc(pid)}"></label></div>
      <div class="rel-drop" data-rel-drop="${esc(pid)}">${!chaveDono() ? '<p class="rel-vazio">Entre no sistema para enviar relatórios.</p>' : l === undefined ? '<p class="rel-vazio">Carregando…</p>' : l.length ? `<ul class="cli-relatorios">${l.map(r => `<li><span class="rel-icone">${icon('text', 18)}</span><div><b>${esc(r.titulo)}</b><small>${fmtDate(r.data, true)}. ${tamanho(r.tamanho)}</small></div><button class="btn sm" data-act="rel-abrir" data-id="${esc(r.id)}">${icon('external', 14)} Abrir</button><button class="icon-btn sm ghost" data-act="rel-editar" data-id="${esc(r.id)}" data-projeto="${esc(pid)}" title="Renomear" aria-label="Renomear ${esc(r.titulo)}">${icon('edit', 15)}</button><button class="icon-btn sm ghost danger" data-act="rel-remover" data-id="${esc(r.id)}" data-projeto="${esc(pid)}" title="Remover" aria-label="Remover ${esc(r.titulo)}">${icon('trash', 15)}</button></li>`).join('')}</ul>` : '<p class="rel-vazio">Nenhum relatório ainda. Envie um PDF ou arraste o arquivo para cá: ele aparece na aba Relatório da página do cliente.</p>'}</div>`;
  }
  async function desenharRelatorios(pid) {
    const el = document.getElementById('rel-cliente'); if (!el) return;
    if (RELS[pid] === undefined) { await carregarRelatorios(pid); }
    const at = document.getElementById('rel-cliente'); if (at && route().id === pid) at.innerHTML = relatoriosHTMLDono(pid);
  }
  async function enviarRelatorio(pid, arquivo) {
    if (!arquivo) return;
    if (arquivo.type !== 'application/pdf' && !/\.pdf$/i.test(arquivo.name)) { toast('Escolha um arquivo PDF', 'alert'); return; }
    if (arquivo.size > 10 * 1048576) { toast('O PDF passa de 10 MB. Exporte uma versão menor e tente de novo.', 'alert'); return; }
    const p = get.project(pid);
    const v = await formModal({ title: 'Enviar relatório', sub: `Vai aparecer na página do cliente, no projeto ${esc(p ? p.name : '')}.`, fields: [{ name: 'titulo', label: 'Título', value: arquivo.name.replace(/\.pdf$/i, ''), required: true, full: true }, { name: 'data', label: 'Data', type: 'date', value: today() }], submit: 'Enviar' });
    if (!v) return;
    toast('Enviando o relatório…', 'upload');
    const dataUrl = await new Promise((ok, erro) => { const r = new FileReader(); r.onload = () => ok(String(r.result).replace(/^data:[^;]*;/, 'data:application/pdf;')); r.onerror = erro; r.readAsDataURL(arquivo); });
    try { await rpc('relatorio_put', { p_key: chaveDono(), p_id: 'r' + newToken().slice(0, 20), p_cliente: p.clientId, p_projeto: pid, p_titulo: v.titulo, p_data: v.data || today(), p_pdf: dataUrl }); await carregarRelatorios(pid); desenharRelatorios(pid); toast('Relatório enviado'); }
    catch (e) { toast('Não foi possível enviar agora. Confira a internet e tente de novo.', 'alert'); }
  }
  async function abrirPdfDono(id) {
    try { const url = await rpc('relatorio_pdf_dono', { p_key: chaveDono(), p_id: id }); const b = await (await fetch(url)).blob(); const u = URL.createObjectURL(b); window.open(u, '_blank', 'noopener'); setTimeout(() => URL.revokeObjectURL(u), 60000); }
    catch (e) { toast('Não foi possível abrir o relatório agora.', 'alert'); }
  }
  viewEl.addEventListener('change', e => { const el = e.target; if (el.dataset && el.dataset.relPdf && el.files[0]) { enviarRelatorio(el.dataset.relPdf, el.files[0]); el.value = ''; } });
  viewEl.addEventListener('dragover', e => { const z = e.target.closest && e.target.closest('[data-rel-drop]'); if (z && e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); z.classList.add('soltar'); } });
  viewEl.addEventListener('dragleave', e => { const z = e.target.closest && e.target.closest('[data-rel-drop]'); if (z && !z.contains(e.relatedTarget)) z.classList.remove('soltar'); });
  viewEl.addEventListener('drop', e => { const z = e.target.closest && e.target.closest('[data-rel-drop]'); if (!z) return; e.preventDefault(); z.classList.remove('soltar'); if (e.dataTransfer.files[0]) enviarRelatorio(z.dataset.relDrop, e.dataTransfer.files[0]); });

  /* ---------------- Relatório de gestão (só para o gestor) ---------------- */
  const DIA = 86400000;
  const isoDe = d => localISO(d);
  const isoConcluida = t => (t.completedAt ? isoDe(new Date(t.completedAt)) : '');
  const diasAtraso = t => (t.dueDate && !isDone(t) && t.dueDate < today() ? -daysUntil(t.dueDate) : 0);
  const entregueAtrasada = t => isDone(t) && t.dueDate && isoConcluida(t) > t.dueDate;
  // Gravidade do atraso: leve até 3 dias, atenção de 4 a 7, grave acima de 7 (ou quando trava etapa ou entrega)
  function gravidade(dias, travaAlgo) {
    if (!dias) return null;
    if (dias > 7 || travaAlgo) return { k: 'grave', label: 'Grave' };
    if (dias > 3) return { k: 'atencao', label: 'Atenção' };
    return { k: 'leve', label: 'Leve' };
  }
  const selo = g => (g ? `<span class="grav grav-${g.k}">${icon(g.k === 'grave' ? 'alert' : g.k === 'atencao' ? 'flag' : 'clock', 12)} ${g.label}</span>` : '');
  const pessoaNome = id => { const m = get.member(id); return m ? m.name : 'Sem responsável'; };

  function relatorioGestao(p, info) {
    const ts = info.tasks;
    if (!ts.length) return '';
    const hoje = today();
    const total = ts.length, feitas = ts.filter(isDone).length;
    const pctFeito = feitas / total;

    // Ritmo: % feito comparado com % do tempo que já passou
    const criadas = ts.map(t => (t.createdAt || '').slice(0, 10)).filter(Boolean).sort();
    const inicio = p.startDate || criadas[0] || hoje;
    const fim = p.dueDate || '';
    let ritmo = null, previsao = null;
    const passados = Math.max(1, Math.round((parseISO(hoje) - parseISO(inicio)) / DIA));
    if (fim) {
      const totalDias = Math.max(1, Math.round((parseISO(fim) - parseISO(inicio)) / DIA));
      const pctTempo = Math.min(1, Math.max(0, passados / totalDias));
      const dif = Math.round((pctFeito - pctTempo) * totalDias);
      ritmo = Math.abs(dif) <= 1 ? { k: 'ok', txt: 'No prazo', sub: `${Math.round(pctFeito * 100)}% feito com ${Math.round(pctTempo * 100)}% do tempo usado` }
        : dif > 0 ? { k: 'bom', txt: `${dif} dias adiantado`, sub: `${Math.round(pctFeito * 100)}% feito com ${Math.round(pctTempo * 100)}% do tempo usado` }
          : { k: 'mau', txt: `${-dif} dias atrasado`, sub: `${Math.round(pctFeito * 100)}% feito com ${Math.round(pctTempo * 100)}% do tempo usado` };
    }
    if (feitas < total) {
      const porDia = feitas / passados;
      if (porDia > 0) {
        const d = new Date(parseISO(hoje).getTime() + Math.ceil((total - feitas) / porDia) * DIA);
        const iso = isoDe(d), dif = fim ? Math.round((parseISO(iso) - parseISO(fim)) / DIA) : null;
        previsao = { iso, txt: fmtDate(iso, true), sub: dif == null ? 'No ritmo atual' : dif > 0 ? `${dif} dias depois do combinado` : dif < 0 ? `${-dif} dias antes do combinado` : 'Na data combinada', k: dif == null ? 'ok' : dif > 0 ? 'mau' : 'bom' };
      } else previsao = { txt: 'Sem previsão', sub: 'Nenhuma tarefa concluída ainda', k: 'ok' };
    } else previsao = { txt: 'Concluído', sub: 'Todas as tarefas feitas', k: 'bom' };

    // Atrasos e o que cada atraso trava
    const travas = id => DB.tasks.filter(u => (u.waitingFor || []).includes(id) && !isDone(u));
    const etapaVencida = t => { const st = get.stage ? get.stage(t.stageId) : DB.stages.find(x => x.id === t.stageId); return st && st.dueDate && st.dueDate < hoje; };
    const atrasadas = ts.filter(t => diasAtraso(t) > 0).map(t => {
      const tr = travas(t.id);
      const g = gravidade(diasAtraso(t), tr.length > 0 || etapaVencida(t) || (fim && fim < hoje));
      return { t, dias: diasAtraso(t), g, tr };
    }).sort((a, b) => ({ grave: 0, atencao: 1, leve: 2 }[a.g.k] - { grave: 0, atencao: 1, leve: 2 }[b.g.k]) || b.dias - a.dias);
    const pior = atrasadas[0] ? atrasadas[0].g : null;

    // Pessoas: quem faz e quem revisa neste projeto
    const ids = [...new Set(ts.flatMap(t => [t.assigneeId, t.status === 'em_revisao' ? t.reviewerId : null]).filter(Boolean))];
    const semana = isoDe(new Date(parseISO(hoje).getTime() - 7 * DIA));
    const pessoas = ids.map(id => {
      const meu = ts.filter(t => t.assigneeId === id);
      const abertas = meu.filter(t => !isDone(t));
      const fe = meu.filter(isDone);
      const revisar = ts.filter(t => t.status === 'em_revisao' && t.reviewerId === id);
      const ativa = meu.some(t => t.status === 'em_andamento' || t.status === 'em_revisao') || fe.some(t => isoConcluida(t) >= semana) || revisar.length > 0;
      return {
        id, nome: pessoaNome(id), m: get.member(id), abertas, fe, revisar, ativa,
        atrasadas: abertas.filter(t => diasAtraso(t) > 0),
        noPrazo: fe.filter(t => !entregueAtrasada(t)).length,
        cx: COMPLEXIDADE.map(c => meu.filter(t => t.complexity === c.v).length),
        semCx: meu.filter(t => !t.complexity).length,
      };
    }).sort((a, b) => b.atrasadas.length - a.atrasadas.length || b.abertas.length - a.abertas.length);
    const comTrabalho = pessoas.filter(x => x.abertas.length || x.revisar.length);
    const ativos = comTrabalho.filter(x => x.ativa);
    const pctAtivos = comTrabalho.length ? Math.round(ativos.length / comTrabalho.length * 100) : 0;

    // Linha: concluídas por dia, comparadas com o ritmo ideal até a entrega
    const ultimo = fim && fim > hoje ? fim : hoje;
    const nDias = Math.max(1, Math.round((parseISO(ultimo) - parseISO(inicio)) / DIA));
    const passo = Math.max(1, Math.ceil(nDias / 60));
    const pontos = []; for (let d = 0; d <= nDias; d += passo) pontos.push(d); if (pontos[pontos.length - 1] !== nDias) pontos.push(nDias);
    const isoDia = d => isoDe(new Date(parseISO(inicio).getTime() + d * DIA));
    const real = pontos.map(d => (isoDia(d) <= hoje ? ts.filter(t => isDone(t) && isoConcluida(t) && isoConcluida(t) <= isoDia(d)).length : null));
    const durFim = fim ? Math.max(1, Math.round((parseISO(fim) - parseISO(inicio)) / DIA)) : null;
    const ideal = pontos.map(d => (durFim ? Math.min(total, Math.round(total * Math.min(1, d / durFim) * 10) / 10) : null));
    const iHoje = pontos.findIndex(d => isoDia(d) >= hoje);
    const marcas = [[0, fmtDate(inicio)]];
    if (iHoje > 0 && iHoje < pontos.length - 1) marcas.push([iHoje, 'Hoje']);
    marcas.push([pontos.length - 1, fim ? `Entrega ${fmtDate(fim)}` : fmtDate(ultimo)]);
    const serieReal = { nome: 'Concluídas', valores: real, cor: '#3987e5' };
    const serieIdeal = { nome: 'Ritmo ideal', valores: ideal, cor: 'rgba(240, 239, 236, .55)', tracejado: true };
    const linha = Charts.linhas(fim ? [serieIdeal, serieReal] : [serieReal], { max: total, rotulos: pontos.map(d => fmtDate(isoDia(d), true)), marcas });

    // Discos
    const corSt = { aguardando: 'var(--st-wait)', a_fazer: 'var(--st-todo)', em_andamento: 'var(--st-doing)', em_revisao: 'var(--st-review)', concluida: 'var(--st-done)' };
    const stSegs = STATUS_ORDER.map(k => ({ value: ts.filter(t => t.status === k).length, color: corSt[k], label: STATUS[k].label }));
    const prazoSegs = [
      { value: ts.filter(t => isDone(t) && !entregueAtrasada(t)).length, color: 'var(--positivo)', label: 'Entregues no prazo' },
      { value: ts.filter(entregueAtrasada).length, color: 'var(--alerta)', label: 'Entregues com atraso' },
      { value: atrasadas.length, color: 'var(--critico)', label: 'Abertas e atrasadas' },
    ];
    const cxSegs = [...COMPLEXIDADE.map(c => ({ value: ts.filter(t => t.complexity === c.v).length, color: c.cor, label: c.label })), { value: ts.filter(t => !t.complexity).length, color: 'rgba(240, 239, 236, .18)', label: 'Sem complexidade' }];
    const disco = (titulo, segs, centro, sub) => `<section class="panel rel-card"><div class="panel-head"><h3>${titulo}</h3></div><div class="donut-wrap">${Charts.donut(segs, { size: 150, stroke: 14, center: centro, sub })}<div class="legend">${segs.filter(x => x.value).map(x => `<div><i style="background:${x.color}"></i><span>${esc(x.label)}</span><b>${x.value}</b></div>`).join('') || '<div><span>Nada ainda</span></div>'}</div></div></section>`;

    // Colunas por pessoa
    const serCarga = [{ nome: 'Concluídas', cor: 'var(--positivo)' }, { nome: 'Abertas no prazo', cor: '#3987e5' }, { nome: 'Atrasadas', cor: 'var(--critico)' }];
    const carga = pessoas.map(x => ({ nome: x.nome, valores: [x.fe.length, x.abertas.length - x.atrasadas.length, x.atrasadas.length] }));
    const serCx = [...COMPLEXIDADE.map(c => ({ nome: c.label, cor: c.cor })), { nome: 'Sem complexidade', cor: 'rgba(240, 239, 236, .18)' }];
    const cargaCx = pessoas.map(x => ({ nome: x.nome, valores: [...x.cx, x.semCx] }));
    const atrasoCx = COMPLEXIDADE.map(c => { const q = ts.filter(t => t.complexity === c.v); const a = q.filter(t => diasAtraso(t) > 0 || entregueAtrasada(t)).length; return { c, n: q.length, a, pct: q.length ? Math.round(a / q.length * 100) : 0 }; });

    // Quem cobrar: atrasos de quem faz e revisões paradas de quem revisa
    const cobrar = [
      ...atrasadas.map(x => ({ quem: pessoaNome(x.t.assigneeId), tarefa: x.t, motivo: `${plural(x.dias, 'dia', 'dias')} de atraso${x.tr.length ? `. Trava ${plural(x.tr.length, 'tarefa', 'tarefas')}` : ''}`, g: x.g, papel: x.t.status === 'em_revisao' ? 'faz' : 'faz' })),
      ...ts.filter(t => t.status === 'em_revisao' && t.reviewerId && t.dueDate && t.dueDate < hoje).map(t => ({ quem: pessoaNome(t.reviewerId), tarefa: t, motivo: `Revisão parada há ${plural(-daysUntil(t.dueDate), 'dia', 'dias')}`, g: gravidade(-daysUntil(t.dueDate), travas(t.id).length > 0), papel: 'revisa' })),
    ];
    // Quem depende de quem
    const deps = ts.filter(t => !isDone(t)).flatMap(t => pendencias(t).map(x => ({ t, x })));
    const prox = ts.filter(t => !isDone(t) && t.dueDate && t.dueDate >= hoje && daysUntil(t.dueDate) <= 7).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const linhaTarefa = t => `<button class="rel-tarefa" data-act="open-task" data-id="${t.id}">${esc(t.title)}</button>`;

    const kpi = (titulo, valor, sub, k = '') => `<div class="rel-kpi ${k ? 'k-' + k : ''}"><span>${titulo}</span><b>${valor}</b><small>${sub}</small></div>`;
    return `
      <div class="section-head rel-head"><div><h2>Relatório de gestão<span class="ponto">.</span></h2><p class="dica-ordem"><span>${icon('lock', 13)} Só você vê esta parte. Os números são de hoje, ${fmtDate(hoje, true)}.</span></p></div></div>
      <div class="relatorio">
        <div class="rel-kpis">
          ${kpi('Concluído', `${Math.round(pctFeito * 100)}%`, `${feitas} de ${plural(total, 'tarefa', 'tarefas')}`)}
          ${kpi('Ritmo', ritmo ? ritmo.txt : 'Sem prazo', ritmo ? ritmo.sub : 'Defina a data de entrega do projeto', ritmo ? ritmo.k : '')}
          ${kpi('Atrasadas', String(atrasadas.length), atrasadas.length ? `Pior caso: ${pior.label.toLowerCase()}` : 'Nenhuma tarefa atrasada', atrasadas.length ? (pior.k === 'leve' ? 'ok' : 'mau') : 'bom')}
          ${kpi('Previsão de entrega', previsao.txt, previsao.sub, previsao.k)}
          ${kpi('Time ativo', `${pctAtivos}%`, comTrabalho.length ? `${ativos.length} de ${plural(comTrabalho.length, 'pessoa', 'pessoas')} com tarefas` : 'Ninguém com tarefa aberta', pctAtivos >= 70 ? 'bom' : pctAtivos >= 40 ? 'ok' : 'mau')}
        </div>
        <div class="rel-grid">
          <section class="panel rel-card rel-largo"><div class="panel-head"><h3>Tarefas concluídas comparadas com o ritmo ideal</h3></div>${Charts.legenda(fim ? [serieReal, serieIdeal] : [serieReal])}${linha}</section>
          ${disco('Situação das tarefas', stSegs, String(total), 'tarefas')}
          <section class="panel rel-card rel-largo"><div class="panel-head"><h3>Carga do time</h3><span class="rel-nota">Tarefas de cada pessoa como responsável</span></div>${pessoas.length ? `${Charts.legenda(serCarga)}${Charts.colunas(carga, serCarga)}` : '<p class="rel-vazio">Nenhuma tarefa tem responsável ainda.</p>'}</section>
          ${disco('Prazos', prazoSegs, `${feitas ? Math.round(prazoSegs[0].value / feitas * 100) : 0}%`, 'no prazo')}
          <section class="panel rel-card rel-largo"><div class="panel-head"><h3>Complexidade por pessoa</h3><span class="rel-nota">Quem está com as tarefas mais pesadas</span></div>${pessoas.length ? `${Charts.legenda(serCx)}${Charts.colunas(cargaCx, serCx)}` : '<p class="rel-vazio">Nenhuma tarefa tem responsável ainda.</p>'}</section>
          ${disco('Complexidade das tarefas', cxSegs, String(total), 'tarefas')}
        </div>

        <section class="panel rel-card"><div class="panel-head"><h3>Time</h3><span class="rel-nota">${ativos.length} ${ativos.length === 1 ? 'pessoa ativa' : 'pessoas ativas'}: com tarefa em andamento, em revisão ou que concluiu algo nos últimos 7 dias</span></div>
          ${pessoas.length ? `<div class="rel-tabela" role="table">
            <div class="rt-l rt-cab" role="row"><span>Pessoa</span><span>Situação</span><span>Abertas</span><span>Atrasadas</span><span>Para revisar</span><span>Concluídas</span><span>No prazo</span></div>
            ${pessoas.map(x => `<div class="rt-l" role="row"><span class="rt-pessoa">${avatar(x.m)}${esc(x.nome)}${tagCliente(x.m)}</span><span>${x.abertas.length || x.revisar.length ? `<span class="pill ${x.ativa ? 'st-done' : 'st-todo'}">${x.ativa ? 'Ativa' : 'Parada'}</span>` : '<span class="dim">Sem tarefa aberta</span>'}</span><span>${x.abertas.length}</span><span class="${x.atrasadas.length ? 'rt-mau' : ''}">${x.atrasadas.length}</span><span>${x.revisar.length}</span><span>${x.fe.length}</span><span>${x.fe.length ? `${Math.round(x.noPrazo / x.fe.length * 100)}%` : '–'}</span></div>`).join('')}
          </div>` : '<p class="rel-vazio">Nenhuma tarefa tem responsável ainda.</p>'}
        </section>

        <div class="rel-grid rel-listas">
          <section class="panel rel-card"><div class="panel-head"><h3>Quem cobrar</h3><span class="rel-nota">Do mais grave para o mais leve</span></div>
            ${cobrar.length ? `<ul class="rel-lista">${cobrar.map(c => `<li>${selo(c.g)}<div><b>${esc(c.quem)}${tagCliente(get.member(c.papel === 'revisa' ? c.tarefa.reviewerId : c.tarefa.assigneeId))}</b><span>${c.papel === 'revisa' ? 'Revisar: ' : ''}${linhaTarefa(c.tarefa)}</span><small>${c.motivo}</small></div></li>`).join('')}</ul>` : '<p class="rel-vazio">Ninguém para cobrar agora. Tudo dentro do prazo.</p>'}
          </section>
          <section class="panel rel-card"><div class="panel-head"><h3>Quem depende de quem</h3><span class="rel-nota">Cobrar quem está à direita destrava quem está à esquerda</span></div>
            ${deps.length ? `<ul class="rel-lista">${deps.map(({ t, x }) => `<li class="rel-dep"><div><b>${esc(pessoaNome(t.assigneeId))}</b>${linhaTarefa(t)}</div><span class="rel-seta">${icon('lock', 13)} espera</span><div><b>${esc(pessoaNome(x.assigneeId))}</b>${linhaTarefa(x)}${taskCtx(x).p && taskCtx(x).p.id !== p.id ? `<small>${esc(taskCtx(x).p.name)}</small>` : ''}</div></li>`).join('')}</ul>` : '<p class="rel-vazio">Nenhuma tarefa está aguardando outra.</p>'}
          </section>
          <section class="panel rel-card"><div class="panel-head"><h3>Próximos 7 dias</h3><span class="rel-nota">O que vence logo</span></div>
            ${prox.length ? `<ul class="rel-lista">${prox.map(t => { const n = daysUntil(t.dueDate); return `<li><span class="grav grav-prox">${n === 0 ? 'Hoje' : n === 1 ? 'Amanhã' : `Em ${n} dias`}</span><div><b>${esc(pessoaNome(t.assigneeId))}</b><span>${linhaTarefa(t)}</span><small>Vence em ${fmtDate(t.dueDate)}. ${STATUS[t.status].label}.</small></div></li>`; }).join('')}</ul>` : '<p class="rel-vazio">Nada vence nos próximos 7 dias.</p>'}
          </section>
          <section class="panel rel-card"><div class="panel-head"><h3>Atraso por complexidade</h3><span class="rel-nota">Quanto de cada nível atrasou, aberta ou entregue</span></div>
            <div class="rel-barras">${atrasoCx.map(x => `<div class="rb"><span>${x.c.label}</span><div class="rb-trilho"><i style="width:${x.pct}%"></i></div><b>${x.n ? `${x.pct}%` : '–'}</b><small>${x.n ? `${x.a} de ${x.n}` : 'nenhuma'}</small></div>`).join('')}</div>
          </section>
        </div>
      </div>`;
  }

  /* Entregas do projeto: tudo o que as tarefas entregaram, com as galerias em mosaico */
  function entregasDoProjeto(info) {
    const ds = info.stages.flatMap(s => s.tasks.flatMap(t => (t.deliverables || [])
      .filter(d => d.type !== 'checklist' && (d.type === 'galeria' ? (d.images || []).length : d.value || d.label))
      .map(d => ({ ...d, task: t.title, value: d.type === 'galeria' ? '' : d.value }))));
    if (!ds.length) return '';
    return `<div class="section-head entregas-head"><div><h2>Entregas</h2><p class="dica-ordem"><span>${plural(ds.length, 'entrega', 'entregas')} das tarefas deste projeto, do jeito que o cliente vê.</span></p></div></div>
      <div class="portal-delivs">${ds.map(PortalRender.entrega).join('')}</div>`;
  }

  /* Barra de edição em lote: aparece sozinha quando há tarefa marcada, acima do menu. */
  function batchBar(p, info) {
    const ids = [...UI.sel].filter(id => info.tasks.some(t => t.id === id));
    const n = ids.length;
    const dis = n ? '' : 'disabled';
    return `<div class="lote" role="toolbar" aria-label="Editar tarefas selecionadas">
      <div class="lote-conta"><b>${n}</b> ${n === 1 ? 'selecionada' : 'selecionadas'}<button class="link-more" data-act="sel-all" data-id="${p.id}">${n === info.tasks.length ? 'Desmarcar todas' : 'Marcar todas'}</button></div>
      <select class="field-inline" data-lote="status" ${dis} aria-label="Mudar a situação"><option value="">Situação…</option>${STATUS_ORDER.map(k => `<option value="${k}">${STATUS[k].label}</option>`).join('')}</select>
      <select class="field-inline" data-lote="assigneeId" ${dis} aria-label="Mudar o responsável"><option value="">Responsável…</option>${opcoesResponsavel(p.companyId, null, false, p.id)}<option value="__nenhum">Sem responsável</option></select>
      <label class="lote-data" title="Mudar o prazo"><span>Prazo</span><input type="date" class="field-inline" data-lote="dueDate" ${dis} aria-label="Mudar o prazo"></label>
      <select class="field-inline" data-lote="complexity" ${dis} aria-label="Mudar a complexidade"><option value="">Complexidade…</option>${COMPLEXIDADE.map(c => `<option value="${c.v}">${c.label}</option>`).join('')}<option value="__nenhuma">Sem complexidade</option></select>
      <select class="field-inline" data-lote="stageId" ${dis} aria-label="Mover para outra etapa"><option value="">Mover para…</option>${info.stages.map((x, i) => `<option value="${x.stage.id}">${i + 1}. ${esc(x.stage.name)}</option>`).join('')}</select>
      <button class="btn btn-danger sm" data-act="lote-excluir" ${dis}>${icon('trash', 15)} Excluir</button>
      <button class="icon-btn sm ghost" data-act="sel-limpar" title="Limpar a seleção (Esc)" aria-label="Limpar a seleção">${icon('x', 16)}</button>
    </div>`;
  }

  /* Todas as tarefas */
  VIEWS.tarefas = () => {
    const f = UI.filters;
    let list = DB.tasks.map(t => ({ t, ...taskCtx(t) })).filter(x => x.p);
    if (f.client) list = list.filter(x => x.c && x.c.id === f.client);
    if (f.member) list = list.filter(x => (f.member === '_none' ? !x.t.assigneeId : x.t.assigneeId === f.member));
    if (f.status === 'abertas') list = list.filter(x => !isDone(x.t));
    else if (f.status) list = list.filter(x => x.t.status === f.status);
    if (f.late) list = list.filter(x => isLate(x.t));
    if (f.q) { const q = f.q.toLowerCase(); list = list.filter(x => [x.t.title, x.t.description, x.p.name, x.c?.name, x.s?.name].join(' ').toLowerCase().includes(q)); }
    list.sort((a, b) => (isDone(a.t) - isDone(b.t)) || (a.t.dueDate || '9999').localeCompare(b.t.dueDate || '9999'));

    const filters = `
      <div class="filters">
        <input type="search" id="f-q" data-filter="q" value="${esc(f.q)}" placeholder="Buscar tarefas" aria-label="Buscar tarefas">
        <select data-filter="client" aria-label="Cliente"><option value="">Todos os clientes</option>${DB.clients.map(c => `<option value="${c.id}" ${f.client === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
        <select data-filter="member" aria-label="Responsável"><option value="">Todos os responsáveis</option>${DB.team.map(m => `<option value="${m.id}" ${f.member === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}<option value="_none" ${f.member === '_none' ? 'selected' : ''}>Sem responsável</option></select>
        ${UI.taskView === 'lista' ? `<select data-filter="status" aria-label="Status"><option value="abertas" ${f.status === 'abertas' ? 'selected' : ''}>Abertas</option><option value="" ${f.status === '' ? 'selected' : ''}>Todos os status</option>${STATUS_ORDER.map(s => `<option value="${s}" ${f.status === s ? 'selected' : ''}>${STATUS[s].label}</option>`).join('')}</select>` : ''}
        <label class="tog"><input type="checkbox" data-filter="late" ${f.late ? 'checked' : ''}> Só atrasadas</label>
      </div>`;

    let body;
    if (UI.taskView === 'quadro') {
      // No quadro, o filtro de status não se aplica: cada coluna é um status
      let all = DB.tasks.map(t => ({ t, ...taskCtx(t) })).filter(x => x.p && x.p.status === 'ativo');
      if (f.client) all = all.filter(x => x.c && x.c.id === f.client);
      if (f.member) all = all.filter(x => (f.member === '_none' ? !x.t.assigneeId : x.t.assigneeId === f.member));
      if (f.late) all = all.filter(x => isLate(x.t));
      if (f.q) { const q = f.q.toLowerCase(); all = all.filter(x => [x.t.title, x.t.description, x.p.name, x.c?.name].join(' ').toLowerCase().includes(q)); }
      all.sort((a, b) => (a.t.dueDate || '9999').localeCompare(b.t.dueDate || '9999'));
      body = `<p class="muted" style="margin:-6px 0 14px;font-size:14px">Arraste os cartões entre as colunas para mudar o status. Mostra apenas projetos ativos.</p>
        <div class="board">${STATUS_ORDER.map(s => {
          const col = all.filter(x => x.t.status === s);
          return `<div class="col" data-status="${s}"><div class="col-head">${statusPill(s)}<span>${col.length}</span></div>
            ${col.map(x => { const due = relDue(x.t); return `<div class="kcard" draggable="true" data-act="open-task" data-id="${x.t.id}" tabindex="0" role="button">
              <span class="tt">${bloqueada(x.t) ? `${icon('lock', 13)} ` : ''}${esc(x.t.title)}</span>${etiquetaCx(x.t) ? `<span>${etiquetaCx(x.t)}</span>` : ''}
              <span class="where">${esc(x.c?.name)} / ${esc(x.p.name)}</span>${linhaEspera(x.t)}${linhaRevisao(x.t)}
              <span class="foot">${avatar(get.member(x.t.assigneeId))}<span class="due ${due.cls}">${icon('calendar', 14)} ${due.txt}</span></span>
            </div>`; }).join('')}
          </div>`;
        }).join('')}</div>`;
    } else {
      body = list.length ? `<div class="panel table" style="padding:0">
        <div class="trow head"><span style="width:24px"></span><span>Tarefa</span><span>Cliente e projeto</span><span>Responsável</span><span>Prazo</span><span>Status</span></div>
        ${list.map(({ t, p, c, s }) => { const m = get.member(t.assigneeId); const due = relDue(t); return `
          <div class="trow" data-act="open-task" data-id="${t.id}" tabindex="0" role="button">
            ${botaoConcluir(t)}
            <div style="min-width:0"><div class="tt" style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.title)}</div><div class="where">${esc(s?.name)}</div>${linhaEspera(t)}${linhaRevisao(t)}</div>
            <div class="where">${esc(c?.name)} / ${esc(p.name)}</div>
            <div class="who-cell">${avatar(m)}<span>${m ? esc(m.name) : '<span class="dim">Ninguém</span>'}</span></div>
            <span class="due ${due.cls}">${due.txt}</span>
            <span>${statusPill(t.status)}</span>
          </div>`; }).join('')}
      </div>` : `<div class="empty-state"><h3>Nenhuma tarefa encontrada</h3><p>Mude os filtros para ver outras tarefas.</p></div>`;
    }

    return `
      <div class="page-head">
        <div><h1>Tarefas<span class="ponto">.</span></h1><p>Todas as tarefas de todos os clientes, em lista ou em quadro.</p></div>
        <div class="tabs" role="tablist">
          <button class="${UI.taskView === 'lista' ? 'on' : ''}" data-act="task-view" data-v="lista">${icon('list', 15)} Lista</button>
          <button class="${UI.taskView === 'quadro' ? 'on' : ''}" data-act="task-view" data-v="quadro">${icon('board', 15)} Quadro</button>
        </div>
      </div>
      ${filters}
      ${body}`;
  };

  /* Equipe: primeiro quem atende todas as empresas, depois cada empresa com os seus responsáveis */
  function gruposEquipe(cliente) {
    const base = DB.team.filter(m => daCliente(m) === cliente);
    const gs = cliente ? [] : [{ empresa: null, ms: base.filter(paraTodas) }];
    (DB.companies || []).slice().sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).forEach(e => {
      const ms = base.filter(m => !paraTodas(m) && m.companyIds.includes(e.id));
      if (ms.length) gs.push({ empresa: e, ms });
    });
    return gs.filter(g => g.ms.length);
  }
  VIEWS.equipe = () => {
    const activeTasks = DB.tasks.filter(t => { const { p } = taskCtx(t); return p && p.status === 'ativo'; });
    return `
      <div class="page-head">
        <div><h1>Equipe<span class="ponto">.</span></h1><p>Quem pode ser responsável pelas tarefas. Cada pessoa aparece só nas empresas marcadas no cadastro dela.</p></div>
        <div class="actions"><button class="btn btn-primary" data-act="new-member">${icon('plus', 16)} Novo responsável</button></div>
      </div>
      ${DB.team.length ? [[false, 'Minha equipe', 'Quem trabalha com você'], [true, 'Equipe dos clientes', 'Pessoas das empresas dos clientes que participam das tarefas']].filter(([c]) => DB.team.some(m => daCliente(m) === c)).map(([cli, titulo, sub]) => `<div class="equipe-bloco"><div class="section-head"><div><h2>${titulo}</h2><p class="dica-ordem"><span>${sub}</span></p></div></div>${gruposEquipe(cli).map(g => `<section class="equipe-grupo"><h2 class="equipe-grupo-t">${g.empresa ? `<a href="#/empresa/${g.empresa.id}">${icon('building', 16)} ${esc(g.empresa.name)}</a>` : `${icon('globe', 16)} Todas as empresas`}<small>${plural(g.ms.length, 'pessoa', 'pessoas')}</small></h2><div class="grid team-grid">${g.ms.map(m => {
        const mine = activeTasks.filter(t => t.assigneeId === m.id);
        const open = mine.filter(t => !isDone(t)).length, done = mine.filter(isDone).length, late = mine.filter(isLate).length;
        return `<div class="panel member">
          <div class="row"><a class="membro-link" href="#/membro/${m.id}">${avatar(m, 'lg')}<div style="flex:1;min-width:0"><b>${esc(m.name)}</b><span>${esc(daCliente(m) ? (cargoNoCliente(m) || m.role || 'Equipe do cliente') : (m.role || 'Sem função definida'))}</span></div></a>
            <button class="icon-btn sm ghost" data-act="edit-member" data-id="${m.id}" title="Editar" aria-label="Editar ${esc(m.name)}">${icon('edit', 16)}</button>
            <button class="icon-btn sm ghost danger" data-act="delete-member" data-id="${m.id}" title="Remover" aria-label="Remover ${esc(m.name)}">${icon('trash', 16)}</button>
          </div>
          <div class="nums"><div><b>${open}</b><span>Abertas</span></div><div><b>${done}</b><span>Concluídas</span></div><div class="${late ? 'alert' : ''}"><b>${late}</b><span>Atrasadas</span></div></div>
        </div>`;
      }).join('')}</div></section>`).join('')}</div>`).join('') : `<div class="empty-state"><h3>Ninguém na equipe ainda</h3><p>Adicione você e quem trabalha com você para definir os responsáveis de cada tarefa.</p><button class="btn btn-primary" data-act="new-member">${icon('plus', 16)} Adicionar pessoa</button></div>`}`;
  };

  /* Ajustes */
  VIEWS.ajustes = () => {
    return `
      <div class="page-head"><div><h1>Ajustes<span class="ponto">.</span></h1><p>Seu nome, o tema do sistema e o backup dos dados.</p></div></div>
      <div class="grid settings">
        <section class="panel">
          <div class="panel-head"><h3>Identidade</h3></div>
          <div class="set-row">
            <label class="field"><span>Nome do seu negócio (aparece no menu e na visão do cliente)</span><input id="s-business" data-setting="businessName" value="${esc(DB.settings.businessName)}"></label>
            <label class="field"><span>Seu nome (usado na saudação do painel)</span><input id="s-owner" data-setting="ownerName" value="${esc(DB.settings.ownerName)}"></label>
          </div>
          <div class="set-row">
            <p>Tema: muda as cores, o céu do fundo e a página que o cliente vê.</p>
            <div class="temas">${Cosmos.TEMAS.map(t => `<button class="tema ${DB.settings.tema === t.id ? 'on' : ''}" data-act="tema" data-v="${t.id}" aria-pressed="${DB.settings.tema === t.id}"><span class="previa" style="background:radial-gradient(90% 120% at 50% 120%, ${t.acento}55, transparent 60%), ${t.fundo}"><i style="background:${t.acento}"></i><b style="background:${t.acento};box-shadow:0 0 12px ${t.acento}"></b></span><strong>${t.nome}</strong><small>${t.descricao}</small></button>`).join('')}</div>
          </div>
        </section>
        <section class="panel">
          <div class="panel-head"><h3>Seus dados</h3></div>
          ${window.Nuvem && Nuvem.sessao() ? `<div class="set-row conta-linha"><p>Conectado como <b>${esc(Nuvem.sessao().email || '')}</b>. O sistema também abre online, de qualquer computador ou celular: <a href="${esc(CFG.portalBaseUrl)}sistema/" target="_blank" rel="noopener">${esc(CFG.portalBaseUrl)}sistema/</a></p><div class="actions"><button class="btn" data-act="sair-sistema">${icon('logout', 16)} Sair do sistema</button></div></div>` : ''}
          <div class="set-row">
            <p>${Nuvem.ativo ? 'Os dados ficam salvos no banco de dados (Supabase) e uma cópia fica neste navegador, para abrir rápido e funcionar sem internet. Cada alteração sobe sozinha; sem internet, sobe quando a conexão voltar. O banco guarda as 30 últimas versões. O backup continua valendo como cópia extra.' : 'Os dados ficam salvos neste navegador, neste computador. Baixe um backup de vez em quando para não perder nada e para levar os dados para outro computador.'}</p>
            <div class="actions"><button class="btn" data-act="export">${icon('download', 16)} Baixar backup</button><button class="btn" data-act="import">${icon('upload', 16)} Restaurar backup</button></div>
            <input type="file" id="import-file" accept="application/json,.json" class="hidden">
          </div>
          <div class="set-row">
            <p>Traga as pessoas, as empresas e quem é de qual empresa do Orbe Finance. Escolha o arquivo <b>cadastros-orbe.json</b>, na pasta <b>importar</b> do sistema. Nada do que já está aqui é apagado: só os campos vazios são preenchidos.</p>
            <div class="actions"><button class="btn" data-act="import-orbe">${icon('upload', 16)} Importar cadastros do Orbe</button></div>
            <input type="file" id="import-orbe" accept="application/json,.json" class="hidden">
          </div>
          <div class="set-row">
            <p>Os clientes Rapha e Carla Mendes, as empresas deles e a equipe vieram como exemplo. Você pode recomeçar do zero ou voltar ao exemplo.</p>
            <div class="actions"><button class="btn" data-act="reset-demo">Voltar aos dados de exemplo</button><button class="btn btn-danger" data-act="erase-all">${icon('trash', 16)} Apagar tudo e começar do zero</button></div>
          </div>
        </section>
      </div>`;
  };

  /* Visão do cliente (somente leitura). É exatamente o que o link do cliente mostra. */
  VIEWS.portal = id => {
    const c = get.client(id);
    if (!c) return VIEWS.naoencontrado('Cliente não encontrado.');
    return `<div id="cli-previa" data-cliente="${esc(c.id)}"></div>`;
  };
  // Os mesmos dados que o cliente recebe do banco (cli_dados), montados daqui
  function dadosDoCliente(cid) {
    const c = get.client(cid);
    const ps = projectsOf(cid).filter(p => p.status !== 'pausado');
    const sts = DB.stages.filter(st => ps.some(p => p.id === st.projectId));
    const ts = DB.tasks.filter(t => sts.some(st => st.id === t.stageId));
    const mids = new Set(ts.flatMap(t => [t.assigneeId, t.reviewerId]).filter(Boolean));
    return {
      email: '', permissoes: { perfil: 'leitor', projetos: 'todos', itens: {} }, negocio: DB.settings.businessName || '', tema: DB.settings.tema, cliente: c ? c.name : '', meus: [],
      projetos: ps.map(p => ({ id: p.id, name: p.name, description: p.description, status: p.status, startDate: p.startDate, dueDate: p.dueDate, company: get.company(p.companyId)?.name || '' })),
      etapas: sts.map(st => ({ id: st.id, projectId: st.projectId, name: st.name, description: st.description, expected: st.expected, startDate: st.startDate, dueDate: st.dueDate, order: st.order })),
      tarefas: ts.map(t => ({ id: t.id, stageId: t.stageId, title: t.title, description: t.description, status: t.status, startDate: t.startDate, dueDate: t.dueDate, completedAt: t.completedAt, assigneeId: t.assigneeId, reviewerId: t.reviewerId, waitingFor: t.waitingFor || [], order: t.order })),
      pessoas: DB.team.filter(m => mids.has(m.id)).map(m => ({ id: m.id, name: m.name, role: m.role, color: m.color, cliente: m.tipo === 'cliente' })),
      comentarios: (DB.comments || []).filter(x => ts.some(t => t.id === x.taskId)),
      relatorios: Object.values(RELS).flat().filter(r => ps.some(p => p.id === r.projeto)),
    };
  }
  function montarPrevia() {
    const el = document.getElementById('cli-previa'); if (!el || el.dataset.montado) return;
    el.dataset.montado = '1';
    const cid = el.dataset.cliente;
    const app = PortalApp.montar(el, { leitura: true, voltar: `#/cliente/${cid}`, carregar: async () => dadosDoCliente(cid), relatorio: id => rpc('relatorio_pdf_dono', { p_key: chaveDono(), p_id: id }) });
    app.iniciar();
    if (chaveDono()) projectsOf(cid).forEach(p => carregarRelatorios(p.id).then(() => app.recarregar()));
  }
  const safeUrl = PortalRender.safeUrl;

  /* ---------------- Depois de renderizar ---------------- */
  let clockTimer;
  function afterRender(r) {
    clearInterval(clockTimer);
    if (r.name === 'painel') {
      clockTimer = setInterval(() => {
        const el = $('#clock-t'); if (!el) return;
        const d = new Date(); el.textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      }, 15000);
    }
    if (r.name === 'tarefas' && UI.taskView === 'quadro') setupBoard();
    PortalRender.preencherImagens(viewEl);
    if (r.name === 'portal') montarPrevia();
    if (r.name === 'projeto') desenharRelatorios(r.id);
  }
  function setupBoard() {
    $$('.kcard').forEach(card => {
      card.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', card.dataset.id); e.dataTransfer.effectAllowed = 'move'; card.classList.add('dragging'); });
      card.addEventListener('dragend', () => card.classList.remove('dragging'));
    });
    $$('.col').forEach(col => {
      col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('over'); });
      col.addEventListener('dragleave', e => { if (!col.contains(e.relatedTarget)) col.classList.remove('over'); });
      col.addEventListener('drop', e => {
        e.preventDefault(); col.classList.remove('over');
        const t = get.task(e.dataTransfer.getData('text/plain'));
        if (t && t.status !== col.dataset.status && setStatus(t, col.dataset.status)) { save(); render(); }
      });
    });
  }

  /* ---------------- Prioridade: arrastar tarefas ---------------- */
  // A ordem das tarefas dentro da etapa é a prioridade. Arraste pela alça (mouse ou toque) ou use as setas no teclado.
  // Soltar em outra etapa move a tarefa para ela.
  function salvarOrdem() {
    $$('.task-list[data-stage]', viewEl).forEach(list => {
      const sid = list.dataset.stage;
      $$('.task[data-id]', list).forEach((row, k) => { const t = get.task(row.dataset.id); if (t) { t.stageId = sid; t.order = k; } });
    });
    save(); render();
  }
  // Arrastar: pela alça na hora; de qualquer outro ponto da linha depois de mexer alguns pixels (mouse)
  // ou segurando o dedo meio segundo (toque). Botões e campos da linha continuam só clicáveis.
  let arrasto = null, ultimoArrasto = 0;
  viewEl.addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    const grip = e.target.closest('[data-grip]');
    const row = e.target.closest('.task-list .task');
    if (!row) return;
    if (!grip && e.target.closest('button, a, input, select, textarea, label')) return;
    if (grip) { e.preventDefault(); if (grip.setPointerCapture) grip.setPointerCapture(e.pointerId); }
    const toque = e.pointerType !== 'mouse' && !grip;
    arrasto = { row, x0: e.clientX, y0: e.clientY, mexeu: false, pronto: !toque, id: e.pointerId };
    if (toque) arrasto.timer = setTimeout(() => { if (arrasto && !arrasto.mexeu) { arrasto.pronto = true; row.classList.add('pegando'); if (navigator.vibrate) navigator.vibrate(12); } }, 450);
  });
  // No toque, depois de "pegar" a tarefa, o dedo arrasta a tarefa em vez de rolar a página
  viewEl.addEventListener('touchmove', e => { if (arrasto && arrasto.pronto) e.preventDefault(); }, { passive: false });
  viewEl.addEventListener('pointermove', e => {
    if (!arrasto) return;
    const a = arrasto;
    if (!a.mexeu) {
      const d = Math.hypot(e.clientX - a.x0, e.clientY - a.y0);
      if (!a.pronto) { if (d > 8) { clearTimeout(a.timer); arrasto = null; } return; } // rolou a página antes de segurar
      if (d < 6) return;
      a.mexeu = true; a.row.classList.add('arrastando'); a.row.classList.remove('pegando'); document.body.classList.add('arrastando-tarefa');
      if (a.row.setPointerCapture) { try { a.row.setPointerCapture(a.id); } catch (err) { /* segue */ } }
      const sel = window.getSelection && window.getSelection(); if (sel) sel.removeAllRanges();
    }
    // rola a página perto das bordas
    if (e.clientY < 90) window.scrollBy(0, -14); else if (e.clientY > innerHeight - 150) window.scrollBy(0, 14);
    let alvo = null, menor = Infinity;
    $$('.stage:not(.collapsed) .task-list[data-stage]', viewEl).forEach(l => {
      const b = l.getBoundingClientRect();
      const d = e.clientY < b.top ? b.top - e.clientY : e.clientY > b.bottom ? e.clientY - b.bottom : 0;
      if (d < menor) { menor = d; alvo = l; }
    });
    if (!alvo) return;
    const antes = $$('.task', alvo).filter(x => x !== a.row).find(x => { const b = x.getBoundingClientRect(); return e.clientY < b.top + b.height / 2; });
    if (antes) { if (a.row.nextElementSibling !== antes) alvo.insertBefore(a.row, antes); }
    else if (alvo.lastElementChild !== a.row) alvo.appendChild(a.row);
    $$('.task-list[data-stage]', viewEl).forEach(l => l.classList.toggle('alvo', l === alvo));
  });
  function fimArrasto(e) {
    if (!arrasto) return;
    const a = arrasto; arrasto = null; clearTimeout(a.timer); a.row.classList.remove('pegando');
    document.body.classList.remove('arrastando-tarefa');
    $$('.task-list.alvo', viewEl).forEach(l => l.classList.remove('alvo'));
    a.row.classList.remove('arrastando');
    if (!a.mexeu) return;
    ultimoArrasto = Date.now();
    if (e.type === 'pointercancel') { render(); return; }
    salvarOrdem();
    toast('Prioridade atualizada');
  }
  viewEl.addEventListener('pointerup', fimArrasto);
  viewEl.addEventListener('pointercancel', fimArrasto);
  // Teclado: setas na alça sobem e descem a tarefa.
  viewEl.addEventListener('keydown', e => {
    const grip = e.target.closest && e.target.closest('[data-grip]');
    if (!grip || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault(); e.stopPropagation();
    const row = grip.closest('.task'), lista = row.parentElement;
    const viz = e.key === 'ArrowUp' ? row.previousElementSibling : row.nextElementSibling;
    if (!viz) return;
    if (e.key === 'ArrowUp') lista.insertBefore(row, viz); else lista.insertBefore(viz, row);
    const id = grip.dataset.grip;
    salvarOrdem();
    const g = viewEl.querySelector(`[data-grip="${id}"]`); if (g) g.focus();
  });

  /* ---------------- Edição rápida na lista ----------------
     Um menu pequeno abre ao lado do que foi clicado. itens: [{ v, label, html, on, titulo }] ou { sep: 'Texto' } */
  let menuAberto = null;
  function fecharMenuRapido(valor) {
    if (!menuAberto) return;
    const m = menuAberto; menuAberto = null;
    m.el.remove(); document.removeEventListener('pointerdown', m.fora, true);
    if (m.volta && document.contains(m.volta)) m.volta.focus();
    m.resolve(valor);
  }
  function menuRapido(ancora, itens, { conteudo = '', largura = 0 } = {}) {
    fecharMenuRapido(undefined);
    return new Promise(resolve => {
      const el = document.createElement('div');
      el.className = 'menu-rapido'; el.setAttribute('role', 'menu');
      el.innerHTML = conteudo || itens.map(it => it.sep !== undefined ? `<p class="mr-sep">${esc(it.sep)}</p>` : `<button role="menuitemradio" aria-checked="${!!it.on}" class="mr-op ${it.on ? 'on' : ''}" data-v="${esc(String(it.v))}" ${it.desligado ? 'disabled' : ''} ${it.titulo ? `title="${esc(it.titulo)}"` : ''}>${it.html || esc(it.label)}${it.on ? icon('check', 14) : ''}</button>`).join('');
      if (largura) el.style.minWidth = largura + 'px';
      document.body.appendChild(el);
      const r = ancora.getBoundingClientRect(), b = el.getBoundingClientRect();
      let top = r.bottom + 6; if (top + b.height > innerHeight - 110) top = Math.max(10, r.top - b.height - 6);
      el.style.top = top + 'px';
      el.style.left = Math.max(10, Math.min(innerWidth - b.width - 10, r.left)) + 'px';
      const fora = e => { if (!el.contains(e.target)) fecharMenuRapido(undefined); };
      document.addEventListener('pointerdown', fora, true);
      menuAberto = { el, resolve, fora, volta: ancora };
      el.addEventListener('click', e => { const b = e.target.closest('.mr-op'); if (b && !b.disabled) fecharMenuRapido(b.dataset.v); });
      el.addEventListener('keydown', e => {
        const ops = [...el.querySelectorAll('.mr-op:not([disabled]), input, .btn')];
        const i = ops.indexOf(document.activeElement);
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fecharMenuRapido(undefined); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); ops[(i + 1) % ops.length]?.focus(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); ops[(i - 1 + ops.length) % ops.length]?.focus(); }
        else if (e.key === 'Tab') { e.preventDefault(); ops[(i + (e.shiftKey ? -1 : 1) + ops.length) % ops.length]?.focus(); }
      });
      (el.querySelector('.mr-op.on') || el.querySelector('.mr-op:not([disabled]), input'))?.focus();
    });
  }
  window.addEventListener('scroll', () => fecharMenuRapido(undefined), { passive: true });
  const salvarRapido = msg => { save(); render(); if (msg) toast(msg); };
  async function qeResp(t, el) {
    const p = taskCtx(t).p;
    const ops = responsaveisPara(p && p.companyId, p && p.id);
    const atual = t.assigneeId && !ops.some(m => m.id === t.assigneeId) ? [get.member(t.assigneeId)].filter(Boolean) : [];
    const v = await menuRapido(el, [
      ...[...ops, ...atual].map(m => ({ v: m.id, on: t.assigneeId === m.id, html: `${avatar(m)}<span>${esc(m.name)}${m.role ? `<small>${esc(m.role)}</small>` : ''}</span>` })),
      { v: '', label: 'Sem responsável', on: !t.assigneeId },
      { v: '__novo', html: `${icon('plus', 15)}<span>Novo responsável</span>` },
    ], { largura: 240 });
    if (v === undefined) return;
    if (v === '__novo') { const m = await memberForm(null, { companyId: p && p.companyId }); if (!m) return; t.assigneeId = m.id; }
    else t.assigneeId = v || null;
    salvarRapido('Responsável alterado');
  }
  async function qePrazo(t, el) {
    const v = await menuRapido(el, [], { largura: 250, conteudo: `<div class="mr-prazo"><label class="field"><span>Início</span><input type="date" class="input" value="${esc(t.startDate || '')}" data-mr-ini></label><label class="field"><span>Entrega</span><input type="date" class="input" value="${esc(t.dueDate || '')}" data-mr-data></label><p class="mr-erro" data-mr-erro></p><div class="mr-acoes">${t.dueDate || t.startDate ? '<button class="btn sm btn-ghost mr-op" data-v="__tirar">Tirar as datas</button>' : ''}<button class="btn sm btn-primary" data-mr-ok>Salvar</button></div></div>` });
    if (v === undefined) return;
    if (v === '__tirar') { t.startDate = ''; t.dueDate = ''; return salvarRapido('Datas removidas'); }
    const { ini, fim } = JSON.parse(v);
    t.startDate = ini; t.dueDate = fim;
    salvarRapido(fim ? `Entrega: ${fmtDate(fim)}` : 'Datas salvas');
  }
  // Salvar das datas: Enter num campo ou o botão; início depois da entrega não passa
  function okDatas() {
    if (!menuAberto) return;
    const m = menuAberto.el, ini = m.querySelector('[data-mr-ini]').value, fim = m.querySelector('[data-mr-data]').value, e = m.querySelector('[data-mr-erro]');
    if (ini && fim && ini > fim) { e.textContent = 'O início está depois da entrega.'; return; }
    fecharMenuRapido(JSON.stringify({ ini, fim }));
  }
  document.addEventListener('click', e => { if (e.target.closest('[data-mr-ok]')) okDatas(); });
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches && e.target.matches('[data-mr-data], [data-mr-ini]')) { e.preventDefault(); okDatas(); } });
  async function qeStatus(t, el) {
    const v = await menuRapido(el, STATUS_ORDER.map(k => ({ v: k, on: t.status === k, html: `${statusPill(k)}`, desligado: k === 'concluida' && bloqueada(t), titulo: k === 'concluida' && bloqueada(t) ? 'Aguardando outra tarefa' : '' })), { largura: 190 });
    if (v === undefined || v === t.status) return;
    if (setStatus(t, v)) salvarRapido();
  }
  async function qeCx(t, el) {
    const v = await menuRapido(el, [...COMPLEXIDADE.map(c => ({ v: c.v, on: t.complexity === c.v, html: `<i class="mr-cor" style="background:${c.cor}"></i><span>${c.label}</span>` })), { v: '', label: 'Sem complexidade', on: !t.complexity }], { largura: 220 });
    if (v === undefined) return;
    t.complexity = v ? Number(v) : null;
    salvarRapido();
  }
  async function qeMais(t, el) {
    const p = taskCtx(t).p, ets = p ? stagesOf(p.id) : [];
    const v = await menuRapido(el, [
      { v: '__abrir', html: `${icon('edit', 15)}<span>Abrir a tarefa</span>` },
      { v: '__renomear', html: `${icon('text', 15)}<span>Renomear</span>` },
      { sep: 'Mover para a etapa' },
      ...ets.map((st, i) => ({ v: st.id, on: st.id === t.stageId, label: `${i + 1}. ${st.name}` })),
    ], { largura: 240 });
    if (v === undefined) return;
    if (v === '__abrir') return openTask(t.id);
    if (v === '__renomear') return renomearNaLinha(t.id);
    if (v === t.stageId) return;
    t.stageId = v; t.order = nextOrder(tasksOfStage(v).filter(x => x.id !== t.id));
    salvarRapido(`Movida para ${get.stage(v)?.name || 'outra etapa'}`);
  }
  // Renomear na própria linha (duplo clique no nome ou pelo menu "⋯")
  function renomearNaLinha(id) {
    const t = get.task(id); const span = viewEl.querySelector(`[data-titulo="${id}"]`); if (!t || !span) return;
    const inp = document.createElement('input');
    inp.className = 'tt-editar'; inp.value = t.title; inp.setAttribute('aria-label', 'Nome da tarefa');
    span.replaceWith(inp); inp.focus(); inp.select();
    let feito = false;
    const fim = salvar => { if (feito) return; feito = true; const v = inp.value.trim(); if (salvar && v && v !== t.title) { t.title = v; salvarRapido('Tarefa renomeada'); } else render(); };
    inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); fim(true); } else if (e.key === 'Escape') { e.preventDefault(); fim(false); } });
    inp.addEventListener('blur', () => fim(true));
    inp.addEventListener('click', e => e.stopPropagation());
  }
  let cliqueTitulo = null;

  /* ---------------- Regras ---------------- */
  /* Aguardando: a tarefa espera outras (do mesmo cliente) e não pode ser concluída antes delas */
  const pendencias = t => (t.waitingFor || []).map(id => get.task(id)).filter(x => x && !isDone(x));
  const bloqueada = t => pendencias(t).length > 0;
  function nomeEspera(t, x) {
    const a = taskCtx(t).p, b = taskCtx(x).p;
    return b && a && b.id !== a.id ? `${x.title} (${b.name})` : x.title;
  }
  // Uma tarefa não pode esperar por ela mesma nem por quem já espera por ela (ciclo)
  function criaCiclo(tId, alvoId) {
    const vistos = new Set(), fila = [alvoId];
    while (fila.length) {
      const id = fila.shift(); if (id === tId) return true;
      if (vistos.has(id)) continue; vistos.add(id);
      const x = get.task(id); if (x) fila.push(...(x.waitingFor || []));
    }
    return false;
  }
  // Destrava as tarefas cujas tarefas esperadas já foram todas concluídas (ou excluídas)
  function liberarProntas() {
    const liberadas = [];
    DB.tasks.forEach(u => {
      if (!(u.waitingFor || []).length) return;
      u.waitingFor = u.waitingFor.filter(id => get.task(id));
      if (bloqueada(u)) return;
      u.waitingFor = [];
      if (u.status === 'aguardando') { u.status = 'a_fazer'; liberadas.push(u); }
    });
    if (liberadas.length === 1) toast(`Tarefa liberada: ${liberadas[0].title}. Ela voltou para A fazer.`, 'check');
    else if (liberadas.length > 1) toast(`${liberadas.length} tarefas liberadas. Elas voltaram para A fazer.`, 'check');
    return liberadas;
  }
  function avisoBloqueio(t) {
    const ps = pendencias(t);
    toast(`Ainda não dá para concluir: esta tarefa aguarda ${ps.length === 1 ? `"${nomeEspera(t, ps[0])}"` : `${ps.length} tarefas`} ser${ps.length === 1 ? '' : 'em'} concluída${ps.length === 1 ? '' : 's'}.`, 'lock');
  }
  /* Janela para escolher de quais tarefas esta(s) depende(m): todas as tarefas abertas do mesmo cliente */
  async function escolherEspera(tarefas) {
    const ids = new Set(tarefas.map(t => t.id));
    const c = taskCtx(tarefas[0]).c;
    const atuais = new Set(tarefas.length === 1 ? (tarefas[0].waitingFor || []) : []);
    const grupos = (c ? projectsOf(c.id) : [taskCtx(tarefas[0]).p].filter(Boolean)).map(p => ({
      p, etapas: stagesOf(p.id).map(st => ({ st, ts: tasksOfStage(st.id).filter(x => !ids.has(x.id) && !isDone(x) && !tarefas.some(t => criaCiclo(t.id, x.id))) })).filter(e => e.ts.length),
    })).filter(g => g.etapas.length);
    if (!grupos.length) { toast('Não há outras tarefas abertas deste cliente para esperar', 'alert'); return null; }
    const v = await formModal({
      title: tarefas.length === 1 ? 'Esta tarefa aguarda qual tarefa?' : `Estas ${tarefas.length} tarefas aguardam qual tarefa?`,
      sub: 'Marque uma ou mais. Enquanto elas não forem concluídas, esta não pode ser concluída. Quando todas terminarem, ela volta sozinha para A fazer.',
      wide: true,
      fields: [{ name: 'espera', label: 'Tarefas', type: 'tarefas', grupos, atuais }],
      submit: 'Aguardar',
      onReady: form => {
        const busca = form.querySelector('[data-busca-tarefa]');
        busca.addEventListener('input', () => {
          const q = norm(busca.value);
          form.querySelectorAll('.esp-item').forEach(l => { l.hidden = q && !norm(l.dataset.txt).includes(q); });
          form.querySelectorAll('.esp-etapa, .esp-proj').forEach(g => { g.hidden = !g.querySelector('.esp-item:not([hidden])'); });
        });
      },
    });
    return v ? v.espera : null;
  }
  async function porEmEspera(tarefas) {
    const escolhidas = await escolherEspera(tarefas);
    if (!escolhidas) return false;
    tarefas.forEach(t => {
      t.waitingFor = tarefas.length === 1 ? escolhidas.slice() : [...new Set([...(t.waitingFor || []), ...escolhidas])];
      if (bloqueada(t)) { t.status = 'aguardando'; t.completedAt = null; }
    });
    save(); if (drawerTask) renderDrawer(); render();
    toast(tarefas.length === 1 ? 'Tarefa em Aguardando' : `${tarefas.length} tarefas em Aguardando`, 'lock');
    return true;
  }
  /* Em revisão: quem revisa. Ao mudar para Em revisão sem revisor, pergunta na hora. */
  async function pedirRevisor(tarefas) {
    const p = taskCtx(tarefas[0]).p;
    const ops = responsaveisPara(p && p.companyId, p && p.id).map(m => [m.id, `${m.name}${m.role ? ` (${m.role})` : ''}`]);
    const v = await formModal({
      title: tarefas.length === 1 ? 'Quem vai revisar esta tarefa?' : `Quem vai revisar estas ${tarefas.length} tarefas?`,
      sub: 'A tarefa só entra em revisão com alguém responsável por revisar. Essa pessoa aparece na tarefa e na página do cliente.',
      fields: [{ name: 'reviewerId', label: 'Quem revisa', type: 'select', full: true, options: [['', 'Escolha uma pessoa'], ...ops, ['__novo', '+ Novo responsável…']], required: true }],
      submit: 'Pôr em revisão',
    });
    if (!v || !v.reviewerId) return false;
    let rid = v.reviewerId;
    if (rid === '__novo') { const m = await memberForm(null, { companyId: p && p.companyId }); if (!m) return false; rid = m.id; }
    tarefas.forEach(t => { if (!t.reviewerId) t.reviewerId = rid; setStatus(t, 'em_revisao'); });
    save(); if (drawerTask) renderDrawer(); render();
    toast(tarefas.length === 1 ? `Em revisão com ${get.member(rid)?.name || ''}` : `${tarefas.length} tarefas em revisão`, 'check');
    return true;
  }
  function setStatus(t, st) {
    if (st === 'concluida' && bloqueada(t)) { avisoBloqueio(t); return false; }
    if (st === 'aguardando' && !bloqueada(t)) { porEmEspera([t]); return false; }
    if (st === 'em_revisao' && !t.reviewerId) { pedirRevisor([t]); return false; }
    const { p } = taskCtx(t);
    const before = p ? projectInfo(p).pct : 0;
    t.status = st;
    t.completedAt = st === 'concluida' ? (t.completedAt || new Date().toISOString()) : null;
    if (p) {
      const after = projectInfo(p);
      if (after.pct === 100 && before < 100) toast(`${p.name} chegou a 100%`, 'flag');
      else if (st === 'concluida') {
        const si = after.stages.find(x => x.stage.id === t.stageId);
        if (si && si.state === 'concluida') toast(`Etapa ${si.stage.name} concluída`);
      }
    }
    if (st === 'concluida') liberarProntas();
    return true;
  }
  const nextOrder = arr => (arr.length ? Math.max(...arr.map(x => x.order || 0)) + 1 : 0);
  function deleteTaskCascade(ids) { DB.tasks = DB.tasks.filter(t => !ids.includes(t.id)); liberarProntas(); }
  function deleteStageCascade(stageIds) {
    DB.tasks = DB.tasks.filter(t => !stageIds.includes(t.stageId));
    DB.stages = DB.stages.filter(s => !stageIds.includes(s.id));
  }
  function deleteProjectCascade(pids) {
    deleteStageCascade(DB.stages.filter(s => pids.includes(s.projectId)).map(s => s.id));
    DB.projects = DB.projects.filter(p => !pids.includes(p.id));
  }

  /* ---------------- Link do cliente (Supabase) ---------------- */
  // Banco: o arquivo local (js/config.js) ou o público (sistema online). Quem abre as funções de dono é a sessão do login.
  const CFG = (() => { const b = window.APP_CONFIG || window.PORTAL_CONFIG; return b && b.supabaseUrl && b.supabaseKey ? { ...window.PORTAL_CONFIG, ...b, portalBaseUrl: b.portalBaseUrl || (window.PORTAL_CONFIG || {}).portalBaseUrl || 'https://jdalete.github.io/acompanhamento/' } : null; })();
  const chaveDono = () => (window.Nuvem && Nuvem.chave()) || null;
  const SYNC = { last: {}, timer: null, warned: false };
  async function rpc(fn, body) {
    const r = await fetch(`${CFG.supabaseUrl}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: CFG.supabaseKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const out = await r.json().catch(() => null);
    if (!r.ok) throw new Error((out && out.message) || `Erro ${r.status}`);
    return out;
  }
  function newToken() {
    const b = new Uint8Array(18);
    crypto.getRandomValues(b);
    return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  const portalUrl = c => `${CFG.portalBaseUrl}#${c.shareToken}`;
  // O link agora só registra a qual cliente pertence: a página lê os dados ao vivo, com login (e-mail + código).
  async function publishClient(c, force = false) {
    if (!force && c.linkRegistrado) return false;
    await rpc('portal_link_cliente', { p_key: chaveDono(), p_token: c.shareToken, p_cliente: c.id });
    c.linkRegistrado = true; c.sharedAt = new Date().toISOString(); persist();
    return true;
  }
  function scheduleSync() {
    clearTimeout(SYNC.timer);
    SYNC.timer = setTimeout(CFG ? syncAll : cuidarImagens, 1500);
  }
  async function syncAll() {
    let failed = !(await cuidarImagens());
    for (const c of DB.clients.filter(x => x.shareToken && !x.linkRegistrado)) {
      try { await publishClient(c); } catch (e) { failed = true; }
    }
    if (failed && !SYNC.warned) { SYNC.warned = true; toast('Não foi possível atualizar o link do cliente. Verifique a internet; tento de novo na próxima alteração.', 'alert'); }
    if (!failed) SYNC.warned = false;
  }
  /* Fotos das galerias: envia ao Supabase os que ainda não subiram e apaga (aqui e lá) os que saíram do sistema.
     Devolve false se algum envio falhou. */
  let cuidando = null, conferidas = false;
  function cuidarImagens() {
    if (cuidando) return cuidando.then(() => cuidarImagens());
    cuidando = (async () => {
      let ok = true;
      try {
        const usadas = new Set(imagensUsadas());
        const lista = await Imagens.estados();
        const remover = [];
        for (const [id, est] of lista) {
          if (usadas.has(id)) continue;
          if (est.enviada && CFG) remover.push(id); else await Imagens.apagar(id);
        }
        if (remover.length) {
          try { await rpc('portal_image_delete', { p_key: chaveDono(), p_ids: remover }); for (const id of remover) await Imagens.apagar(id); }
          catch (e) { ok = false; }
        }
        if (CFG && !conferidas) {
          // Confere uma vez por sessão se as fotos marcadas como enviadas estão mesmo lá; as que faltarem sobem de novo.
          const marcadas = lista.filter(([id, est]) => usadas.has(id) && est.enviada).map(([id]) => id);
          try {
            const la = new Set(marcadas.length ? await rpc('portal_images_existentes', { p_key: chaveDono(), p_ids: marcadas }) : []);
            marcadas.forEach(id => { if (!la.has(id)) { const x = lista.find(l => l[0] === id); x[1] = { enviada: false }; } });
            conferidas = true;
          } catch (e) { /* sem internet: confere na próxima */ }
        }
        if (CFG) {
          for (const [id, est] of lista) {
            if (!usadas.has(id) || est.enviada) continue;
            const d = await Imagens.pegar(id); if (!d) continue;
            try { await rpc('portal_image_put', { p_key: chaveDono(), p_id: id, p_full: d.full, p_thumb: d.thumb }); await Imagens.marcarEnviada(id); }
            catch (e) { ok = false; break; }
          }
        }
      } catch (e) { /* navegador sem IndexedDB: nada a fazer */ }
      return ok;
    })();
    return cuidando.finally(() => { cuidando = null; });
  }
  function imagensUsadas() {
    const doRascunho = rascunhoT ? (rascunhoT.deliverables || []).filter(d => d.type === 'galeria').flatMap(d => (d.images || []).map(im => im.id)) : [];
    return doRascunho.concat(DB.tasks.flatMap(t => (t.deliverables || []).filter(d => d.type === 'galeria').flatMap(d => (d.images || []).map(im => im.id))));
  }
  // De onde o sistema lê as imagens: deste navegador; se não estiverem aqui, do Supabase.
  PortalRender.usarImagens(async (ids, cheia) => {
    const out = {}, faltam = [];
    for (const id of ids) {
      let d = null; try { d = await Imagens.pegar(id); } catch (e) { /* sem IndexedDB */ }
      if (d) out[id] = cheia ? d.full : d.thumb; else faltam.push(id);
    }
    if (faltam.length && CFG) { try { Object.assign(out, await rpc('portal_images_owner', { p_key: chaveDono(), p_ids: faltam, p_full: !!cheia })); } catch (e) { /* sem internet */ } }
    return out;
  });
  async function unpublish(tokens) {
    if (!CFG) return;
    for (const t of tokens) { try { await rpc('portal_delete', { p_key: chaveDono(), p_token: t }); } catch (e) { /* segue */ } }
  }
  function shareStatus(c) {
    if (!c.sharedAt) return 'Ainda não atualizado';
    const d = new Date(c.sharedAt);
    const sameDay = localISO(d) === today();
    return `Atualizado ${sameDay ? 'hoje' : `em ${d.getDate()} ${MONTHS[d.getMonth()]}`} às ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  /* ---------------- Acessos do link: e-mail + código, com permissões ---------------- */
  const CODIGOS_KEY = 'gestao-projetos.codigos'; // os códigos em texto ficam só neste navegador; no banco, só embaralhados
  const lerCodigos = () => { try { return JSON.parse(localStorage.getItem(CODIGOS_KEY) || '{}'); } catch (e) { return {}; } };
  function guardarCodigo(tok, email, cod) { const c = lerCodigos(); (c[tok] = c[tok] || {})[email] = cod; try { localStorage.setItem(CODIGOS_KEY, JSON.stringify(c)); } catch (e) { /* segue */ } }
  function esquecerCodigo(tok, email) { const c = lerCodigos(); if (c[tok]) { delete c[tok][email]; try { localStorage.setItem(CODIGOS_KEY, JSON.stringify(c)); } catch (e) { /* segue */ } } }
  function gerarCodigo() { const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; const b = new Uint8Array(8); crypto.getRandomValues(b); return [...b].map(x => A[x % A.length]).join(''); }
  const codigoBonito = c => (c ? `${c.slice(0, 4)}-${c.slice(4)}` : '');
  const PERFIS = {
    leitor: { nome: 'Leitor', desc: 'Só vê o andamento', itens: { etapas: 'ver', tarefas: 'ver', cronograma: 'ver', relatorios: 'ver', comentarios: 'ver' }, soMinhas: false },
    colaborador: { nome: 'Colaborador', desc: 'Vê, comenta e edita as tarefas em que é responsável ou revisor', itens: { etapas: 'ver', tarefas: 'editar', cronograma: 'ver', relatorios: 'ver', comentarios: 'comentar' }, soMinhas: true },
    gestor: { nome: 'Gestor do cliente', desc: 'Edita etapas e todas as tarefas que você liberar', itens: { etapas: 'editar', tarefas: 'editar', cronograma: 'ver', relatorios: 'ver', comentarios: 'comentar' }, soMinhas: false },
  };
  const NIVEIS = { nao: 'Não vê', ver: 'Vê', comentar: 'Comenta', editar: 'Edita' };
  const ITENS = [['etapas', 'Etapas (nome, descrição, resultado e datas)', ['nao', 'ver', 'editar']], ['tarefas', 'Tarefas (situação, datas e descrição)', ['nao', 'ver', 'comentar', 'editar']], ['cronograma', 'Cronograma', ['nao', 'ver']], ['relatorios', 'Relatórios em PDF', ['nao', 'ver']], ['comentarios', 'Comentários nas tarefas', ['nao', 'ver', 'comentar']]];
  const resumoPerm = (perm, c) => { const ps = projectsOf(c.id); const n = perm.projetos === 'todos' || !perm.projetos ? 'todos os projetos' : `${perm.projetos.length} de ${ps.length} projetos`; return `${(PERFIS[perm.perfil] || PERFIS.leitor).nome}, ${n}`; };

  async function formAcesso(c, atual) {
    const perm = atual ? atual.permissoes : { perfil: 'colaborador', projetos: 'todos', ...PERFIS.colaborador };
    const emails = [...new Set([c.email, ...linksOfClient(c.id).flatMap(({ e }) => linksOfCompany(e.id).map(x => x.c.email)), ...DB.team.filter(m => m.tipo === 'cliente').map(m => m.email)].filter(Boolean))];
    const ps = projectsOf(c.id);
    const v = await formModal({
      title: atual ? `Permissões de ${atual.email}` : `Novo acesso para ${c.name}`,
      sub: atual ? 'Mude o perfil ou ajuste item por item. A pessoa continua com o mesmo código.' : 'O sistema gera um código só deste e-mail. Depois é só mandar o link, o e-mail e o código para a pessoa.',
      wide: true,
      sections: [
        { fields: [
          ...(atual ? [] : [{ name: 'email', label: 'E-mail de quem vai acessar', type: 'email', required: true, full: true, list: emails, placeholder: 'nome@empresa.com' }]),
          { name: 'perfil', label: 'Perfil', type: 'escolha', full: true, value: perm.perfil || 'leitor', options: Object.entries(PERFIS).map(([k, p]) => [k, p.nome, p.desc]) },
        ] },
        { title: 'Projetos que pode ver', fields: [{ name: 'projetos', label: 'Projetos', type: 'escolha', full: true, value: perm.projetos === 'todos' || !perm.projetos ? 'todos' : 'alguns', options: [['todos', 'Todos os projetos', 'Inclusive os que forem criados depois'], ['alguns', 'Só alguns', 'Escolha abaixo']] },
          { name: 'quais', label: 'Quais projetos', type: 'projetos', value: Array.isArray(perm.projetos) ? perm.projetos : ps.map(p => p.id) }] },
        { title: 'Detalhado: o que pode ver, comentar ou editar', closed: !atual, fields: [
          ...ITENS.map(([k, l, ops]) => ({ name: 'i_' + k, label: l, type: 'select', value: (perm.itens || {})[k] || 'ver', options: ops.map(o => [o, NIVEIS[o]]) })),
          { name: 'soMinhas', label: 'Edição de tarefas', type: 'select', value: perm.soMinhas ? 'minhas' : 'todas', options: [['minhas', 'Só as tarefas em que é responsável ou revisor'], ['todas', 'Todas as tarefas dos projetos liberados']], full: true },
        ] },
      ],
      submit: atual ? 'Salvar permissões' : 'Gerar código e dar acesso',
      onReady: form => {
        // Só os projetos deste cliente na lista; o perfil preenche o detalhado
        form.querySelectorAll('.esp-proj').forEach(g => { if (!g.querySelector(`input[value]`) || ![...g.querySelectorAll('input')].some(i => ps.some(p => p.id === i.value))) g.remove(); });
        const quais = form.querySelector('[name="quais"]')?.closest('.field');
        const mostrar = () => { if (quais) quais.hidden = form.querySelector('input[name="projetos"]:checked')?.value !== 'alguns'; };
        form.querySelectorAll('input[name="projetos"]').forEach(r => r.addEventListener('change', mostrar)); mostrar();
        form.querySelectorAll('input[name="perfil"]').forEach(r => r.addEventListener('change', () => {
          const pf = PERFIS[r.value]; if (!pf) return;
          ITENS.forEach(([k]) => { form.elements['i_' + k].value = pf.itens[k]; });
          form.elements.soMinhas.value = pf.soMinhas ? 'minhas' : 'todas';
        }));
      },
      validar: v => (v.projetos === 'alguns' && !(v.quais || []).length ? 'Marque ao menos um projeto' : null),
    });
    if (!v) return null;
    const itens = {}; ITENS.forEach(([k]) => { itens[k] = v['i_' + k]; });
    return { email: (v.email || atual.email).trim().toLowerCase(), permissoes: { perfil: v.perfil, projetos: v.projetos === 'todos' ? 'todos' : v.quais, soMinhas: v.soMinhas === 'minhas', itens } };
  }

  async function openShare(clientId) {
    const c = get.client(clientId); if (!c) return;
    if (!CFG || !chaveDono()) { await formModal({ title: 'Entre no sistema primeiro', sub: 'O link do cliente depende do seu acesso (e-mail e senha). Entre no sistema e tente de novo.', submit: 'Entendi' }); return; }
    if (!c.shareToken) {
      const ok = await formModal({ title: `Criar link para ${c.name}`, sub: `${esc(c.name)} vai acompanhar os projetos por um link protegido: cada pessoa entra com o próprio e-mail e um código que o sistema gera. Você escolhe a seguir quem acessa e o que cada um pode ver ou editar.`, submit: 'Criar link' });
      if (!ok) return;
      c.shareToken = newToken();
      try { await publishClient(c, true); }
      catch (e) { delete c.shareToken; persist(); toast('Não foi possível criar o link. Verifique a internet e tente de novo.', 'alert'); return; }
      save(); render(); toast('Link criado', 'link');
    } else if (!c.linkRegistrado) { try { await publishClient(c, true); save(); } catch (e) { /* tenta de novo depois */ } }
    showShareModal(c);
  }
  async function showShareModal(c) {
    const url = portalUrl(c), tok = c.shareToken;
    const prevFocus = document.activeElement;
    let lista = null;
    const fone = d => { const x = String(d || '').replace(/\D/g, ''); return x.length >= 10 ? (x.length <= 11 ? '55' + x : x) : ''; };
    const msg = (email, cod) => `Olá! Por este link você acompanha os projetos com a gente:\n${url}\n\nE-mail: ${email}\nCódigo de acesso: ${codigoBonito(cod)}`;
    const quando = d => { if (!d) return 'Ainda não entrou'; const x = new Date(d); return `Entrou em ${x.getDate()} ${MONTHS[x.getMonth()]} às ${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`; };
    const desenhar = () => {
      const cods = lerCodigos()[tok] || {};
      modalRoot.innerHTML = `<div class="scrim" data-m="close"></div>
      <div class="modal wide" role="dialog" aria-modal="true" aria-labelledby="m-title">
        <h2 id="m-title">Link de ${esc(c.name)}</h2>
        <p class="msub">Cada pessoa entra com o próprio e-mail e o código que o sistema gera. Só quem estiver na lista abaixo consegue ver.</p>
        <div class="share-url"><input class="input" readonly id="share-url" value="${esc(url)}" aria-label="Link do cliente"><button class="btn" data-m="copy">${icon('copy', 16)} Copiar link</button></div>
        <div class="acessos-cab"><h3>Quem pode acessar</h3><button class="btn btn-primary sm" data-m="novo">${icon('plus', 14)} Adicionar e-mail</button></div>
        <div class="acessos-lista">${lista === null ? '<p class="rel-vazio">Carregando os acessos…</p>' : lista.length ? lista.map(a => { const cod = cods[a.email]; return `<div class="acesso-item">
            <div class="acesso-quem"><b>${esc(a.email)}</b><small>${esc(resumoPerm(a.permissoes, c))}. ${a.bloqueado ? '<span class="rt-mau">Bloqueado por tentativas erradas</span>' : esc(quando(a.ultimo))}</small></div>
            <div class="acesso-codigo">${cod ? `<code>${codigoBonito(cod)}</code>` : '<small class="dim">Código guardado só no computador onde foi criado</small>'}</div>
            <div class="acesso-acoes">
              ${cod ? `<button class="btn sm" data-m="msg" data-email="${esc(a.email)}">${icon('copy', 14)} Copiar mensagem</button><a class="btn sm" href="https://wa.me/${fone(c.phone)}?text=${encodeURIComponent(msg(a.email, cod))}" target="_blank" rel="noopener">${icon('chat', 14)} WhatsApp</a>` : ''}
              <button class="btn sm btn-ghost" data-m="perm" data-email="${esc(a.email)}">${icon('sliders', 14)} Permissões</button>
              <button class="btn sm btn-ghost" data-m="codigo" data-email="${esc(a.email)}">${icon('key', 14)} Novo código</button>
              <button class="icon-btn sm ghost danger" data-m="remover" data-email="${esc(a.email)}" title="Remover acesso" aria-label="Remover o acesso de ${esc(a.email)}">${icon('trash', 15)}</button>
            </div></div>`; }).join('') : `<div class="acessos-vazio">${icon('lock', 18)}<p>Ninguém tem acesso ainda. O link pede e-mail e código: adicione quem vai acompanhar os projetos.</p></div>`}</div>
        <div class="mfoot share-foot">
          <button class="btn btn-danger sm" data-m="revoke">Desativar link</button>
          <div class="actions"><a class="btn" href="${esc(url)}" target="_blank" rel="noopener">${icon('external', 16)} Abrir o link</a><button class="btn btn-ghost" data-m="close">Fechar</button></div>
        </div>
      </div>`;
    };
    const close = () => { modalRoot.innerHTML = ''; modalCancel = null; if (prevFocus && prevFocus.focus) prevFocus.focus(); };
    const carregar = async () => { try { lista = await rpc('acessos_listar', { p_key: chaveDono(), p_tok: undefined, p_token: tok }); } catch (e) { lista = []; toast('Não foi possível carregar os acessos agora.', 'alert'); } desenhar(); };
    const salvar = async (email, codigo, permissoes) => rpc('acesso_salvar', { p_key: chaveDono(), p_token: tok, p_email: email, p_codigo: codigo, p_permissoes: permissoes });
    modalCancel = close;
    modalRoot.onclick = async e => {
      const b = e.target.closest('[data-m]'); if (!b || !modalRoot.contains(b)) return;
      const m = b.dataset.m, email = b.dataset.email;
      if (m === 'close') return close();
      if (m === 'copy') { (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => toast('Link copiado'), () => { $('#share-url').select(); document.execCommand('copy'); toast('Link copiado'); }); return; }
      if (m === 'msg') { const cod = (lerCodigos()[tok] || {})[email]; (navigator.clipboard ? navigator.clipboard.writeText(msg(email, cod)) : Promise.reject()).then(() => toast('Mensagem copiada'), () => toast('Não foi possível copiar', 'alert')); return; }
      if (m === 'novo' || m === 'perm') {
        modalRoot.onclick = null;
        const atual = m === 'perm' ? lista.find(a => a.email === email) : null;
        const r = await formAcesso(c, atual);
        if (r) {
          if (!atual && lista.some(a => a.email === r.email)) toast('Este e-mail já tem acesso: ajuste em Permissões', 'alert');
          else {
            const cod = atual ? null : gerarCodigo();
            try { await salvar(r.email, cod, r.permissoes); if (cod) guardarCodigo(tok, r.email, cod); toast(atual ? 'Permissões salvas' : 'Acesso criado. Mande o link, o e-mail e o código.'); }
            catch (err) { toast('Não foi possível salvar o acesso agora.', 'alert'); }
          }
        }
        return showShareModal(c);
      }
      if (m === 'codigo') {
        modalRoot.onclick = null;
        const ok = await confirmBox(`Gerar um código novo para ${email}?`, 'O código atual para de funcionar na hora e a pessoa precisa entrar de novo com o código novo.', 'Gerar código novo');
        if (ok) { const cod = gerarCodigo(); try { await salvar(email, cod, null); guardarCodigo(tok, email, cod); toast('Código novo gerado'); } catch (err) { toast('Não foi possível gerar agora.', 'alert'); } }
        return showShareModal(c);
      }
      if (m === 'remover') {
        modalRoot.onclick = null;
        const ok = await confirmBox(`Remover o acesso de ${email}?`, 'A pessoa sai na hora e não consegue mais entrar com este código.', 'Remover acesso');
        if (ok) { try { await rpc('acesso_remover', { p_key: chaveDono(), p_token: tok, p_email: email }); esquecerCodigo(tok, email); toast('Acesso removido', 'trash'); } catch (err) { toast('Não foi possível remover agora.', 'alert'); } }
        return showShareModal(c);
      }
      if (m === 'revoke') {
        modalRoot.onclick = null; close();
        const ok = await confirmBox(`Desativar o link de ${c.name}?`, 'Todos os acessos deste link deixam de funcionar. Você pode criar um link novo depois, com outro endereço.', 'Desativar link');
        if (!ok) return;
        try { await rpc('portal_delete', { p_key: chaveDono(), p_token: tok }); }
        catch (err) { toast('Não foi possível desativar agora. Verifique a internet e tente de novo.', 'alert'); return; }
        delete c.shareToken; delete c.sharedAt; delete c.linkRegistrado;
        save(); render(); toast('Link desativado', 'trash');
      }
    };
    desenhar(); carregar();
    setTimeout(() => { const b = $('[data-m="novo"]', modalRoot); if (b) b.focus(); }, 30);
  }
  // Links criados antes do login: registra o cliente e pede os e-mails (uma vez por sessão)
  let linksConferidos = false;
  async function conferirLinksAntigos() {
    if (linksConferidos || !chaveDono()) return; linksConferidos = true;
    const semAcesso = [];
    for (const c of DB.clients.filter(x => x.shareToken)) {
      try { if (!c.linkRegistrado) { await publishClient(c, true); save(); } const l = await rpc('acessos_listar', { p_key: chaveDono(), p_token: c.shareToken }); if (!l.length) semAcesso.push(c); } catch (e) { /* tenta na próxima vez */ }
    }
    if (!semAcesso.length || modalRoot.innerHTML.trim()) return;
    const ok = await formModal({ title: 'Os links dos clientes agora pedem login', sub: `${semAcesso.map(c => esc(c.name)).join(', ')} ${semAcesso.length === 1 ? 'tem um link' : 'têm links'} sem nenhum e-mail cadastrado. Até você cadastrar, ninguém consegue abrir. Cadastre agora quem vai acompanhar.`, submit: 'Cadastrar e-mails' });
    if (ok) showShareModal(semAcesso[0]);
  }

  /* ---------------- Modal de formulário ---------------- */
  let modalCancel = null;
  const MASK_MODE = { tel: 'tel', cpf: 'numeric', cnpj: 'numeric', cep: 'numeric' };
  function fieldHTML(f) {
    const full = f.full ? 'full' : '';
    const v = f.value ?? '';
    const req = f.required ? 'required' : '';
    if (f.type === 'textarea') return `<label class="field ${full}"><span>${f.label}</span><textarea name="${f.name}" rows="${f.rows || 3}" placeholder="${esc(f.placeholder || '')}" ${req}>${esc(v)}</textarea></label>`;
    if (f.type === 'select') return `<label class="field ${full}"><span>${f.label}</span><select name="${f.name}" ${req}>${f.options.map(([ov, ol]) => `<option value="${esc(ov)}" ${ov === v ? 'selected' : ''}>${esc(ol)}</option>`).join('')}</select></label>`;
    if (f.type === 'color') {
      const cores = !v || CLIENT_COLORS.includes(v) ? CLIENT_COLORS : [v, ...CLIENT_COLORS];
      return `<div class="field ${full}"><span>${f.label}</span><div class="color-pick">${cores.map((c, i) => `<label style="color:${esc(c)}"><input type="radio" name="${f.name}" value="${esc(c)}" ${(v || CLIENT_COLORS[0]) === c ? 'checked' : ''} aria-label="Cor ${i + 1}"><i style="background:${esc(c)}"></i></label>`).join('')}</div></div>`;
    }
    if (f.type === 'escolha') {
      return `<div class="field ${full} escolha-pick"><span>${f.label}</span><div class="tpl-pick">${f.options.map(([ov, ol, os]) => `<label><input type="radio" name="${f.name}" value="${ov}" ${ov === v ? 'checked' : ''}><span class="opt"><b>${esc(ol)}</b><small>${esc(os)}</small></span></label>`).join('')}</div></div>`;
    }
    if (f.type === 'projetos') {
      const sel = new Set(v || []);
      const gs = gruposProjetos();
      return `<div class="field full esp-pick"><span>${f.label}</span>${gs.length ? `<div class="esp-lista">${gs.map(g => `<div class="esp-proj"><p class="esp-proj-t">${icon('user', 14)} ${esc(g.c.name)}</p>${g.ps.map(p => `<label class="esp-item chk-linha"><input type="checkbox" name="${f.name}" value="${p.id}" ${sel.has(p.id) ? 'checked' : ''}><span>${esc(p.name)}</span>${projPill(p.status)}</label>`).join('')}</div>`).join('')}</div>` : '<p class="hint">Nenhum projeto cadastrado ainda.</p>'}</div>`;
    }
    if (f.type === 'tarefas') {
      return `<div class="field full esp-pick"><input type="search" class="input" data-busca-tarefa placeholder="Buscar tarefa" aria-label="Buscar tarefa">
        <div class="esp-lista">${f.grupos.map(g => `<div class="esp-proj"><p class="esp-proj-t">${icon('grid', 14)} ${esc(g.p.name)}</p>${g.etapas.map(e => `<div class="esp-etapa"><p class="esp-etapa-t">${esc(e.st.name)}</p>${e.ts.map(x => `<label class="esp-item chk-linha" data-txt="${esc(x.title + ' ' + g.p.name + ' ' + e.st.name)}"><input type="checkbox" name="${f.name}" value="${x.id}" ${f.atuais.has(x.id) ? 'checked' : ''}><span>${esc(x.title)}</span>${statusPill(x.status)}</label>`).join('')}</div>`).join('')}</div>`).join('')}</div></div>`;
    }
    if (f.type === 'empresas') {
      const todas = !v || !v.length;
      const emps = (DB.companies || []).slice().sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      return `<div class="field full empresas-pick"><span>${f.label}</span>
        <label class="chk-linha"><input type="checkbox" name="${f.name}__todas" data-todas ${todas ? 'checked' : ''}> Todas as empresas</label>
        <div class="emp-lista" ${todas ? 'hidden' : ''}>${emps.length ? emps.map(e => `<label class="chk-linha"><input type="checkbox" name="${f.name}" value="${e.id}" ${!todas && v.includes(e.id) ? 'checked' : ''}> ${esc(e.name)}</label>`).join('') : '<p class="hint">Nenhuma empresa cadastrada ainda.</p>'}</div>
        ${f.hint ? `<small class="hint">${esc(f.hint)}</small>` : ''}</div>`;
    }
    if (f.type === 'template') return `<div class="field ${full}"><span>${f.label}</span><div class="tpl-pick">${f.options.map(([ov, ol, os], i) => `<label><input type="radio" name="${f.name}" value="${ov}" ${i === 0 ? 'checked' : ''}><span class="opt"><b>${esc(ol)}</b><small>${esc(os)}</small></span></label>`).join('')}</div></div>`;
    if (f.type === 'photo') {
      const foto = safeImg(v);
      return `<div class="field full"><span>${f.label}</span><div class="photo-pick">
        <span class="avatar xl photo-prev ${foto ? 'foto' : 'empty'}" style="${foto ? `background-image:url('${foto}')` : ''}">${foto ? '' : icon('camera', 22)}</span>
        <div class="actions"><label class="btn sm">${icon('camera', 15)} ${foto ? 'Trocar foto' : 'Escolher foto'}<input type="file" accept="image/*" data-photo-file hidden></label>${foto ? '<button type="button" class="btn sm btn-ghost" data-photo-clear>Tirar a foto</button>' : ''}</div>
        <input type="hidden" name="${f.name}" value="${esc(foto)}"></div></div>`;
    }
    const list = f.list ? `list="dl-${f.name}"` : '';
    const dl = f.list ? `<datalist id="dl-${f.name}">${f.list.map(o => `<option value="${esc(o)}"></option>`).join('')}</datalist>` : '';
    const mask = f.mask ? `data-mask="${f.mask}" inputmode="${MASK_MODE[f.mask]}"` : '';
    return `<label class="field ${full}"><span>${f.label}</span><input name="${f.name}" type="${f.type || 'text'}" value="${esc(v)}" placeholder="${esc(f.placeholder || '')}" ${mask} ${list} ${req} autocomplete="off">${dl}${f.hint ? `<small class="hint" data-hint="${f.name}">${esc(f.hint)}</small>` : ''}</label>`;
  }
  /* sections: [{ title, fields, closed }] para formulários longos (cada seção abre e fecha). */
  function formModal({ title, sub = '', fields = [], sections = null, submit = 'Salvar', danger = false, wide = false, onReady = null, validar = null }) {
    return new Promise(resolve => {
      const prevFocus = document.activeElement;
      const all = sections ? sections.flatMap(x => x.fields) : fields;
      const grid = fs => `<div class="form-grid">${fs.map(fieldHTML).join('')}</div>`;
      const body = sections
        ? sections.map(x => x.title ? `<details class="fsec" ${x.closed ? '' : 'open'}><summary>${esc(x.title)}</summary>${grid(x.fields)}</details>` : grid(x.fields)).join('')
        : (fields.length ? grid(fields) : '');
      modalRoot.innerHTML = `<div class="scrim" data-m="cancel"></div>
        <div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="m-title">
          <h2 id="m-title">${esc(title)}</h2>${sub ? `<p class="msub">${sub}</p>` : ''}
          <form novalidate>
            ${body}
            <div class="mfoot"><button type="button" class="btn btn-ghost" data-m="cancel">Cancelar</button><button type="submit" class="btn ${danger ? 'btn-danger' : 'btn-primary'}">${esc(submit)}</button></div>
          </form>
        </div>`;
      const form = $('form', modalRoot);
      const close = val => { modalRoot.innerHTML = ''; modalCancel = null; if (prevFocus && prevFocus.focus) prevFocus.focus(); resolve(val); };
      modalCancel = () => close(null);
      $$('[data-m="cancel"]', modalRoot).forEach(b => b.addEventListener('click', () => close(null)));
      form.addEventListener('submit', e => {
        e.preventDefault();
        const bad = all.find(f => f.required && !String(new FormData(form).get(f.name) || '').trim());
        if (bad) { const el = form.elements[bad.name]; const d = el.closest('details'); if (d) d.open = true; el.focus(); el.style.borderColor = 'var(--danger)'; toast(`Preencha o campo "${bad.label}"`, 'alert'); return; }
        const out = {};
        const fd = new FormData(form);
        const semEmpresa = all.find(f => f.type === 'empresas' && !fd.get(f.name + '__todas') && !fd.getAll(f.name).length);
        if (semEmpresa) { toast('Marque ao menos uma empresa, ou "Todas as empresas"', 'alert'); return; }
        if (all.some(f => f.type === 'tarefas' && !fd.getAll(f.name).length)) { toast('Marque ao menos uma tarefa', 'alert'); return; }
        const vazio = [...form.querySelectorAll('[required]')].find(el => !el.closest('[hidden]') && !String(el.value || '').trim());
        if (vazio) { const d = vazio.closest('details'); if (d) d.open = true; vazio.focus(); toast(`Preencha o campo "${vazio.closest('.field')?.querySelector('span')?.textContent || 'obrigatório'}"`, 'alert'); return; }
        all.forEach(f => { out[f.name] = f.type === 'empresas' ? (fd.get(f.name + '__todas') ? null : fd.getAll(f.name)) : (f.type === 'tarefas' || f.type === 'projetos') ? fd.getAll(f.name) : String(fd.get(f.name) ?? '').trim(); });
        if (validar) { const m = validar(out); if (m) { toast(m, 'alert'); return; } }
        close(out);
      });
      wireForm(form);
      if (onReady) onReady(form);
      const first = form.querySelector('input:not([type="radio"]):not([type="hidden"]):not([type="file"]), textarea, select') || form.querySelector('button[type="submit"]');
      setTimeout(() => first && first.focus(), 30);
    });
  }

  /* Máscaras, foto e preenchimento automático pelo CEP e pelo CNPJ (como no Orbe). */
  const MASKS = {
    tel: d => { d = d.slice(0, 11); if (d.length <= 2) return d; if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`; if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`; return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`; },
    cpf: d => d.slice(0, 11).replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2'),
    cnpj: d => d.slice(0, 14).replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2'),
    cep: d => d.slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2'),
  };
  function resizePhoto(file) {
    return new Promise((ok, fail) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const max = 256, k = Math.min(1, max / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url); ok(cv.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => { URL.revokeObjectURL(url); fail(); };
      img.src = url;
    });
  }
  function wireForm(form) {
    const fill = (name, v) => { const el = form.elements[name]; if (el && v && !el.value.trim()) { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); } };
    const hint = (name, txt) => { const h = form.querySelector(`[data-hint="${name}"]`); if (h) h.textContent = txt; };
    $$('[data-mask]', form).forEach(el => {
      const apply = () => { const m = MASKS[el.dataset.mask]; if (m) el.value = m(digits(el.value)); };
      apply();
      el.addEventListener('input', apply);
    });
    const cep = form.elements.cep;
    if (cep) cep.addEventListener('input', async () => {
      const d = digits(cep.value);
      if (d.length !== 8 || cep.dataset.ok === d) return;
      cep.dataset.ok = d; hint('cep', 'Buscando o endereço…');
      try {
        const r = await (await fetch(`https://viacep.com.br/ws/${d}/json/`)).json();
        if (r.erro) { hint('cep', 'CEP não encontrado. Preencha o endereço à mão.'); return; }
        fill('endereco', r.logradouro); fill('bairro', r.bairro); fill('cidade', r.localidade); fill('uf', r.uf);
        hint('cep', 'Endereço preenchido pelo CEP.');
      } catch (e) { hint('cep', 'Sem internet para buscar o CEP. Preencha à mão.'); }
    });
    const cnpj = form.elements.cnpj;
    if (cnpj) cnpj.addEventListener('input', async () => {
      const d = digits(cnpj.value);
      if (d.length !== 14 || cnpj.dataset.ok === d) return;
      cnpj.dataset.ok = d; hint('cnpj', 'Buscando os dados da Receita…');
      try {
        const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${d}`);
        if (!res.ok) { hint('cnpj', 'CNPJ não encontrado. Confira os números.'); return; }
        const e = await res.json();
        fill('name', e.nome_fantasia || e.razao_social); fill('razaoSocial', e.razao_social); fill('segmento', e.cnae_fiscal_descricao);
        fill('cep', String(e.cep || '')); fill('endereco', [e.descricao_tipo_de_logradouro, e.logradouro].filter(Boolean).join(' ')); fill('numero', e.numero);
        fill('complemento', e.complemento); fill('bairro', e.bairro); fill('cidade', e.municipio); fill('uf', e.uf);
        fill('email', String(e.email || '').toLowerCase()); fill('phone', e.ddd_telefone_1);
        hint('cnpj', 'Dados preenchidos pela Receita. Confira antes de salvar.');
      } catch (err) { hint('cnpj', 'Sem internet para buscar o CNPJ. Preencha à mão.'); }
    });
    const pick = form.querySelector('.photo-pick');
    if (pick) {
      const hidden = $('input[type="hidden"]', pick), prev = $('.photo-prev', pick);
      const show = url => {
        hidden.value = url;
        prev.classList.toggle('foto', !!url); prev.classList.toggle('empty', !url);
        prev.style.backgroundImage = url ? `url('${url}')` : ''; prev.innerHTML = url ? '' : icon('camera', 22);
      };
      $('[data-photo-file]', pick).addEventListener('change', async e => {
        const f = e.target.files[0]; if (!f) return;
        try { show(await resizePhoto(f)); } catch (err) { toast('Não foi possível abrir esta imagem', 'alert'); }
      });
      pick.addEventListener('click', e => { if (e.target.closest('[data-photo-clear]')) show(''); });
    }
  }
  const confirmBox = (title, sub, submit = 'Excluir') => formModal({ title, sub, submit, danger: true });

  /* ---------------- Formulários de entidades ---------------- */
  const ENDERECO = () => [
    { name: 'cep', label: 'CEP', mask: 'cep', placeholder: '00000-000', hint: 'O CEP preenche a rua, o bairro e a cidade.' },
    { name: 'endereco', label: 'Rua / avenida', full: true },
    { name: 'numero', label: 'Número' }, { name: 'complemento', label: 'Complemento' },
    { name: 'bairro', label: 'Bairro' }, { name: 'cidade', label: 'Cidade' }, { name: 'uf', label: 'Estado (UF)', placeholder: 'SP' },
  ];
  const redesFields = x => REDES.map(([k, l]) => ({ name: 'rede_' + k, label: l, value: x?.redes?.[k], placeholder: k === 'outra' ? 'Link' : '@perfil ou link' }));
  const temAlgum = (x, ks) => !!x && ks.some(k => x[k]);
  function aplicarRedes(v) {
    const redes = {};
    REDES.forEach(([k]) => { if (v['rede_' + k]) redes[k] = v['rede_' + k]; delete v['rede_' + k]; });
    v.redes = redes;
    if (v.uf) v.uf = v.uf.toUpperCase().slice(0, 2);
    return v;
  }

  /* Pessoa (cliente): só o que é da pessoa. O que é do negócio fica na empresa. */
  async function clientForm(c, { companyId = '' } = {}) {
    const novo = !c;
    const ident = [
      { name: 'photo', label: 'Foto', type: 'photo', value: c?.photo },
      { name: 'name', label: 'Nome', value: c?.name, required: true, full: true, placeholder: 'Ex.: Raphaela Cerqueira' },
      { name: 'phone', label: 'WhatsApp / telefone', mask: 'tel', value: c?.phone, placeholder: '(00) 0 0000-0000' },
      { name: 'email', label: 'E-mail', type: 'email', value: c?.email },
      { name: 'situacao', label: 'Situação', type: 'select', value: c?.situacao || 'ativo', options: SITUACOES },
    ];
    if (novo && !companyId) ident.push(
      { name: 'empresa', label: 'Empresa (opcional)', list: DB.companies.map(e => e.name).sort(), placeholder: 'Escolha ou digite uma nova' },
      { name: 'papel', label: 'Papel na empresa', type: 'select', value: 'socio', options: PAPEIS },
    );
    if (novo && companyId) ident.push({ name: 'papel', label: `Papel em ${get.company(companyId)?.name || 'na empresa'}`, type: 'select', value: 'socio', options: PAPEIS });
    ident.push({ name: 'color', label: 'Cor (aparece quando não tem foto)', type: 'color', value: c?.color || CLIENT_COLORS[DB.clients.length % CLIENT_COLORS.length], full: true });
    const v = await formModal({
      title: c ? `Editar ${c.name}` : 'Nova pessoa',
      wide: true,
      sections: [
        { fields: ident },
        { title: 'Mais detalhes', closed: !temAlgum(c, ['phone2', 'cpf', 'since', 'birthday']), fields: [
          { name: 'phone2', label: 'Segundo telefone', mask: 'tel', value: c?.phone2 },
          { name: 'cpf', label: 'CPF', mask: 'cpf', value: c?.cpf, placeholder: '000.000.000-00' },
          { name: 'since', label: 'Cliente desde', type: 'date', value: c?.since },
          { name: 'birthday', label: 'Aniversário', type: 'date', value: c?.birthday },
        ] },
        { title: 'Redes sociais', closed: !c || !Object.keys(c.redes || {}).length, fields: redesFields(c) },
        { title: 'Endereço', closed: !temAlgum(c, ['cep', 'endereco', 'cidade']), fields: ENDERECO().map(f => ({ ...f, value: c?.[f.name] })) },
        { title: 'Observações', closed: !c?.notes, fields: [{ name: 'notes', label: 'Observações', type: 'textarea', value: c?.notes, full: true, placeholder: 'O que contratou, combinados importantes…' }] },
      ],
      submit: c ? 'Salvar alterações' : 'Cadastrar pessoa',
    });
    if (!v) return null;
    const { empresa = '', papel = 'socio' } = v; delete v.empresa; delete v.papel;
    aplicarRedes(v);
    if (c) { Object.assign(c, v); save(); render(); toast('Cadastro atualizado'); return c; }
    const nc = { id: uid(), ...v, createdAt: new Date().toISOString() };
    DB.clients.push(nc);
    let eid = companyId;
    if (!eid && empresa) eid = findOrCreateCompany(empresa).id;
    if (eid) DB.links.push({ id: uid(), clientId: nc.id, companyId: eid, role: papel });
    save();
    if (companyId) render(); else location.hash = `#/cliente/${nc.id}`;
    toast('Pessoa cadastrada');
    return nc;
  }
  function findOrCreateCompany(name) {
    let e = DB.companies.find(x => norm(x.name) === norm(name));
    if (!e) { e = { id: uid(), name: name.trim(), color: CLIENT_COLORS[DB.companies.length % CLIENT_COLORS.length], createdAt: new Date().toISOString() }; DB.companies.push(e); }
    return e;
  }

  /* Empresa: CNPJ, razão social, endereço e tudo sobre o negócio. */
  async function companyForm(e, { clientId = '' } = {}) {
    const neg = ['oQueFaz', 'oQueVende', 'publico', 'momento', 'objetivos', 'desafios', 'notes'];
    const ident = [
      { name: 'photo', label: 'Logo ou foto', type: 'photo', value: e?.photo },
      { name: 'name', label: 'Nome da empresa (como você chama)', value: e?.name, required: true, full: true },
      { name: 'cnpj', label: 'CNPJ', mask: 'cnpj', value: e?.cnpj, placeholder: '00.000.000/0000-00', hint: 'Com o CNPJ, os dados da Receita entram sozinhos.' },
      { name: 'razaoSocial', label: 'Razão social', value: e?.razaoSocial },
      { name: 'segmento', label: 'Segmento / ramo', value: e?.segmento, full: true },
    ];
    if (!e && clientId) ident.push({ name: 'papel', label: `Papel de ${get.client(clientId)?.name || 'a pessoa'} na empresa`, type: 'select', value: 'socio', options: PAPEIS, full: true });
    ident.push({ name: 'color', label: 'Cor (aparece quando não tem logo)', type: 'color', value: e?.color || CLIENT_COLORS[DB.companies.length % CLIENT_COLORS.length], full: true });
    const v = await formModal({
      title: e ? `Editar ${e.name}` : 'Nova empresa',
      wide: true,
      sections: [
        { fields: ident },
        { title: 'Contato da empresa', closed: !!e && !temAlgum(e, ['phone', 'email', 'site']) && !Object.keys(e.redes || {}).length, fields: [
          { name: 'phone', label: 'WhatsApp / telefone', mask: 'tel', value: e?.phone },
          { name: 'email', label: 'E-mail', type: 'email', value: e?.email },
          { name: 'site', label: 'Site', value: e?.site, placeholder: 'https://', full: true },
          ...redesFields(e),
        ] },
        { title: 'Endereço', closed: !temAlgum(e, ['cep', 'endereco', 'cidade']), fields: ENDERECO().map(f => ({ ...f, value: e?.[f.name] })) },
        { title: 'Mais detalhes', closed: !temAlgum(e, ['inscricaoMunicipal', 'inscricaoEstadual', 'emailFinanceiro', 'phone2']), fields: [
          { name: 'inscricaoMunicipal', label: 'Inscrição municipal', value: e?.inscricaoMunicipal },
          { name: 'inscricaoEstadual', label: 'Inscrição estadual', value: e?.inscricaoEstadual },
          { name: 'emailFinanceiro', label: 'E-mail do financeiro (para nota fiscal)', type: 'email', value: e?.emailFinanceiro },
          { name: 'phone2', label: 'Segundo telefone', mask: 'tel', value: e?.phone2 },
        ] },
        { title: 'Sobre o negócio', closed: !temAlgum(e, neg), fields: [
          { name: 'oQueFaz', label: 'O que faz', type: 'textarea', value: e?.oQueFaz, rows: 2 },
          { name: 'oQueVende', label: 'O que vende (produtos e serviços)', type: 'textarea', value: e?.oQueVende, rows: 2 },
          { name: 'publico', label: 'Público-alvo', type: 'textarea', value: e?.publico, rows: 2 },
          { name: 'momento', label: 'Momento atual', type: 'textarea', value: e?.momento, rows: 2 },
          { name: 'objetivos', label: 'Objetivos com o seu trabalho', type: 'textarea', value: e?.objetivos, rows: 2 },
          { name: 'desafios', label: 'Desafios e dores', type: 'textarea', value: e?.desafios, rows: 2 },
          { name: 'notes', label: 'Observações', type: 'textarea', value: e?.notes, rows: 2, full: true },
        ] },
      ],
      submit: e ? 'Salvar alterações' : 'Cadastrar empresa',
    });
    if (!v) return null;
    const papel = v.papel || 'socio'; delete v.papel;
    aplicarRedes(v);
    if (e) { Object.assign(e, v); save(); render(); toast('Empresa atualizada'); return e; }
    const ne = { id: uid(), ...v, createdAt: new Date().toISOString() };
    DB.companies.push(ne);
    if (clientId) DB.links.push({ id: uid(), clientId, companyId: ne.id, role: papel });
    save();
    if (clientId) render(); else location.hash = `#/empresa/${ne.id}`;
    toast('Empresa cadastrada');
    return ne;
  }

  /* Ligar pessoa e empresa (de qualquer um dos dois lados), ou trocar o papel. */
  async function linkForm({ clientId = '', companyId = '', link = null }) {
    if (link) {
      const c = get.client(link.clientId), e = get.company(link.companyId);
      const v = await formModal({ title: 'Papel na empresa', sub: `${esc(c?.name)} em ${esc(e?.name)}`, fields: [{ name: 'role', label: 'Papel', type: 'select', value: link.role, options: PAPEIS, full: true }] });
      if (!v) return;
      link.role = v.role; save(); render(); toast('Papel atualizado'); return;
    }
    if (clientId) {
      const ja = new Set(linksOfClient(clientId).map(x => x.e.id));
      const opts = DB.companies.filter(e => !ja.has(e.id)).sort(byName).map(e => [e.id, e.name]);
      if (!opts.length) return companyForm(null, { clientId });
      const v = await formModal({
        title: 'Ligar a uma empresa', sub: `Empresa de ${esc(get.client(clientId)?.name)}`,
        fields: [
          { name: 'companyId', label: 'Empresa', type: 'select', value: opts[0][0], options: [...opts, ['__nova', '+ Cadastrar uma empresa nova']], full: true },
          { name: 'role', label: 'Papel na empresa', type: 'select', value: 'socio', options: PAPEIS, full: true },
        ],
        submit: 'Ligar',
      });
      if (!v) return;
      if (v.companyId === '__nova') return companyForm(null, { clientId });
      DB.links.push({ id: uid(), clientId, companyId: v.companyId, role: v.role }); save(); render(); toast('Empresa ligada');
      return;
    }
    const ja = new Set(linksOfCompany(companyId).map(x => x.c.id));
    const opts = DB.clients.filter(c => !ja.has(c.id)).sort(byName).map(c => [c.id, c.name]);
    if (!opts.length) return clientForm(null, { companyId });
    const v = await formModal({
      title: 'Ligar uma pessoa', sub: `Pessoa de ${esc(get.company(companyId)?.name)}`,
      fields: [
        { name: 'clientId', label: 'Pessoa', type: 'select', value: opts[0][0], options: [...opts, ['__nova', '+ Cadastrar uma pessoa nova']], full: true },
        { name: 'role', label: 'Papel na empresa', type: 'select', value: 'socio', options: PAPEIS, full: true },
      ],
      submit: 'Ligar',
    });
    if (!v) return;
    if (v.clientId === '__nova') return clientForm(null, { companyId });
    DB.links.push({ id: uid(), clientId: v.clientId, companyId, role: v.role }); save(); render(); toast('Pessoa ligada');
  }

  async function projectForm(p, clientId, companyId = '') {
    if (!p && !DB.clients.length) { toast('Cadastre uma pessoa antes de criar um projeto', 'alert'); return clientForm(); }
    const tplOpts = [
      ...Object.entries(TEMPLATES).map(([k, t]) => [k, t.name, `${t.stages.length} etapas e ${t.stages.reduce((a, s) => a + s.tasks.length, 0)} tarefas prontas`]),
      ['', 'Em branco', 'Você cria as etapas do zero'],
    ];
    const fromCompany = !p && !clientId && companyId;
    const people = fromCompany && linksOfCompany(companyId).length ? linksOfCompany(companyId).map(x => x.c) : DB.clients.slice().sort(byName);
    const cid0 = p?.clientId || clientId || people[0].id;
    const coid0 = p ? (p.companyId || '') : (companyId || (linksOfClient(cid0)[0]?.e.id || ''));
    const companyOpts = cid => {
      const ids = linksOfClient(cid).map(x => x.e.id);
      if (coid0 && !ids.includes(coid0) && get.company(coid0)) ids.push(coid0);
      return [['', 'Sem empresa'], ...ids.map(id => [id, get.company(id).name])];
    };
    const fields = [];
    if (!clientId || p) fields.push({ name: 'clientId', label: 'Cliente (pessoa)', type: 'select', value: cid0, options: people.map(c => [c.id, c.name]), full: true });
    fields.push({ name: 'companyId', label: 'Empresa do projeto', type: 'select', value: coid0, options: companyOpts(cid0), full: true });
    if (!p) fields.push({ name: 'template', label: 'Comece a partir de um modelo', type: 'template', options: tplOpts, full: true });
    fields.push(
      { name: 'name', label: 'Nome do projeto', value: p?.name, full: true, placeholder: p ? '' : 'Se deixar vazio, usa o nome do modelo', required: !!p },
      { name: 'description', label: 'O que foi contratado', type: 'textarea', value: p?.description, full: true },
      { name: 'startDate', label: 'Início', type: 'date', value: p?.startDate || today() },
      { name: 'dueDate', label: 'Entrega prevista', type: 'date', value: p?.dueDate },
    );
    if (p) fields.push({ name: 'status', label: 'Situação do projeto', type: 'select', value: p.status, options: Object.entries(PROJECT_STATUS), full: true });
    const v = await formModal({
      title: p ? 'Editar projeto' : 'Novo projeto', fields, submit: p ? 'Salvar alterações' : 'Criar projeto',
      onReady: form => {
        const sel = form.elements.clientId, co = form.elements.companyId;
        if (!sel) return;
        sel.addEventListener('change', () => {
          const atual = co.value, opts = companyOpts(sel.value);
          co.innerHTML = opts.map(([ov, ol]) => `<option value="${esc(ov)}">${esc(ol)}</option>`).join('');
          co.value = opts.some(([ov]) => ov === atual) ? atual : (opts[1] ? opts[1][0] : '');
        });
      },
    });
    if (!v) return;
    v.companyId = v.companyId || null;
    if (p) { Object.assign(p, v); save(); render(); toast('Projeto atualizado'); return; }
    const np = {
      id: uid(), clientId: v.clientId || clientId, companyId: v.companyId, name: v.name || (TEMPLATES[v.template]?.name || 'Novo projeto'),
      template: v.template, description: v.description, startDate: v.startDate, dueDate: v.dueDate, status: 'ativo', createdAt: new Date().toISOString(),
    };
    DB.projects.push(np);
    if (v.template) buildFromTemplate(DB, np.id, v.template);
    save(); location.hash = `#/projeto/${np.id}`; toast('Projeto criado');
  }
  async function stageForm(s, projectId) {
    const v = await formModal({
      title: s ? 'Editar etapa' : 'Nova etapa',
      fields: [
        { name: 'name', label: 'Nome da etapa', value: s?.name, required: true, full: true, placeholder: 'Ex.: Briefing' },
        { name: 'description', label: 'Descrição', type: 'textarea', value: s?.description, full: true, rows: 2, placeholder: 'O que acontece nesta etapa' },
        { name: 'expected', label: 'Resultado esperado', type: 'textarea', value: s?.expected, full: true, rows: 2, placeholder: 'Ex.: Contas configuradas e conversões medindo certo' },
        { name: 'startDate', label: 'Data de início da etapa', type: 'date', value: s?.startDate },
        { name: 'dueDate', label: 'Data de entrega da etapa', type: 'date', value: s?.dueDate },
      ],
      submit: s ? 'Salvar alterações' : 'Criar etapa',
      validar: v => (v.startDate && v.dueDate && v.startDate > v.dueDate ? 'A data de início está depois da data de entrega' : null),
    });
    if (!v) return;
    if (s) { Object.assign(s, v); save(); render(); toast('Etapa atualizada'); }
    else {
      const ns = { id: uid(), projectId, name: v.name, description: v.description, expected: v.expected, startDate: v.startDate, dueDate: v.dueDate, order: nextOrder(stagesOf(projectId)) };
      DB.stages.push(ns); save(); render(); toast('Etapa criada');
      setTimeout(() => gotoStage(ns.id), 50);
    }
  }
  /* Responsáveis valem para todas as empresas (sem companyIds) ou só para as empresas marcadas */
  const paraTodas = m => !m.companyIds || !m.companyIds.length;
  function responsaveisPara(companyId, projectId) { return DB.team.filter(m => paraTodas(m) || (companyId && m.companyIds.includes(companyId)) || (projectId && (m.projectIds || []).includes(projectId))); }
  function opcoesResponsavel(companyId, atual, comFuncao = true, projectId = null) {
    const lista = responsaveisPara(companyId, projectId);
    const fora = atual && !lista.some(m => m.id === atual) ? [get.member(atual)].filter(Boolean) : [];
    return [...lista, ...fora].map(m => `<option value="${m.id}" ${atual === m.id ? 'selected' : ''}>${esc(m.name)}${comFuncao && m.role ? ` (${esc(m.role)})` : ''}</option>`).join('');
  }
  const VINCULOS = [['', 'Não informado'], ['socio', 'Sócio'], ['clt', 'CLT'], ['pj', 'PJ'], ['freela', 'Freelancer'], ['estagio', 'Estágio'], ['parceiro', 'Parceiro']];
  const vinculoNome = k => (VINCULOS.find(x => x[0] === k) || ['', ''])[1];
  // Todos os projetos, agrupados por cliente, para marcar onde a pessoa está
  function gruposProjetos() {
    return DB.clients.slice().sort(byName).map(c => ({ c, ps: projectsOf(c.id).slice().sort(byName) })).filter(g => g.ps.length);
  }
  /* Responsável do time: cadastro completo, como o de clientes */
  async function memberForm(m, opts = {}) {
    const emp = opts.companyId && get.company(opts.companyId);
    const v = await formModal({
      title: m ? `Editar ${m.name}` : 'Novo responsável',
      sub: !m && emp ? `Vai aparecer nas tarefas dos projetos da ${esc(emp.name)}. Marque outras empresas se esta pessoa também cuidar delas.` : '',
      wide: true,
      sections: [
        { fields: [
          { name: 'tipo', label: 'Esta pessoa é', type: 'escolha', full: true, value: m ? (m.tipo || 'interna') : (opts.tipo || 'interna'), options: [['interna', 'Da minha equipe', 'Trabalha comigo nos projetos'], ['cliente', 'Da equipe do cliente', 'Trabalha na empresa do cliente']] },
          { name: 'empresaCliente', label: 'Empresa do cliente', type: 'select', value: (m && m.tipo === 'cliente' && m.companyIds && m.companyIds[0]) || (emp ? emp.id : ''), options: [['', 'Escolha a empresa'], ...DB.companies.slice().sort(byName).map(e => [e.id, e.name])] },
          { name: 'cargo', label: 'Cargo na empresa', type: 'select', value: (m && m.clientId && (DB.links.find(l => l.clientId === m.clientId && m.companyIds && l.companyId === m.companyIds[0]) || {}).role) || 'contato', options: PAPEIS },
          { name: 'photo', label: 'Foto', type: 'photo', value: m?.photo },
          { name: 'name', label: 'Nome', value: m?.name, required: true },
          { name: 'role', label: 'Função', value: m?.role, placeholder: 'Ex.: Design' },
          { name: 'phone', label: 'WhatsApp / telefone', mask: 'tel', value: m?.phone, placeholder: '(00) 0 0000-0000' },
          { name: 'email', label: 'E-mail', type: 'email', value: m?.email },
          { name: 'vinculo', label: 'Vínculo', type: 'select', value: m?.vinculo || '', options: VINCULOS },
          { name: 'since', label: 'No time desde', type: 'date', value: m?.since },
        ] },
        { title: 'Empresas e projetos', fields: [
          { name: 'companyIds', label: 'Empresas em que aparece', type: 'empresas', value: m ? m.companyIds : (emp ? [emp.id] : null), hint: 'Aparece como opção de responsável nas tarefas dos projetos dessas empresas.' },
          { name: 'projectIds', label: 'Projetos em que está envolvida', type: 'projetos', value: m?.projectIds || (opts.projectId ? [opts.projectId] : []) },
        ] },
        { title: 'Redes sociais e portfólio', closed: !m || (!Object.keys(m.redes || {}).length && !m.site), fields: [...redesFields(m), { name: 'site', label: 'Portfólio ou site', value: m?.site, placeholder: 'Link' }] },
        { title: 'Mais detalhes', closed: !temAlgum(m, ['skills', 'birthday', 'cidade', 'pix', 'notes']), fields: [
          { name: 'skills', label: 'Habilidades e ferramentas', type: 'textarea', value: m?.skills, full: true, placeholder: 'Ex.: Figma, Meta Ads, edição de vídeo' },
          { name: 'cidade', label: 'Cidade', value: m?.cidade }, { name: 'uf', label: 'Estado (UF)', value: m?.uf, placeholder: 'SP' },
          { name: 'birthday', label: 'Aniversário', type: 'date', value: m?.birthday },
          { name: 'pix', label: 'Chave Pix', value: m?.pix },
          { name: 'notes', label: 'Observações', type: 'textarea', value: m?.notes, full: true, placeholder: 'Disponibilidade, combinados, o que mais for útil' },
        ] },
        { fields: [{ name: 'color', label: 'Cor (aparece quando não tem foto)', type: 'color', value: m?.color || CLIENT_COLORS[DB.team.length % CLIENT_COLORS.length], full: true }] },
      ],
      submit: m ? 'Salvar alterações' : 'Adicionar',
      onReady: form => {
        const todas = form.querySelector('[data-todas]'), lista = form.querySelector('.emp-lista');
        if (todas && lista) todas.addEventListener('change', () => { lista.hidden = todas.checked; });
        // Da equipe do cliente: pede a empresa e o cargo; some a escolha de empresas (é a do cliente)
        const campos = ['empresaCliente', 'cargo'].map(n => form.elements[n].closest('.field'));
        const empPick = form.querySelector('.empresas-pick');
        const aplicar = () => {
          const cli = form.querySelector('input[name="tipo"]:checked')?.value === 'cliente';
          campos.forEach(c => { c.hidden = !cli; });
          form.elements.empresaCliente.required = cli;
          if (empPick) empPick.hidden = cli;
        };
        form.querySelectorAll('input[name="tipo"]').forEach(r => r.addEventListener('change', aplicar));
        aplicar();
      },
    });
    if (!v) return null;
    aplicarRedes(v);
    const { empresaCliente, cargo } = v; delete v.empresaCliente; delete v.cargo;
    if (v.tipo === 'cliente') v.companyIds = [empresaCliente];
    else if (!v.companyIds || !v.companyIds.length) v.companyIds = null;
    let pessoa = m;
    if (m) Object.assign(m, v); else { pessoa = { id: uid(), ...v }; DB.team.push(pessoa); }
    if (v.tipo === 'cliente') ligarAoCliente(pessoa, empresaCliente, cargo);
    save(); render(); toast(m ? 'Cadastro atualizado' : v.tipo === 'cliente' ? `Adicionado e ligado à ${get.company(empresaCliente)?.name || 'empresa'}` : 'Responsável adicionado');
    return pessoa;
  }
  // Pessoa da equipe do cliente: entra (ou é achada) nos cadastros de Clientes, ligada à empresa com o cargo
  function ligarAoCliente(m, companyId, cargo) {
    let c = m.clientId && get.client(m.clientId);
    if (!c) {
      const tel = digits(m.phone || '');
      c = DB.clients.find(x => norm(x.name) === norm(m.name) || (m.email && x.email && x.email.toLowerCase() === m.email.toLowerCase()) || (tel.length >= 10 && digits(x.phone || '') === tel));
    }
    if (!c) { c = { id: uid(), name: m.name, phone: m.phone || '', email: m.email || '', photo: m.photo || '', color: m.color, situacao: 'contato', redes: { ...(m.redes || {}) }, createdAt: new Date().toISOString() }; DB.clients.push(c); }
    else { ['phone', 'email', 'photo'].forEach(k => { if (!c[k] && m[k]) c[k] = m[k]; }); }
    m.clientId = c.id;
    const l = DB.links.find(x => x.clientId === c.id && x.companyId === companyId);
    if (l) l.role = cargo || l.role; else DB.links.push({ id: uid(), clientId: c.id, companyId, role: cargo || 'contato' });
  }
  const daCliente = m => m && m.tipo === 'cliente';
  function cargoNoCliente(m) {
    if (!daCliente(m)) return '';
    const e = get.company((m.companyIds || [])[0]); const l = m.clientId && DB.links.find(x => x.clientId === m.clientId && e && x.companyId === e.id);
    return [l ? roleName(l.role) : '', e ? e.name : ''].filter(Boolean).join(' na ');
  }
  const tagCliente = m => (daCliente(m) ? '<span class="tag-cliente" title="Equipe do cliente">Cliente</span>' : '');

  /* Perfil de uma pessoa do time */
  VIEWS.membro = id => {
    const m = get.member(id);
    if (!m) return VIEWS.naoencontrado('Pessoa não encontrada.');
    const minhas = DB.tasks.filter(t => t.assigneeId === id && taskCtx(t).p);
    const revisar = DB.tasks.filter(t => t.status === 'em_revisao' && t.reviewerId === id);
    const abertas = minhas.filter(t => !isDone(t)), atrasadas = abertas.filter(isLate), feitas = minhas.filter(isDone);
    const noPrazo = feitas.filter(t => !t.dueDate || !t.completedAt || localISO(new Date(t.completedAt)) <= t.dueDate).length;
    // Projetos: os marcados no cadastro e os em que a pessoa tem tarefas
    const pids = [...new Set([...(m.projectIds || []), ...minhas.map(t => taskCtx(t).p.id)])];
    const projs = pids.map(pid => get.project(pid)).filter(Boolean).sort((a, b) => (a.status === 'ativo' ? 0 : 1) - (b.status === 'ativo' ? 0 : 1) || byName(a, b));
    const empresas = paraTodas(m) ? 'Todas as empresas' : m.companyIds.map(e => get.company(e)?.name).filter(Boolean).join(', ');
    const dados = dadosList([
      ['Função', m.role], ['Vínculo', vinculoNome(m.vinculo)], ['WhatsApp', m.phone], ['E-mail', m.email],
      ['No time desde', m.since ? fmtDate(m.since, true) : ''], ['Aniversário', m.birthday ? fmtDate(m.birthday) : ''],
      ['Cidade', [m.cidade, m.uf].filter(Boolean).join(' / ')], ['Chave Pix', m.pix], ['Aparece em', empresas],
      ['Habilidades', m.skills], ['Redes', redesHTML(m), true], ['Portfólio', m.site ? `<a href="${esc(PortalRender.safeUrl(m.site))}" target="_blank" rel="noopener">${esc(m.site)}</a>` : '', true], ['Observações', m.notes],
    ]);
    const proxTarefas = abertas.slice().sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999')).slice(0, 8);
    return `
      <div class="page-head">
        <div class="client-head">
          ${avatar(m, 'xl')}
          <div class="info">
            <div class="nome-linha"><h1>${esc(m.name)}<span class="ponto">.</span></h1>${daCliente(m) ? '<span class="pill st-wait">Equipe do cliente</span>' : m.vinculo ? `<span class="pill">${esc(vinculoNome(m.vinculo))}</span>` : ''}</div>
            <p class="empresas-linha"><span>${esc(m.role || (daCliente(m) ? 'Equipe do cliente' : 'Sem função definida'))}</span>${daCliente(m) && m.companyIds?.[0] ? `<a href="#/empresa/${m.companyIds[0]}">${icon('building', 14)} ${esc(get.company(m.companyIds[0])?.name || '')}<small>${esc((cargoNoCliente(m).split(' na ')[0]) || '')}</small></a>` : ''}</p>
            ${quickContacts(m)}
          </div>
        </div>
        <div class="actions">
          <button class="icon-btn danger" data-act="delete-member" data-id="${m.id}" title="Remover do time" aria-label="Remover do time">${icon('trash', 16)}</button>
          <button class="btn btn-primary" data-act="edit-member" data-id="${m.id}">${icon('edit', 16)} Editar perfil</button>
        </div>
      </div>
      <div class="rel-kpis membro-kpis">
        <div class="rel-kpi"><span>Tarefas abertas</span><b>${abertas.length}</b><small>como responsável</small></div>
        <div class="rel-kpi ${atrasadas.length ? 'k-mau' : 'k-bom'}"><span>Atrasadas</span><b>${atrasadas.length}</b><small>${atrasadas.length ? 'precisam de cobrança' : 'nenhuma'}</small></div>
        <div class="rel-kpi"><span>Para revisar</span><b>${revisar.length}</b><small>tarefas em revisão com ${esc(m.name)}</small></div>
        <div class="rel-kpi"><span>Concluídas</span><b>${feitas.length}</b><small>${feitas.length ? `${Math.round(noPrazo / feitas.length * 100)}% no prazo` : 'nenhuma ainda'}</small></div>
        <div class="rel-kpi"><span>Projetos</span><b>${projs.filter(p => p.status === 'ativo').length}</b><small>ativos, de ${projs.length} no total</small></div>
      </div>
      <div class="grid ficha">
        <section class="panel">
          <div class="panel-head"><h3>Projetos</h3><button class="link-more" data-act="membro-projetos" data-id="${m.id}">${icon('edit', 14)} Escolher projetos</button></div>
          ${projs.length ? `<ul class="vinculos">${projs.map(p => {
            const c = get.client(p.clientId), mt = minhas.filter(t => taskCtx(t).p.id === p.id), ab = mt.filter(t => !isDone(t)), at = ab.filter(isLate);
            const marcado = (m.projectIds || []).includes(p.id);
            return `<li>
              <a class="vinc-nome" href="#/projeto/${p.id}">${c ? clientAvatar(c, '') : ''}<span><b>${esc(p.name)}</b><small>${esc(c ? c.name : '')}${p.status !== 'ativo' ? ` (${esc(PROJECT_STATUS[p.status] || p.status)})` : ''}</small></span></a>
              <span class="pill plain">${mt.length ? `${ab.length} ${ab.length === 1 ? 'aberta' : 'abertas'}${at.length ? `, ${at.length} ${at.length === 1 ? 'atrasada' : 'atrasadas'}` : ''}` : 'Sem tarefas'}</span>
              ${marcado ? `<button class="icon-btn sm ghost danger" data-act="membro-sair" data-id="${m.id}" data-projeto="${p.id}" title="Tirar deste projeto" aria-label="Tirar ${esc(m.name)} de ${esc(p.name)}">${icon('unlink', 15)}</button>` : '<span class="icon-btn sm ghost" aria-hidden="true"></span>'}
            </li>`;
          }).join('')}</ul>` : `<p class="muted vazio-curto">${esc(m.name)} ainda não está em nenhum projeto. <button class="link-more" data-act="membro-projetos" data-id="${m.id}">Escolher projetos</button></p>`}
        </section>
        <section class="panel">
          <div class="panel-head"><h3>Cadastro</h3><button class="link-more" data-act="edit-member" data-id="${m.id}">${icon('edit', 14)} Editar</button></div>
          ${dados || `<p class="muted vazio-curto">Só o nome está preenchido. <button class="link-more" data-act="edit-member" data-id="${m.id}">Completar o perfil</button></p>`}
        </section>
      </div>
      <div class="section-head"><h2>Próximas tarefas</h2></div>
      ${proxTarefas.length ? `<div class="panel table" style="padding:0">${proxTarefas.map(t => { const k = taskCtx(t), due = relDue(t); return `<div class="trow" data-act="open-task" data-id="${t.id}" tabindex="0" role="button">${botaoConcluir(t)}<div style="min-width:0"><div class="tt" style="font-weight:500">${esc(t.title)}</div>${linhaEspera(t)}</div><div class="where">${esc(k.c?.name)} / ${esc(k.p?.name)}</div><span class="due ${due.cls}">${due.txt}</span><span>${statusPill(t.status)}</span></div>`; }).join('')}</div>` : `<div class="empty-state"><h3>Nenhuma tarefa aberta</h3><p>${esc(m.name)} não tem tarefas abertas como responsável agora.</p></div>`}`;
  };

  function gotoStage(id, prefix = 'stage-') {
    const el = document.getElementById(prefix + id);
    if (!el) return;
    if (UI.collapsed[id]) { delete UI.collapsed[id]; saveUI(); render(); return gotoStage(id, prefix); }
    el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  }

  /* ---------------- Painel da tarefa ---------------- */
  let drawerTask = null;
  /* O card trabalha num rascunho: nada vale até clicar em Salvar */
  let rascunhoT = null, originalT = '';
  const tarefaAberta = () => rascunhoT;
  const clonar = o => JSON.parse(JSON.stringify(o));
  const tarefaSuja = () => !!rascunhoT && JSON.stringify(rascunhoT) !== originalT;
  function atualizarEstado() {
    const el = document.getElementById('d-estado'); if (!el) return;
    const suja = tarefaSuja();
    el.classList.toggle('pendente', suja);
    el.innerHTML = suja ? `${icon('edit', 14)} Alterações não salvas` : '';
    const b = drawerRoot.querySelector('[data-act="tarefa-salvar"]'); if (b) b.disabled = !suja;
  }
  function salvarTarefa() {
    const t = get.task(drawerTask); if (!t || !rascunhoT) return false;
    const novo = clonar(rascunhoT), st = novo.status;
    delete novo.status; delete novo.completedAt;
    (novo.deliverables || []).forEach(d => { delete d.novo; });
    const mudou = t.status !== st;
    Object.assign(t, novo);
    if (mudou) setStatus(t, st);
    save();
    closeDrawer(true);
    toast('Tarefa salva');
    return true;
  }
  // Fechar com alterações pendentes: salvar, descartar ou continuar editando
  function perguntarFechar() {
    return new Promise(resolve => {
      const volta = document.activeElement;
      modalRoot.innerHTML = `<div class="scrim" data-m="ficar"></div>
        <div class="modal wide" role="alertdialog" aria-modal="true" aria-labelledby="m-title">
          <h2 id="m-title">Salvar as alterações desta tarefa?</h2>
          <p class="msub">Você mexeu nesta tarefa e ainda não salvou. Se descartar, ela volta a ficar como estava.</p>
          <div class="mfoot mfoot-3"><button type="button" class="btn btn-ghost" data-m="ficar">Continuar editando</button><button type="button" class="btn btn-danger" data-m="descartar">Descartar alterações</button><button type="button" class="btn btn-primary" data-m="salvar">Salvar e fechar</button></div>
        </div>`;
      const fim = v => { modalRoot.innerHTML = ''; modalCancel = null; if (v === 'ficar' && volta && volta.focus) volta.focus(); resolve(v); };
      modalCancel = () => fim('ficar');
      modalRoot.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => fim(b.dataset.m)));
      setTimeout(() => { const b = modalRoot.querySelector('[data-m="salvar"]'); if (b) b.focus(); }, 30);
    });
  }
  async function liberarCard() {
    if (!tarefaSuja()) return true;
    const r = await perguntarFechar();
    if (r === 'ficar') return false;
    if (r === 'salvar') salvarTarefa();
    else scheduleSync(); // fotos adicionadas e descartadas saem do navegador
    return true;
  }
  async function openTask(id, focusTitle = false) {
    if (drawerTask && drawerTask !== id && !(await liberarCard())) return;
    const real = get.task(id); if (!real) return;
    if (drawerTask !== id) { delivEdit = new Set(); delivAberto = new Set(); rascunho = {}; }
    drawerTask = id;
    rascunhoT = clonar(real); originalT = JSON.stringify(rascunhoT);
    renderDrawer();
    if (focusTitle) { const el = $('#d-title'); if (el) { el.focus(); el.select(); } }
    else { const el = $('.drawer [data-act="close-drawer"].icon-btn'); if (el) el.focus(); }
  }
  async function closeDrawer(forcar = false) {
    if (!drawerTask) return;
    if (!forcar && !(await liberarCard())) return;
    drawerTask = null; rascunhoT = null; originalT = ''; drawerRoot.innerHTML = '';
    render();
  }
  function renderDrawer() {
    guardarRascunhos();
    const t = tarefaAberta();
    if (!t) { drawerTask = null; drawerRoot.innerHTML = ''; return; }
    const { s, p, c } = taskCtx(t);
    const stages = p ? stagesOf(p.id) : [];
    drawerRoot.innerHTML = `<div class="scrim" data-act="close-drawer"></div>
      <aside class="drawer" role="dialog" aria-modal="true" aria-label="Tarefa">
        <div class="drawer-head">
          <span class="where">${esc(c?.name)} / ${esc(p?.name)} / ${esc(s?.name)}</span>
          <button class="icon-btn" data-act="close-drawer" aria-label="Fechar">${icon('x')}</button>
        </div>
        <div class="drawer-body">
          <input class="title-input" id="d-title" data-f="title" value="${esc(t.title)}" placeholder="Nome da tarefa" aria-label="Nome da tarefa">
          <div class="field"><span>Status</span>
            <div class="seg" role="radiogroup">${STATUS_ORDER.map(st => `<button role="radio" aria-checked="${t.status === st}" class="${t.status === st ? 'on' : ''} ${STATUS[st].cls}" data-act="set-status" data-v="${st}">${STATUS[st].label}</button>`).join('')}</div>
          </div>
          ${caixaEspera(t)}
          <div class="form-grid">
            <label class="field"><span>Responsável</span><select data-f="assigneeId"><option value="">Sem responsável</option>${opcoesResponsavel(p && p.companyId, t.assigneeId, true, p && p.id)}<option value="__novo">+ Novo responsável…</option></select></label>
            ${t.status === 'em_revisao' ? `<label class="field campo-revisao"><span>Quem revisa</span><select data-f="reviewerId"><option value="">Escolha quem revisa</option>${opcoesResponsavel(p && p.companyId, t.reviewerId, true, p && p.id)}<option value="__novo">+ Novo responsável…</option></select></label>` : ''}
            <label class="field"><span>Data de início</span><input type="date" data-f="startDate" value="${esc(t.startDate || '')}"></label>
            <label class="field"><span>Data final de entrega</span><input type="date" data-f="dueDate" value="${esc(t.dueDate)}"></label>
            <p class="aviso-datas full" id="aviso-datas" role="status">${avisoDatas(t)}</p>
            <label class="field full"><span>Etapa</span><select data-f="stageId">${stages.map((x, i) => `<option value="${x.id}" ${x.id === t.stageId ? 'selected' : ''}>${i + 1}. ${esc(x.name)}</option>`).join('')}</select></label>
          </div>
          <label class="field"><span>O que deve ser feito</span><textarea data-f="description" rows="5" placeholder="Explique o que precisa ser feito e o que conta como pronto">${esc(t.description)}</textarea></label>
          <div class="field"><span>Complexidade</span>
            <div class="cx-escolha" role="radiogroup" aria-label="Complexidade">${COMPLEXIDADE.map(c => `<button role="radio" aria-checked="${t.complexity === c.v}" class="cx-op ${t.complexity === c.v ? 'on' : ''}" data-act="set-cx" data-v="${c.v}" style="--cx:${c.cor}"><i aria-hidden="true"></i>${c.label}</button>`).join('')}</div>
          </div>
          ${conversaTarefa(t)}
          <div>
            <div class="deliv-head"><h4>Entregáveis</h4>
              <div class="deliv-add">
                <button class="btn sm" data-act="add-deliv" data-type="link">${icon('link', 14)} Link</button>
                <button class="btn sm" data-act="add-deliv" data-type="texto">${icon('text', 14)} Texto</button>
                <button class="btn sm" data-act="add-deliv" data-type="acesso">${icon('key', 14)} Acesso</button>
                <button class="btn sm" data-act="add-deliv" data-type="galeria">${icon('image', 14)} Galeria</button>
                <button class="btn sm" data-act="add-deliv" data-type="checklist">${icon('listcheck', 14)} Checklist</button>
              </div>
            </div>
            <div class="deliv-list" style="margin-top:12px">
              ${t.deliverables.length ? t.deliverables.map(delivEditor).join('') : '<p class="deliv-empty">Nenhum entregável ainda. Adicione um link, um texto, os dados de um acesso, uma galeria de fotos ou um checklist.</p>'}
            </div>
          </div>
        </div>
        <div class="drawer-foot">
          <button class="btn btn-danger sm" data-act="delete-task">${icon('trash', 14)} Excluir tarefa</button>
          <span class="saved" id="d-estado"></span>
          <div class="drawer-salvar"><button class="btn btn-ghost sm" data-act="close-drawer">Fechar</button><button class="btn btn-primary sm" data-act="tarefa-salvar">${icon('check', 14)} Salvar</button></div>
        </div>
      </aside>`;
    PortalRender.preencherImagens(drawerRoot);
    atualizarEstado();
  }
  /* Entregáveis de texto e link abertos para edição, e textos longos abertos por inteiro */
  let delivEdit = new Set(), delivAberto = new Set(), rascunho = {};
  // Guarda o que está sendo digitado num entregável aberto, para não perder se o painel redesenhar
  function guardarRascunhos() {
    drawerRoot.querySelectorAll('[data-deliv] [data-de]').forEach(el => {
      const id = el.closest('[data-deliv]').dataset.deliv;
      if (delivEdit.has(id)) (rascunho[id] = rascunho[id] || {})[el.dataset.de] = el.value;
    });
  }
  const rv = (d, k) => (rascunho[d.id] && rascunho[d.id][k] !== undefined ? rascunho[d.id][k] : d[k]);
  const btnCopiar = (d, titulo) => `<button class="icon-btn sm ghost" data-act="copy-deliv" data-id="${d.id}" title="${titulo}" aria-label="${titulo}">${icon('copy', 15)}</button>`;
  const btnEditar = (d, nome) => `<button class="icon-btn sm ghost" data-act="deliv-editar" data-id="${d.id}" title="Editar" aria-label="Editar ${esc(nome)}">${icon('edit', 15)}</button>`;
  const btnRemover = d => `<button class="icon-btn sm ghost danger" data-act="del-deliv" data-id="${d.id}" title="Remover" aria-label="Remover entregável">${icon('trash', 15)}</button>`;
  const acoesEdicao = d => `<div class="deliv-acoes"><button class="btn sm btn-ghost" data-act="deliv-cancelar" data-id="${d.id}">Cancelar</button><button class="btn sm btn-primary" data-act="deliv-salvar" data-id="${d.id}">Salvar</button></div>`;

  /* Texto: aparece como um comentário; longo, mostra o começo e "Ver mais" */
  function textoEditor(d) {
    if (delivEdit.has(d.id)) return `<div class="deliv deliv-texto editando" data-deliv="${d.id}">
      <div class="deliv-top"><span class="deliv-type" title="Texto">${icon('text', 15)}</span>
        <input data-de="label" value="${esc(rv(d, 'label'))}" placeholder="Título. Ex.: Resumo da reunião" aria-label="Título do texto">${btnRemover(d)}</div>
      <textarea class="input" data-de="value" rows="7" placeholder="Escreva o texto" aria-label="Texto">${esc(rv(d, 'value'))}</textarea>
      ${acoesEdicao(d)}
    </div>`;
    const v = d.value || '';
    const longo = v.length > 320 || v.split('\n').length > 6;
    const aberto = delivAberto.has(d.id);
    return `<div class="deliv deliv-texto" data-deliv="${d.id}">
      <div class="deliv-top"><span class="deliv-type" title="Texto">${icon('text', 15)}</span>
        <b class="deliv-nome">${esc(d.label || 'Texto')}</b>${btnEditar(d, d.label || 'texto')}${v ? btnCopiar(d, 'Copiar o texto') : ''}${btnRemover(d)}</div>
      ${v ? `<div class="comentario ${longo && !aberto ? 'recolhido' : ''}" id="cm-${d.id}">${esc(v)}</div>
        ${longo ? `<button class="ver-mais" data-act="deliv-vermais" data-id="${d.id}" aria-expanded="${aberto}" aria-controls="cm-${d.id}">${aberto ? 'Ver menos' : 'Ver mais'}${icon('down', 14)}</button>` : ''}`
        : `<p class="deliv-vazio">Sem texto ainda. Clique no lápis para escrever.</p>`}
    </div>`;
  }

  /* Link: um botão com o nome escolhido; o endereço só aparece na edição */
  function linkEditor(d) {
    if (delivEdit.has(d.id)) return `<div class="deliv deliv-link editando" data-deliv="${d.id}">
      <div class="deliv-top"><span class="deliv-type" title="Link">${icon('link', 15)}</span><b class="deliv-nome">${d.value ? 'Editar link' : 'Novo link'}</b>${btnRemover(d)}</div>
      <div class="form-grid link-campos">
        <label class="field"><span>Nome do botão</span><input class="input" data-de="label" value="${esc(rv(d, 'label'))}" placeholder="Ex.: Ver o relatório completo"></label>
        <label class="field"><span>Endereço do link</span><input class="input" type="url" data-de="value" value="${esc(rv(d, 'value'))}" placeholder="Cole o endereço (https://…)"></label>
      </div>
      ${acoesEdicao(d)}
    </div>`;
    const nome = d.label || 'Abrir link';
    return `<div class="deliv deliv-link" data-deliv="${d.id}">
      <div class="deliv-top"><span class="deliv-type" title="Link">${icon('link', 15)}</span>
        ${d.value ? `<a class="link-botao" href="${esc(safeUrl(d.value))}" target="_blank" rel="noopener" title="${esc(d.value)}">${esc(nome)}${icon('external', 14)}</a>` : `<span class="deliv-vazio">Link sem endereço. Clique no lápis.</span>`}
        <span class="deliv-espaco"></span>${btnEditar(d, nome)}${d.value ? btnCopiar(d, 'Copiar o endereço do link') : ''}${btnRemover(d)}</div>
    </div>`;
  }

  /* Checklist: itens para marcar, sem abrir nada */
  function checklistEditor(d) {
    const its = d.items || [];
    const validos = its.filter(i => i.text.trim());
    const feitos = validos.filter(i => i.done).length;
    const pct = validos.length ? Math.round(feitos / validos.length * 100) : 0;
    return `<div class="deliv deliv-chk" data-deliv="${d.id}">
      <div class="deliv-top"><span class="deliv-type" title="Checklist">${icon('listcheck', 15)}</span>
        <input data-df="label" data-did="${d.id}" value="${esc(d.label)}" placeholder="Nome da lista. Ex.: Informações para levantar" aria-label="Nome do checklist">
        ${validos.length ? `<span class="chk-conta ${feitos === validos.length ? 'completo' : ''}">${feitos} de ${validos.length}</span>` : ''}${btnRemover(d)}</div>
      ${validos.length ? `<div class="chk-barra" aria-hidden="true"><i style="width:${pct}%"></i></div>` : ''}
      <ul class="chk-lista">${its.map(it => `<li class="${it.done ? 'feito' : ''}">
        <button class="chk-box ${it.done ? 'on' : ''}" data-act="chk-toggle" data-id="${d.id}" data-item="${it.id}" role="checkbox" aria-checked="${!!it.done}" aria-label="${esc(it.text || 'Item')}">${icon('check', 12)}</button>
        <input class="chk-txt" data-chk="${d.id}" data-item="${it.id}" value="${esc(it.text)}" placeholder="Escreva o item" aria-label="Texto do item">
        <button class="chk-x" data-act="chk-del" data-id="${d.id}" data-item="${it.id}" title="Remover item" aria-label="Remover o item ${esc(it.text)}">${icon('x', 13)}</button>
      </li>`).join('')}</ul>
      <div class="chk-novo-linha">${icon('plus', 15)}<input class="chk-novo" data-chk-novo="${d.id}" placeholder="Adicionar item e apertar Enter" aria-label="Novo item do checklist"></div>
    </div>`;
  }

  function delivEditor(d) {
    if (d.type === 'galeria') return galeriaEditor(d);
    if (d.type === 'checklist') return checklistEditor(d);
    if (d.type === 'texto') return textoEditor(d);
    if (d.type === 'link') return linkEditor(d);
    const ic = d.type === 'link' ? 'link' : d.type === 'acesso' ? 'key' : 'text';
    const ph = { link: 'Nome. Ex.: Pasta com os arquivos', texto: 'Nome. Ex.: Resumo da reunião', acesso: 'Plataforma. Ex.: Gerenciador de Negócios' }[d.type];
    const value = d.type === 'link'
      ? `<input class="input" type="url" data-df="value" data-did="${d.id}" value="${esc(d.value)}" placeholder="Cole aqui o link do Google Drive" aria-label="Link">`
      : `<textarea class="input" data-df="value" data-did="${d.id}" rows="3" placeholder="${d.type === 'acesso' ? 'Login, senha ou instruções de acesso' : 'Escreva o texto'}" aria-label="Conteúdo">${esc(d.value)}</textarea>`;
    return `<div class="deliv" data-deliv="${d.id}">
      <div class="deliv-top">
        <span class="deliv-type" title="${d.type === 'link' ? 'Link' : d.type === 'acesso' ? 'Acesso' : 'Texto'}">${icon(ic, 15)}</span>
        <input data-df="label" data-did="${d.id}" value="${esc(d.label)}" placeholder="${ph}" aria-label="Nome do entregável">
        ${d.type === 'link' ? `<a class="icon-btn sm ghost" id="open-${d.id}" href="${esc(safeUrl(d.value))}" target="_blank" rel="noopener" title="Abrir link" aria-label="Abrir link">${icon('external', 15)}</a>` : ''}
        <button class="icon-btn sm ghost" data-act="copy-deliv" data-id="${d.id}" title="Copiar" aria-label="Copiar conteúdo">${icon('copy', 15)}</button>
        <button class="icon-btn sm ghost danger" data-act="del-deliv" data-id="${d.id}" title="Remover" aria-label="Remover entregável">${icon('trash', 15)}</button>
      </div>
      ${value}
    </div>`;
  }

  /* Galeria de fotos no painel da tarefa: escolher, arrastar ou colar */
  function galeriaEditor(d) {
    const n = (d.images || []).length;
    const x = (im, k) => `<button class="gal-x" data-act="del-img" data-id="${d.id}" data-img="${im.id}" title="Remover" aria-label="Remover a imagem ${k + 1}">${icon('x', 13)}</button>`;
    return `<div class="deliv deliv-gal" data-deliv="${d.id}">
      <div class="deliv-top">
        <span class="deliv-type" title="Galeria">${icon('image', 15)}</span>
        <input data-df="label" data-did="${d.id}" value="${esc(d.label)}" placeholder="Nome da galeria. Ex.: Perfil antes e depois" aria-label="Nome da galeria">
        <button class="icon-btn sm ghost danger" data-act="del-deliv" data-id="${d.id}" title="Remover a galeria" aria-label="Remover a galeria inteira">${icon('trash', 15)}</button>
      </div>
      <div class="gal-edit" data-drop="${d.id}">
        ${n ? PortalRender.galeriaGrade(d, x) : ''}
        <label class="gal-add">
          <input type="file" accept="image/*" multiple data-gal-file="${d.id}" class="sr-only">
          ${icon('plus', 18)}<span>${n ? 'Adicionar fotos' : 'Escolher fotos'}</span>
        </label>
      </div>
      <p class="gal-dica">${n ? `${plural(n, 'foto', 'fotos')}. ` : ''}Arraste fotos para cá ou cole uma imagem com Cmd+V.</p>
    </div>`;
  }
  let galAtual = null; // última galeria usada, para onde vai a imagem colada
  async function adicionarImagens(galId, arquivos) {
    const t = tarefaAberta(); if (!t) return;
    let d = t.deliverables.find(x => x.id === galId && x.type === 'galeria');
    const lista = [...arquivos].filter(f => f && /^image\//.test(f.type));
    if (!lista.length) { toast('Escolha arquivos de foto ou imagem (PNG, JPG ou WebP)', 'alert'); return; }
    if (!d) { d = { id: uid(), type: 'galeria', label: 'Galeria', value: '', images: [] }; t.deliverables.push(d); }
    galAtual = d.id;
    const zona = $(`.drawer [data-drop="${d.id}"]`); if (zona) zona.classList.add('enviando');
    let falhas = 0;
    for (const f of lista) {
      try {
        const r = await Imagens.preparar(f);
        const id = 'i' + newToken().slice(0, 20);
        await Imagens.guardar(id, { full: r.full, thumb: r.thumb });
        d.images = d.images || [];
        d.images.push({ id, w: r.w, h: r.h });
      } catch (e) { falhas++; }
    }
    save(); renderDrawer(); render();
    const ok = lista.length - falhas;
    if (ok) toast(`${plural(ok, 'foto adicionada', 'fotos adicionadas')} à galeria`, 'image');
    if (falhas) toast(`${plural(falhas, 'foto não pôde ser lida', 'fotos não puderam ser lidas')}`, 'alert');
  }
  drawerRoot.addEventListener('change', e => {
    const el = e.target;
    if (el.dataset.galFile && el.files.length) { adicionarImagens(el.dataset.galFile, el.files); el.value = ''; }
  });
  drawerRoot.addEventListener('dragover', e => {
    const z = e.target.closest('[data-drop]'); if (!z || !e.dataTransfer || ![...e.dataTransfer.types].includes('Files')) return;
    e.preventDefault(); z.classList.add('soltar');
  });
  drawerRoot.addEventListener('dragleave', e => { const z = e.target.closest('[data-drop]'); if (z && !z.contains(e.relatedTarget)) z.classList.remove('soltar'); });
  drawerRoot.addEventListener('drop', e => {
    const z = e.target.closest('[data-drop]'); if (!z) return;
    e.preventDefault(); z.classList.remove('soltar');
    if (e.dataTransfer.files.length) adicionarImagens(z.dataset.drop, e.dataTransfer.files);
  });
  // Colar uma imagem (Cmd+V) com a tarefa aberta: vai para a última galeria usada, ou cria uma.
  document.addEventListener('paste', e => {
    if (!drawerTask || modalCancel) return;
    const files = [...(e.clipboardData ? e.clipboardData.files : [])].filter(f => /^image\//.test(f.type));
    if (!files.length) return;
    e.preventDefault();
    const t = tarefaAberta(); if (!t) return;
    const gals = t.deliverables.filter(d => d.type === 'galeria');
    const alvo = gals.find(d => d.id === galAtual) || gals[gals.length - 1];
    adicionarImagens(alvo ? alvo.id : null, files);
  });

  drawerRoot.addEventListener('keydown', e => {
    const el = e.target, t = tarefaAberta(); if (!t) return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); salvarTarefa(); return; }
    if (el.dataset.chkNovo !== undefined && e.key === 'Enter') {
      e.preventDefault();
      const d = t.deliverables.find(x => x.id === el.dataset.chkNovo); const txt = el.value.trim();
      if (!d || !txt) return;
      d.items = d.items || []; d.items.push({ id: uid(), text: txt, done: false });
      save(); renderDrawer(); render();
      const f = $(`.drawer [data-chk-novo="${d.id}"]`); if (f) f.focus();
      return;
    }
    if (el.dataset.chk && (e.key === 'Enter' || (e.key === 'Backspace' && !el.value))) {
      const d = t.deliverables.find(x => x.id === el.dataset.chk); if (!d) return;
      const i = d.items.findIndex(x => x.id === el.dataset.item); if (i < 0) return;
      e.preventDefault();
      if (e.key === 'Enter') {
        const novo = { id: uid(), text: '', done: false }; d.items.splice(i + 1, 0, novo);
        save(); renderDrawer();
        const f = $(`.drawer [data-chk="${d.id}"][data-item="${novo.id}"]`); if (f) f.focus();
      } else {
        d.items.splice(i, 1); save(); renderDrawer(); render();
        const ant = d.items[i - 1];
        const f = ant ? $(`.drawer [data-chk="${d.id}"][data-item="${ant.id}"]`) : $(`.drawer [data-chk-novo="${d.id}"]`);
        if (f) { f.focus(); if (f.setSelectionRange) f.setSelectionRange(f.value.length, f.value.length); }
      }
      return;
    }
    if (el.dataset.de && e.key === 'Enter' && (el.tagName === 'INPUT' || e.metaKey || e.ctrlKey)) {
      e.preventDefault(); const box = el.closest('[data-deliv]'); if (box) ACTIONS['deliv-salvar'](box.dataset.deliv);
    }
    if (el.dataset.de && e.key === 'Escape') {
      e.preventDefault(); e.stopPropagation(); const box = el.closest('[data-deliv]'); if (box) ACTIONS['deliv-cancelar'](box.dataset.deliv);
    }
  });
  drawerRoot.addEventListener('input', () => setTimeout(atualizarEstado, 0));
  drawerRoot.addEventListener('input', e => {
    const t = tarefaAberta(); if (!t) return;
    const el = e.target;
    if (el.dataset.chk) {
      const d = t.deliverables.find(x => x.id === el.dataset.chk); const it = d && (d.items || []).find(i => i.id === el.dataset.item);
      if (it) { it.text = el.value; save(); renderSoon(); }
      return;
    }
    if (el.dataset.f) {
      const f = el.dataset.f;
      if (f === 'stageId') {
        if (el.value === t.stageId) return;
        t.stageId = el.value; t.order = nextOrder(tasksOfStage(el.value).filter(x => x.id !== t.id));
        const { s, p, c } = taskCtx(t); $('.drawer .where').textContent = `${c?.name} / ${p?.name} / ${s?.name}`;
      } else if (f === 'assigneeId' || f === 'reviewerId') {
        if (el.value === '__novo') {
          el.value = t[f] || '';
          const proj = taskCtx(t).p;
          memberForm(null, { companyId: proj && proj.companyId }).then(m => {
            const tt = tarefaAberta(); if (!m || !tt || tt.id !== t.id) return;
            tt[f] = m.id; save(); if (drawerTask === tt.id) renderDrawer(); render();
            const sel = $(`.drawer [data-f="${f}"]`); if (sel) sel.focus();
          });
          return;
        }
        t[f] = el.value || null;
        if (f === 'reviewerId') { save(); renderDrawer(); render(); return; }
      }
      else t[f] = el.value;
      if (f === 'startDate' || f === 'dueDate') { const a = document.getElementById('aviso-datas'); if (a) a.innerHTML = avisoDatas(t); }
      save(); renderSoon();
    } else if (el.dataset.df) {
      const d = t.deliverables.find(x => x.id === el.dataset.did); if (!d) return;
      d[el.dataset.df] = el.value;
      if (d.type === 'link' && el.dataset.df === 'value') { const a = document.getElementById('open-' + d.id); if (a) a.href = safeUrl(d.value); }
      save(); renderSoon();
    }
  });

  /* ---------------- Busca global ---------------- */
  function searchResults(q) {
    q = q.trim().toLowerCase();
    if (!q) return [];
    const out = [];
    const nq = norm(q);
    DB.clients.forEach(c => { if (norm(`${c.name} ${c.email || ''} ${empresasTxt(c.id)}`).includes(nq)) out.push({ href: `#/cliente/${c.id}`, ic: 'user', t: c.name, s: linksOfClient(c.id)[0]?.e.name || 'Pessoa' }); });
    DB.companies.forEach(e => { if (norm(`${e.name} ${e.razaoSocial || ''} ${digits(e.cnpj) && e.cnpj}`).includes(nq)) out.push({ href: `#/empresa/${e.id}`, ic: 'building', t: e.name, s: 'Empresa' }); });
    DB.projects.forEach(p => { if (p.name.toLowerCase().includes(q)) out.push({ href: `#/projeto/${p.id}`, ic: 'folder', t: p.name, s: get.client(p.clientId)?.name || 'Projeto' }); });
    DB.tasks.forEach(t => { if (t.title.toLowerCase().includes(q)) { const { p } = taskCtx(t); if (p) out.push({ task: t.id, ic: 'tasks', t: t.title, s: p.name }); } });
    return out.slice(0, 10);
  }
  let searchSel = 0;
  function showSearch() {
    const input = $('#gsearch'), box = $('#gresults');
    const res = searchResults(input.value);
    if (!input.value.trim()) { box.classList.add('hidden'); return; }
    searchSel = Math.min(searchSel, Math.max(0, res.length - 1));
    box.innerHTML = res.length ? res.map((r, i) => r.task
      ? `<a href="#" class="${i === searchSel ? 'on' : ''}" data-act="search-task" data-id="${r.task}">${icon(r.ic, 16)}<span>${esc(r.t)}</span><small>${esc(r.s)}</small></a>`
      : `<a href="${r.href}" class="${i === searchSel ? 'on' : ''}" data-act="search-go">${icon(r.ic, 16)}<span>${esc(r.t)}</span><small>${esc(r.s)}</small></a>`).join('')
      : `<div class="empty">Nada encontrado para “${esc(input.value)}”.</div>`;
    box.classList.remove('hidden');
  }
  function closeSearch() { const box = $('#gresults'); if (box) box.classList.add('hidden'); }

  /* ---------------- Ações ---------------- */
  const ACTIONS = {
    'new-menu': () => $('#new-menu').classList.toggle('hidden'),
    'new-client': () => clientForm(),
    'share-client': id => openShare(id),
    'edit-client': id => clientForm(get.client(id)),
    'delete-client': async id => {
      const c = get.client(id); if (!c) return;
      const n = projectsOf(id).length;
      if (!(await confirmBox(`Excluir ${c.name}?`, `${n ? `Os ${plural(n, 'projeto', 'projetos')} deste cliente, com todas as etapas, tarefas e entregáveis, também serão excluídos. ` : ''}Não dá para desfazer.`, 'Excluir cliente'))) return;
      if (c.shareToken) unpublish([c.shareToken]);
      deleteProjectCascade(projectsOf(id).map(p => p.id));
      DB.links = DB.links.filter(l => l.clientId !== id);
      DB.clients = DB.clients.filter(x => x.id !== id);
      save(); location.hash = '#/clientes'; toast('Cliente excluído', 'trash');
    },
    'new-project': (id, el) => projectForm(null, id || '', el.dataset.company || ''),
    'new-company': () => companyForm(),
    'edit-company': id => companyForm(get.company(id)),
    'delete-company': async id => {
      const e = get.company(id); if (!e) return;
      const np = projectsOfCompany(id).length, nl = linksOfCompany(id).length;
      if (!(await confirmBox(`Excluir a empresa ${e.name}?`, `${nl ? `${plural(nl, 'pessoa continua', 'pessoas continuam')} cadastrada${nl === 1 ? '' : 's'}, só sem esta empresa. ` : ''}${np ? `${plural(np, 'projeto continua', 'projetos continuam')}, sem empresa definida. ` : ''}Não dá para desfazer.`, 'Excluir empresa'))) return;
      DB.links = DB.links.filter(l => l.companyId !== id);
      DB.projects.forEach(p => { if (p.companyId === id) p.companyId = null; });
      DB.companies = DB.companies.filter(x => x.id !== id);
      UI.cadTab = 'empresas'; saveUI();
      save(); location.hash = '#/clientes'; toast('Empresa excluída', 'trash');
    },
    'link-company': id => linkForm({ clientId: id }),
    'link-person': id => linkForm({ companyId: id }),
    'edit-link': id => { const l = DB.links.find(x => x.id === id); if (l) linkForm({ link: l }); },
    'unlink': async id => {
      const l = DB.links.find(x => x.id === id); if (!l) return;
      const c = get.client(l.clientId), e = get.company(l.companyId);
      if (!(await confirmBox(`Desligar ${c?.name} de ${e?.name}?`, 'Os dois cadastros continuam. Só deixam de estar ligados.', 'Desligar'))) return;
      DB.links = DB.links.filter(x => x.id !== id); save(); render(); toast('Desligado', 'unlink');
    },
    'cad-tab': (id, el) => { UI.cadTab = el.dataset.v; UI.cadSit = ''; saveUI(); render(); },
    'cad-view': (id, el) => { UI.cadView = el.dataset.v; saveUI(); render(); },
    'cad-clear': () => { UI.cadQ = ''; UI.cadSit = ''; render(); },
    'import-orbe': () => $('#import-orbe').click(),
    'sel-limpar': () => { UI.sel = new Set(); render(); },
    'sel-task': id => { if (UI.sel.has(id)) UI.sel.delete(id); else UI.sel.add(id); render(); },
    'sel-stage': id => { const ts = tasksOfStage(id); const all = ts.every(t => UI.sel.has(t.id)); ts.forEach(t => (all ? UI.sel.delete(t.id) : UI.sel.add(t.id))); render(); },
    'sel-all': id => { const ts = tasksOfProject(id); const all = ts.every(t => UI.sel.has(t.id)); UI.sel = all ? new Set() : new Set(ts.map(t => t.id)); render(); },
    'lote-excluir': async () => {
      const ids = [...UI.sel].filter(id => get.task(id)); if (!ids.length) return;
      if (!(await confirmBox(`Excluir ${plural(ids.length, 'tarefa', 'tarefas')}?`, 'Os entregáveis dessas tarefas também serão excluídos. Não dá para desfazer.', `Excluir ${plural(ids.length, 'tarefa', 'tarefas')}`))) return;
      deleteTaskCascade(ids); UI.sel = new Set(); save(); render(); toast(`${plural(ids.length, 'tarefa excluída', 'tarefas excluídas')}`, 'trash');
    },
    'edit-project': id => projectForm(get.project(id)),
    'delete-project': async id => {
      const p = get.project(id); if (!p) return;
      if (!(await confirmBox(`Excluir o projeto ${p.name}?`, 'Todas as etapas, tarefas e entregáveis deste projeto também serão excluídos. Não dá para desfazer.', 'Excluir projeto'))) return;
      const cid = p.clientId; deleteProjectCascade([id]);
      save(); location.hash = `#/cliente/${cid}`; toast('Projeto excluído', 'trash');
    },
    'new-stage': id => stageForm(null, id),
    'edit-stage': id => stageForm(get.stage(id)),
    'delete-stage': async id => {
      const s = get.stage(id); if (!s) return;
      const n = tasksOfStage(id).length;
      if (!(await confirmBox(`Excluir a etapa ${s.name}?`, `${n ? `As ${plural(n, 'tarefa', 'tarefas')} desta etapa também serão excluídas. ` : ''}Não dá para desfazer.`, 'Excluir etapa'))) return;
      deleteStageCascade([id]); save(); render(); toast('Etapa excluída', 'trash');
    },
    'stage-up': id => moveStage(id, -1),
    'stage-down': id => moveStage(id, 1),
    'toggle-stage': id => { if (UI.collapsed[id]) delete UI.collapsed[id]; else UI.collapsed[id] = true; saveUI(); render(); },
    'goto-stage': id => gotoStage(id),
    'portal-stage': (id, el) => PortalRender.handleClick(el),
    'add-task': stageId => {
      const t = { id: uid(), stageId, title: 'Nova tarefa', description: '', assigneeId: null, dueDate: '', status: 'a_fazer', completedAt: null, deliverables: [], order: nextOrder(tasksOfStage(stageId)), createdAt: new Date().toISOString() };
      DB.tasks.push(t); save(); render(); openTask(t.id, true);
    },
    'open-task': (id, el, e) => {
      if (e && e.target.closest && e.target.closest('[data-titulo]')) {
        if (cliqueTitulo && cliqueTitulo.id === id) { clearTimeout(cliqueTitulo.timer); cliqueTitulo = null; renomearNaLinha(id); return; }
        cliqueTitulo = { id, timer: setTimeout(() => { cliqueTitulo = null; openTask(id); }, 240) };
        return;
      }
      openTask(id);
    },
    'search-task': id => { closeSearch(); $('#gsearch').value = ''; openTask(id); },
    'search-go': (id, el) => { closeSearch(); $('#gsearch').value = ''; location.hash = el.getAttribute('href'); },
    'toggle-task': id => { const t = get.task(id); if (!t) return; if (!setStatus(t, isDone(t) ? 'a_fazer' : 'concluida')) return; save(); render(); if (drawerTask) renderDrawer(); },
    'close-drawer': () => closeDrawer(),
    'tarefa-salvar': () => salvarTarefa(),
    'rel-abrir': id => abrirPdfDono(id),
    'rel-editar': async (id, el) => {
      const r = (RELS[el.dataset.projeto] || []).find(x => x.id === id); if (!r) return;
      const v = await formModal({ title: 'Renomear relatório', fields: [{ name: 'titulo', label: 'Título', value: r.titulo, required: true, full: true }, { name: 'data', label: 'Data', type: 'date', value: r.data }], submit: 'Salvar' });
      if (!v) return;
      try { await rpc('relatorio_editar', { p_key: chaveDono(), p_id: id, p_titulo: v.titulo, p_data: v.data || null }); await carregarRelatorios(el.dataset.projeto); desenharRelatorios(el.dataset.projeto); toast('Relatório atualizado'); } catch (e) { toast('Não foi possível salvar agora.', 'alert'); }
    },
    'rel-remover': async (id, el) => {
      if (!(await confirmBox('Remover este relatório?', 'Ele some da página do cliente. Não dá para desfazer.', 'Remover'))) return;
      try { await rpc('relatorio_delete', { p_key: chaveDono(), p_id: id }); await carregarRelatorios(el.dataset.projeto); desenharRelatorios(el.dataset.projeto); toast('Relatório removido', 'trash'); } catch (e) { toast('Não foi possível remover agora.', 'alert'); }
    },
    'comentar-dono': () => {
      const t = tarefaAberta(); const ta = document.getElementById('novo-comentario'); if (!t || !ta || !ta.value.trim()) return;
      if (!Array.isArray(DB.comments)) DB.comments = [];
      DB.comments.push({ id: uid(), taskId: t.id, autor: DB.settings.ownerName || 'Equipe', autorNome: DB.settings.ownerName || DB.settings.businessName || 'Equipe', deCliente: false, texto: ta.value.trim(), em: new Date().toISOString() });
      save(); renderDrawer(); toast('Comentário enviado');
    },
    'desfazer-cliente': (id) => {
      const h = (DB.history || []).find(x => x.id === id); const t = tarefaAberta(); if (!h || !t) return;
      t[h.campo] = h.antes === undefined ? null : h.antes; renderDrawer();
      toast('Valor anterior de volta no card. Clique em Salvar para confirmar.');
    },
    'proj-modo': (id, el) => { UI.projModo = el.dataset.v; UI.sel = new Set(); saveUI(); render(); },
    'gantt-zoom': (id, el) => { UI.gZoom = el.dataset.v; saveUI(); render(); },
    'sair-sistema': async () => {
      if (!(await formModal({ title: 'Sair do sistema?', sub: 'Para entrar de novo, use o seu e-mail e senha. Os dados continuam salvos no banco.', submit: 'Sair' }))) return;
      const ok = await Nuvem.sair();
      if (!ok) toast('Uma alteração ainda não tinha subido. Ela fica neste navegador até você entrar de novo.', 'alert');
      location.reload();
    },
    'proj-view': (id, el) => { UI.projView = el.dataset.v; saveUI(); render(); },
    'proj-limpar': () => { UI.projF = { q: '', sit: 'ativo', cliente: '', empresa: '', resp: '', ritmo: '', ordem: UI.projF.ordem || 'prazo' }; saveUI(); render(); },
    'membro-projetos': async id => {
      const m = get.member(id); if (!m) return;
      const v = await formModal({ title: `Projetos de ${m.name}`, sub: 'Marque os projetos em que esta pessoa está envolvida. Ela passa a aparecer como opção de responsável nas tarefas desses projetos.', wide: true, fields: [{ name: 'projectIds', label: 'Projetos', type: 'projetos', value: m.projectIds || [] }], submit: 'Salvar projetos' });
      if (!v) return;
      m.projectIds = v.projectIds; save(); render(); toast('Projetos atualizados');
    },
    'membro-sair': (id, el) => {
      const m = get.member(id); if (!m) return;
      m.projectIds = (m.projectIds || []).filter(x => x !== el.dataset.projeto); save(); render(); toast('Tirado do projeto');
    },
    'qe-resp': (id, el) => { const t = get.task(id); if (t) qeResp(t, el); },
    'qe-prazo': (id, el) => { const t = get.task(id); if (t) qePrazo(t, el); },
    'qe-status': (id, el) => { const t = get.task(id); if (t) qeStatus(t, el); },
    'qe-cx': (id, el) => { const t = get.task(id); if (t) qeCx(t, el); },
    'qe-mais': (id, el) => { const t = get.task(id); if (t) qeMais(t, el); },
    'qe-entregas': async id => { await openTask(id); const h = drawerRoot.querySelector('.deliv-head'); if (h) h.scrollIntoView({ block: 'start' }); },
    'set-status': (id, el) => { const t = tarefaAberta(); if (!t) return; if (!setStatus(t, el.dataset.v)) return; save(); renderDrawer(); render(); const b = $(`.seg [data-v="${el.dataset.v}"]`); if (b) b.focus(); },
    'set-cx': (id, el) => {
      const t = tarefaAberta(); if (!t) return;
      const v = Number(el.dataset.v); t.complexity = t.complexity === v ? null : v;
      save(); renderDrawer(); render();
      const b = $(`.drawer .cx-op[data-v="${v}"]`); if (b) b.focus();
    },
    'espera-editar': () => { const t = tarefaAberta(); if (t) porEmEspera([t]); },
    'espera-tirar': (id, el) => {
      const t = tarefaAberta(); if (!t) return;
      t.waitingFor = (t.waitingFor || []).filter(x => x !== el.dataset.tarefa);
      if (!bloqueada(t)) { t.waitingFor = []; if (t.status === 'aguardando') { t.status = 'a_fazer'; toast('Tarefa liberada. Ela voltou para A fazer.', 'check'); } }
      save(); renderDrawer(); render();
    },
    'espera-abrir': (id, el) => openTask(el.dataset.tarefa),
    'delete-task': async () => {
      const t = get.task(drawerTask); if (!t) return;
      if (!(await confirmBox(`Excluir a tarefa ${t.title}?`, 'Os entregáveis desta tarefa também serão excluídos. Não dá para desfazer.', 'Excluir tarefa'))) return;
      deleteTaskCascade([t.id]); save(); closeDrawer(true); toast('Tarefa excluída', 'trash');
    },
    'add-deliv': (id, el) => {
      const t = tarefaAberta(); if (!t) return;
      const d = { id: uid(), type: el.dataset.type, label: '', value: '' };
      if (d.type === 'checklist') {
        d.items = []; t.deliverables.push(d); save(); renderDrawer(); render();
        const f = $(`.drawer [data-did="${d.id}"][data-df="label"]`); if (f) { f.scrollIntoView({ block: 'center' }); f.focus(); }
        return;
      }
      if (d.type === 'texto' || d.type === 'link') {
        d.novo = true; t.deliverables.push(d); delivEdit.add(d.id); save(); renderDrawer();
        const f = $(`.drawer [data-deliv="${d.id}"] [data-de="${d.type === 'link' ? 'label' : 'value'}"]`); if (f) { f.scrollIntoView({ block: 'center' }); f.focus(); }
        return;
      }
      if (d.type === 'galeria') {
        d.images = []; t.deliverables.push(d); galAtual = d.id; save(); renderDrawer();
        const f = $(`.drawer [data-gal-file="${d.id}"]`); if (f) { f.closest('.deliv').scrollIntoView({ block: 'center' }); f.click(); }
        return;
      }
      t.deliverables.push(d); save(); renderDrawer();
      const inp = $(`.drawer [data-df="label"][data-did="${d.id}"]`); if (inp) { inp.focus(); inp.scrollIntoView({ block: 'center' }); }
    },
    'del-img': (id, el) => {
      const t = tarefaAberta(); const d = t && t.deliverables.find(x => x.id === id); if (!d) return;
      d.images = (d.images || []).filter(im => im.id !== el.dataset.img);
      galAtual = d.id; save(); renderDrawer(); render();
      const prox = $(`.drawer [data-drop="${d.id}"] .gal-x`) || $(`.drawer [data-gal-file="${d.id}"]`); if (prox) prox.focus();
    },
    'zoom': (id, el) => PortalRender.handleClick(el),
    'deliv-editar': id => {
      delivEdit.add(id); renderDrawer();
      const f = $(`.drawer [data-deliv="${id}"] [data-de="value"]`) || $(`.drawer [data-deliv="${id}"] [data-de]`); if (f) { f.focus(); if (f.setSelectionRange && f.type !== 'url') f.setSelectionRange(f.value.length, f.value.length); }
    },
    'deliv-salvar': id => {
      const t = tarefaAberta(); const d = t && t.deliverables.find(x => x.id === id); if (!d) return;
      const box = $(`.drawer [data-deliv="${id}"]`);
      const label = box.querySelector('[data-de="label"]').value.trim(), value = box.querySelector('[data-de="value"]').value.trim();
      if (d.type === 'link' && !value) { toast('Cole o endereço do link', 'alert'); box.querySelector('[data-de="value"]').focus(); return; }
      if (d.type === 'texto' && !value && !label) { toast('Escreva o texto ou remova este entregável', 'alert'); box.querySelector('[data-de="value"]').focus(); return; }
      d.label = label; d.value = value; delete d.novo;
      delivEdit.delete(id); delete rascunho[id]; save(); renderDrawer(); render();
      const b = $(`.drawer [data-deliv="${id}"] [data-act="deliv-editar"]`); if (b) b.focus();
    },
    'deliv-cancelar': id => {
      const t = tarefaAberta(); const d = t && t.deliverables.find(x => x.id === id);
      delivEdit.delete(id); delete rascunho[id];
      if (d && d.novo) { t.deliverables = t.deliverables.filter(x => x.id !== id); save(); render(); }
      renderDrawer();
      const b = $(`.drawer [data-deliv="${id}"] [data-act="deliv-editar"]`); if (b) b.focus();
    },
    'deliv-vermais': id => {
      if (delivAberto.has(id)) delivAberto.delete(id); else delivAberto.add(id);
      const el = document.getElementById('cm-' + id), b = $(`.drawer [data-act="deliv-vermais"][data-id="${id}"]`);
      if (el) el.classList.toggle('recolhido', !delivAberto.has(id));
      if (b) { const on = delivAberto.has(id); b.setAttribute('aria-expanded', on); b.innerHTML = `${on ? 'Ver menos' : 'Ver mais'}${icon('down', 14)}`; if (!on) el.scrollIntoView({ block: 'nearest' }); }
    },
    'chk-toggle': (id, el) => {
      const t = tarefaAberta(); const d = t && t.deliverables.find(x => x.id === id); if (!d) return;
      const it = (d.items || []).find(i => i.id === el.dataset.item); if (!it) return;
      it.done = !it.done; save(); renderDrawer(); render();
      const b = $(`.drawer [data-act="chk-toggle"][data-item="${it.id}"]`); if (b) b.focus();
    },
    'chk-del': (id, el) => {
      const t = tarefaAberta(); const d = t && t.deliverables.find(x => x.id === id); if (!d) return;
      const i = d.items.findIndex(x => x.id === el.dataset.item); if (i < 0) return;
      d.items.splice(i, 1); save(); renderDrawer(); render();
      const prox = $(`.drawer [data-deliv="${id}"] .chk-txt`) ; const f = d.items[Math.max(0, i - 1)] ? $(`.drawer [data-chk="${id}"][data-item="${d.items[Math.max(0, i - 1)].id}"]`) : $(`.drawer [data-chk-novo="${id}"]`);
      (f || prox) && (f || prox).focus();
    },
    'del-deliv': async id => {
      const t = tarefaAberta(); if (!t) return;
      const d = t.deliverables.find(x => x.id === id);
      const n = d && d.type === 'galeria' ? (d.images || []).length : 0;
      if (n && !(await confirmBox('Remover a galeria inteira?', `${plural(n, 'foto será apagada', 'fotos serão apagadas')} deste computador e do link do cliente. Não dá para desfazer.`, 'Remover galeria'))) return;
      t.deliverables = t.deliverables.filter(x => x.id !== id); save(); renderDrawer(); render();
    },
    'copy-deliv': id => {
      const t = tarefaAberta(); const d = t && t.deliverables.find(x => x.id === id); if (!d) return;
      const txt = d.value || '';
      (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast('Copiado'), () => toast('Não foi possível copiar', 'alert'));
    },
    'reveal': id => { const el = document.getElementById('rv-' + id); if (el) el.classList.toggle('masked'); },
    'client-tab': (id, el) => { UI.clientTab = el.dataset.v; saveUI(); render(); },
    'task-view': (id, el) => { UI.taskView = el.dataset.v; saveUI(); render(); },
    'new-member': () => memberForm(),
    'edit-member': id => memberForm(get.member(id)),
    'delete-member': async id => {
      const m = get.member(id); if (!m) return;
      const n = DB.tasks.filter(t => t.assigneeId === id).length;
      if (!(await confirmBox(`Remover ${m.name} da equipe?`, n ? `${plural(n, 'tarefa ficará', 'tarefas ficarão')} sem responsável.` : 'Nenhuma tarefa está com esta pessoa.', 'Remover'))) return;
      DB.tasks.forEach(t => { if (t.assigneeId === id) t.assigneeId = null; if (t.reviewerId === id) t.reviewerId = null; });
      DB.team = DB.team.filter(x => x.id !== id); save();
      if (route().name === 'membro') location.hash = '#/equipe'; else render();
      toast('Pessoa removida', 'trash');
    },
    'tema': (id, el) => { DB.settings.tema = Cosmos.valido(el.dataset.v); save(); render(); },
    'export': async () => {
      // O backup leva junto as fotos das galerias (que ficam fora do localStorage)
      const imagens = {};
      for (const id of new Set(imagensUsadas())) { try { const d = await Imagens.pegar(id); if (d) imagens[id] = d; } catch (e) { /* sem IndexedDB */ } }
      const blob = new Blob([JSON.stringify(Object.keys(imagens).length ? { ...DB, imagens } : DB, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = `backup-gestao-projetos-${today()}.json`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast('Backup baixado', 'download');
    },
    'import': () => $('#import-file').click(),
    'reset-demo': async () => {
      if (!(await confirmBox('Voltar aos dados de exemplo?', 'Tudo o que você cadastrou será substituído pelos dados de exemplo. Baixe um backup antes se quiser guardar.', 'Voltar ao exemplo'))) return;
      unpublish(DB.clients.filter(c => c.shareToken).map(c => c.shareToken));
      const keep = DB.settings; DB = seedDB(); DB.settings = { ...DB.settings, ...keep }; persist(); location.hash = '#/'; render(); toast('Dados de exemplo restaurados');
    },
    'erase-all': async () => {
      if (!(await confirmBox('Apagar tudo?', 'Clientes, projetos, etapas, tarefas e equipe serão apagados. Baixe um backup antes se quiser guardar. Não dá para desfazer.', 'Apagar tudo'))) return;
      unpublish(DB.clients.filter(c => c.shareToken).map(c => c.shareToken));
      const keep = DB.settings; DB = emptyDB(); DB.settings = keep;
      DB.team.push({ id: uid(), name: keep.ownerName || 'Eu', role: 'Gestão', color: CLIENT_COLORS[0] });
      persist(); location.hash = '#/'; render(); toast('Tudo apagado. Comece cadastrando um cliente.', 'trash');
    },
    'print': () => window.print(),
  };
  /* Junta os cadastros do Orbe aos daqui: acha pelo código do Orbe, pelo nome, CPF/CNPJ ou e-mail; só preenche o que está vazio. */
  function importOrbe(data) {
    const r = { pNew: 0, pUpd: 0, pSame: 0, eNew: 0, eUpd: 0, eSame: 0, links: 0 };
    const now = new Date().toISOString();
    const fill = (dst, src) => {
      let mudou = false;
      for (const [k, v] of Object.entries(src)) {
        if (k === 'orbeId' || v === '' || v == null) continue;
        if (k === 'photo' && !safeImg(v)) continue;
        if (k === 'redes') { dst.redes = dst.redes || {}; for (const [rk, rv] of Object.entries(v || {})) if (rv && !dst.redes[rk]) { dst.redes[rk] = rv; mudou = true; } continue; }
        if (!dst[k]) { dst[k] = v; mudou = true; }
      }
      if (!dst.orbeId) dst.orbeId = src.orbeId;
      return mudou;
    };
    const mapE = {}, mapP = {};
    data.empresas.forEach(src => {
      let x = DB.companies.find(e => e.orbeId && e.orbeId === src.orbeId)
        || DB.companies.find(e => norm(e.name) === norm(src.name))
        || (digits(src.cnpj).length === 14 && DB.companies.find(e => digits(e.cnpj) === digits(src.cnpj)));
      if (!x) { x = { id: uid(), createdAt: now }; DB.companies.push(x); fill(x, src); r.eNew++; }
      else if (fill(x, src)) r.eUpd++; else r.eSame++;
      if (!x.color) x.color = CLIENT_COLORS[DB.companies.indexOf(x) % CLIENT_COLORS.length];
      mapE[src.orbeId] = x.id;
    });
    data.pessoas.forEach(src => {
      let x = DB.clients.find(c => c.orbeId && c.orbeId === src.orbeId)
        || DB.clients.find(c => norm(c.name) === norm(src.name))
        || (digits(src.cpf).length >= 11 && DB.clients.find(c => digits(c.cpf) === digits(src.cpf)))
        || (src.email && DB.clients.find(c => c.email && c.email.toLowerCase() === src.email.toLowerCase()));
      if (!x) { x = { id: uid(), createdAt: now }; DB.clients.push(x); fill(x, src); r.pNew++; }
      else if (fill(x, src)) r.pUpd++; else r.pSame++;
      if (!x.color) x.color = CLIENT_COLORS[DB.clients.indexOf(x) % CLIENT_COLORS.length];
      if (!x.situacao) x.situacao = 'ativo';
      mapP[src.orbeId] = x.id;
    });
    (data.vinculos || []).forEach(v => {
      const clientId = mapP[v.pessoa], companyId = mapE[v.empresa];
      if (!clientId || !companyId || DB.links.some(l => l.clientId === clientId && l.companyId === companyId)) return;
      DB.links.push({ id: uid(), clientId, companyId, role: PAPEIS.some(([k]) => k === v.role) ? v.role : 'contato' });
      r.links++;
    });
    return r;
  }
  function moveStage(id, dir) {
    const s = get.stage(id); if (!s) return;
    const list = stagesOf(s.projectId);
    const i = list.findIndex(x => x.id === id), j = i + dir;
    if (j < 0 || j >= list.length) return;
    list.splice(j, 0, list.splice(i, 1)[0]);
    list.forEach((x, k) => { x.order = k; });
    save(); render();
  }

  /* ---------------- Eventos globais ---------------- */
  // Dica dos gráficos do relatório: passar o mouse mostra os números do ponto, da coluna ou da fatia
  const dicaViz = document.createElement('div');
  dicaViz.className = 'viz-dica'; dicaViz.setAttribute('role', 'tooltip'); dicaViz.hidden = true;
  document.body.appendChild(dicaViz);
  window.addEventListener('scroll', () => { dicaViz.hidden = true; }, { passive: true });
  document.addEventListener('mousemove', e => {
    const alvo = e.target.closest && e.target.closest('.relatorio [data-tip], .donut-wrap [data-tip]');
    if (!alvo) { dicaViz.hidden = true; return; }
    const [titulo, ...linhas] = alvo.dataset.tip.split('|');
    dicaViz.innerHTML = `<b>${esc(titulo)}</b>${linhas.map(l => `<span>${esc(l)}</span>`).join('')}`;
    dicaViz.hidden = false;
    const r = dicaViz.getBoundingClientRect();
    dicaViz.style.left = Math.min(window.innerWidth - r.width - 12, e.clientX + 14) + 'px';
    dicaViz.style.top = Math.max(12, e.clientY - r.height - 14) + 'px';
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('.menu-wrap')) { const m = $('#new-menu'); if (m) m.classList.add('hidden'); }
    if (!e.target.closest('.search')) closeSearch();
    if (e.target.closest('[data-grip]') || Date.now() - ultimoArrasto < 300) return;
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    if (!ACTIONS[act]) return;
    if (el.tagName === 'A' && act !== 'search-go') e.preventDefault();
    if (act === 'search-go') e.preventDefault();
    if (el.closest('.menu')) $('#new-menu').classList.add('hidden');
    ACTIONS[act](el.dataset.id, el, e);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (modalCancel) { modalCancel(); return; }
      if (drawerTask) { closeDrawer(); return; }
      closeSearch(); const m = $('#new-menu'); if (m) m.classList.add('hidden');
      if (UI.sel.size) { UI.sel = new Set(); render(); }
    }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role="button"][data-act]') && e.target.tagName !== 'BUTTON') {
      e.preventDefault(); e.target.click();
    }
    if (e.key === '/' && !e.target.closest('input, textarea, select') && !modalCancel && !drawerTask) { e.preventDefault(); $('#gsearch').focus(); }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && !modalCancel) { e.preventDefault(); if (drawerTask) closeDrawer(); $('#gsearch').focus(); }
  });
  viewEl.addEventListener('input', e => {
    const el = e.target;
    if (el.dataset.filter) {
      UI.filters[el.dataset.filter] = el.type === 'checkbox' ? el.checked : el.value;
      if (el.type === 'search') renderSoon(); else render();
    }
    if (el.dataset.projf) {
      UI.projF[el.dataset.projf] = el.value; saveUI();
      if (el.type === 'search') renderSoon(); else render();
    }
    if (el.dataset.cad) {
      UI[el.dataset.cad] = el.value;
      if (el.type === 'search') renderSoon(); else render();
    }
    if (el.dataset.setting) {
      DB.settings[el.dataset.setting] = el.value; save();
      renderSide(route());
    }
  });
  viewEl.addEventListener('change', e => {
    const el = e.target;
    if (el.dataset.lote) {
      const campo = el.dataset.lote, v = el.value;
      const ts = [...UI.sel].map(id => get.task(id)).filter(Boolean);
      if (!v || !ts.length) return;
      if (campo === 'status' && v === 'aguardando') { el.value = ''; porEmEspera(ts); return; }
      if (campo === 'status' && v === 'em_revisao' && ts.some(t => !t.reviewerId)) { el.value = ''; pedirRevisor(ts); return; }
      if (campo === 'complexity') {
        ts.forEach(t => { t.complexity = v === '__nenhuma' ? null : Number(v); });
        save(); render(); toast(`Complexidade alterada em ${plural(ts.length, 'tarefa', 'tarefas')}`); return;
      }
      if (campo === 'status' && v === 'concluida') {
        const travadas = ts.filter(bloqueada);
        ts.filter(t => !bloqueada(t)).forEach(t => setStatus(t, v));
        if (travadas.length) { save(); render(); toast(`${plural(travadas.length, 'tarefa continua', 'tarefas continuam')} em Aguardando: ainda espera${travadas.length === 1 ? '' : 'm'} outra tarefa`, 'lock'); return; }
      } else if (campo === 'status') ts.forEach(t => setStatus(t, v));
      else if (campo === 'assigneeId') ts.forEach(t => { t.assigneeId = v === '__nenhum' ? null : v; });
      else if (campo === 'dueDate') ts.forEach(t => { t.dueDate = v; });
      else if (campo === 'stageId') ts.forEach(t => { if (t.stageId !== v) { t.stageId = v; t.order = nextOrder(tasksOfStage(v).filter(x => x.id !== t.id)); } });
      const nome = { status: 'Situação alterada', assigneeId: 'Responsável alterado', dueDate: 'Prazo alterado', stageId: 'Tarefas movidas' }[campo];
      save(); render(); toast(`${nome} em ${plural(ts.length, 'tarefa', 'tarefas')}`);
      return;
    }
    if (el.id === 'import-orbe' && el.files[0]) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          if (!data || data.tipo !== 'cadastros-orbe' || !Array.isArray(data.pessoas) || !Array.isArray(data.empresas)) throw new Error('formato');
          const r = importOrbe(data);
          save(); UI.cadTab = 'pessoas'; UI.cadQ = ''; UI.cadSit = ''; saveUI();
          location.hash = '#/clientes'; render();
          formModal({
            title: 'Cadastros do Orbe importados',
            sub: `Pessoas: ${r.pNew} novas${r.pUpd ? ` e ${r.pUpd} completadas` : ''}. Empresas: ${r.eNew} novas${r.eUpd ? ` e ${r.eUpd} completadas` : ''}. Ligações entre pessoas e empresas: ${r.links} novas.${r.pSame + r.eSame ? ` ${r.pSame + r.eSame} ${r.pSame + r.eSame === 1 ? 'cadastro já estava igual aqui e não mudou' : 'cadastros já estavam iguais aqui e não mudaram'}.` : ''} Nada do que já existia aqui foi apagado ou trocado: só os campos vazios foram preenchidos.`,
            submit: 'Ver os cadastros',
          });
        } catch (err) { toast('Este arquivo não é o de cadastros do Orbe (importar/cadastros-orbe.json)', 'alert'); }
      };
      reader.readAsText(el.files[0]);
      el.value = '';
    }
    if (el.id === 'import-file' && el.files[0]) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          if (!data || !Array.isArray(data.clients) || !Array.isArray(data.tasks)) throw new Error('formato');
          const imagens = data.imagens && typeof data.imagens === 'object' ? data.imagens : {};
          delete data.imagens;
          (async () => {
            for (const [id, d] of Object.entries(imagens)) {
              if (/^[A-Za-z0-9_-]{8,64}$/.test(id) && d && /^data:image\//.test(d.full) && /^data:image\//.test(d.thumb)) { try { await Imagens.guardar(id, { full: d.full, thumb: d.thumb }); } catch (e) { /* segue */ } }
            }
            DB = migrate(data); persist(); render(); scheduleSync(); toast('Backup restaurado');
          })();
          return;
        } catch (err) { toast('Este arquivo não é um backup válido do sistema', 'alert'); }
      };
      reader.readAsText(el.files[0]);
      el.value = '';
    }
  });

  buildTop();
  const gs = $('#gsearch');
  gs.addEventListener('input', () => { searchSel = 0; showSearch(); });
  gs.addEventListener('focus', showSearch);
  gs.addEventListener('keydown', e => {
    const items = $$('#gresults a');
    if (e.key === 'ArrowDown') { e.preventDefault(); searchSel = Math.min(searchSel + 1, items.length - 1); showSearch(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); searchSel = Math.max(searchSel - 1, 0); showSearch(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (items[searchSel]) items[searchSel].click(); }
    else if (e.key === 'Escape') { gs.value = ''; closeSearch(); gs.blur(); }
  });
  window.addEventListener('hashchange', () => { render(); if (drawerTask) closeDrawer(); });
  // Fechar a aba ou recarregar com o card alterado e não salvo: o navegador pergunta antes
  window.addEventListener('beforeunload', e => { if (tarefaSuja()) { e.preventDefault(); e.returnValue = ''; } });
  window.addEventListener('storage', e => { if (e.key === STORE_KEY && e.newValue) { try { DB = migrate(JSON.parse(e.newValue)); render(); } catch (err) { /* ignora */ } } });
  render();
  scheduleSync();
  // Banco de dados (Supabase): o banco é a versão oficial; este navegador guarda uma cópia.
  /* ---------------- Entrar no sistema ----------------
     Sem sessão, nada aparece: só a tela de entrada. O primeiro acesso só é criado no computador que tem a chave privada. */
  function telaAcesso() {
    if (document.getElementById('acesso')) return;
    const el = document.createElement('div');
    el.id = 'acesso'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'acesso-t');
    el.innerHTML = `<div class="acesso-cartao"><div class="acesso-marca">${BRAND_MARK}<span>${esc(DB.settings.businessName || 'Gestão de Projetos')}</span></div><div id="acesso-corpo"><p class="acesso-sub">Conferindo o acesso…</p></div></div>`;
    document.body.appendChild(el);
    document.documentElement.classList.add('sem-acesso');
    montarAcesso();
  }
  async function montarAcesso() {
    const corpo = document.getElementById('acesso-corpo'); if (!corpo) return;
    let existe = true;
    try { existe = await Nuvem.existeDono(); } catch (e) { corpo.innerHTML = `<h1 id="acesso-t">Sem conexão<span class="ponto">.</span></h1><p class="acesso-sub">Não foi possível falar com o banco de dados. Confira a internet e recarregue a página.</p>`; return; }
    const local = !!(window.APP_CONFIG && window.APP_CONFIG.publishKey);
    if (!existe && !local) { corpo.innerHTML = `<h1 id="acesso-t">Acesso ainda não criado<span class="ponto">.</span></h1><p class="acesso-sub">Abra o sistema no seu computador (o arquivo index.html da pasta Gestao de Projetos) para criar o seu acesso. Depois ele funciona aqui também.</p>`; return; }
    const criar = !existe;
    corpo.innerHTML = `<h1 id="acesso-t">${criar ? 'Crie o seu acesso' : 'Entrar no sistema'}<span class="ponto">.</span></h1>
      <p class="acesso-sub">${criar ? 'É a primeira vez. Escolha o e-mail e a senha que vão abrir o sistema em qualquer computador ou celular. Só este computador pode criar o acesso.' : 'Use o e-mail e a senha do seu acesso.'}</p>
      <form id="acesso-form" class="acesso-form" novalidate>
        <label class="field"><span>E-mail</span><input type="email" name="email" autocomplete="username" required></label>
        <label class="field"><span>Senha</span><input type="password" name="senha" autocomplete="${criar ? 'new-password' : 'current-password'}" minlength="8" required></label>
        ${criar ? '<label class="field"><span>Repita a senha</span><input type="password" name="senha2" autocomplete="new-password" minlength="8" required></label><p class="acesso-dica">Use pelo menos 8 caracteres. Uma frase curta é fácil de lembrar e difícil de adivinhar.</p>' : ''}
        <p class="acesso-erro" id="acesso-erro" role="alert"></p>
        <button class="btn btn-primary" type="submit">${criar ? 'Criar acesso e entrar' : 'Entrar'}</button>
      </form>`;
    const form = document.getElementById('acesso-form'), erro = document.getElementById('acesso-erro');
    setTimeout(() => form.elements.email.focus(), 30);
    form.addEventListener('submit', async e => {
      e.preventDefault(); erro.textContent = '';
      const email = form.elements.email.value.trim(), senha = form.elements.senha.value;
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { erro.textContent = 'Digite um e-mail válido.'; form.elements.email.focus(); return; }
      if (senha.length < 8) { erro.textContent = 'A senha precisa ter pelo menos 8 caracteres.'; form.elements.senha.focus(); return; }
      if (criar && senha !== form.elements.senha2.value) { erro.textContent = 'As duas senhas não estão iguais.'; form.elements.senha2.focus(); return; }
      const b = form.querySelector('button'); b.disabled = true; b.textContent = criar ? 'Criando…' : 'Entrando…';
      try {
        if (criar) await Nuvem.criarAcesso(email, senha);
        else {
          const r = await Nuvem.entrar(email, senha);
          if (!r.ok) {
            b.disabled = false; b.textContent = 'Entrar';
            erro.textContent = r.erro === 'bloqueado' ? 'Muitas tentativas erradas. Espere 15 minutos e tente de novo.' : 'E-mail ou senha não conferem.';
            return;
          }
        }
        document.getElementById('acesso').remove(); document.documentElement.classList.remove('sem-acesso');
        toast(criar ? 'Acesso criado. Bem-vindo!' : 'Bem-vindo de volta');
        render(); setTimeout(conferirLinksAntigos, 2500);
      } catch (err) { b.disabled = false; b.textContent = criar ? 'Criar acesso e entrar' : 'Entrar'; erro.textContent = 'Não foi possível agora. Confira a internet e tente de novo.'; }
    });
  }
  if (window.Nuvem && Nuvem.ativo && !Nuvem.sessao()) telaAcesso();

  if (window.Nuvem) Nuvem.iniciar({
    chave: STORE_KEY,
    novo: nasceuAgora,
    obter: () => DB,
    trocar: novo => {
      DB = migrate(novo);
      try { localStorage.setItem(STORE_KEY, JSON.stringify(DB)); } catch (e) { /* sem espaço */ }
      render(); scheduleSync();
    },
    ocupado: () => !!drawerTask || !!modalRoot.innerHTML.trim(),
    aviso: msg => toast(msg, 'alert'),
    semAcesso: () => telaAcesso(),
  });
  if (window.Nuvem && Nuvem.sessao()) setTimeout(conferirLinksAntigos, 3000);
})();

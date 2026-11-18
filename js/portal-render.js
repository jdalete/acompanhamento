/* Visão do cliente: monta o retrato de um cliente e desenha a página.
   Usado no sistema (Visão do cliente) e na página pública do link. */
const PortalRender = (() => {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const MONTHS_FULL = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const parseISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const fmtDate = (s, year = false) => { if (!s) return ''; const d = parseISO(s); return `${d.getDate()} ${MONTHS[d.getMonth()]}${year ? ' ' + d.getFullYear() : ''}`; };
  const fmtStamp = iso => { const d = new Date(iso); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };
  const fmtLong = d => `${d.getDate()} de ${MONTHS_FULL[d.getMonth()]} de ${d.getFullYear()}`;
  const PROJECT_LABEL = { ativo: 'Ativo', pausado: 'Pausado', concluido: 'Concluído' };
  const STAGE_STATE = { concluida: ['st-done', 'Concluída'], andamento: ['st-doing', 'Em andamento'], pendente: ['st-todo', 'Não iniciada'] };

  function safeUrl(u) {
    const v = String(u || '').trim();
    if (!v) return '#';
    if (/^https?:\/\//i.test(v) || /^mailto:/i.test(v)) return v;
    if (/^[a-z]+:/i.test(v)) return '#';
    return 'https://' + v;
  }

  const nomePessoa = (db, id) => { const m = id && (db.team || []).find(x => x.id === id); return m ? m.name : ''; };
  /* Tarefas que ainda prendem esta (nome, e o projeto quando é outro) */
  function aguardadas(db, t, p) {
    if (t.status === 'concluida') return [];
    return (t.waitingFor || []).map(id => db.tasks.find(x => x.id === id)).filter(x => x && x.status !== 'concluida').map(x => {
      const st = db.stages.find(s => s.id === x.stageId), pr = st && db.projects.find(q => q.id === st.projectId);
      return pr && pr.id !== p.id ? `${x.title} (${pr.name})` : x.title;
    });
  }

  /* Retrato do cliente: só o que ele pode ver */
  function build(db, clientId) {
    const c = db.clients.find(x => x.id === clientId);
    if (!c) return null;
    const projects = db.projects.filter(p => p.clientId === c.id && p.status !== 'pausado').map(p => {
      const stages = db.stages.filter(s => s.projectId === p.id).sort((a, b) => a.order - b.order);
      const stageData = stages.map(s => ({
        id: s.id,
        name: s.name,
        expected: s.expected || '',
        dueDate: s.dueDate || '',
        tasks: db.tasks.filter(t => t.stageId === s.id).sort((a, b) => a.order - b.order)
          .map(t => ({ title: t.title, status: t.status, dueDate: t.dueDate || '', completedAt: t.completedAt || null, waiting: aguardadas(db, t, p), who: nomePessoa(db, t.assigneeId), reviewer: t.status === 'em_revisao' ? nomePessoa(db, t.reviewerId) : '' })),
      }));
      const deliverables = stages.flatMap(s => db.tasks.filter(t => t.stageId === s.id).sort((a, b) => a.order - b.order)
        .flatMap(t => (t.deliverables || []).filter(d => d.type !== 'checklist' && (d.type === 'galeria' ? (d.images || []).length : d.value || d.label)).map(d => d.type === 'galeria'
          ? { id: d.id, type: d.type, label: d.label, value: '', task: t.title, images: d.images.map(im => ({ id: im.id, w: im.w || 0, h: im.h || 0 })) }
          : { id: d.id, type: d.type, label: d.label, value: d.value, task: t.title })));
      const empresa = (db.companies || []).find(e => e.id === p.companyId);
      return { id: p.id, name: p.name, company: empresa ? empresa.name : '', description: p.description || '', status: p.status, startDate: p.startDate || '', dueDate: p.dueDate || '', stages: stageData, deliverables };
    });
    return {
      v: 1,
      business: (db.settings && db.settings.businessName) || '',
      tema: (db.settings && db.settings.tema) || 'interestelar',
      client: { name: c.name },
      projects,
    };
  }

  function info(p) {
    const stages = p.stages.map(s => {
      const total = s.tasks.length;
      const done = s.tasks.filter(t => t.status === 'concluida').length;
      const moving = s.tasks.some(t => t.status === 'em_andamento' || t.status === 'em_revisao');
      const state = total && done === total ? 'concluida' : (done > 0 || moving) ? 'andamento' : 'pendente';
      return { ...s, total, done, pct: total ? Math.round((done / total) * 100) : 0, state };
    });
    const total = stages.reduce((a, s) => a + s.total, 0);
    const done = stages.reduce((a, s) => a + s.done, 0);
    const stagesDone = stages.filter(s => s.state === 'concluida').length;
    return { stages, total, done, pct: total ? Math.round((done / total) * 100) : 0, stagesDone, stagesLeft: stages.length - stagesDone, current: stages.find(s => s.state !== 'concluida') };
  }

  /* Progresso no topo: o anel é o único ponto focal; ao lado, o que falta e o prazo; embaixo, a trilha das etapas.
     o: { pct, stages:[{id,name,state,pct}], tasksDone, tasksTotal, startDate, dueDate, late, ritmo, click, animate } */
  function hojeISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
  function progressoFatos(o) {
    const atual = o.stages.find(s => s.state !== 'concluida');
    const feitas = o.stages.length - o.stages.filter(s => s.state !== 'concluida').length;
    const restam = o.stages.length - feitas;
    const pronto = o.stages.length > 0 && !atual;
    const hoje = parseISO(hojeISO());
    let prazo = '';
    if (o.dueDate && !pronto) {
      const dias = Math.round((parseISO(o.dueDate) - hoje) / 86400000);
      prazo = dias > 1 ? `Entrega em ${dias} dias, ${fmtDate(o.dueDate, true)}` : dias === 1 ? `Entrega amanhã, ${fmtDate(o.dueDate)}` : dias === 0 ? 'Entrega prevista para hoje' : `A entrega estava prevista para ${fmtDate(o.dueDate, true)}`;
    }
    // Ritmo: compara o que já está pronto com o que o tempo corrido do projeto pede (só no sistema).
    let ritmo = '';
    if (o.ritmo && o.startDate && o.dueDate && !pronto) {
      const total = parseISO(o.dueDate) - parseISO(o.startDate);
      if (total > 0) {
        const esperado = Math.round(Math.max(0, Math.min(1, (hoje - parseISO(o.startDate)) / total)) * 100);
        ritmo = o.pct >= esperado - 10
          ? `<p class="ritmo ok">${icon('check', 14)} No ritmo para entregar no prazo</p>`
          : `<p class="ritmo alerta">${icon('clock', 14)} Pelo tempo que já passou, o esperado hoje seria ${esperado}%</p>`;
      }
    }
    return `<div class="prog-info">
        <p class="prog-agora">${pronto ? 'Todas as etapas concluídas' : atual ? `<span>Etapa atual</span><b>${esc(atual.name)}</b>` : 'Etapas a definir'}</p>
        <ul class="prog-fatos">
          ${o.stages.length ? `<li><b>${feitas} de ${o.stages.length}</b> etapas concluídas${restam && !pronto ? `, faltam ${restam}` : ''}</li>` : ''}
          ${o.tasksTotal ? `<li><b>${o.tasksDone} de ${o.tasksTotal}</b> tarefas feitas</li>` : ''}
          ${prazo ? `<li>${icon('flag', 14)} ${prazo}</li>` : ''}
          ${o.late ? `<li class="critico">${icon('alert', 14)} ${o.late} ${o.late === 1 ? 'tarefa atrasada' : 'tarefas atrasadas'}</li>` : ''}
        </ul>
        ${ritmo}
      </div>`;
  }
  // Variante com o anel ao lado (quando não há caminho para desenhar).
  function progressoLado(o) {
    const pronto = o.stages.length > 0 && o.stages.every(s => s.state === 'concluida');
    return `<div class="progresso"><div class="prog-anel">${Charts.ring(o.pct, { size: 196, stroke: 15, sub: pronto ? 'entregue' : 'pronto', animate: o.animate })}</div>${progressoFatos(o)}</div>`;
  }
  function trilha(o) {
    if (!o.stages.length) return '';
    const atual = o.stages.find(s => s.state !== 'concluida');
    return `<div class="trilha" aria-label="Etapas do projeto">${o.stages.map((s, i) => `<button class="trilha-etapa ${s.state}${s === atual ? ' atual' : ''}" data-act="${o.click}" data-id="${esc(s.id)}" title="${esc(s.name)}: ${s.pct}% pronto"><span class="trilha-barra"><i style="width:${s.pct}%"></i></span><span class="trilha-nome"><small>${i + 1}</small>${esc(s.name)}</span></button>`).join('')}</div>`;
  }

  function pipelineBlock(stages, pct) {
    const data = stages.map((s, i) => ({ id: s.id, index: i + 1, name: s.name, state: s.state, pct: s.pct, meta: s.total ? `${s.done} de ${s.total} ${s.total === 1 ? 'tarefa' : 'tarefas'}` : 'Sem tarefas' }));
    if (!data.length) return '';
    return `${Charts.pipeline(data, pct, { onClick: 'portal-stage' })}
      <div class="pipe-ring">${Charts.ring(pct, { size: 150, stroke: 12, sub: 'concluído' })}</div>
      <div class="pipe-list">${data.map(s => `<button class="pl-card pl-${s.state}" data-act="portal-stage" data-id="${s.id}"><span class="pl-name"><span class="pl-num">${s.index}</span><span class="pl-txt">${esc(s.name)}</span></span><span class="pl-meta">${s.meta}</span><span class="pl-bar"><i style="width:${s.pct}%"></i></span></button>`).join('')}</div>`;
  }

  /* Miniaturas de uma galeria. As imagens chegam depois, por preencherImagens. */
  function galeriaGrade(d, extra = '') {
    const n = d.images.length;
    return `<div class="galeria" data-galeria="${esc(d.id)}" data-nome="${esc(d.label || 'Galeria')}">${d.images.map((im, k) => `<div class="gal-thumb"><button class="gal-item" data-act="zoom" data-id="${esc(d.id)}" data-i="${k}" aria-label="Ver a foto ${k + 1} de ${n}"><img data-img="${esc(im.id)}" alt="Foto ${k + 1} de ${n}${d.label ? ': ' + esc(d.label) : ''}"${im.w && im.h ? ` style="aspect-ratio:${im.w}/${im.h}"` : ''}></button>${extra ? extra(im, k) : ''}</div>`).join('')}</div>`;
  }

  function deliv(d) {
    const ic = d.type === 'link' ? 'link' : d.type === 'acesso' ? 'key' : d.type === 'galeria' ? 'image' : 'text';
    const name = d.label || (d.type === 'link' ? 'Link' : d.type === 'acesso' ? 'Acesso' : d.type === 'galeria' ? 'Galeria' : 'Texto');
    const head = `<div class="h"><span class="deliv-type">${icon(ic, 15)}</span><b>${esc(name)}</b>${d.type === 'acesso' ? `<button class="icon-btn sm ghost no-print" data-act="reveal" data-id="${esc(d.id)}" title="Mostrar ou esconder" aria-label="Mostrar ou esconder o acesso">${icon('eye', 15)}</button>` : ''}</div><span class="from">Da tarefa: ${esc(d.task)}</span>`;
    if (d.type === 'galeria') return `<div class="pdeliv pgaleria">${head}${galeriaGrade(d)}<p class="gal-dica no-print">${icon('zoomin', 13)} ${d.images.length} ${d.images.length === 1 ? 'foto' : 'fotos'}. Toque numa foto para ver em tela cheia.</p></div>`;
    if (d.type === 'link') return `<div class="pdeliv">${head}<a class="open" href="${esc(safeUrl(d.value))}" target="_blank" rel="noopener">${icon('external', 14)} Abrir link</a></div>`;
    return `<div class="pdeliv">${head}<pre id="rv-${esc(d.id)}" class="${d.type === 'acesso' ? 'masked' : ''}">${esc(d.value)}</pre></div>`;
  }

  /* opts.backHref: link para voltar ao sistema (só no sistema); opts.updatedAt: data da última atualização */
  function render(data, opts = {}) {
    const updated = opts.updatedAt ? new Date(opts.updatedAt) : new Date();
    const ps = data.projects || [];
    const mark = BRAND_MARK;
    return `
      <div class="portal-bar">
        <span class="brand">${mark}<span class="brand-text">${esc(data.business)}<small>Acompanhamento de projetos</small></span></span>
        <div class="actions no-print">
          ${opts.backHref ? `<a class="btn btn-ghost" href="${opts.backHref}">${icon('back', 16)} Voltar ao painel</a>` : ''}
          <button class="btn" data-act="print">${icon('printer', 16)} Salvar em PDF</button>
        </div>
      </div>
      <section class="portal-hero">
        <p class="hello">Olá, ${esc(data.client.name)}</p>
        <h1>${ps.length === 1 ? 'Acompanhe o seu projeto' : 'Acompanhe os seus projetos'}<span class="ponto">.</span></h1>
        <p>Aqui está o que você contratou, em que etapa cada projeto está e tudo o que já foi entregue. Atualizado em ${fmtLong(updated)}, às ${String(updated.getHours()).padStart(2, '0')}:${String(updated.getMinutes()).padStart(2, '0')}.</p>
      </section>
      ${ps.length ? ps.map(p => {
        const i = info(p);
        return `
        <section class="portal-proj">
          <div class="proj-cabeca">
            <div class="proj-cabeca-texto">
              ${p.company ? `<p class="proj-empresa">${icon('building', 14)} ${esc(p.company)}</p>` : ''}
              <h2>${esc(p.name)}</h2>
            </div>
          </div>
          <section class="panel pipe-panel palco">
            <div class="palco-grid">
              <div class="palco-caminho">${i.stages.length ? pipelineBlock(i.stages, i.pct) : `<div class="pipe-vazio">${Charts.ring(i.pct, { size: 180, stroke: 14, sub: 'pronto' })}<p>As etapas deste projeto vão aparecer aqui.</p></div>`}</div>
              <aside class="palco-lado">
                <div class="meta-line"><span class="pill proj-${esc(p.status)}">${PROJECT_LABEL[p.status] || ''}</span>${p.startDate ? `<span class="d">${icon('calendar', 15)} Início em ${fmtDate(p.startDate, true)}</span>` : ''}</div>
                ${progressoFatos({ pct: i.pct, stages: i.stages, tasksDone: i.done, tasksTotal: i.total, dueDate: p.dueDate, startDate: p.startDate })}
                ${p.description ? `<p class="palco-desc">${esc(p.description)}</p>` : ''}
                ${i.stages.length ? `<p class="palco-dica">${icon('right', 13)} Toque numa etapa para ver as tarefas dela</p>` : ''}
              </aside>
            </div>
          </section>
          <div class="portal-stages">
            ${i.stages.map((s, k) => `
              <div class="panel pstage" id="pstage-${esc(s.id)}">
                <div class="h"><span class="stage-idx pidx-${s.state}">${k + 1}</span><h3>${esc(s.name)}</h3><span class="pill ${STAGE_STATE[s.state][0]}">${STAGE_STATE[s.state][1]}</span></div>
                ${s.dueDate || s.expected ? `<div class="pstage-meta">${s.dueDate ? `<span class="due">${icon('flag', 13)} ${s.state === 'concluida' ? 'Entregue' : 'Entrega prevista'}: ${fmtDate(s.dueDate, true)}</span>` : ''}${s.expected ? `<p class="stage-esperado"><span>Resultado esperado</span>${esc(s.expected)}</p>` : ''}</div>` : ''}
                ${s.tasks.length ? `<ul>${s.tasks.map(t => {
                  const done = t.status === 'concluida';
                  const doing = t.status === 'em_andamento' || t.status === 'em_revisao';
                  const espera = !done && (t.waiting || []).length ? t.waiting : null;
                  const when = done ? (t.completedAt ? `Feita em ${fmtStamp(t.completedAt)}` : 'Feita') : t.dueDate ? `Até ${fmtDate(t.dueDate)}` : '';
                  return `<li class="${done ? 'done' : espera ? 'waiting' : doing ? 'doing' : ''}"><span class="mk">${icon(espera ? 'lock' : 'check', 12)}</span><span class="nm">${esc(t.title)}${espera ? `<small class="espera-cli">Aguardando: ${espera.map(esc).join(', ')}</small>` : ''}${t.who || t.reviewer ? `<small class="quem-cli">${t.who ? `Responsável: ${esc(t.who)}` : ''}${t.who && t.reviewer ? '<br>' : ''}${t.reviewer ? `Em revisão com ${esc(t.reviewer)}` : ''}</small>` : ''}</span><span class="dt">${when}</span></li>`;
                }).join('')}</ul>` : '<p class="muted" style="font-size:14px">Tarefas a definir.</p>'}
              </div>`).join('')}
          </div>
          ${p.deliverables.length ? `
            <div class="section-head" style="margin-top:28px"><h2 style="font-size:22px">Entregas</h2></div>
            <div class="portal-delivs">${p.deliverables.map(deliv).join('')}</div>` : ''}
        </section>`;
      }).join('') : `<div class="empty-state"><h3>Nenhum projeto para mostrar ainda</h3><p>Assim que um projeto for criado, ele aparece aqui.</p></div>`}
      <p class="portal-foot">${esc(data.business)}</p>`;
  }

  /* Cliques da página (revelar acesso, imprimir, ir para a etapa) */
  function handleClick(el) {
    const act = el.dataset.act, id = el.dataset.id;
    if (act === 'reveal') { const pre = document.getElementById('rv-' + id); if (pre) pre.classList.toggle('masked'); return true; }
    if (act === 'print') { window.print(); return true; }
    if (act === 'zoom') { abrirZoom(id, Number(el.dataset.i) || 0); return true; }
    if (act === 'portal-stage') {
      const target = document.getElementById('pstage-' + id);
      if (target) {
        target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
        target.classList.remove('flash'); void target.offsetWidth; target.classList.add('flash');
      }
      return true;
    }
    return false;
  }

  /* ---------- Imagens das galerias ----------
     Cada página diz de onde vêm as imagens: o sistema lê do navegador, o link do cliente lê do Supabase.
     carregador(ids, completa) devolve { id: endereço da imagem }. */
  let carregador = null;
  const cache = { mini: new Map(), cheia: new Map() };
  function usarImagens(fn) { carregador = fn; }
  async function buscar(ids, cheia) {
    const c = cheia ? cache.cheia : cache.mini;
    const faltam = [...new Set(ids)].filter(id => !c.has(id));
    if (faltam.length && carregador) {
      for (let i = 0; i < faltam.length; i += 30) {
        try { const r = await carregador(faltam.slice(i, i + 30), cheia) || {}; Object.entries(r).forEach(([k, v]) => { if (v) c.set(k, v); }); }
        catch (e) { /* tenta de novo na próxima vez */ }
      }
    }
    return ids.map(id => c.get(id) || null);
  }
  function esquecerImagem(id) { cache.mini.delete(id); cache.cheia.delete(id); }
  async function preencherImagens(root) {
    if (!root) return;
    const imgs = [...root.querySelectorAll('img[data-img]:not([src])')];
    if (!imgs.length) return;
    const srcs = await buscar(imgs.map(im => im.dataset.img), false);
    imgs.forEach((im, k) => {
      if (srcs[k]) im.src = srcs[k];
      else { const b = im.closest('.gal-item'); if (b) { b.classList.add('sem-imagem'); b.title = 'Foto ainda não disponível'; } }
    });
  }

  /* ---------- Zoom: uma imagem por vez, em tela cheia ---------- */
  let zoom = null;
  function abrirZoom(galId, inicio) {
    const grade = document.querySelector(`.galeria[data-galeria="${CSS.escape(galId)}"]`);
    if (!grade) return;
    const ids = [...grade.querySelectorAll('img[data-img]')].map(im => im.dataset.img);
    if (!ids.length) return;
    fecharZoom();
    const nome = grade.dataset.nome || 'Galeria';
    const toque = matchMedia('(hover: none)').matches;
    const el = document.createElement('div');
    el.className = 'zoom';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', nome);
    el.innerHTML = `
      <div class="zoom-topo">
        <span class="zoom-conta" aria-live="polite"></span>
        <span class="zoom-nome">${esc(nome)}</span>
        <button class="zoom-btn" data-z="ampliar" aria-label="Aproximar">${icon('zoomin', 18)}</button>
        <button class="zoom-btn" data-z="fechar" aria-label="Fechar (Esc)">${icon('x', 20)}</button>
      </div>
      <div class="zoom-palco"><img class="zoom-img" alt=""></div>
      ${ids.length > 1 ? `<button class="zoom-nav ant" data-z="ant" aria-label="Foto anterior">${icon('left', 26)}</button><button class="zoom-nav prox" data-z="prox" aria-label="Próxima foto">${icon('right', 26)}</button>` : ''}
      <p class="zoom-dica">${toque ? `${ids.length > 1 ? 'Deslize para passar. ' : ''}Toque na foto para aproximar.` : `${ids.length > 1 ? 'Use as setas para passar. ' : ''}Clique na foto para aproximar.`}</p>`;
    document.body.appendChild(el);
    document.documentElement.classList.add('zoom-aberto');
    const z = zoom = { el, ids, i: 0, nome, volta: document.activeElement, ampliado: false,
      palco: el.querySelector('.zoom-palco'), img: el.querySelector('.zoom-img') };

    el.addEventListener('click', e => {
      const b = e.target.closest('[data-z]');
      if (b) { const a = b.dataset.z; if (a === 'fechar') fecharZoom(); else if (a === 'ant') ir(-1); else if (a === 'prox') ir(1); else if (a === 'ampliar') ampliar(!z.ampliado); return; }
      if (e.target === z.img) { if (!z.arrastou) ampliar(!z.ampliado, e); return; }
      if (e.target === z.palco && !z.ampliado) fecharZoom();
    });
    // Arrastar para ver partes da imagem aproximada (mouse) e deslizar para trocar (toque)
    let ini = null;
    z.palco.addEventListener('pointerdown', e => {
      ini = { x: e.clientX, y: e.clientY, sl: z.palco.scrollLeft, st: z.palco.scrollTop, tipo: e.pointerType };
      z.arrastou = false;
    });
    z.palco.addEventListener('pointermove', e => {
      if (!ini) return;
      const dx = e.clientX - ini.x, dy = e.clientY - ini.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) z.arrastou = true;
      if (z.ampliado && ini.tipo === 'mouse') { z.palco.scrollLeft = ini.sl - dx; z.palco.scrollTop = ini.st - dy; z.palco.classList.add('arrastando'); }
    });
    const fim = e => {
      if (!ini) return;
      const dx = e.clientX - ini.x, dy = e.clientY - ini.y;
      if (!z.ampliado && ini.tipo !== 'mouse' && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) ir(dx < 0 ? 1 : -1);
      ini = null; z.palco.classList.remove('arrastando');
      setTimeout(() => { z.arrastou = false; }, 0);
    };
    z.palco.addEventListener('pointerup', fim);
    z.palco.addEventListener('pointercancel', () => { ini = null; z.palco.classList.remove('arrastando'); });
    mostrar(Math.max(0, Math.min(inicio, ids.length - 1)));
    el.querySelector('[data-z="fechar"]').focus();
  }
  async function mostrar(i) {
    const z = zoom; if (!z) return;
    z.i = i; ampliar(false);
    z.el.querySelector('.zoom-conta').textContent = z.ids.length > 1 ? `${i + 1} de ${z.ids.length}` : '';
    z.img.alt = `Foto ${i + 1} de ${z.ids.length}: ${z.nome}`;
    const id = z.ids[i];
    const [mini] = await buscar([id], false);
    if (zoom !== z || z.i !== i) return;
    if (mini && !cache.cheia.has(id)) { z.img.src = mini; z.el.classList.add('carregando'); }
    const [cheia] = await buscar([id], true);
    if (zoom !== z || z.i !== i) return;
    z.el.classList.remove('carregando');
    if (cheia) z.img.src = cheia;
    else if (!mini) z.el.classList.add('sem-imagem');
    // Já busca as vizinhas para a troca ser instantânea
    const viz = [z.ids[i + 1], z.ids[i - 1]].filter(Boolean);
    if (viz.length) buscar(viz, true);
  }
  function ir(passo) {
    const z = zoom; if (!z || z.ids.length < 2) return;
    z.el.classList.remove('sem-imagem');
    mostrar((z.i + passo + z.ids.length) % z.ids.length);
  }
  function ampliar(sim, ev) {
    const z = zoom; if (!z) return;
    const { img, palco } = z;
    const r = img.getBoundingClientRect();
    z.ampliado = !!sim;
    z.el.classList.toggle('ampliado', z.ampliado);
    const b = z.el.querySelector('[data-z="ampliar"]');
    b.innerHTML = icon(z.ampliado ? 'zoomout' : 'zoomin', 18);
    b.setAttribute('aria-label', z.ampliado ? 'Afastar' : 'Aproximar');
    if (!z.ampliado) { img.style.width = ''; palco.scrollTo(0, 0); return; }
    const alvo = Math.min(4000, Math.max(img.naturalWidth || 0, r.width * 2));
    img.style.width = alvo + 'px';
    // Mantém o ponto clicado no centro da tela
    const fx = ev ? (ev.clientX - r.left) / r.width : 0.5, fy = ev ? (ev.clientY - r.top) / r.height : 0.5;
    const alt = alvo * (r.height / r.width);
    palco.scrollLeft = fx * alvo - palco.clientWidth / 2;
    palco.scrollTop = fy * alt - palco.clientHeight / 2;
  }
  function fecharZoom() {
    const z = zoom; if (!z) return;
    zoom = null; z.el.remove();
    document.documentElement.classList.remove('zoom-aberto');
    if (z.volta && z.volta.focus && document.contains(z.volta)) z.volta.focus();
  }
  document.addEventListener('keydown', e => {
    if (!zoom) return;
    const k = e.key;
    if (k === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); if (zoom.ampliado) ampliar(false); else fecharZoom(); }
    else if (k === 'ArrowRight') { e.preventDefault(); e.stopImmediatePropagation(); ir(1); }
    else if (k === 'ArrowLeft') { e.preventDefault(); e.stopImmediatePropagation(); ir(-1); }
    else if (k === '+' || k === '=') { e.preventDefault(); ampliar(true); }
    else if (k === '-') { e.preventDefault(); ampliar(false); }
    else if (k === 'Tab') {
      const f = [...zoom.el.querySelectorAll('button')];
      const i = f.indexOf(document.activeElement);
      e.preventDefault(); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    }
  }, true);

  return { build, render, safeUrl, handleClick, progressoLado, progressoFatos, trilha, galeriaGrade, entrega: deliv, usarImagens, preencherImagens, esquecerImagem, abrirZoom };
})();

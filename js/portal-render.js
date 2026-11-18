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
          .map(t => ({ title: t.title, status: t.status, dueDate: t.dueDate || '', completedAt: t.completedAt || null })),
      }));
      const deliverables = stages.flatMap(s => db.tasks.filter(t => t.stageId === s.id).sort((a, b) => a.order - b.order)
        .flatMap(t => (t.deliverables || []).filter(d => d.value || d.label).map(d => ({ id: d.id, type: d.type, label: d.label, value: d.value, task: t.title }))));
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

  function deliv(d) {
    const ic = d.type === 'link' ? 'link' : d.type === 'acesso' ? 'key' : 'text';
    const name = d.label || (d.type === 'link' ? 'Link' : d.type === 'acesso' ? 'Acesso' : 'Texto');
    const head = `<div class="h"><span class="deliv-type">${icon(ic, 15)}</span><b>${esc(name)}</b>${d.type === 'acesso' ? `<button class="icon-btn sm ghost no-print" data-act="reveal" data-id="${esc(d.id)}" title="Mostrar ou esconder" aria-label="Mostrar ou esconder o acesso">${icon('eye', 15)}</button>` : ''}</div><span class="from">Da tarefa: ${esc(d.task)}</span>`;
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
                  const when = done ? (t.completedAt ? `Feita em ${fmtStamp(t.completedAt)}` : 'Feita') : t.dueDate ? `Até ${fmtDate(t.dueDate)}` : '';
                  return `<li class="${done ? 'done' : doing ? 'doing' : ''}"><span class="mk">${icon('check', 12)}</span><span class="nm">${esc(t.title)}</span><span class="dt">${when}</span></li>`;
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

  return { build, render, safeUrl, handleClick, progressoLado, progressoFatos, trilha };
})();

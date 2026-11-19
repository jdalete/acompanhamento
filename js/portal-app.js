/* Página do cliente: Visão geral, uma aba por projeto (Etapas, Cronograma, Relatório),
   edição e comentários conforme as permissões de cada e-mail.
   Usada no link do cliente (publico/js/portal.js) e na "Visão do cliente" do sistema (só leitura). */
const PortalApp = (() => {
  'use strict';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const MESES_L = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const pISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const fd = (s, ano = false) => { if (!s) return ''; const d = pISO(String(s).slice(0, 10)); return `${d.getDate()} ${MESES[d.getMonth()]}${ano ? ' ' + d.getFullYear() : ''}`; };
  const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const dias = s => Math.round((pISO(s) - pISO(hoje())) / 86400000);
  const SIT = { aguardando: 'Aguardando', a_fazer: 'A fazer', em_andamento: 'Em andamento', em_revisao: 'Em revisão', concluida: 'Concluída' };
  const CLS = { aguardando: 'st-wait', a_fazer: 'st-todo', em_andamento: 'st-doing', em_revisao: 'st-review', concluida: 'st-done' };
  const ESTADO = { concluida: ['st-done', 'Concluída'], andamento: ['st-doing', 'Em andamento'], pendente: ['st-todo', 'Não iniciada'] };
  const pill = st => `<span class="pill ${CLS[st] || ''}">${SIT[st] || ''}</span>`;
  const periodo = (a, b) => (a && b ? `${fd(a)} a ${fd(b, true)}` : b ? `Até ${fd(b, true)}` : a ? `Desde ${fd(a, true)}` : 'Sem datas');
  const ERROS = {
    'aguardando outra tarefa': 'Esta tarefa ainda aguarda outra ser concluída.',
    'sem revisor': 'Para pôr em revisão, quem cuida do projeto precisa escolher o revisor.',
    'inicio depois da entrega': 'A data de início está depois da entrega.',
    'sem permissao': 'Você não tem permissão para esta alteração.',
    sessao: 'Sua sessão terminou. Entre de novo.',
  };
  const msgErro = e => { const m = String((e && e.message) || e || ''); const k = Object.keys(ERROS).find(x => m.includes(x)); return k ? ERROS[k] : 'Não foi possível salvar agora. Tente de novo.'; };
  const kb = n => (n > 1048576 ? `${(n / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

  function montar(raiz, op) {
    let dados = null;
    const est = { aba: 'geral', modo: 'etapas', etapa: {}, aberta: null, zoom: 'mes', editandoEtapa: null };
    const avisos = document.createElement('div'); avisos.className = 'cli-avisos'; avisos.setAttribute('role', 'status'); avisos.setAttribute('aria-live', 'polite');
    document.body.appendChild(avisos);
    const avisar = (t, erro = false) => { const el = document.createElement('div'); el.className = 'toast' + (erro ? ' erro' : ''); el.innerHTML = `${icon(erro ? 'alert' : 'check', 16)}<span>${esc(t)}</span>`; avisos.appendChild(el); setTimeout(() => el.remove(), 3200); };

    // ---------- modelo ----------
    const perm = () => (dados && dados.permissoes) || {};
    const nivel = item => (op.leitura ? (perm().itens || {})[item] === 'nao' ? 'nao' : 'ver' : ((perm().itens || {})[item] || 'ver'));
    const gestor = () => !op.leitura && perm().perfil === 'gestor';
    const pessoa = id => (dados.pessoas || []).find(m => m.id === id);
    const meus = () => new Set(dados.meus || []);
    const podeEditarTarefa = t => !op.leitura && nivel('tarefas') === 'editar' && (!perm().soMinhas || meus().has(t.assigneeId) || meus().has(t.reviewerId));
    const podeComentar = t => !op.leitura && nivel('comentarios') !== 'nao' && (nivel('tarefas') === 'comentar' || nivel('tarefas') === 'editar' || podeEditarTarefa(t));
    const podeEditarEtapa = () => !op.leitura && nivel('etapas') === 'editar';
    function projetos() {
      return (dados.projetos || []).map(p => {
        const stages = (dados.etapas || []).filter(s => s.projectId === p.id).sort((a, b) => (a.order || 0) - (b.order || 0))
          .map(s => ({ ...s, tasks: (dados.tarefas || []).filter(t => t.stageId === s.id).sort((a, b) => (a.order || 0) - (b.order || 0)) }));
        const pr = { ...p, stages };
        return { p: pr, i: PortalRender.info(pr) };
      });
    }
    const tarefa = id => (dados.tarefas || []).find(t => t.id === id);
    const pendentes = t => (t.waitingFor || []).map(tarefa).filter(x => x && x.status !== 'concluida');

    // ---------- desenho ----------
    function topo() {
      return `<div class="portal-bar cli-topo">
        <span class="brand">${BRAND_MARK}<span class="brand-text">${esc(dados.negocio)}<small>Acompanhamento de projetos</small></span></span>
        <div class="actions no-print">
          ${op.voltar ? `<a class="btn btn-ghost" href="${op.voltar}">${icon('back', 16)} Voltar ao painel</a>` : ''}
          <button class="btn btn-ghost" data-c="pdf">${icon('printer', 16)} Salvar em PDF</button>
          ${op.sair ? `<button class="btn" data-c="sair" title="${esc(dados.email || '')}">${icon('logout', 16)} Sair</button>` : ''}
        </div>
      </div>`;
    }
    function abas(lista) {
      return `<nav class="cli-abas no-print" role="tablist" aria-label="Projetos">
        <button role="tab" aria-selected="${est.aba === 'geral'}" class="${est.aba === 'geral' ? 'on' : ''}" data-c="aba" data-v="geral">${icon('grid', 15)} Visão geral</button>
        ${lista.map(({ p, i }) => `<button role="tab" aria-selected="${est.aba === p.id}" class="${est.aba === p.id ? 'on' : ''}" data-c="aba" data-v="${esc(p.id)}"><span>${esc(p.name)}</span><b>${i.pct}%</b></button>`).join('')}
      </nav>`;
    }
    function geral(lista) {
      const tot = lista.reduce((a, x) => a + x.i.total, 0), feitas = lista.reduce((a, x) => a + x.i.done, 0);
      const etT = lista.reduce((a, x) => a + x.i.stages.length, 0), etF = lista.reduce((a, x) => a + x.i.stagesDone, 0);
      const pct = tot ? Math.round(feitas / tot * 100) : 0;
      const eu = meus();
      const comigo = op.leitura ? [] : (dados.tarefas || []).filter(t => t.status !== 'concluida' && (eu.has(t.assigneeId) || (t.status === 'em_revisao' && eu.has(t.reviewerId))));
      const proximas = lista.flatMap(({ p, i }) => i.stages.filter(s => s.state !== 'concluida' && s.dueDate).map(s => ({ p, s }))).sort((a, b) => a.s.dueDate.localeCompare(b.s.dueDate)).slice(0, 6);
      const rel = nivel('relatorios') === 'nao' ? [] : (dados.relatorios || []).slice(0, 4);
      return `<section class="cli-hero">
          <div class="cli-hero-anel">${Charts.ring(pct, { size: 240, stroke: 16, sub: 'de tudo concluído', animate: true })}</div>
          <div class="cli-hero-texto">
            <p class="hello">Olá, ${esc(dados.cliente || '')}</p>
            <h1>${lista.length === 1 ? 'Seu projeto' : 'Seus projetos'}<span class="ponto">.</span></h1>
            <div class="cli-kpis">
              <div><b>${lista.filter(x => x.p.status === 'ativo').length}</b><span>${lista.length === 1 ? 'projeto' : 'projetos'} em andamento</span></div>
              <div><b>${etF}<small> de ${etT}</small></b><span>etapas concluídas</span></div>
              <div><b>${feitas}<small> de ${tot}</small></b><span>tarefas feitas</span></div>
              ${nivel('relatorios') !== 'nao' ? `<div><b>${(dados.relatorios || []).length}</b><span>${(dados.relatorios || []).length === 1 ? 'relatório' : 'relatórios'}</span></div>` : ''}
            </div>
          </div>
        </section>
        ${comigo.length ? `<section class="panel cli-comigo"><div class="panel-head"><h3>${icon('flag', 16)} Aguardando você</h3><span class="rel-nota">${comigo.length} ${comigo.length === 1 ? 'tarefa' : 'tarefas'} com você</span></div>
          <ul class="cli-lista">${comigo.slice(0, 8).map(t => { const pr = lista.find(x => x.p.stages.some(s => s.id === t.stageId)); return `<li><button data-c="ir-tarefa" data-id="${esc(t.id)}"><b>${esc(t.title)}</b><small>${esc(pr ? pr.p.name : '')}${t.dueDate ? `. ${dias(t.dueDate) < 0 ? `Atrasada desde ${fd(t.dueDate)}` : `Até ${fd(t.dueDate)}`}` : ''}</small></button>${pill(t.status)}</li>`; }).join('')}</ul></section>` : ''}
        <section class="cli-projetos">${lista.map(({ p, i }) => `<button class="panel cli-proj" data-c="aba" data-v="${esc(p.id)}">
            <div class="cli-proj-topo"><div><p class="proj-empresa">${p.company ? `${icon('building', 13)} ${esc(p.company)}` : ''}</p><h3>${esc(p.name)}</h3></div>${Charts.ring(i.pct, { size: 96, stroke: 8 })}</div>
            <div class="cli-proj-fatos"><span><small>Etapa atual</small>${i.current ? esc(i.current.name) : 'Todas concluídas'}</span><span><small>Entrega</small>${p.dueDate ? fd(p.dueDate, true) : 'Sem data'}</span><span><small>Tarefas</small>${i.done} de ${i.total}</span></div>
            <div class="stage-dots">${i.stages.map(s => `<i class="${s.state}" style="--p:${s.pct}%"></i>`).join('')}</div>
          </button>`).join('')}</section>
        <div class="cli-duas">
          <section class="panel"><div class="panel-head"><h3>Próximas entregas</h3></div>${proximas.length ? `<ul class="cli-agenda">${proximas.map(({ p, s }) => { const n = dias(s.dueDate); const d = pISO(s.dueDate); return `<li><span class="due-date ${n < 0 ? 'late' : ''}"><b>${d.getDate()}</b><span>${MESES[d.getMonth()]}</span></span><div><b>${esc(s.name)}</b><small>${esc(p.name)}. ${n < 0 ? `Prevista para ${fd(s.dueDate)}` : n === 0 ? 'Hoje' : `Em ${n} ${n === 1 ? 'dia' : 'dias'}`}</small></div><span class="pill ${ESTADO[s.state][0]}">${ESTADO[s.state][1]}</span></li>`; }).join('')}</ul>` : '<p class="rel-vazio">Nenhuma entrega com data marcada.</p>'}</section>
          ${nivel('relatorios') !== 'nao' ? `<section class="panel"><div class="panel-head"><h3>Relatórios recentes</h3></div>${rel.length ? relatoriosHTML(rel, lista) : '<p class="rel-vazio">Os relatórios aparecem aqui assim que forem enviados.</p>'}</section>` : ''}
        </div>`;
    }
    function relatoriosHTML(rel, lista) {
      return `<ul class="cli-relatorios">${rel.map(r => { const pr = lista && lista.find(x => x.p.id === r.projeto); return `<li><span class="rel-icone">${icon('text', 18)}</span><div><b>${esc(r.titulo)}</b><small>${fd(r.data, true)}${pr ? `. ${esc(pr.p.name)}` : ''}. ${kb(r.tamanho)}</small></div><button class="btn sm" data-c="rel-abrir" data-id="${esc(r.id)}">${icon('external', 14)} Abrir</button><button class="icon-btn sm ghost" data-c="rel-baixar" data-id="${esc(r.id)}" data-nome="${esc(r.titulo)}" title="Baixar" aria-label="Baixar ${esc(r.titulo)}">${icon('download', 15)}</button></li>`; }).join('')}</ul>`;
    }
    function tarefaHTML(t) {
      const quem = pessoa(t.assigneeId), rev = pessoa(t.reviewerId), pend = pendentes(t), aberta = est.aberta === t.id;
      const late = t.status !== 'concluida' && t.dueDate && dias(t.dueDate) < 0;
      const ed = podeEditarTarefa(t), com = (dados.comentarios || []).filter(c => c.taskId === t.id);
      const ops = ['a_fazer', 'em_andamento', ...(t.reviewerId ? ['em_revisao'] : []), 'concluida'];
      return `<div class="ct-tarefa ${aberta ? 'aberta' : ''} ${t.status === 'concluida' ? 'feita' : ''}" id="ct-${esc(t.id)}">
        <button class="ct-linha" data-c="abrir" data-id="${esc(t.id)}" aria-expanded="${aberta}">
          <span class="ct-mk ${CLS[t.status] || ''}">${icon(pend.length ? 'lock' : 'check', 12)}</span>
          <span class="ct-nome"><b>${esc(t.title)}</b><small>${quem ? `Responsável: ${esc(quem.name)}` : 'Sem responsável'}${t.status === 'em_revisao' && rev ? `. Em revisão com ${esc(rev.name)}` : ''}</small>${pend.length ? `<small class="espera-cli">Aguardando: ${pend.map(x => esc(x.title)).join(', ')}</small>` : ''}</span>
          <span class="ct-datas ${late ? 'late' : ''}">${t.status === 'concluida' && t.completedAt ? `Feita em ${fd(t.completedAt.slice(0, 10))}` : periodo(t.startDate, t.dueDate)}</span>
          ${pill(t.status)}${com.length ? `<span class="ct-com" title="Comentários">${icon('chat', 13)} ${com.length}</span>` : ''}
          <span class="ct-seta">${icon('down', 15)}</span>
        </button>
        ${aberta ? `<div class="ct-det">
          ${ed ? `<div class="ct-edicao">
              <label class="field"><span>Situação</span><select class="input" data-c="status" data-id="${esc(t.id)}">${ops.map(k => `<option value="${k}" ${t.status === k ? 'selected' : ''} ${k === 'concluida' && pend.length ? 'disabled' : ''}>${SIT[k]}${k === 'concluida' && pend.length ? ' (aguardando outra tarefa)' : ''}</option>`).join('')}</select></label>
              <label class="field"><span>Início</span><input class="input" type="date" data-campo="startDate" value="${esc(t.startDate || '')}"></label>
              <label class="field"><span>Entrega</span><input class="input" type="date" data-campo="dueDate" value="${esc(t.dueDate || '')}"></label>
              <label class="field full"><span>Descrição</span><textarea class="input" rows="3" data-campo="description">${esc(t.description || '')}</textarea></label>
              <div class="ct-acoes full"><button class="btn btn-primary sm" data-c="salvar-tarefa" data-id="${esc(t.id)}">${icon('check', 14)} Salvar</button></div>
            </div>` : t.description ? `<p class="ct-desc">${esc(t.description)}</p>` : ''}
          ${nivel('comentarios') !== 'nao' ? `<div class="ct-comentarios"><h4>Comentários</h4>
            ${com.length ? `<ul>${com.map(c => `<li class="${c.deCliente ? 'de-cliente' : ''}"><b>${esc(c.deCliente ? c.autor : (c.autorNome || dados.negocio))}</b><small>${fd(String(c.em).slice(0, 10))} às ${String(new Date(c.em).getHours()).padStart(2, '0')}:${String(new Date(c.em).getMinutes()).padStart(2, '0')}</small><p>${esc(c.texto)}</p></li>`).join('')}</ul>` : '<p class="rel-vazio">Nenhum comentário ainda.</p>'}
            ${podeComentar(t) ? `<div class="ct-novo"><textarea class="input" rows="2" placeholder="Escreva um comentário" data-novo="${esc(t.id)}" aria-label="Novo comentário"></textarea><button class="btn sm" data-c="comentar" data-id="${esc(t.id)}">${icon('chat', 14)} Comentar</button></div>` : ''}
          </div>` : ''}
        </div>` : ''}
      </div>`;
    }
    function projeto(x) {
      const { p, i } = x;
      if (!est.etapa[p.id]) est.etapa[p.id] = (i.current || i.stages[0] || {}).id;
      const modos = [['etapas', 'Etapas', 'list'], ...(nivel('cronograma') !== 'nao' ? [['cronograma', 'Cronograma', 'calendar']] : []), ...(nivel('relatorios') !== 'nao' ? [['relatorio', 'Relatório', 'text']] : [])];
      if (!modos.some(m => m[0] === est.modo)) est.modo = 'etapas';
      let corpo = '';
      if (est.modo === 'etapas') {
        const s = i.stages.find(z => z.id === est.etapa[p.id]) || i.stages[0];
        corpo = i.stages.length ? `<div class="cli-etapas no-print" role="tablist" aria-label="Etapas">${i.stages.map((z, k) => `<button role="tab" aria-selected="${s && z.id === s.id}" class="${s && z.id === s.id ? 'on' : ''} e-${z.state}" data-c="etapa" data-p="${esc(p.id)}" data-v="${esc(z.id)}"><span class="cli-n">${z.state === 'concluida' ? icon('check', 12) : k + 1}</span><span class="cli-en">${esc(z.name)}</span></button>`).join('')}</div>
          ${s ? `<section class="panel cli-etapa">
            <div class="cli-etapa-cab"><div><h3>${esc(s.name)}</h3><p class="cli-periodo">${icon('calendar', 14)} ${periodo(s.startDate, s.dueDate)}</p></div><span class="pill ${ESTADO[s.state][0]}">${ESTADO[s.state][1]}</span>${podeEditarEtapa() ? `<button class="btn sm" data-c="editar-etapa" data-id="${esc(s.id)}">${icon('edit', 14)} Editar etapa</button>` : ''}</div>
            ${est.editandoEtapa === s.id ? `<div class="ct-edicao cli-etapa-form">
                <label class="field full"><span>Nome</span><input class="input" data-ecampo="name" value="${esc(s.name)}"></label>
                <label class="field full"><span>Descrição</span><textarea class="input" rows="2" data-ecampo="description">${esc(s.description || '')}</textarea></label>
                <label class="field full"><span>Resultado esperado</span><textarea class="input" rows="2" data-ecampo="expected">${esc(s.expected || '')}</textarea></label>
                <label class="field"><span>Início</span><input class="input" type="date" data-ecampo="startDate" value="${esc(s.startDate || '')}"></label>
                <label class="field"><span>Entrega</span><input class="input" type="date" data-ecampo="dueDate" value="${esc(s.dueDate || '')}"></label>
                <div class="ct-acoes full"><button class="btn btn-ghost sm" data-c="cancelar-etapa">Cancelar</button><button class="btn btn-primary sm" data-c="salvar-etapa" data-id="${esc(s.id)}">${icon('check', 14)} Salvar etapa</button></div>
              </div>` : `${s.description ? `<p class="cli-desc">${esc(s.description)}</p>` : ''}${s.expected ? `<p class="stage-esperado"><span>Resultado esperado</span>${esc(s.expected)}</p>` : ''}`}
            <div class="stage-prog"><div class="bar"><i style="width:${s.pct}%"></i></div><span>${s.done} de ${s.total} ${s.total === 1 ? 'tarefa' : 'tarefas'}</span></div>
            <div class="ct-lista">${s.tasks.length ? s.tasks.map(tarefaHTML).join('') : '<p class="rel-vazio">Tarefas a definir.</p>'}</div>
          </section>` : ''}` : '<p class="rel-vazio">As etapas deste projeto vão aparecer aqui.</p>';
      } else if (est.modo === 'cronograma') {
        const etapas = i.stages.map(z => ({ id: z.id, nome: z.name, inicio: z.startDate || '', fim: z.dueDate || '', pct: z.pct, estado: z.state, tarefas: z.tasks.map(t => ({ id: t.id, titulo: t.title, inicio: t.startDate || '', fim: t.dueDate || '', status: t.status, quem: pessoa(t.assigneeId)?.name || '' })) }));
        corpo = `<section class="panel gantt-painel"><div class="panel-head"><h3>Cronograma</h3><div class="tabs" role="group" aria-label="Zoom">${[['semana', 'Semana'], ['mes', 'Mês'], ['projeto', 'Projeto inteiro']].map(([v, l]) => `<button class="${est.zoom === v ? 'on' : ''}" data-c="zoom" data-v="${v}">${l}</button>`).join('')}</div></div>${PortalRender.gantt(etapas, { zoom: est.zoom, abrirTarefa: 'cli-ir' })}<p class="gantt-dica">Clique numa etapa para recolher as tarefas. Clique numa tarefa para ver os detalhes.</p></section>`;
      } else {
        const rel = (dados.relatorios || []).filter(r => r.projeto === p.id);
        corpo = `<section class="panel"><div class="panel-head"><h3>Relatório</h3></div>${rel.length ? relatoriosHTML(rel) : '<p class="rel-vazio">O primeiro relatório deste projeto aparece aqui.</p>'}</section>`;
      }
      return `<div class="proj-cabeca"><div class="proj-cabeca-texto">${p.company ? `<p class="proj-empresa">${icon('building', 14)} ${esc(p.company)}</p>` : ''}<h2>${esc(p.name)}</h2><div class="meta-line proj-meta"><span class="pill proj-${esc(p.status)}">${{ ativo: 'Ativo', pausado: 'Pausado', concluido: 'Concluído' }[p.status] || ''}</span>${p.startDate ? `<span class="d">${icon('calendar', 15)} Início em ${fd(p.startDate, true)}</span>` : ''}</div>${p.description ? `<p class="proj-desc">${esc(p.description)}</p>` : ''}</div></div>
        <section class="panel pipe-panel palco"><div class="palco-grid">
          <div class="palco-caminho">${i.stages.length ? PortalRender.pipelineBlock(i.stages, i.pct) : `<div class="pipe-vazio">${Charts.ring(i.pct, { size: 180, stroke: 14, sub: 'pronto' })}</div>`}</div>
        </div>
        ${PortalRender.destaques({ stages: i.stages, tasksDone: i.done, tasksTotal: i.total, dueDate: p.dueDate })}
        </section>
        <div class="cli-modos no-print"><div class="tabs" role="tablist" aria-label="Forma de ver">${modos.map(([v, l, ic]) => `<button role="tab" class="${est.modo === v ? 'on' : ''}" data-c="modo" data-v="${v}">${icon(ic, 15)} ${l}</button>`).join('')}</div></div>
        ${corpo}`;
    }
    function desenhar() {
      if (!dados) return;
      const lista = projetos();
      if (est.aba !== 'geral' && !lista.some(x => x.p.id === est.aba)) est.aba = 'geral';
      const y = window.scrollY;
      raiz.innerHTML = `${topo()}${lista.length > 0 ? abas(lista) : ''}<div class="cli-corpo">${est.aba === 'geral' ? geral(lista) : projeto(lista.find(x => x.p.id === est.aba))}</div><p class="portal-foot">${esc(dados.negocio)}</p>`;
      window.scrollTo(0, y);
    }

    // ---------- ações ----------
    async function recarregar() { try { dados = await op.carregar(); desenhar(); } catch (e) { if (String(e.message || '').includes('sessao') && op.semSessao) op.semSessao(); } }
    async function editar(tipo, id, campos, ok) {
      try { await op.editar(tipo, id, campos); avisar(ok); await recarregar(); }
      catch (e) { avisar(msgErro(e), true); await recarregar(); }
    }
    async function abrirPdf(id, baixar, nome) {
      try {
        const url = await op.relatorio(id);
        if (!url) throw new Error('vazio');
        const b = await (await fetch(url)).blob(); const u = URL.createObjectURL(b);
        if (baixar) { const a = document.createElement('a'); a.href = u; a.download = (nome || 'relatorio').replace(/[^\w\s-]/g, '') + '.pdf'; document.body.appendChild(a); a.click(); a.remove(); }
        else window.open(u, '_blank', 'noopener');
        setTimeout(() => URL.revokeObjectURL(u), 60000);
      } catch (e) { avisar('Não foi possível abrir o relatório agora.', true); }
    }
    raiz.addEventListener('click', e => {
      const el = e.target.closest('[data-c], [data-act="cli-ir"], [data-act="portal-stage"]');
      if (!el) return;
      if (el.dataset.act === 'portal-stage') { const lista = projetos(); const x = lista.find(z => z.p.id === est.aba); if (x) { est.etapa[x.p.id] = el.dataset.id; est.modo = 'etapas'; desenhar(); const a = raiz.querySelector('.cli-etapa'); if (a) a.scrollIntoView({ behavior: 'smooth', block: 'start' }); } return; }
      if (el.dataset.act === 'cli-ir') { e.preventDefault(); irTarefa(el.dataset.id); return; }
      const c = el.dataset.c, id = el.dataset.id;
      if (c === 'aba') { est.aba = el.dataset.v; est.aberta = null; desenhar(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
      else if (c === 'modo') { est.modo = el.dataset.v; desenhar(); }
      else if (c === 'etapa') { est.etapa[el.dataset.p] = el.dataset.v; est.aberta = null; est.editandoEtapa = null; desenhar(); }
      else if (c === 'zoom') { est.zoom = el.dataset.v; desenhar(); }
      else if (c === 'abrir') { est.aberta = est.aberta === id ? null : id; desenhar(); }
      else if (c === 'ir-tarefa') irTarefa(id);
      else if (c === 'pdf') window.print();
      else if (c === 'sair') op.sair();
      else if (c === 'editar-etapa') { est.editandoEtapa = id; desenhar(); }
      else if (c === 'cancelar-etapa') { est.editandoEtapa = null; desenhar(); }
      else if (c === 'salvar-etapa') {
        const campos = {}; raiz.querySelectorAll('[data-ecampo]').forEach(i => { campos[i.dataset.ecampo] = i.value; });
        if (campos.startDate && campos.dueDate && campos.startDate > campos.dueDate) { avisar(ERROS['inicio depois da entrega'], true); return; }
        est.editandoEtapa = null; editar('etapa', id, campos, 'Etapa salva');
      } else if (c === 'salvar-tarefa') {
        const box = raiz.querySelector(`#ct-${CSS.escape(id)}`), campos = {};
        box.querySelectorAll('[data-campo]').forEach(i => { campos[i.dataset.campo] = i.value; });
        if (campos.startDate && campos.dueDate && campos.startDate > campos.dueDate) { avisar(ERROS['inicio depois da entrega'], true); return; }
        editar('tarefa', id, campos, 'Tarefa salva');
      } else if (c === 'comentar') {
        const ta = raiz.querySelector(`[data-novo="${CSS.escape(id)}"]`); const txt = ta.value.trim(); if (!txt) { ta.focus(); return; }
        op.comentar(id, txt).then(async () => { avisar('Comentário enviado'); await recarregar(); }, err => avisar(msgErro(err), true));
      } else if (c === 'rel-abrir') abrirPdf(id, false);
      else if (c === 'rel-baixar') abrirPdf(id, true, el.dataset.nome);
    });
    raiz.addEventListener('change', e => {
      const el = e.target;
      if (el.dataset.c === 'status') editar('tarefa', el.dataset.id, { status: el.value }, `Situação: ${SIT[el.value]}`);
    });
    function irTarefa(id) {
      const t = tarefa(id); if (!t) return;
      const x = projetos().find(z => z.p.stages.some(s => s.id === t.stageId)); if (!x) return;
      est.aba = x.p.id; est.modo = 'etapas'; est.etapa[x.p.id] = t.stageId; est.aberta = id; desenhar();
      const el = raiz.querySelector(`#ct-${CSS.escape(id)}`); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return {
      async iniciar() { await recarregar(); },
      recarregar,
      definir(d) { dados = d; desenhar(); },
      ocupado: () => !!est.aberta || !!est.editandoEtapa || !!(document.activeElement && raiz.contains(document.activeElement) && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)),
    };
  }
  return { montar };
})();

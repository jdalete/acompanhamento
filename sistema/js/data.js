/* Dados, modelos de projeto e dados de exemplo */
const STORE_KEY = 'gestao-projetos.v1';

const uid = () => Math.random().toString(36).slice(2, 10);

function localISO(d = new Date()) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}
function addDays(n, base = new Date()) {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return localISO(d);
}
function stampDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(10 + (n % 7), 15, 0, 0);
  return d.toISOString();
}

const STATUS = {
  aguardando:   { label: 'Aguardando',   cls: 'st-wait' },
  a_fazer:      { label: 'A fazer',      cls: 'st-todo' },
  em_andamento: { label: 'Em andamento', cls: 'st-doing' },
  em_revisao:   { label: 'Em revisão',   cls: 'st-review' },
  concluida:    { label: 'Concluída',    cls: 'st-done' },
};
const STATUS_ORDER = ['aguardando', 'a_fazer', 'em_andamento', 'em_revisao', 'concluida'];

// Complexidade da tarefa: uma rampa de um tom só (validada para o fundo escuro), mais clara = mais complexa
const COMPLEXIDADE = [
  { v: 1, label: 'Muito simples', cor: '#1c5cab' },
  { v: 2, label: 'Simples', cor: '#2a78d6' },
  { v: 3, label: 'Média', cor: '#5598e7' },
  { v: 4, label: 'Complexa', cor: '#86b6ef' },
  { v: 5, label: 'Extremamente complexa', cor: '#b7d3f6' },
];

const PROJECT_STATUS = {
  ativo:     'Ativo',
  pausado:   'Pausado',
  concluido: 'Concluído',
};

// Cores claras que combinam com o céu escuro da identidade Brasa (o texto do avatar fica escuro por cima).
// Situação da pessoa e papel na empresa (as mesmas listas do Orbe Finance).
const SITUACOES = [['ativo', 'Ativo'], ['negociacao', 'Em negociação'], ['pausado', 'Pausado'], ['encerrado', 'Encerrado'], ['contato', 'Só contato'], ['servir', 'Servir']];
const PAPEIS = [['socio', 'Sócio(a)'], ['administrador', 'Sócio(a) administrador(a)'], ['ceo', 'CEO'], ['diretor', 'Diretor(a)'], ['gerente', 'Gerente'], ['financeiro', 'Financeiro'], ['vendedor', 'Vendedor(a)'], ['contato', 'Contato']];
const REDES = [['instagram', 'Instagram'], ['linkedin', 'LinkedIn'], ['facebook', 'Facebook'], ['tiktok', 'TikTok'], ['youtube', 'YouTube'], ['outra', 'Outra rede']];
const CLIENT_COLORS = ['#A9CBFF', '#8FDCE6', '#B79BFF', '#7FE0B5', '#F2C14E', '#FF9AA8', '#E3CC9B', '#FFB27A'];

/* Modelos: cada um gera etapas e tarefas prontas ao criar um projeto */
const TEMPLATES = {
  'pagina-vendas': {
    name: 'Página de vendas',
    stages: [
      { name: 'Briefing e estratégia', desc: 'Entender a oferta, o público e o objetivo da página.', tasks: [
        ['Reunião de briefing', 'Alinhar oferta, público, principais objeções e a meta de conversão da página.'],
        ['Coleta de materiais', 'Receber logo, fotos, depoimentos, provas sociais e acessos ao domínio.'],
        ['Análise de concorrentes', 'Mapear de 3 a 5 páginas de referência do nicho e anotar o que funciona.'],
      ]},
      { name: 'Copy', desc: 'Texto persuasivo da página, seção por seção.', tasks: [
        ['Estrutura da página', 'Definir a ordem das seções: promessa, prova, oferta, garantia e perguntas frequentes.'],
        ['Redação da copy', 'Escrever todos os textos da página seguindo a estrutura aprovada.'],
        ['Revisão com o cliente', 'Enviar a copy, receber ajustes e fechar a versão final.'],
      ]},
      { name: 'Design', desc: 'Layout da página no desktop e no celular.', tasks: [
        ['Wireframe', 'Rascunho da distribuição das seções antes do visual final.'],
        ['Layout desktop e mobile', 'Criar o visual completo nas duas versões.'],
        ['Aprovação do layout', 'Apresentar o layout ao cliente e registrar a aprovação.'],
      ]},
      { name: 'Desenvolvimento', desc: 'Montagem da página e integrações.', tasks: [
        ['Montagem da página', 'Construir a página na plataforma escolhida, fiel ao layout aprovado.'],
        ['Checkout e formulários', 'Conectar o botão de compra, o checkout e os formulários de captura.'],
        ['Pixel e tags', 'Instalar Pixel da Meta, Google Tag Manager e eventos de conversão.'],
      ]},
      { name: 'Publicação', desc: 'Testes finais e entrega para o cliente.', tasks: [
        ['Testes de velocidade e responsividade', 'Testar em vários celulares e navegadores e otimizar o carregamento.'],
        ['Publicação no domínio', 'Colocar a página no ar no domínio do cliente.'],
        ['Entrega e treinamento', 'Mostrar a página ao cliente e explicar como fazer pequenas alterações.'],
      ]},
    ],
  },
  'trafego-pago': {
    name: 'Configuração de tráfego pago',
    stages: [
      { name: 'Diagnóstico', desc: 'Entender o negócio e reunir os acessos.', tasks: [
        ['Reunião de onboarding', 'Entender produto, ticket, público, região de atuação e metas.'],
        ['Coleta de acessos', 'Gerenciador de Negócios, conta de anúncios, Google Ads, site e Instagram.'],
        ['Análise de público e concorrência', 'Levantar públicos, palavras-chave e anúncios ativos dos concorrentes.'],
      ]},
      { name: 'Estrutura e rastreamento', desc: 'Contas configuradas e conversões medindo certo.', tasks: [
        ['Configurar Gerenciador de Negócios', 'Organizar a BM, conta de anúncios, forma de pagamento e permissões.'],
        ['Pixel e API de Conversões', 'Instalar o Pixel da Meta e configurar a API de Conversões.'],
        ['Tag Manager e conversões do Google', 'Configurar o Google Tag Manager e as conversões do Google Ads.'],
        ['Validar eventos de conversão', 'Fazer testes e confirmar que todos os eventos chegam nas plataformas.'],
      ]},
      { name: 'Estratégia e criativos', desc: 'Plano de campanhas e peças dos anúncios.', tasks: [
        ['Plano de campanhas e orçamento', 'Definir campanhas, públicos, distribuição de verba e metas por canal.'],
        ['Briefing de criativos', 'Passar para o design os ângulos, formatos e textos dos anúncios.'],
        ['Produção de criativos', 'Criar imagens e vídeos nos formatos de feed, stories e reels.'],
        ['Aprovação de criativos e textos', 'Apresentar ao cliente e registrar os ajustes e a aprovação.'],
      ]},
      { name: 'Lançamento', desc: 'Campanhas no ar.', tasks: [
        ['Subir campanhas na Meta', 'Criar campanhas, conjuntos e anúncios no Gerenciador de Anúncios.'],
        ['Subir campanhas no Google', 'Criar campanhas de pesquisa e, se fizer sentido, Performance Max.'],
        ['Checklist antes de ativar', 'Revisar orçamento, públicos, links, UTMs e eventos antes de ativar.'],
      ]},
      { name: 'Otimização e relatório', desc: 'Primeiros ajustes e prestação de contas.', tasks: [
        ['Acompanhar os 7 primeiros dias', 'Monitorar entrega, custo por resultado e possíveis reprovações.'],
        ['Primeiras otimizações', 'Pausar o que não funciona e redistribuir verba para o que funciona.'],
        ['Relatório de resultados', 'Montar e apresentar o relatório do primeiro ciclo.'],
      ]},
    ],
  },
  'gmn': {
    name: 'Google Meu Negócio',
    stages: [
      { name: 'Diagnóstico', desc: 'Situação atual do perfil.', tasks: [
        ['Verificar acesso ao perfil', 'Confirmar que o cliente é proprietário e dar acesso de gerente.'],
        ['Auditoria do perfil', 'Listar o que falta: categorias, fotos, descrição, horários e avaliações.'],
      ]},
      { name: 'Otimização', desc: 'Perfil completo e bem posicionado.', tasks: [
        ['Categorias e serviços', 'Escolher categoria principal, secundárias e cadastrar os serviços.'],
        ['Descrição com palavras-chave', 'Reescrever a descrição com os termos que os clientes pesquisam.'],
        ['Fotos e vídeos', 'Subir fachada, ambiente, equipe e serviços com boa qualidade.'],
        ['Horários, links e atributos', 'Preencher horários, link do WhatsApp, site e atributos do negócio.'],
      ]},
      { name: 'Conteúdo e avaliações', desc: 'Perfil ativo e com prova social.', tasks: [
        ['Calendário de postagens', 'Planejar as postagens semanais do perfil.'],
        ['Estratégia de avaliações', 'Criar a mensagem e o link para pedir avaliações aos clientes.'],
        ['Responder avaliações', 'Responder todas as avaliações, positivas e negativas.'],
      ]},
      { name: 'Entrega', desc: 'Resultado e próximos passos.', tasks: [
        ['Relatório de entrega', 'Mostrar o antes e depois do perfil e os primeiros números.'],
      ]},
    ],
  },
};

/* Cria etapas e tarefas a partir de um modelo.
   plan: lista (por etapa) de listas de [status, responsavelId, prazoEmDias, concluidaHaDias] */
function buildFromTemplate(db, projectId, tplKey, plan = [], defaultAssignee = null, startDue = 7) {
  const tpl = TEMPLATES[tplKey];
  if (!tpl) return;
  let due = startDue;
  tpl.stages.forEach((st, si) => {
    const stageId = uid();
    db.stages.push({ id: stageId, projectId, name: st.name, description: st.desc, order: si });
    st.tasks.forEach(([title, desc], ti) => {
      const p = (plan[si] && plan[si][ti]) || [];
      const status = p[0] || 'a_fazer';
      due += 2;
      db.tasks.push({
        id: uid(),
        stageId,
        title,
        description: desc,
        assigneeId: p[1] !== undefined ? p[1] : defaultAssignee,
        dueDate: p[2] !== undefined ? addDays(p[2]) : (plan.length ? addDays(due) : ''),
        status,
        completedAt: status === 'concluida' ? stampDaysAgo(p[3] ?? 3) : null,
        deliverables: [],
        order: ti,
        createdAt: new Date().toISOString(),
      });
    });
  });
}

function emptyDB() {
  return {
    version: 1,
    settings: { businessName: 'Jhonatan', ownerName: 'Jhonatan', tema: 'interestelar' },
    team: [],
    comments: [],
    history: [],
    clients: [],
    companies: [],
    links: [],
    projects: [],
    stages: [],
    tasks: [],
  };
}

function seedDB() {
  const db = emptyDB();
  const J = 'm_jhon', B = 'm_bia', L = 'm_leo', C = 'm_caio';
  db.team = [
    { id: J, name: 'Jhonatan', role: 'Gestão e tráfego pago', color: '#A9CBFF' },
    { id: B, name: 'Bia', role: 'Design', color: '#FF9AA8' },
    { id: L, name: 'Léo', role: 'Copywriter', color: '#8FDCE6' },
    { id: C, name: 'Caio', role: 'Desenvolvimento', color: '#7FE0B5' },
  ];

  const rapha = { id: 'c_rapha', name: 'Rapha', email: '', phone: '', situacao: 'ativo', notes: 'Comprou dois projetos: página de vendas e configuração do tráfego pago da outra empresa.', color: '#B79BFF', createdAt: stampDaysAgo(30) };
  const studio = { id: 'c_studio', name: 'Carla Mendes', email: '', phone: '', situacao: 'ativo', notes: 'Cliente de exemplo para você ver como o sistema fica com mais de um cliente.', color: '#F2C14E', createdAt: stampDaysAgo(25) };
  db.clients.push(rapha, studio);
  db.companies.push(
    { id: 'e_valore', name: 'Valore', segmento: 'Exemplo', color: '#A9CBFF', createdAt: stampDaysAgo(30) },
    { id: 'e_tomcar', name: 'Tom Car', segmento: 'Exemplo', color: '#8FDCE6', createdAt: stampDaysAgo(30) },
    { id: 'e_studio', name: 'Studio Bem-Estar', segmento: 'Exemplo', color: '#7FE0B5', createdAt: stampDaysAgo(25) },
  );
  db.links.push(
    { id: 'l_1', clientId: rapha.id, companyId: 'e_valore', role: 'ceo' },
    { id: 'l_2', clientId: rapha.id, companyId: 'e_tomcar', role: 'socio' },
    { id: 'l_3', clientId: studio.id, companyId: 'e_studio', role: 'socio' },
  );

  const p1 = { id: 'p_lp', clientId: rapha.id, companyId: 'e_valore', name: 'Página de vendas', template: 'pagina-vendas', description: 'Criação da página de vendas do produto principal da Rapha, do briefing até a publicação.', startDate: addDays(-24), dueDate: addDays(21), status: 'ativo', createdAt: stampDaysAgo(24) };
  const p2 = { id: 'p_trafego', clientId: rapha.id, companyId: 'e_tomcar', name: 'Tráfego pago da segunda empresa', template: 'trafego-pago', description: 'Configuração completa do tráfego pago (Meta Ads e Google Ads) da outra empresa da Rapha.', startDate: addDays(-12), dueDate: addDays(30), status: 'ativo', createdAt: stampDaysAgo(12) };
  const p3 = { id: 'p_gmn', clientId: studio.id, companyId: 'e_studio', name: 'Google Meu Negócio', template: 'gmn', description: 'Otimização completa do perfil no Google para aparecer nas buscas da região.', startDate: addDays(-18), dueDate: addDays(9), status: 'ativo', createdAt: stampDaysAgo(18) };
  db.projects.push(p1, p2, p3);

  buildFromTemplate(db, p1.id, 'pagina-vendas', [
    [['concluida', J, -22, 22], ['concluida', J, -20, 19], ['concluida', L, -18, 17]],
    [['concluida', L, -15, 15], ['concluida', L, -11, 11], ['concluida', J, -8, 8]],
    [['concluida', B, -6, 5], ['em_revisao', B, 1], ['a_fazer', J, 3]],
    [['a_fazer', C, 8], ['a_fazer', C, 11], ['a_fazer', J, 12]],
    [['a_fazer', C, 16], ['a_fazer', C, 19], ['a_fazer', J, 21]],
  ]);
  buildFromTemplate(db, p2.id, 'trafego-pago', [
    [['concluida', J, -10, 10], ['concluida', J, -8, 7], ['concluida', J, -6, 6]],
    [['concluida', J, -4, 4], ['concluida', J, -3, 2], ['em_andamento', J, -1], ['a_fazer', J, 2]],
    [['a_fazer', J, 5], ['a_fazer', J, 7], ['a_fazer', B, 12], ['a_fazer', J, 14]],
    [['a_fazer', J, 17], ['a_fazer', J, 18], ['a_fazer', J, 19]],
    [['a_fazer', J, 26], ['a_fazer', J, 28], ['a_fazer', J, 30]],
  ]);
  buildFromTemplate(db, p3.id, 'gmn', [
    [['concluida', J, -16, 16], ['concluida', J, -14, 13]],
    [['concluida', J, -11, 10], ['concluida', L, -9, 9], ['concluida', B, -6, 4], ['concluida', J, -4, 3]],
    [['em_andamento', J, 2], ['concluida', L, -1, 1], ['a_fazer', J, 6]],
    [['a_fazer', J, 9]],
  ]);

  // Entregáveis de exemplo
  const byTitle = (pid, title) => {
    const stageIds = db.stages.filter(s => s.projectId === pid).map(s => s.id);
    return db.tasks.find(t => stageIds.includes(t.stageId) && t.title === title);
  };
  const add = (task, items) => task && task.deliverables.push(...items.map(i => ({ id: uid(), ...i })));
  add(byTitle(p1.id, 'Reunião de briefing'), [
    { type: 'link', label: 'Gravação da reunião', value: 'https://drive.google.com/' },
    { type: 'texto', label: 'Resumo do briefing', value: 'Produto: mentoria em grupo.\nPúblico: mulheres de 28 a 45 anos que querem empreender.\nMeta: 3% de conversão na página.' },
  ]);
  add(byTitle(p1.id, 'Redação da copy'), [
    { type: 'link', label: 'Documento da copy', value: 'https://docs.google.com/' },
  ]);
  add(byTitle(p1.id, 'Layout desktop e mobile'), [
    { type: 'link', label: 'Layout no Figma', value: 'https://figma.com/' },
  ]);
  add(byTitle(p2.id, 'Coleta de acessos'), [
    { type: 'acesso', label: 'Gerenciador de Negócios', value: 'ID da BM: 0000000000\nAcesso de administrador liberado para o Jhonatan.' },
  ]);
  add(byTitle(p2.id, 'Pixel e API de Conversões'), [
    { type: 'texto', label: 'Eventos configurados', value: 'PageView, ViewContent, Lead e Purchase.' },
  ]);
  add(byTitle(p3.id, 'Fotos e vídeos'), [
    { type: 'link', label: 'Pasta com as fotos', value: 'https://drive.google.com/' },
  ]);
  return db;
}

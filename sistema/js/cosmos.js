/* Céu do fundo e temas, no padrão do Orbe Finance (identidade Brasa).
   - As estrelas são desenhadas uma vez em ladrilhos e depois só deslizam (paralaxe leve, só com mouse ou rolagem).
   - Estrela cadente de vez em quando.
   - Luz que segue o cursor no vidro (--mx / --my) e leve inclinação 3D em [data-tilt].
   Usado pelo sistema e pela página pública do cliente. */
(() => {
  'use strict';
  const TEMAS = [
    { id: 'interestelar', nome: 'Interestelar', descricao: 'Céu profundo: a Via Láctea subindo do horizonte, nebulosas e planetas escuros.', acento: '#5C9DFF', fundo: '#02040A' },
    { id: 'abissal', nome: 'Abissal', descricao: 'Fundo do mar: azul profundo e feixes de luz que se perdem na água.', acento: '#3FB6C8', fundo: '#020A12' },
    { id: 'digital', nome: 'Grade digital', descricao: 'Retrofuturista: rede, conexões e neon contido.', acento: '#2EE6F2', fundo: '#05030C' },
    { id: 'maison', nome: 'Maison', descricao: 'Luxo discreto: preto profundo, champanhe e guilhoché de relojoaria.', acento: '#C8A970', fundo: '#0A0908' },
  ];
  const valido = id => (TEMAS.some(t => t.id === id) ? id : 'interestelar');

  const reduzir = matchMedia('(prefers-reduced-motion: reduce)');
  const semMouse = matchMedia('(hover: none)');
  const celular = matchMedia('(max-width: 767.98px)');
  const cosmos = document.getElementById('cosmos');

  const CAMADAS = [
    { classe: 'longe', tile: 900, densidade: 1 / 1500, zMin: 0, zMax: 0.55, prof: 0.08, rolagem: 0.04 },
    { classe: 'perto', tile: 1100, densidade: 1 / 9000, zMin: 0.55, zMax: 1, prof: 0.22, rolagem: 0.12 },
  ];
  const PALETAS = {
    interestelar: ['226,236,255', '255,255,255', '180,206,255', '214,228,255', '255,222,206'],
    abissal: ['190,226,236', '150,205,222', '220,240,246'],
    digital: ['80,230,255', '255,70,170', '170,140,255'],
    maison: ['226,206,170', '246,238,224'],
  };

  function brilhoSprite() {
    const t = document.createElement('canvas');
    t.width = t.height = 64;
    const s = t.getContext('2d');
    const g = s.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,250,245,1)');
    g.addColorStop(0.08, 'rgba(236,244,255,.85)');
    g.addColorStop(0.25, 'rgba(170,200,255,.22)');
    g.addColorStop(1, 'rgba(150,185,255,0)');
    s.fillStyle = g;
    s.fillRect(0, 0, 64, 64);
    for (const horizontal of [true, false]) {
      const l = horizontal ? s.createLinearGradient(0, 32, 64, 32) : s.createLinearGradient(32, 0, 32, 64);
      l.addColorStop(0, 'rgba(255,235,220,0)');
      l.addColorStop(0.5, 'rgba(255,240,230,.55)');
      l.addColorStop(1, 'rgba(255,235,220,0)');
      s.fillStyle = l;
      if (horizontal) s.fillRect(0, 31.5, 64, 1); else s.fillRect(31.5, 0, 1, 64);
    }
    return t;
  }

  // Ladrilho que se repete sem emenda (pontos perto da borda são desenhados dos dois lados).
  function ladrilho({ tile, densidade, zMin, zMax }, sprite, tema) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const tela = document.createElement('canvas');
    tela.width = tela.height = tile * dpr;
    const ctx = tela.getContext('2d');
    ctx.scale(dpr, dpr);
    const cores = PALETAS[tema] || PALETAS.interestelar;
    const fator = { interestelar: 1, abissal: 0.55, digital: 0.22, maison: 0.12 }[tema] ?? 1;
    const n = Math.round(tile * tile * densidade * fator);
    const pontos = [];
    for (let i = 0; i < n; i++) {
      const z = zMin + (zMax - zMin) * Math.random() ** 2;
      pontos.push({ x: Math.random() * tile, y: Math.random() * tile, z, cor: cores[Math.floor(Math.random() * cores.length)] });
    }
    const repetir = (x, y, desenhar) => {
      const dxs = x < 30 ? [0, tile] : x > tile - 30 ? [0, -tile] : [0];
      const dys = y < 30 ? [0, tile] : y > tile - 30 ? [0, -tile] : [0];
      for (const dx of dxs) for (const dy of dys) desenhar(x + dx, y + dy);
    };
    if (tema === 'digital') {
      ctx.lineWidth = 0.6;
      for (const a of pontos) for (const b of pontos) {
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (a === b || d > 150 || a.x > b.x) continue;
        ctx.globalAlpha = (1 - d / 150) * 0.22;
        ctx.strokeStyle = `rgb(${a.cor})`;
        repetir(a.x, a.y, (x, y) => { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + b.x - a.x, y + b.y - a.y); ctx.stroke(); });
      }
    }
    for (const p of pontos) {
      repetir(p.x, p.y, (x, y) => {
        if (tema === 'interestelar' && p.z > 0.72) {
          const tam = 10 + p.z * 22;
          ctx.globalAlpha = (p.z > 0.9 ? 0.95 : 0.6) * (0.75 + Math.random() * 0.25);
          ctx.drawImage(sprite, x - tam / 2, y - tam / 2, tam, tam);
          return;
        }
        ctx.globalAlpha = tema === 'abissal' ? 0.12 + p.z * 0.4 : tema === 'digital' ? 0.35 + p.z * 0.5 : 0.22 + p.z * 0.7;
        ctx.fillStyle = `rgb(${p.cor})`;
        if (tema === 'abissal') { ctx.shadowColor = `rgba(${p.cor},.8)`; ctx.shadowBlur = 4 + p.z * 6; }
        ctx.beginPath();
        ctx.arc(x, y, tema === 'digital' ? 0.8 + p.z * 1.4 : tema === 'abissal' ? 0.5 + p.z * 1.8 : 0.3 + p.z * 1.35, 0, 6.2832);
        ctx.fill();
        ctx.shadowBlur = 0;
      });
    }
    return tela;
  }

  // Coluna da Via Láctea: milhares de estrelas finas concentradas no centro, mais densas embaixo.
  function colunaDeEstrelas(sprite) {
    const alvo = cosmos && cosmos.querySelector('[data-via-estrelas]');
    if (!alvo || alvo.dataset.pronto) return;
    alvo.dataset.pronto = '1';
    const L = 700, A = 1600;
    const tela = document.createElement('canvas');
    tela.width = L; tela.height = A;
    const ctx = tela.getContext('2d');
    const gauss = () => (Math.random() + Math.random() + Math.random() + Math.random() - 2) / 2;
    const eixo = y => L / 2 + Math.sin(y / 260) * 22 + Math.sin(y / 97) * 6;
    const largura = y => L * (0.07 + (y / A) * 0.13);
    for (let i = 0; i < 26000; i++) {
      const y = A * Math.pow(Math.random(), 0.6);
      const x = eixo(y) + gauss() * largura(y) * 1.6;
      ctx.globalAlpha = 0.05 + Math.random() * 0.12;
      ctx.fillStyle = Math.random() > 0.8 ? '#FFE4D8' : '#D6E4FF';
      ctx.fillRect(x, y, 1.2, 1.2);
    }
    for (let i = 0; i < 11000; i++) {
      const y = A * Math.pow(Math.random(), 0.55);
      const x = eixo(y) + gauss() * largura(y) * 1.4;
      const brilho = Math.random();
      ctx.globalAlpha = 0.3 + brilho * 0.65;
      ctx.fillStyle = brilho > 0.97 ? '#FFFFFF' : brilho > 0.9 ? '#FFD9CF' : brilho > 0.5 ? '#E2ECFF' : '#B7CEFF';
      ctx.beginPath();
      ctx.arc(x, y, brilho > 0.985 ? 1.8 : brilho > 0.9 ? 1.1 : 0.6, 0, 6.2832);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 1400; i++) {
      const y = A * (0.08 + Math.random() * 0.86);
      const x = eixo(y) + largura(y) * 0.25 + Math.sin(y / 140) * largura(y) * 0.35 + gauss() * largura(y) * 0.28;
      const r = 6 + Math.random() * 18;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(0,0,0,.22)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 1; ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 30; i++) {
      const y = A * (0.12 + Math.random() * 0.84), x = eixo(y) + gauss() * largura(y) * 1.3;
      const tam = 14 + Math.random() * 22;
      ctx.globalAlpha = 0.75;
      ctx.drawImage(sprite, x - tam / 2, y - tam / 2, tam, tam);
    }
    tela.toBlob(blob => { if (blob) alvo.style.backgroundImage = `url(${URL.createObjectURL(blob)})`; });
  }

  let sprite = null, estrelas = [], camadas = [], temaDesenhado = '';
  if (cosmos) {
    sprite = brilhoSprite();
    const primeiraCena = cosmos.querySelector('.cena');
    estrelas = CAMADAS.map(c => {
      const el = document.createElement('div');
      el.className = `estrelas ${c.classe}`;
      el.style.setProperty('--tile', `${c.tile}px`);
      if (primeiraCena) primeiraCena.before(el); else cosmos.prepend(el);
      return { el, ...c };
    });
    camadas = [...cosmos.querySelectorAll('[data-prof]')];
  }

  function redesenhar(tema) {
    if (!cosmos || tema === temaDesenhado) return;
    temaDesenhado = tema;
    if (tema === 'interestelar') colunaDeEstrelas(sprite);
    for (const e of estrelas) {
      ladrilho(e, sprite, tema).toBlob(blob => {
        if (!blob || temaDesenhado !== tema) return;
        const antigo = e.el.dataset.url;
        e.el.dataset.url = URL.createObjectURL(blob);
        e.el.style.backgroundImage = `url(${e.el.dataset.url})`;
        if (antigo) URL.revokeObjectURL(antigo);
      });
    }
  }

  function aplicar(id) {
    id = valido(id);
    document.documentElement.dataset.tema = id;
    const meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.setAttribute('content', TEMAS.find(t => t.id === id).fundo);
    redesenhar(id);
    return id;
  }

  // ---------- Paralaxe: o laço só roda enquanto há movimento ----------
  const alvo = { x: 0, y: 0 }, atual = { x: 0, y: 0 };
  let rolagemSuave = window.scrollY, rodando = false;
  function quadro() {
    atual.x += (alvo.x - atual.x) * 0.08;
    atual.y += (alvo.y - atual.y) * 0.08;
    rolagemSuave += (window.scrollY - rolagemSuave) * 0.18;
    const parado = Math.abs(alvo.x - atual.x) < 0.002 && Math.abs(alvo.y - atual.y) < 0.002 && Math.abs(window.scrollY - rolagemSuave) < 0.5;
    if (parado) { atual.x = alvo.x; atual.y = alvo.y; rolagemSuave = window.scrollY; }
    for (const c of camadas) {
      const p = +c.dataset.prof;
      c.style.transform = `translate3d(${(-atual.x * p * 46).toFixed(1)}px, ${(-atual.y * p * 46 - rolagemSuave * p * 0.45).toFixed(1)}px, 0)`;
    }
    for (const e of estrelas) {
      const y = (rolagemSuave * e.rolagem) % e.tile;
      e.el.style.transform = `translate3d(${(-atual.x * e.prof * 46).toFixed(1)}px, ${(-y - atual.y * e.prof * 46).toFixed(1)}px, 0)`;
    }
    rodando = !parado;
    if (rodando) requestAnimationFrame(quadro);
  }
  function acordar() {
    if (!cosmos || rodando || reduzir.matches || celular.matches) return;
    rodando = true;
    requestAnimationFrame(quadro);
  }
  if (cosmos) {
    requestAnimationFrame(quadro);
    addEventListener('scroll', acordar, { passive: true });

    // Estrela cadente ocasional (só no Interestelar, pelo CSS)
    const cadente = document.createElement('i');
    cadente.className = 'cadente';
    cosmos.append(cadente);
    const proxima = () => setTimeout(() => {
      if (!document.hidden && !reduzir.matches) {
        cadente.style.left = `${35 + Math.random() * 60}%`;
        cadente.style.top = `${Math.random() * 30}%`;
        cadente.classList.remove('voando');
        void cadente.offsetWidth;
        cadente.classList.add('voando');
      }
      proxima();
    }, 12000 + Math.random() * 18000);
    proxima();
  }

  // ---------- Luz do cursor no vidro e inclinação 3D ----------
  const VIDRO = '.panel, .kpi, .modal, .drawer, .dock';
  let ultimo = null, agendado = false, inclinado = null;
  function aplicarCursor() {
    agendado = false;
    const e = ultimo;
    if (!e || !e.target || !e.target.closest) return;
    const el = e.target.closest(VIDRO);
    if (el) {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${Math.round(e.clientX - r.left)}px`);
      el.style.setProperty('--my', `${Math.round(e.clientY - r.top)}px`);
    }
    const card = reduzir.matches || semMouse.matches ? null : e.target.closest('[data-tilt]');
    if (inclinado && inclinado !== card) inclinado.style.transform = '';
    inclinado = card;
    if (card) {
      const r = card.getBoundingClientRect();
      const dx = (e.clientX - r.left) / r.width - 0.5, dy = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `perspective(1200px) rotateX(${(-dy * 3).toFixed(2)}deg) rotateY(${(dx * 4).toFixed(2)}deg)`;
    }
  }
  addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;
    alvo.x = (e.clientX / innerWidth - 0.5) * 2;
    alvo.y = (e.clientY / innerHeight - 0.5) * 2;
    acordar();
    ultimo = e;
    if (!agendado) { agendado = true; requestAnimationFrame(aplicarCursor); }
  }, { passive: true });
  document.addEventListener('pointerleave', () => {
    alvo.x = alvo.y = 0;
    acordar();
    if (inclinado) inclinado.style.transform = '';
    inclinado = null;
  });

  window.Cosmos = { TEMAS, aplicar, valido };
})();

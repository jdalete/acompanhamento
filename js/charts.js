/* Ícones e gráficos em SVG */
const ICONS = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  tasks: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  sidebar: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  up: '<path d="m18 15-6-6-6 6"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  text: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
  key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>',
  trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 19c-6.5 0-10-7-10-7a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  external: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  alert: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  board: '<rect x="3" y="3" width="5" height="18" rx="1.5"/><rect x="10" y="3" width="5" height="12" rx="1.5"/><rect x="17" y="3" width="4" height="8" rx="1.5"/>',
  printer: '<path d="M6 9V2h12v7"/><rect x="6" y="14" width="12" height="8"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>',
  back: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  flag: '<path d="M4 22V4M4 4h13l-2 4 2 4H4"/>',
  building: '<path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h3a1 1 0 0 1 1 1v11M2 21h20M8 7h4M8 11h4M8 15h4"/>',
  chat: '<path d="M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.6-5.2A8.5 8.5 0 1 1 21 12z"/>',
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3z"/>',
  camera: '<path d="M4 8h3.5L9 5.5h6L16.5 8H20v11.5H4z"/><circle cx="12" cy="13" r="3.5"/>',
  unlink: '<path d="M9 17H7a5 5 0 0 1 0-10h2M15 7h2a5 5 0 0 1 0 10h-2M8 12h2M14 12h2"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  grip: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="m21 16-5-5-9 9"/>',
  zoomin: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4M11 8v6M8 11h6"/>',
  zoomout: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4M8 11h6"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  listcheck: '<path d="M11 6h10M11 12h10M11 18h10"/><path d="m3 6 1.5 1.5L7 5M3 12l1.5 1.5L7 11"/><rect x="3" y="16" width="4" height="4" rx="1"/>',
  lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
  more: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11"/>',
  paperclip: '<path d="m21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/>',
};
// Marca: o orbe de luz da identidade Brasa (muda de forma em cada tema pelo CSS).
const BRAND_MARK = '<span class="marca-ponto" aria-hidden="true"></span>';

function icon(name, size = 18) {
  return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

const Charts = (() => {
  let n = 0;
  const gid = p => `${p}${++n}`;
  const escT = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* Anel de progresso circular */
  /* Anel de progresso como um instrumento: escala graduada, arco em segmentos, ponteiro de luz e disco central.
     Tudo em SVG estático (sem canvas): um filtro de brilho por anel e uma única animação de entrada. */
  const P = (c, r, g) => { const a = (g * Math.PI) / 180; return [c + r * Math.cos(a), c + r * Math.sin(a)]; };
  const arco = (c, r, g0, g1) => { const [x0, y0] = P(c, r, g0), [x1, y1] = P(c, r, g1); return `M${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 ${g1 - g0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)},${y1.toFixed(2)}`; };
  function ring(pct, { size = 150, stroke = 11, label, sub, animate = false } = {}) {
    const v = Math.max(0, Math.min(100, Number(pct) || 0));
    const c = size / 2, id = gid('rg'), grande = size >= 170, pequeno = size < 120;
    const INI = 135, VAR = 270, fim = INI + (VAR * v) / 100; // medidor de 270°, aberto embaixo
    const rFora = c - 2, rEsc = c - (pequeno ? 6 : 9), lEsc = pequeno ? 3 : grande ? 7 : 5;
    const sw = pequeno ? Math.max(5, stroke - 2) : stroke;
    const rArco = rEsc - lEsc - sw / 2 - (pequeno ? 3 : 6);
    const rDisco = rArco - sw / 2 - (pequeno ? 4 : 9);
    // Escala: risquinhos a cada 2% (5% nos pequenos); os de 25% são maiores
    const passo = pequeno ? 5 : 2;
    let escala = '';
    for (let k = 0; k <= 100; k += passo) {
      const g = INI + (VAR * k) / 100, maior = k % 25 === 0;
      const [x0, y0] = P(c, rEsc, g), [x1, y1] = P(c, rEsc - (maior ? lEsc : lEsc * 0.55), g);
      escala += `<line x1="${x0.toFixed(2)}" y1="${y0.toFixed(2)}" x2="${x1.toFixed(2)}" y2="${y1.toFixed(2)}" class="esc ${k <= v && v > 0 ? 'acesa' : ''} ${maior ? 'maior' : ''}"/>`;
    }
    // Arco: em segmentos nos grandes, contínuo nos pequenos
    let trilho = '', aceso = '';
    if (pequeno) {
      trilho = `<path d="${arco(c, rArco, INI, INI + VAR)}" class="arco-trilho" stroke-width="${sw}" fill="none" stroke-linecap="round"/>`;
      if (v > 0) aceso = `<path d="${arco(c, rArco, INI, Math.max(INI + 0.5, fim))}" stroke="url(#${id})" stroke-width="${sw}" fill="none" stroke-linecap="round"/>`;
    } else {
      const N = grande ? 54 : 40, fatia = VAR / N, vao = grande ? 1.5 : 1.8;
      for (let k = 0; k < N; k++) {
        const g0 = INI + k * fatia + vao / 2, g1 = INI + (k + 1) * fatia - vao / 2;
        const d = `<path d="${arco(c, rArco, g0, g1)}" stroke-width="${sw}" fill="none"`;
        if (g1 <= fim + 0.01 && v > 0) aceso += `${d} stroke="url(#${id})"/>`; else trilho += `${d} class="arco-trilho"/>`;
      }
    }
    // Ponteiro: ponto de luz na ponta do arco e linha fina até o disco
    const [px, py] = P(c, rArco, v > 0 ? fim : INI), [qx, qy] = P(c, rDisco + 2, v > 0 ? fim : INI);
    const ponteiro = v > 0 ? `<line x1="${px.toFixed(2)}" y1="${py.toFixed(2)}" x2="${qx.toFixed(2)}" y2="${qy.toFixed(2)}" class="ponteiro"/><circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="${pequeno ? 2.6 : 4}" class="ponteiro-luz" filter="url(#${id}b)"/><circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="${pequeno ? 1.6 : 2.4}" class="ponteiro-ponto"/>` : '';
    const [ex0, ey0] = P(c, rArco, INI), [ex1, ey1] = P(c, rArco, INI + VAR);
    return `<svg class="ring instrumento ${animate ? 'entrar' : ''}" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${label ?? v}${label ? '' : '%'} ${escT(sub || 'concluído')}">
      <defs>
        <linearGradient id="${id}" x1="0" y1="1" x2="1" y2="0"><stop offset="0" style="stop-color:var(--acc-2)"/><stop offset=".6" style="stop-color:var(--acc)"/><stop offset="1" style="stop-color:var(--acc-3)"/></linearGradient>
        <radialGradient id="${id}h"><stop offset=".62" style="stop-color:var(--acc);stop-opacity:0"/><stop offset=".8" style="stop-color:var(--acc);stop-opacity:.28"/><stop offset="1" style="stop-color:var(--acc);stop-opacity:0"/></radialGradient>
        <radialGradient id="${id}d" cx=".42" cy=".36" r=".75"><stop offset="0" stop-color="#1A2233"/><stop offset=".7" stop-color="#05080F"/><stop offset="1" stop-color="#020409"/></radialGradient>
        <linearGradient id="${id}r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--acc-3);stop-opacity:.9"/><stop offset=".45" style="stop-color:var(--acc);stop-opacity:.12"/><stop offset="1" style="stop-color:var(--acc);stop-opacity:0"/></linearGradient>
        <filter id="${id}b" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="${pequeno ? 1.6 : 3}"/></filter>
        <filter id="${id}g" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${pequeno ? 2 : sw * 0.45}"/></filter>
      </defs>
      <circle cx="${c}" cy="${c}" r="${rFora}" class="aro"/>
      <g class="escala">${escala}</g>
      ${pequeno ? '' : `<circle cx="${ex0.toFixed(2)}" cy="${ey0.toFixed(2)}" r="2" class="fim-arco"/><circle cx="${ex1.toFixed(2)}" cy="${ey1.toFixed(2)}" r="2" class="fim-arco"/>`}
      <g class="trilho">${trilho}</g>
      <g class="brilho" filter="url(#${id}g)" opacity=".7">${aceso}</g>
      <g class="aceso">${aceso}</g>
      <circle cx="${c}" cy="${c}" r="${rDisco + (pequeno ? 3 : 7)}" fill="url(#${id}h)"/>
      <circle cx="${c}" cy="${c}" r="${rDisco}" fill="url(#${id}d)"/>
      <circle cx="${c}" cy="${c}" r="${rDisco - 0.5}" fill="none" stroke="url(#${id}r)" stroke-width="${pequeno ? 1 : 1.4}"/>
      ${ponteiro}
      <text x="${c}" y="${c + (sub ? (pequeno ? 2 : size * 0.02) : size * 0.07)}" text-anchor="middle" class="ring-num" style="font-size:${size * (pequeno ? 0.22 : 0.2)}px">${label ?? v}<tspan class="ring-pct" style="font-size:${size * 0.085}px" dx="2">${label ? '' : '%'}</tspan></text>
      ${sub ? `<text x="${c}" y="${c + size * (pequeno ? 0.15 : 0.12)}" text-anchor="middle" class="ring-sub" style="font-size:${Math.max(9, size * 0.058)}px">${escT(sub)}</text>` : ''}
    </svg>`;
  }

  /* Anéis concêntricos: um por categoria (ex.: situação das tarefas), cada um com a sua proporção */
  function aneis(segs, { size = 190, center = '', sub = '' } = {}) {
    const c = size / 2, total = segs.reduce((a, s) => a + s.value, 0) || 1, n = segs.length;
    // Os anéis ocupam a faixa entre a moldura e um miolo livre para o total
    const rMax = c - 9, rMin = size * 0.23, gap = (rMax - rMin) / n, sw = Math.max(3, Math.min(8, gap - 3.5));
    const r0 = rMax - sw / 2;
    let out = `<circle cx="${c}" cy="${c}" r="${c - 1.5}" class="aro"/>`;
    for (let k = 0; k < 72; k++) { const g = -90 + k * 5, maior = k % 18 === 0; const [x0, y0] = P(c, c - 1.5, g), [x1, y1] = P(c, c - (maior ? 5.5 : 3.5), g); out += `<line x1="${x0.toFixed(2)}" y1="${y0.toFixed(2)}" x2="${x1.toFixed(2)}" y2="${y1.toFixed(2)}" class="esc ${maior ? 'maior' : ''}"/>`; }
    segs.forEach((s, k) => {
      const r = r0 - k * gap, frac = s.value / total, g1 = -90 + Math.max(0, Math.min(359.4, frac * 360));
      out += `<circle cx="${c}" cy="${c}" r="${r}" class="arco-trilho" stroke-width="${sw}" fill="none"/>`;
      if (s.value > 0) {
        const d = frac >= 0.999 ? `M${c},${c - r} A${r},${r} 0 1 1 ${c - 0.01},${c - r}` : arco(c, r, -90, g1);
        const [px, py] = P(c, r, g1);
        out += `<path d="${d}" fill="none" stroke-width="${sw}" stroke-linecap="round" style="stroke:${s.color}" data-tip="${escT(s.label)}: ${s.value} (${Math.round(frac * 100)}%)"/><circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="${sw * 0.32}" class="ponteiro-ponto"/>`;
      }
    });
    const rIn = rMin - 3;
    return `<svg class="donut aneis" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img">${out}
      <circle cx="${c}" cy="${c}" r="${Math.max(10, rIn)}" class="disco-aneis"/>
      <text x="${c}" y="${c + 3}" text-anchor="middle" class="ring-num" style="font-size:${size * 0.15}px">${escT(center)}</text>
      <text x="${c}" y="${c + size * 0.1}" text-anchor="middle" class="ring-sub" style="font-size:${size * 0.058}px">${escT(sub)}</text>
    </svg>`;
  }

  /* Rosca com segmentos */
  function donut(segs, { size = 170, stroke = 16, center = '', sub = '' } = {}) {
    const c = size / 2, r = c - stroke / 2 - 10, C = 2 * Math.PI * r;
    const total = segs.reduce((a, s) => a + s.value, 0);
    const live = segs.filter(s => s.value > 0);
    let off = 0;
    const gap = live.length > 1 ? 4 : 0;
    const arcs = total ? live.map(s => {
      const len = (C * s.value) / total;
      const out = `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke-width="${stroke}" stroke-dasharray="${Math.max(len - gap, 0.5)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 ${c} ${c})" style="stroke:${s.color}" data-tip="${escT(s.label)}: ${s.value} (${Math.round(s.value / total * 100)}%)"></circle>`;
      off += len;
      return out;
    }).join('') : '';
    let moldura = `<circle cx="${c}" cy="${c}" r="${c - 1.5}" class="aro"/>`;
    for (let k = 0; k < 60; k++) { const g = -90 + k * 6, maior = k % 15 === 0; const [x0, y0] = P(c, c - 1.5, g), [x1, y1] = P(c, c - (maior ? 5.5 : 3.5), g); moldura += `<line x1="${x0.toFixed(2)}" y1="${y0.toFixed(2)}" x2="${x1.toFixed(2)}" y2="${y1.toFixed(2)}" class="esc ${maior ? 'maior' : ''}"/>`; }
    return `<svg class="donut instrumento-rosca" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img">
      ${moldura}
      <circle cx="${c}" cy="${c}" r="${r - stroke / 2 - 4}" class="disco-aneis"/>
      <circle cx="${c}" cy="${c}" r="${r}" fill="none" class="ring-track" stroke-width="${stroke}"/>
      ${arcs}
      <text x="${c}" y="${c + 4}" text-anchor="middle" class="ring-num" style="font-size:${size * 0.2}px">${escT(center)}</text>
      <text x="${c}" y="${c + size * 0.14}" text-anchor="middle" class="ring-sub" style="font-size:${size * 0.075}px">${escT(sub)}</text>
    </svg>`;
  }

  /* Barras verticais (ex.: entregas por semana) */
  function bars(values, labels, { h = 150 } = {}) {
    const max = Math.max(1, ...values);
    const last = values.length - 1;
    return `<div class="vbars" style="height:${h}px">${values.map((v, i) => `
      <div class="vbar ${i === last ? 'is-now' : ''}" title="${v} concluída(s)">
        <span class="vbar-val">${v}</span>
        <span class="vbar-fill" style="height:${Math.max(4, (v / max) * 100)}%"></span>
        <span class="vbar-lbl">${escT(labels[i])}</span>
      </div>`).join('')}</div>`;
  }

  /* Área acumulada (ex.: tarefas concluídas ao longo do tempo) */
  function area(values, { w = 560, h = 180, labels = [], total = null } = {}) {
    const id = gid('ar');
    const padL = 6, padR = 14, padT = 18, padB = 26;
    const max = Math.max(1, total ?? 0, ...values);
    const nn = values.length;
    const X = i => padL + (i * (w - padL - padR)) / Math.max(1, nn - 1);
    const Y = v => h - padB - (v / max) * (h - padT - padB);
    const pts = values.map((v, i) => [X(i), Y(v)]);
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], mx = (x0 + x1) / 2;
      d += ` C${mx},${y0} ${mx},${y1} ${x1},${y1}`;
    }
    const fill = `${d} L${pts[pts.length - 1][0]},${h - padB} L${pts[0][0]},${h - padB} Z`;
    const [lx, ly] = pts[pts.length - 1];
    const grid = [0.25, 0.5, 0.75, 1].map(f => `<line x1="${padL}" x2="${w - padR}" y1="${Y(max * f)}" y2="${Y(max * f)}" class="grid"/>`).join('');
    const goal = total ? `<line x1="${padL}" x2="${w - padR}" y1="${Y(total)}" y2="${Y(total)}" class="goal"/><text x="${w - padR}" y="${Y(total) - 6}" text-anchor="end" class="axis">Total: ${total}</text>` : '';
    const lbls = labels.map(([i, t]) => `<text x="${X(i)}" y="${h - 6}" text-anchor="${i === 0 ? 'start' : i === nn - 1 ? 'end' : 'middle'}" class="axis">${escT(t)}</text>`).join('');
    return `<svg class="area" viewBox="0 0 ${w} ${h}" role="img">
      <defs>
        <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--acc);stop-opacity:.35"/><stop offset="1" style="stop-color:var(--acc);stop-opacity:0"/></linearGradient>
        <filter id="${id}f" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4"/></filter>
      </defs>
      ${grid}${goal}
      <path d="${fill}" fill="url(#${id})"/>
      <path d="${d}" fill="none" class="area-line" vector-effect="non-scaling-stroke"/>
      <circle cx="${lx}" cy="${ly}" r="7" class="area-glow" filter="url(#${id}f)"/>
      <circle cx="${lx}" cy="${ly}" r="3.5" class="area-dot"/>
      ${lbls}
    </svg>`;
  }

  /* Peça central do projeto: etapas ligadas a um anel de luz.
     O arco aceso do anel mostra o percentual do projeto. */
  function pipeline(stages, pct, { onClick = 'goto-stage' } = {}) {
    const W = 1000, cardW = 262, cardH = 84, gap = 26;
    const nS = stages.length;
    if (!nS) return '';
    const L = Math.ceil(nS / 2), R = nS - L;
    const rows = Math.max(L, R);
    const top = 16;
    const blockBottom = top + rows * (cardH + gap) - gap;
    const cx = W / 2, rx = 270, ry = 74;
    const cy = blockBottom + 70 + ry;
    const H = cy + ry + 70;
    const spread = rx * 0.58;
    const anchor = i => (nS === 1 ? cx : cx - spread + (i * 2 * spread) / (nS - 1));
    const anchorMin = anchor(0);
    const stag = L > 1 ? Math.min(30, Math.max(0, (anchorMin - 34 - cardW - 16) / (L - 1))) : 0;
    const rowY = rFromBottom => blockBottom - cardH - rFromBottom * (cardH + gap);
    const id = gid('pl');
    const rad = 18;
    const lineEnd = cy - ry * 0.4;

    const items = stages.map((s, i) => {
      let x, y, side;
      if (i < L) { side = 'l'; const r = i; x = 16 + r * stag; y = rowY(r); }
      else { side = 'r'; const j = i - L; const r = R - 1 - j; x = W - 16 - cardW - r * stag; y = rowY(r); }
      const ax = anchor(i), my = y + cardH / 2;
      let path;
      if (side === 'l') {
        const sx = x + cardW;
        path = `M${sx},${my} H${ax - rad} Q${ax},${my} ${ax},${my + rad} V${lineEnd}`;
      } else {
        const sx = x;
        path = `M${sx},${my} H${ax + rad} Q${ax},${my} ${ax},${my + rad} V${lineEnd}`;
      }
      return { s, x, y, side, path, ax };
    });

    const lines = items.map(it => `<path d="${it.path}" class="pl-line pl-${it.s.state}"/>`).join('');
    const cards = items.map(it => `
      <foreignObject x="${it.x}" y="${it.y}" width="${cardW}" height="${cardH}">
        <button xmlns="http://www.w3.org/1999/xhtml" class="pl-card pl-${it.s.state} side-${it.side}" data-act="${onClick}" data-id="${it.s.id}">
          <span class="pl-name"><span class="pl-num">${it.s.index}</span><span class="pl-txt">${escT(it.s.name)}</span></span>
          <span class="pl-meta">${escT(it.s.meta)}</span>
          <span class="pl-bar"><i style="width:${it.s.pct}%"></i></span>
        </button>
      </foreignObject>`).join('');

    const ell = `M${cx - rx},${cy} A${rx},${ry} 0 1 0 ${cx + rx},${cy} A${rx},${ry} 0 1 0 ${cx - rx},${cy}`;
    return `<svg class="pipeline" viewBox="0 0 ${W} ${H}" role="img" aria-label="Etapas do projeto, ${pct}% concluído">
      <defs>
        <radialGradient id="${id}halo" cx="50%" cy="50%" r="50%"><stop offset="0" style="stop-color:var(--acc);stop-opacity:.0"/><stop offset=".55" style="stop-color:var(--acc);stop-opacity:.10"/><stop offset=".8" style="stop-color:var(--acc-2);stop-opacity:.22"/><stop offset="1" style="stop-color:var(--acc-2);stop-opacity:0"/></radialGradient>
        <linearGradient id="${id}arc" x1="0" y1="0" x2="1" y2="0"><stop offset="0" style="stop-color:var(--acc-2)"/><stop offset=".5" style="stop-color:var(--acc-3)"/><stop offset="1" style="stop-color:var(--acc)"/></linearGradient>
        <filter id="${id}blur" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="14"/></filter>
        <filter id="${id}soft" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="5"/></filter>
      </defs>
      <ellipse cx="${cx}" cy="${cy + 26}" rx="${rx * 1.32}" ry="${ry * 1.45}" fill="url(#${id}halo)"/>
      <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" class="pl-track" stroke-width="34"/>
      ${lines}
      ${pct > 0 ? `
      <path d="${ell}" pathLength="100" fill="none" stroke="url(#${id}arc)" stroke-width="40" stroke-dasharray="${pct} 100" filter="url(#${id}blur)" opacity=".9" class="pl-arc" style="--p:${pct}"/>
      <path d="${ell}" pathLength="100" fill="none" stroke="url(#${id}arc)" stroke-width="30" stroke-dasharray="${pct} 100" stroke-linecap="round" class="pl-arc" style="--p:${pct}"/>
      <path d="${ell}" pathLength="100" fill="none" stroke-width="6" stroke-dasharray="${pct} 100" stroke-linecap="round" filter="url(#${id}soft)" class="pl-arc pl-core" style="--p:${pct}"/>` : ''}
      ${cards}
      <text x="${cx}" y="${cy + 30}" text-anchor="middle" class="pl-pct">${pct}<tspan class="pl-pct-s" dx="4">%</tspan></text>
      <text x="${cx}" y="${cy + ry + 54}" text-anchor="middle" class="pl-caption">do projeto pronto</text>
    </svg>`;
  }

  /* Linhas (uma escala só). series: [{ nome, valores, cor, tracejado }], rotulos: texto de cada ponto (dica), marcas: [[i, texto]] no eixo */
  function linhas(series, { w = 640, h = 220, rotulos = [], marcas = [], max = null } = {}) {
    const padL = 34, padR = 14, padT = 14, padB = 28;
    const n = Math.max(...series.map(s => s.valores.length));
    const topo = Math.max(1, max ?? 0, ...series.flatMap(s => s.valores.filter(v => v != null)));
    const X = i => padL + (i * (w - padL - padR)) / Math.max(1, n - 1);
    const Y = v => h - padB - (v / topo) * (h - padT - padB);
    const passos = [0, 0.5, 1].map(f => Math.round(topo * f));
    const grade = passos.map(v => `<line x1="${padL}" x2="${w - padR}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/><text x="${padL - 8}" y="${Y(v) + 4}" text-anchor="end" class="axis">${v}</text>`).join('');
    const caminhos = series.map(s => {
      const pts = s.valores.map((v, i) => (v == null ? null : [X(i), Y(v)])).filter(Boolean);
      if (!pts.length) return '';
      const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
      const [lx, ly] = pts[pts.length - 1];
      return `<path d="${d}" fill="none" stroke="${s.cor}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" ${s.tracejado ? 'stroke-dasharray="5 5" opacity=".75"' : ''} vector-effect="non-scaling-stroke"/>${s.tracejado ? '' : `<circle cx="${lx}" cy="${ly}" r="4" fill="${s.cor}" stroke="var(--fundo)" stroke-width="2"/>`}`;
    }).join('');
    const eixo = marcas.map(([i, t]) => `<text x="${X(i)}" y="${h - 8}" text-anchor="${i === 0 ? 'start' : i >= n - 1 ? 'end' : 'middle'}" class="axis">${escT(t)}</text>`).join('');
    // Faixas invisíveis por ponto: passar o mouse mostra a linha guia e os valores
    const larg = (w - padL - padR) / Math.max(1, n - 1);
    const faixas = Array.from({ length: n }, (_, i) => {
      const dica = `${escT(rotulos[i] || '')}${series.map(s => s.valores[i] == null ? '' : `|${escT(s.nome)}: ${s.valores[i]}`).join('')}`;
      return `<g class="hit" data-tip="${dica}"><rect x="${X(i) - larg / 2}" y="${padT}" width="${larg}" height="${h - padT - padB}" fill="transparent"/><line class="cruz" x1="${X(i)}" x2="${X(i)}" y1="${padT}" y2="${h - padB}"/></g>`;
    }).join('');
    return `<svg class="viz-linhas" viewBox="0 0 ${w} ${h}" role="img">${grade}${caminhos}${eixo}${faixas}</svg>`;
  }

  /* Colunas empilhadas (uma por grupo). series: [{ nome, cor }], grupos: [{ nome, valores: [] }] */
  function colunas(grupos, series, { h = 220 } = {}) {
    const topo = Math.max(1, ...grupos.map(g => g.valores.reduce((a, b) => a + b, 0)));
    return `<div class="viz-colunas" style="--h:${h}px">${grupos.map(g => {
      const tot = g.valores.reduce((a, b) => a + b, 0);
      const segs = g.valores.map((v, i) => v ? `<i class="seg-col" style="height:${(v / topo) * 100}%;background:${series[i].cor}" data-tip="${escT(g.nome)}|${escT(series[i].nome)}: ${v}"></i>` : '').join('');
      return `<div class="col-viz"><b class="col-tot">${tot}</b><div class="col-pilha">${segs}</div><span class="col-nome" title="${escT(g.nome)}">${escT(g.nome)}</span></div>`;
    }).join('')}</div>`;
  }
  const legenda = series => `<div class="viz-legenda">${series.map(s => `<span><i style="background:${s.cor}${s.tracejado ? ';height:2px;border-radius:0' : ''}"></i>${escT(s.nome)}</span>`).join('')}</div>`;

  /* Trilho fino com escala e ponto de luz na ponta (barras de progresso do painel) */
  const trilho = pct => `<span class="trilho-luz" style="--p:${Math.max(0, Math.min(100, pct))}%" role="img" aria-label="${pct}%"><i></i><b></b></span>`;

  /* Meia-lua: arco fino sobre uma faixa de risquinhos, com uma marca no valor e o percentual grande no centro */
  function meiaLua(pct, { cor = 'var(--acc)', rotulo = '', detalhe = '' } = {}) {
    const v = Math.max(0, Math.min(100, Number(pct) || 0));
    const w = 240, h = 132, cx = w / 2, cy = h - 8, r = 104, g = 180 + (180 * v) / 100;
    let riscos = '';
    for (let a = 181; a < 360; a += 2.4) { const [x0, y0] = P(cx, r - 9, a), [x1, y1] = P(cx, r - 24, a); riscos += `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}"/>`; }
    const [m0x, m0y] = P(cx, r - 9, g), [m1x, m1y] = P(cx, r + 9, g);
    const inteiro = Math.floor(v), dec = (v - inteiro).toFixed(2).slice(1).replace('.', ',');
    return `<div class="meia-lua" style="--cor:${cor}">
      <div class="ml-cab"><span class="ml-ponto"></span><b>${escT(rotulo)}</b><small>${escT(detalhe)}</small></div>
      <div class="ml-corpo">
        <svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${escT(rotulo)}: ${v.toFixed(1).replace('.', ',')}%">
          <g class="ml-riscos">${riscos}</g>
          <path d="${arco(cx, r, 180, 360)}" class="ml-trilho" fill="none"/>
          ${v > 0 ? `<path d="${arco(cx, r, 180, Math.max(180.5, g))}" class="ml-valor" fill="none"/>` : ''}
          <line x1="${m0x.toFixed(1)}" y1="${m0y.toFixed(1)}" x2="${m1x.toFixed(1)}" y2="${m1y.toFixed(1)}" class="ml-marca"/>
        </svg>
        <div class="ml-num"><b>${inteiro}</b><span>${dec}%</span></div>
      </div>
    </div>`;
  }

  return { ring, donut, aneis, trilho, meiaLua, bars, area, pipeline, linhas, colunas, legenda };
})();

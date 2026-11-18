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
  function ring(pct, { size = 150, stroke = 11, label, sub, animate = false } = {}) {
    const c = size / 2, r = c - stroke / 2 - 8, C = 2 * Math.PI * r, id = gid('rg');
    const len = (C * Math.max(0, Math.min(100, pct))) / 100;
    const arc = pct > 0
      ? `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="url(#${id})" stroke-width="${stroke}" stroke-dasharray="${len} ${C}" stroke-linecap="round" transform="rotate(-90 ${c} ${c})" filter="url(#${id}f)" opacity=".75" class="${animate ? 'draw' : ''}" style="--len:${len};--C:${C}"/>
         <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="url(#${id})" stroke-width="${stroke}" stroke-dasharray="${len} ${C}" stroke-linecap="round" transform="rotate(-90 ${c} ${c})" class="${animate ? 'draw' : ''}" style="--len:${len};--C:${C}"/>`
      : '';
    return `<svg class="ring" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${pct}% concluído">
      <defs>
        <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--acc-3)"/><stop offset=".55" style="stop-color:var(--acc)"/><stop offset="1" style="stop-color:var(--acc-2)"/></linearGradient>
        <filter id="${id}f" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${stroke * 0.55}"/></filter>
      </defs>
      <circle cx="${c}" cy="${c}" r="${r}" fill="none" class="ring-track" stroke-width="${stroke}"/>
      ${arc}
      <text x="${c}" y="${c + (sub ? 2 : size * 0.07)}" text-anchor="middle" class="ring-num" style="font-size:${size * 0.24}px">${label ?? pct}<tspan class="ring-pct" style="font-size:${size * 0.11}px" dx="2">${label ? '' : '%'}</tspan></text>
      ${sub ? `<text x="${c}" y="${c + size * 0.15}" text-anchor="middle" class="ring-sub" style="font-size:${Math.max(10, size * 0.075)}px">${escT(sub)}</text>` : ''}
    </svg>`;
  }

  /* Rosca com segmentos */
  function donut(segs, { size = 170, stroke = 16, center = '', sub = '' } = {}) {
    const c = size / 2, r = c - stroke / 2 - 6, C = 2 * Math.PI * r;
    const total = segs.reduce((a, s) => a + s.value, 0);
    const live = segs.filter(s => s.value > 0);
    let off = 0;
    const gap = live.length > 1 ? 4 : 0;
    const arcs = total ? live.map(s => {
      const len = (C * s.value) / total;
      const out = `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke-width="${stroke}" stroke-dasharray="${Math.max(len - gap, 0.5)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 ${c} ${c})" style="stroke:${s.color}"><title>${escT(s.label)}: ${s.value}</title></circle>`;
      off += len;
      return out;
    }).join('') : '';
    return `<svg class="donut" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img">
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
    const lineEnd = cy - ry * 0.25;

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
      <text x="${cx}" y="${cy + ry + 52}" text-anchor="middle" class="pl-caption">${pct}% do projeto concluído</text>
    </svg>`;
  }

  return { ring, donut, bars, area, pipeline };
})();

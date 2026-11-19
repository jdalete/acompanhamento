/* Prints dos entregáveis guardados neste navegador (IndexedDB, que aguenta bem mais que o localStorage).
   Cada imagem tem duas versões: a cheia (para o zoom) e a miniatura (para a grade). */
const Imagens = (() => {
  const NOME = 'gestao-projetos-imagens';
  let conexao;
  function abrir() {
    return conexao || (conexao = new Promise((ok, erro) => {
      const r = indexedDB.open(NOME, 1);
      r.onupgradeneeded = () => { r.result.createObjectStore('img'); r.result.createObjectStore('estado'); };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => { conexao = null; erro(r.error); };
    }));
  }
  async function pedir(lojas, modo, fn) {
    const db = await abrir();
    return new Promise((ok, erro) => {
      const t = db.transaction(lojas, modo);
      let saida;
      const req = fn(...[].concat(lojas).map(n => t.objectStore(n)));
      if (req && 'onsuccess' in req) req.onsuccess = () => { saida = req.result; };
      t.oncomplete = () => ok(saida);
      t.onerror = () => erro(t.error);
      t.onabort = () => erro(t.error);
    });
  }
  const pegar = id => pedir('img', 'readonly', s => s.get(id));
  const guardar = (id, dados, enviada = false) => pedir(['img', 'estado'], 'readwrite', (i, e) => { i.put(dados, id); e.put({ enviada }, id); });
  const marcarEnviada = id => pedir('estado', 'readwrite', e => e.put({ enviada: true }, id));
  const apagar = id => pedir(['img', 'estado'], 'readwrite', (i, e) => { i.delete(id); e.delete(id); });
  async function estados() {
    const db = await abrir();
    return new Promise((ok, erro) => {
      const t = db.transaction('estado', 'readonly'), out = [];
      const c = t.objectStore('estado').openCursor();
      c.onsuccess = () => { const cur = c.result; if (cur) { out.push([cur.key, cur.value]); cur.continue(); } };
      t.oncomplete = () => ok(out);
      t.onerror = () => erro(t.error);
    });
  }

  /* Reduz o print para um tamanho leve sem perder a leitura do texto */
  function codificar(canvas, q) {
    const w = canvas.toDataURL('image/webp', q);
    return w.startsWith('data:image/webp') ? w : canvas.toDataURL('image/jpeg', q);
  }
  async function bitmap(arquivo) {
    if (window.createImageBitmap) { try { return await createImageBitmap(arquivo); } catch (e) { /* tenta pelo <img> */ } }
    const url = URL.createObjectURL(arquivo);
    try {
      const im = new Image();
      await new Promise((ok, erro) => { im.onload = ok; im.onerror = erro; im.src = url; });
      return im;
    } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
  }
  function desenhar(fonte, w0, h0, maior) {
    const k = Math.min(1, maior / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * k)), h = Math.max(1, Math.round(h0 * k));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); // fundo branco para PNG transparente não ficar preto
    g.imageSmoothingQuality = 'high';
    g.drawImage(fonte, 0, 0, w, h);
    return { c, w, h };
  }
  async function preparar(arquivo) {
    const bm = await bitmap(arquivo);
    const w0 = bm.width || bm.naturalWidth, h0 = bm.height || bm.naturalHeight;
    if (!w0 || !h0) throw new Error('imagem vazia');
    const cheia = desenhar(bm, w0, h0, 2000);
    let full = codificar(cheia.c, 0.84);
    if (full.length > 2600000) full = codificar(cheia.c, 0.7);
    const mini = desenhar(bm, w0, h0, 520);
    const thumb = codificar(mini.c, 0.74);
    if (bm.close) bm.close();
    return { full, thumb, w: cheia.w, h: cheia.h };
  }

  return { pegar, guardar, marcarEnviada, apagar, estados, preparar };
})();

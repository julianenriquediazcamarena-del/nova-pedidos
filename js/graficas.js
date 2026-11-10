// Gráficas en SVG sin librerías (funcionan sin internet): líneas, columnas y barras horizontales.
// Marcas delgadas, rejilla tenue, tooltip al pasar el mouse o con el teclado.
(function (A) {
  const u = A.u;
  const NS = 'http://www.w3.org/2000/svg';

  function compacto(n) {
    const a = Math.abs(n);
    if (a >= 1e6) return `$${u.num(n / 1e6)}M`;
    if (a >= 1e3) return `$${u.num(Math.round(n / 100) / 10)}K`;
    return `$${Math.round(n)}`;
  }
  // Escala "bonita": 0, 5K, 10K…
  function escala(min, max, pasos = 4) {
    if (max === min) max = min + 1;
    const bruto = (max - min) / pasos;
    const mag = Math.pow(10, Math.floor(Math.log10(bruto)));
    const paso = [1, 2, 2.5, 5, 10].map(m => m * mag).find(p => p >= bruto);
    const lo = Math.floor(min / paso) * paso, hi = Math.ceil(max / paso) * paso;
    const ticks = [];
    for (let v = lo; v <= hi + paso / 2; v += paso) ticks.push(Math.round(v * 100) / 100);
    return { lo, hi, ticks };
  }
  function el(tag, attrs = {}, padre) {
    const e = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
    if (padre) padre.appendChild(e);
    return e;
  }
  function texto(padre, x, y, contenido, attrs = {}) {
    const t = el('text', { x, y, ...attrs }, padre);
    t.textContent = contenido;
    return t;
  }
  // Columna con la punta redondeada (4px) y la base recta.
  function columna(x, y0, y1, w) {
    const alto = Math.abs(y1 - y0);
    const r = Math.min(4, w / 2, alto);
    if (y1 <= y0) return `M${x},${y0} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + w - r} Q${x + w},${y1} ${x + w},${y1 + r} V${y0} Z`;
    return `M${x},${y0} V${y1 - r} Q${x},${y1} ${x + r},${y1} H${x + w - r} Q${x + w},${y1} ${x + w},${y1 - r} V${y0} Z`;
  }

  function tooltip(cont) {
    let t = cont.querySelector('.viz-tip');
    if (!t) { t = document.createElement('div'); t.className = 'viz-tip'; t.hidden = true; cont.appendChild(t); }
    return {
      mostrar(x, y, titulo, filas, extra) {
        t.replaceChildren();
        const h = document.createElement('div'); h.className = 'viz-tip-titulo'; h.textContent = titulo; t.appendChild(h);
        filas.forEach(f => {
          const r = document.createElement('div'); r.className = 'viz-tip-fila';
          if (f.color) { const k = document.createElement('span'); k.className = 'viz-clave-linea'; k.style.background = f.color; r.appendChild(k); }
          const v = document.createElement('strong'); v.textContent = f.valor; r.appendChild(v);
          const n = document.createElement('span'); n.textContent = f.nombre; r.appendChild(n);
          t.appendChild(r);
        });
        (extra || []).forEach(x2 => { const r = document.createElement('div'); r.className = 'viz-tip-extra'; r.textContent = x2; t.appendChild(r); });
        t.hidden = false;
        const ancho = cont.clientWidth, tw = t.offsetWidth;
        t.style.left = Math.max(0, Math.min(ancho - tw, x + 12)) + 'px';
        t.style.top = Math.max(0, y - 10) + 'px';
      },
      ocultar() { t.hidden = true; },
    };
  }

  // Vuelve a dibujar al cambiar el ancho del contenedor.
  function responsivo(cont, dibujar) {
    dibujar();
    if (!window.ResizeObserver) return;
    if (cont._ro) cont._ro.disconnect();
    let ancho = cont.clientWidth;
    const ro = cont._ro = new ResizeObserver(() => { if (Math.abs(cont.clientWidth - ancho) > 4) { ancho = cont.clientWidth; dibujar(); } });
    ro.observe(cont);
  }

  A.graficas = {
    compacto,

    // series: [{ nombre, valores[], color }]; marcadores: [{ indice, numero, titulo }]
    lineas(cont, { etiquetas, titulos, series, marcadores = [], seleccionado, formato = u.dinero, alElegir }) {
      cont.classList.add('viz');
      responsivo(cont, () => {
        cont.querySelectorAll('svg').forEach(s => s.remove());
        const W = Math.max(280, cont.clientWidth), H = 250;
        const m = { izq: 52, der: 58, arr: marcadores.length ? 26 : 12, aba: 28 };
        const iw = W - m.izq - m.der, ih = H - m.arr - m.aba;
        const todos = series.flatMap(s => s.valores);
        const esc = escala(Math.min(0, ...todos), Math.max(0, ...todos));
        const n = etiquetas.length;
        const x = i => m.izq + (n === 1 ? iw / 2 : (i * iw) / (n - 1));
        const y = v => m.arr + ih - ((v - esc.lo) / (esc.hi - esc.lo)) * ih;
        const svg = el('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', tabindex: 0, 'aria-label': series.map(s => s.nombre).join(' y ') });
        cont.insertBefore(svg, cont.firstChild);

        if (seleccionado != null) {
          const paso = n > 1 ? iw / (n - 1) : iw;
          el('rect', { x: x(seleccionado) - paso / 2, y: m.arr, width: paso, height: ih, class: 'viz-banda' }, svg);
        }
        esc.ticks.forEach(t => {
          el('line', { x1: m.izq, x2: W - m.der, y1: y(t), y2: y(t), class: t === 0 ? 'viz-base' : 'viz-rejilla' }, svg);
          texto(svg, m.izq - 8, y(t) + 4, compacto(t), { class: 'viz-eje', 'text-anchor': 'end' });
        });
        const cada = Math.ceil(n / Math.max(1, Math.floor(iw / 58)));
        etiquetas.forEach((e, i) => {
          if ((n - 1 - i) % cada === 0) texto(svg, x(i), H - 8, e, { class: 'viz-eje', 'text-anchor': 'middle' });
        });
        // Estrategias de la bitácora: línea fina y número arriba.
        marcadores.forEach(mk => {
          el('line', { x1: x(mk.indice), x2: x(mk.indice), y1: m.arr - 6, y2: m.arr + ih, class: 'viz-marca' }, svg);
          el('circle', { cx: x(mk.indice), cy: m.arr - 13, r: 9, class: 'viz-marca-punto' }, svg);
          texto(svg, x(mk.indice), m.arr - 9, String(mk.numero), { class: 'viz-marca-num', 'text-anchor': 'middle' });
        });
        const finales = [];
        series.forEach(s => {
          el('path', { d: s.valores.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' '), class: 'viz-linea', style: `stroke:${s.color}` }, svg);
          const ult = s.valores.length - 1;
          el('circle', { cx: x(ult), cy: y(s.valores[ult]), r: 4, class: 'viz-punto', style: `fill:${s.color}` }, svg);
          finales.push({ y: y(s.valores[ult]), txt: compacto(s.valores[ult]) });
        });
        // Etiqueta del último valor; si chocan, solo la primera serie (el resto queda en la leyenda y el tooltip).
        finales.forEach((f, i) => {
          if (finales.slice(0, i).some(o => Math.abs(o.y - f.y) < 14)) return;
          texto(svg, x(n - 1) + 8, f.y + 4, f.txt, { class: 'viz-valor' });
        });

        const cruz = el('line', { y1: m.arr, y2: m.arr + ih, class: 'viz-cruz', visibility: 'hidden' }, svg);
        const tip = tooltip(cont);
        let actual = seleccionado ?? n - 1;
        const mostrar = i => {
          actual = i;
          cruz.setAttribute('x1', x(i)); cruz.setAttribute('x2', x(i)); cruz.setAttribute('visibility', 'visible');
          const ests = marcadores.filter(mk => mk.indice === i).map(mk => `${mk.numero}. ${mk.titulo}`);
          tip.mostrar(x(i), m.arr, (titulos || etiquetas)[i], series.map(s => ({ nombre: s.nombre, valor: formato(s.valores[i]), color: s.color })), ests);
        };
        const ocultar = () => { cruz.setAttribute('visibility', 'hidden'); tip.ocultar(); };
        const indice = ev => {
          const r = svg.getBoundingClientRect();
          const px = (ev.clientX - r.left) * (W / r.width);
          return Math.max(0, Math.min(n - 1, Math.round(((px - m.izq) / iw) * (n - 1))));
        };
        const capa = el('rect', { x: m.izq - 10, y: 0, width: iw + 20, height: H, fill: 'transparent', style: alElegir ? 'cursor:pointer' : '' }, svg);
        capa.addEventListener('pointermove', ev => mostrar(indice(ev)));
        capa.addEventListener('pointerleave', ocultar);
        if (alElegir) capa.addEventListener('click', ev => alElegir(indice(ev)));
        svg.addEventListener('focus', () => mostrar(actual));
        svg.addEventListener('blur', ocultar);
        svg.addEventListener('keydown', ev => {
          if (ev.key === 'ArrowLeft') { ev.preventDefault(); mostrar(Math.max(0, actual - 1)); }
          if (ev.key === 'ArrowRight') { ev.preventDefault(); mostrar(Math.min(n - 1, actual + 1)); }
          if (ev.key === 'Enter' && alElegir) alElegir(actual);
        });
      });
    },

    columnas(cont, { etiquetas, titulos, valores, nombre, color, seleccionado, formato = v => String(v), formatoCorto = v => String(v), alElegir }) {
      cont.classList.add('viz');
      responsivo(cont, () => {
        cont.querySelectorAll('svg').forEach(s => s.remove());
        const W = Math.max(280, cont.clientWidth), H = 190;
        const m = { izq: 36, der: 12, arr: 18, aba: 28 };
        const iw = W - m.izq - m.der, ih = H - m.arr - m.aba;
        const n = valores.length;
        const esc = escala(0, Math.max(1, ...valores), 3);
        const banda = iw / n;
        const bw = Math.min(24, banda - 6);
        const y = v => m.arr + ih - (v / esc.hi) * ih;
        const svg = el('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': nombre }, null);
        cont.insertBefore(svg, cont.firstChild);
        if (seleccionado != null) el('rect', { x: m.izq + seleccionado * banda, y: m.arr, width: banda, height: ih, class: 'viz-banda' }, svg);
        esc.ticks.forEach(t => {
          el('line', { x1: m.izq, x2: W - m.der, y1: y(t), y2: y(t), class: t === 0 ? 'viz-base' : 'viz-rejilla' }, svg);
          texto(svg, m.izq - 8, y(t) + 4, String(t), { class: 'viz-eje', 'text-anchor': 'end' });
        });
        const cada = Math.ceil(n / Math.max(1, Math.floor(iw / 58)));
        const tip = tooltip(cont);
        valores.forEach((v, i) => {
          const cx = m.izq + i * banda + banda / 2;
          if ((n - 1 - i) % cada === 0) texto(svg, cx, H - 8, etiquetas[i], { class: 'viz-eje', 'text-anchor': 'middle' });
          if (v > 0) el('path', { d: columna(cx - bw / 2, y(0), y(v), bw), class: 'viz-col', style: `fill:${color}` }, svg);
          if (i === seleccionado) texto(svg, cx, y(v) - 6, formatoCorto(v), { class: 'viz-valor', 'text-anchor': 'middle' });
          const hit = el('rect', { x: m.izq + i * banda, y: m.arr, width: banda, height: ih, fill: 'transparent', tabindex: 0, style: alElegir ? 'cursor:pointer' : '' }, svg);
          const ver = () => tip.mostrar(cx, y(v), (titulos || etiquetas)[i], [{ nombre, valor: formato(v), color }]);
          hit.addEventListener('pointerenter', ver);
          hit.addEventListener('focus', ver);
          hit.addEventListener('pointerleave', () => tip.ocultar());
          hit.addEventListener('blur', () => tip.ocultar());
          if (alElegir) { hit.addEventListener('click', () => alElegir(i)); hit.addEventListener('keydown', ev => { if (ev.key === 'Enter') alElegir(i); }); }
        });
      });
    },

    // items: [[nombre, valor]]; barras horizontales en HTML con el valor en la punta.
    barras(cont, { items, color, formato = u.dinero, vacio = 'Sin datos en este periodo.' }) {
      cont.classList.add('viz');
      if (!items.length) { cont.innerHTML = `<div class="vacio">${u.esc(vacio)}</div>`; return; }
      const max = Math.max(...items.map(i => i[1]), 1);
      const total = items.reduce((s, i) => s + i[1], 0);
      cont.replaceChildren();
      const tip = tooltip(cont);
      items.forEach(([nombre, valor]) => {
        const fila = document.createElement('div'); fila.className = 'viz-barra';
        const etq = document.createElement('span'); etq.className = 'viz-barra-nombre'; etq.textContent = nombre;
        const pista = document.createElement('span'); pista.className = 'viz-barra-pista';
        const barra = document.createElement('span'); barra.className = 'viz-barra-relleno';
        barra.style.width = Math.max(1, (valor / max) * 100) + '%'; barra.style.background = color;
        const val = document.createElement('span'); val.className = 'viz-barra-valor'; val.textContent = formato(valor);
        pista.append(barra, val);
        fila.append(etq, pista);
        fila.tabIndex = 0;
        const ver = () => {
          const r = fila.getBoundingClientRect(), rc = cont.getBoundingClientRect();
          tip.mostrar(r.left - rc.left + 80, r.top - rc.top - 30, nombre, [{ nombre: `${Math.round(valor / total * 100)}% del total`, valor: formato(valor), color }]);
        };
        fila.addEventListener('pointerenter', ver); fila.addEventListener('focus', ver);
        fila.addEventListener('pointerleave', () => tip.ocultar()); fila.addEventListener('blur', () => tip.ocultar());
        cont.insertBefore(fila, cont.querySelector('.viz-tip'));
      });
    },
  };
})(window.App);

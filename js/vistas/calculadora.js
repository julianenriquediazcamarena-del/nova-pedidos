// Calculadoras: rápida, playeras, lona/vinil por medida, IVA, anticipo y margen.
(function (A) {
  const u = A.u;
  const esc = u.esc;
  const PESTANAS = [['rapida', 'Rápida'], ['playeras', 'Playeras'], ['medidas', 'Lona y vinil'], ['iva', 'IVA'], ['anticipo', 'Anticipo'], ['margen', 'Margen']];
  const pref = { pestana: 'rapida' };

  A.vistas.calculadora = {
    titulo: 'Calculadora',
    render(c) {
      c.innerHTML = `
        <div class="cabeza"><h1>Calculadora</h1></div>
        <div class="segmentos" id="cl-tab" style="margin-bottom:16px">${PESTANAS.filter(([k]) => k !== 'margen' || A.esDueno()).map(([k, t]) => `<button data-t="${k}">${t}</button>`).join('')}</div>
        <div id="cl-cuerpo"></div>`;
      let limpiar = null;
      const pintar = () => {
        if (limpiar) limpiar();
        u.$$('#cl-tab button', c).forEach(b => b.classList.toggle('activo', b.dataset.t === pref.pestana));
        c.querySelector('#cl-cuerpo').style.maxWidth = pref.pestana === 'playeras' ? '' : '640px';
        limpiar = CALCS[pref.pestana](c.querySelector('#cl-cuerpo')) || null;
      };
      c.querySelector('#cl-tab').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b) { pref.pestana = b.dataset.t; pintar(); } });
      pintar();
      return () => limpiar && limpiar();
    },
  };

  // Evalúa + − × ÷, paréntesis y % como en la calculadora del celular (449 + 16% = 520.84), sin usar eval.
  function evaluar(expr) {
    const tokens = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').match(/\d*\.?\d+|[-+*/()%]/g) || [];
    let i = 0;
    let conPct = false;
    const ver = () => tokens[i];
    const tomar = () => tokens[i++];
    function factor() {
      let t = tomar();
      if (t === '-') return -factor();
      if (t === '+') return factor();
      let v;
      if (t === '(') { v = suma(); if (ver() === ')') tomar(); conPct = false; } else v = parseFloat(t);
      if (Number.isNaN(v)) throw new Error('expresión');
      while (ver() === '%') { tomar(); v = v / 100; conPct = true; }
      return v;
    }
    function producto() {
      conPct = false;
      let v = factor();
      while (ver() === '*' || ver() === '/') { const op = tomar(); const d = factor(); v = op === '*' ? v * d : v / d; conPct = false; }
      return v;
    }
    function suma() {
      let v = producto();
      while (ver() === '+' || ver() === '-') {
        const op = tomar();
        let d = producto();
        if (conPct) d = v * d; // "a + b%" suma el b% de a
        v = op === '+' ? v + d : v - d;
      }
      return v;
    }
    const r = suma();
    if (i < tokens.length || !Number.isFinite(r)) throw new Error('expresión');
    return Math.round(r * 1e8) / 1e8;
  }

  function botonCotizar(cont, lineaFn) {
    const b = cont.querySelector('[data-cotizar]');
    if (b) b.addEventListener('click', () => { const l = lineaFn(); if (l) { A.borradorLineas = [l]; A.ir('#/cotizar'); } });
  }

  const CALCS = {
    rapida(cont) {
      let expr = '';
      cont.innerHTML = `<div class="tarjeta">
        <div class="pantalla"><div class="expr" id="cr-expr"></div><div class="res" id="cr-res">0</div></div>
        <div class="teclado" id="cr-teclas">
          ${['C', '(', ')', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '%', '0', '.', '⌫'].map(k => `<button class="${'÷×−+()%C⌫'.includes(k) ? 'op' : ''}" data-k="${k}">${k}</button>`).join('')}
          <button class="igual" data-k="=" style="grid-column:1/-1">=</button>
        </div>
        <p class="chico tenue" style="margin-top:10px">También puedes usar el teclado. El % funciona como en el celular: 449 + 16% = 520.84</p></div>`;
      const pintar = (final) => {
        cont.querySelector('#cr-expr').textContent = final ? expr + ' =' : expr;
        let r = '';
        try { r = expr ? u.num(evaluar(expr)) : '0'; } catch { r = final ? 'Error' : cont.querySelector('#cr-res').textContent; }
        cont.querySelector('#cr-res').textContent = r;
      };
      const tecla = k => {
        if (k === 'C') expr = '';
        else if (k === '⌫') expr = expr.slice(0, -1);
        else if (k === '=') {
          try { const v = evaluar(expr); pintar(true); expr = String(v); return; } catch { pintar(true); return; }
        } else expr += k;
        pintar(false);
      };
      cont.querySelector('#cr-teclas').addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) tecla(b.dataset.k); });
      const teclado = e => {
        if (e.target.matches('input, textarea, select')) return;
        const mapa = { '*': '×', '/': '÷', '-': '−', Enter: '=', '=': '=', Backspace: '⌫', Escape: 'C', Delete: 'C', ',': '.' };
        const k = mapa[e.key] || (/^[0-9.+()%]$/.test(e.key) ? e.key : null);
        if (k) { e.preventDefault(); tecla(k); }
      };
      document.addEventListener('keydown', teclado);
      return () => document.removeEventListener('keydown', teclado);
    },

    playeras(cont) {
      A.armadorPlayeras.montar(cont, {
        textoBoton: 'Cotizar estas playeras',
        alTerminar(lineas) { A.borradorLineas = lineas; A.ir('#/cotizar'); },
      });
    },

    medidas(cont) {
      const prods = A.precios.productos().filter(p => ['m²', 'm lineal'].includes(p.unidad) && p.precio != null);
      cont.innerHTML = `<div class="tarjeta">
        <div class="campo"><label for="cm-p">Material</label><select id="cm-p">${prods.map(p => `<option value="${p.id}">${esc(p.descripcion)} · ${u.dinero(A.precios.paraVendedor(p.precio, p))} por ${esc(p.unidad)}</option>`).join('')}</select></div>
        <div class="fila">
          <div class="campo"><label for="cm-a" id="cm-la">Ancho (m)</label><input type="number" id="cm-a" step="0.01" min="0" value="1"></div>
          <div class="campo" id="cm-alto-c"><label for="cm-h">Alto (m)</label><input type="number" id="cm-h" step="0.01" min="0" value="1"></div>
          <div class="campo"><label for="cm-n">Piezas</label><input type="number" id="cm-n" min="1" value="1"></div>
        </div>
        <div class="resultado-calc" id="cm-r"></div>
        <button class="btn primario" data-cotizar style="margin-top:12px">Cotizar esto</button></div>`;
      const $ = s => cont.querySelector(s);
      let linea = null;
      const calc = () => {
        const p = A.db.obtener('productos', $('#cm-p').value);
        if (!p) return;
        const lineal = p.unidad === 'm lineal';
        $('#cm-alto-c').hidden = lineal;
        $('#cm-la').textContent = lineal ? 'Largo (m)' : 'Ancho (m)';
        const a = Number($('#cm-a').value) || 0, h = Number($('#cm-h').value) || 0, n = Math.max(1, Number($('#cm-n').value) || 1);
        const cant = u.redondear(lineal ? a * n : a * h * n);
        const precio = A.precios.paraVendedor(p.precio, p);
        const total = u.redondear(cant * precio);
        $('#cm-r').innerHTML = `<div class="chico tenue">${lineal ? `${u.num(cant)} metros lineales (ancho fijo del rollo)` : `${u.num(a)} × ${u.num(h)} m × ${n} = ${u.num(cant)} m²`}</div>
          <div class="grande">${u.dinero(total)}</div><div class="chico tenue">${u.dinero(precio)} por ${esc(p.unidad)} · IVA incluido</div>`;
        linea = A.precios.lineaDeVendedor({ tipo: 'producto', clave: p.clave, categoria: p.categoria, descripcion: `${p.categoria} · ${p.descripcion}`, unidad: p.unidad, cantidad: cant, precioUnit: p.precio, dias: p.dias,
          medidas: lineal ? null : { ancho: a, alto: h, piezas: n } });
      };
      cont.addEventListener('input', calc);
      calc();
      botonCotizar(cont, () => linea);
    },

    iva(cont) {
      const iva = A.db.ajustes().iva;
      cont.innerHTML = `<div class="tarjeta">
        <div class="campo"><label for="ci-m">Monto</label><input type="number" id="ci-m" step="0.01" min="0" placeholder="0.00"></div>
        <div class="segmentos" id="ci-modo"><button data-m="desglosar" class="activo">Ya incluye IVA → desglosar</button><button data-m="agregar">Sin IVA → agregar ${iva}%</button></div>
        <div class="resultado-calc" id="ci-r" style="margin-top:12px"></div></div>`;
      let modo = 'desglosar';
      const calc = () => {
        const m = Number(cont.querySelector('#ci-m').value) || 0;
        const sub = modo === 'desglosar' ? m / (1 + iva / 100) : m;
        const tot = modo === 'desglosar' ? m : m * (1 + iva / 100);
        cont.querySelector('#ci-r').innerHTML = `<div class="dato"><span>Subtotal</span><strong class="num">${u.dinero(sub)}</strong></div>
          <div class="dato"><span>IVA ${iva}%</span><strong class="num">${u.dinero(tot - sub)}</strong></div>
          <div class="dato"><span>Total</span><strong class="num grande" style="font-size:1.3rem">${u.dinero(tot)}</strong></div>`;
      };
      cont.querySelector('#ci-m').addEventListener('input', calc);
      cont.querySelector('#ci-modo').addEventListener('click', e => {
        const b = e.target.closest('[data-m]'); if (!b) return;
        modo = b.dataset.m; u.$$('#ci-modo button', cont).forEach(x => x.classList.toggle('activo', x === b)); calc();
      });
      calc();
    },

    anticipo(cont) {
      const pct = A.db.ajustes().anticipoSugerido;
      cont.innerHTML = `<div class="tarjeta"><div class="fila">
        <div class="campo"><label for="ca-t">Total del pedido</label><input type="number" id="ca-t" step="0.01" min="0" placeholder="0.00"></div>
        <div class="campo"><label for="ca-p">Anticipo %</label><input type="number" id="ca-p" min="0" max="100" value="${pct}"></div>
        <div class="campo"><label for="ca-y">Ya pagó</label><input type="number" id="ca-y" step="0.01" min="0" value="0"></div></div>
        <div class="resultado-calc" id="ca-r"></div></div>`;
      const calc = () => {
        const t = Number(cont.querySelector('#ca-t').value) || 0, p = Number(cont.querySelector('#ca-p').value) || 0, y = Number(cont.querySelector('#ca-y').value) || 0;
        const ant = u.redondear(t * p / 100);
        cont.querySelector('#ca-r').innerHTML = `<div class="dato"><span>Anticipo (${p}%)</span><strong class="num">${u.dinero(ant)}</strong></div>
          <div class="dato"><span>Saldo al entregar</span><strong class="num">${u.dinero(t - ant)}</strong></div>
          ${y ? `<div class="dato"><span>Le falta por pagar</span><strong class="num" style="color:var(--rojo-vivo)">${u.dinero(Math.max(0, t - y))}</strong></div>` : ''}`;
      };
      cont.addEventListener('input', calc); calc();
    },

    margen(cont) {
      cont.innerHTML = `<div class="tarjeta">
        <p class="chico tenue" style="margin-top:0">Para maquilas o compras: cuánto ganas, o qué precio poner para ganar cierto porcentaje.</p>
        <div class="fila">
          <div class="campo"><label for="cg-c">Costo (lo que pagas)</label><input type="number" id="cg-c" step="0.01" min="0" placeholder="0.00"></div>
          <div class="campo"><label for="cg-v">Precio de venta</label><input type="number" id="cg-v" step="0.01" min="0" placeholder="0.00"></div>
        </div>
        <div class="resultado-calc" id="cg-r"></div>
        <div class="separador"></div>
        <div class="fila"><div class="campo"><label for="cg-m">Quiero ganar (% sobre la venta)</label><input type="number" id="cg-m" min="0" max="95" value="40"></div></div>
        <div class="resultado-calc" id="cg-s"></div></div>`;
      const $ = s => cont.querySelector(s);
      const calc = () => {
        const c = Number($('#cg-c').value) || 0, v = Number($('#cg-v').value) || 0, m = Math.min(95, Number($('#cg-m').value) || 0);
        $('#cg-r').innerHTML = c && v ? `<div class="dato"><span>Ganancia</span><strong class="num" style="color:${v - c >= 0 ? 'var(--verde)' : 'var(--rojo-vivo)'}">${u.dinero(v - c)}</strong></div>
          <div class="dato"><span>Margen sobre la venta</span><strong class="num">${u.num((v - c) / v * 100)}%</strong></div>
          <div class="dato"><span>Aumento sobre el costo</span><strong class="num">${u.num((v - c) / c * 100)}%</strong></div>` : '<span class="chico tenue">Escribe costo y precio de venta.</span>';
        $('#cg-s').innerHTML = c ? `<div class="chico tenue">Precio sugerido para ganar ${m}%</div><div class="grande">${u.dinero(c / (1 - m / 100))}</div>` : '<span class="chico tenue">Escribe el costo arriba.</span>';
      };
      cont.addEventListener('input', calc); calc();
    },
  };
})(window.App);

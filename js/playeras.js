// Armador de playeras: filtrar modelos, elegir color, técnica, dónde se estampa y piezas por talla,
// ir juntando en un apartado y pasarlo a la cotización con el precio ya calculado.
(function (A) {
  const u = A.u;
  const esc = u.esc;

  const TECNICAS = [
    { id: 'DTF', ayuda: 'Full color, degradados y fotos' },
    { id: 'Vinil', ayuda: '1 o 2 colores: letras, números, logos simples' },
    { id: 'Sublimación', ayuda: 'Tamaño carta por lado. Solo playera blanca de poliéster' },
  ];
  const UBICACIONES = ['Frente', 'Espalda', 'Manga izquierda', 'Manga derecha'];
  const GRUPOS_TALLA = { 'Hasta EG': t => t !== 'EEG' && t !== 'EEEG', 'EEG (2XL)': t => t === 'EEG', 'EEEG (3XL)': t => t === 'EEEG' };

  // Filtros y elecciones se recuerdan mientras la app esté abierta.
  const filtros = { q: '', para: '', tipo: '', cuello: '', manga: '', color: '', talla: '' };

  function grupoColor(c) { return c === 'Blanco' ? ['Blanco'] : c === 'Todos' ? ['Blanco', 'De color'] : ['De color']; }

  function modelos() {
    return A.precios.modelos().map(m => {
      const variantes = A.precios.playeras().filter(p => p.codigo === m.codigo);
      return {
        ...m,
        at: A.precios.atributos(m),
        tallas: A.precios.tallas(m.codigo),
        colores: [...new Set(variantes.map(v => v.color))],
        desde: Math.min(...variantes.map(v => Number(v.menudeo) || Infinity)),
      };
    });
  }

  function cumple(m, f, ignorar) {
    const ok = (k, cond) => ignorar === k || !f[k] || cond;
    // Las unisex aparecen tanto en Caballero como en Dama.
    return ok('para', m.genero === f.para || (m.genero === 'Unisex' && ['Caballero', 'Dama'].includes(f.para))) &&
      ok('tipo', m.at.tipo === f.tipo) &&
      ok('cuello', m.at.cuello === f.cuello) &&
      ok('manga', m.at.manga === f.manga) &&
      ok('color', m.colores.some(c => grupoColor(c).includes(f.color))) &&
      ok('talla', m.tallas.some(GRUPOS_TALLA[f.talla] || (() => true))) &&
      (!f.q || u.coincide(`${m.codigo} ${m.descripcion} ${m.genero} ${m.at.tela} ${m.at.tipo} ${m.linea}`, f.q));
  }

  function nombreCorto(m) {
    const a = m.at;
    const cuello = a.cuello === 'Polo' ? 'Polo' : a.cuello === 'Cuello V' ? 'Cuello V' : 'Cuello redondo';
    const manga = a.manga === 'Sin mangas' ? 'sin mangas' : `manga ${a.manga.toLowerCase()}`;
    return `${cuello}, ${manga}`;
  }

  function claveGrupo(d) { return [d.codigo, d.color, d.colorExacto || '', d.tecnica, (d.ubicaciones || []).join('+')].join('|'); }

  // Tallas que se piden al proveedor dentro de cada rango de precio del catálogo.
  const TALLAS_EXACTAS = {
    'CH-EG': ['CH', 'M', 'G', 'EG'], 'ECH-EG': ['ECH', 'CH', 'M', 'G', 'EG'], EEG: ['EEG'], EEEG: ['EEEG'],
    'CH(4A)-EG(14A)': ['4', '6', '8', '10', '12', '14'], 'CH(4A)-EEG(16A)': ['4', '6', '8', '10', '12', '14', '16'], '1-2-3': ['1', '2', '3'],
  };
  const exactas = t => TALLAS_EXACTAS[t] || [t];
  // Colores sugeridos (el proveedor puede tener más; se puede escribir cualquiera).
  const COLORES_COMUNES = ['Negro', 'Blanco', 'Marino', 'Rojo', 'Royal', 'Gris jaspe', 'Gris oxford', 'Vino', 'Verde botella', 'Verde bandera',
    'Amarillo', 'Naranja', 'Rosa', 'Turquesa', 'Morado', 'Kaki', 'Chocolate', 'Arena', 'Azul cielo', 'Verde neón', 'Amarillo neón', 'Naranja neón', 'Rosa neón'];
  // Color exacto por defecto según el tipo de color del catálogo ('' = hay que escribirlo).
  const colorPorDefecto = c => (c === 'Blanco' ? 'Blanco' : c === 'Jaspe' ? 'Gris jaspe' : '');
  const etiquetaTalla = d => d.tallaExacta || A.precios.nombreTalla(d.talla);

  function textoUbicaciones(ub) {
    if (!ub || !ub.length) return '';
    if (ub.length === 1) return ub[0];
    return ub.slice(0, -1).join(', ') + ' y ' + ub[ub.length - 1].toLowerCase();
  }

  function lineaPlayera(m, d, cantidad) {
    // Hecha por un vendedor: guarda su porcentaje para que el precio se recalcule con su comisión.
    const vend = A.esVendedor() ? { comisionPct: A.precios.comisionPct({ categoria: 'Playeras', clave: m.codigo }) } : {};
    return {
      ...vend,
      tipo: 'playera', clave: m.codigo, categoria: 'Playeras', unidad: 'pieza', cantidad, precioUnit: 0,
      descripcion: `${m.descripcion} ${m.genero} · Talla ${d.tallaExacta || d.talla} · ${d.colorExacto || d.color}`,
      detalle: { ...d, planchados: d.ubicaciones.length },
    };
  }

  A.armadorPlayeras = {
    textoUbicaciones,
    // opciones: piezasPrevias (playeras que ya hay en la cotización), textoBoton, alTerminar(lineas)
    montar(cont, { piezasPrevias = 0, textoBoton = 'Pasar a la cotización', alTerminar }) {
      const todos = modelos();
      const apartado = []; // líneas ya elegidas
      let sel = null;      // modelo elegido
      let conf = null;     // { color, tecnica, ubicaciones, cantidades: {talla: n} }

      cont.innerHTML = `
        <div class="armador">
          <div class="armador-izq">
            <div class="buscador"><input type="search" data-f="q" placeholder="Buscar: polo, dry-fit, C0300, dama…" value="${esc(filtros.q)}" autocomplete="off"></div>
            <div class="filtros" data-filtros></div>
            <div class="chico tenue" data-cuenta style="margin:10px 0 6px"></div>
            <div class="modelos" data-modelos></div>
            <div data-config></div>
          </div>
          <aside class="armador-der"><div class="apartado" data-apartado></div></aside>
        </div>`;
      const $ = s => cont.querySelector(s);

      // ---------- Filtros y modelos ----------
      function opciones(clave, valorDe) {
        const vals = new Set();
        todos.filter(m => cumple(m, filtros, clave)).forEach(m => [].concat(valorDe(m)).forEach(v => vals.add(v)));
        return vals;
      }
      function grupoChips(etq, clave, todas, disponibles) {
        return `<div class="filtro"><span class="etiqueta">${etq}</span><div class="chips">
          <button type="button" class="chip ${!filtros[clave] ? 'activo' : ''}" data-fc="${clave}" data-v="">Todas</button>
          ${todas.map(v => `<button type="button" class="chip ${filtros[clave] === v ? 'activo' : ''}" data-fc="${clave}" data-v="${esc(v)}" ${!disponibles.has(v) && filtros[clave] !== v ? 'disabled' : ''}>${esc(v)}</button>`).join('')}
        </div></div>`;
      }
      function pintarFiltros() {
        $('[data-filtros]').innerHTML =
          grupoChips('Para', 'para', ['Caballero', 'Dama', 'Jóvenes', 'Niños', 'Bebés'], opciones('para', m => m.genero)) +
          grupoChips('Tipo', 'tipo', ['Casual', 'Deportiva', 'Para sublimar'], opciones('tipo', m => m.at.tipo)) +
          grupoChips('Cuello', 'cuello', ['Redondo', 'Cuello V', 'Polo'], opciones('cuello', m => m.at.cuello)) +
          grupoChips('Manga', 'manga', ['Corta', 'Larga', 'Sin mangas'], opciones('manga', m => m.at.manga)) +
          grupoChips('Color', 'color', ['Blanco', 'De color'], opciones('color', m => m.colores.flatMap(grupoColor))) +
          grupoChips('Talla', 'talla', Object.keys(GRUPOS_TALLA), opciones('talla', m => Object.keys(GRUPOS_TALLA).filter(g => m.tallas.some(GRUPOS_TALLA[g]))));
      }
      function pintarModelos() {
        const lista = todos.filter(m => cumple(m, filtros));
        $('[data-cuenta]').textContent = `${lista.length} modelo${lista.length === 1 ? '' : 's'} · toca uno para elegirlo`;
        $('[data-modelos]').innerHTML = lista.map(m => `
          <button type="button" class="modelo ${sel && sel.codigo === m.codigo ? 'activo' : ''}" data-cod="${esc(m.codigo)}">
            <span class="fila-mod"><span class="clave">${esc(m.codigo)}</span><span class="tenue chico">desde ${u.dinero(m.desde)}</span></span>
            <strong>${esc(nombreCorto(m))}</strong>
            <span class="chico tenue">${esc([m.genero, m.at.tipo, m.at.tela, m.at.silueta ? 'entallada' : ''].filter(Boolean).join(' · '))}</span>
            <span class="chico tenue">${esc(m.tallas.map(A.precios.nombreTalla).join(' · '))}</span>
          </button>`).join('') || '<div class="vacio">Ningún modelo con esos filtros.</div>';
      }

      // ---------- Configuración del modelo elegido ----------
      function elegir(codigo) {
        sel = todos.find(m => m.codigo === codigo);
        const previo = conf || {};
        // Respeta el filtro de color; si no hay, conserva el color que se venía usando.
        const permitidos = sel.colores.filter(c => !filtros.color || grupoColor(c).includes(filtros.color));
        const color = permitidos.includes(previo.color) ? previo.color : permitidos[0] || sel.colores[0];
        conf = {
          color,
          colorExacto: color === previo.color && previo.colorExacto ? previo.colorExacto : colorPorDefecto(color),
          tecnica: previo.tecnica || (sel.at.tipo === 'Para sublimar' ? 'Sublimación' : 'DTF'),
          ubicaciones: previo.ubicaciones || ['Frente'],
          cantidades: {},
        };
        pintarModelos();
        pintarConfig();
        $('[data-config]').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

      function piezasConfig() { return conf ? Object.values(conf.cantidades).reduce((s, n) => s + (Number(n) || 0), 0) : 0; }
      function piezasApartado() { return apartado.reduce((s, l) => s + l.cantidad, 0); }
      function nivelActual() { return A.precios.nivel(piezasPrevias + piezasApartado() + piezasConfig()); }
      // Precio por pieza de un rango de tallas (el vendedor lo ve con su comisión).
      function precioDe(talla, nivel) {
        const r = A.precios.precioPlayera({ codigo: sel.codigo, talla, color: conf.color, tecnica: conf.tecnica, planchados: conf.ubicaciones.length }, nivel);
        return r ? A.precios.paraVendedor(r.unitario, { categoria: 'Playeras', clave: sel.codigo }) : null;
      }

      function pintarConfig() {
        const c = $('[data-config]');
        if (!sel) { c.innerHTML = ''; return; }
        const nivel = nivelActual();
        const tec = TECNICAS.find(t => t.id === conf.tecnica);
        const avisoSubli = conf.tecnica === 'Sublimación' && (sel.at.tipo === 'Casual' || conf.color !== 'Blanco')
          ? '<div class="nota-alerta">La sublimación solo se ve bien en playera blanca o clara de poliéster (tipo “Para sublimar” o deportiva).</div>' : '';
        c.innerHTML = `
          <div class="config-playera">
            <div class="cabeza" style="margin-bottom:10px;flex-wrap:nowrap;align-items:flex-start"><div><span class="clave">${esc(sel.codigo)}</span> <strong>${esc(sel.descripcion)}</strong>
              <div class="chico tenue">${esc([sel.genero, sel.at.tela].filter(Boolean).join(' · '))}</div></div>
              <button type="button" class="btn-icono" data-cerrar-config aria-label="Quitar selección">✕</button></div>

            <div class="paso-conf"><span class="etiqueta">1. Color de la playera</span>
              <div class="segmentos">${sel.colores.map(col => `<button type="button" data-color="${esc(col)}" class="${conf.color === col ? 'activo' : ''}">${esc(col === 'Todos' ? 'Cualquier color' : col)}</button>`).join('')}</div>
              ${conf.color === 'Blanco' ? '' : `<div class="campo" style="margin:8px 0 0;max-width:280px"><label for="pl-colex">¿Qué color exactamente?</label>
                <input type="text" id="pl-colex" data-color-exacto list="pl-colores" value="${esc(conf.colorExacto || '')}" placeholder="Ej. Negro, Marino, Rojo">
                <datalist id="pl-colores">${COLORES_COMUNES.map(x => `<option value="${esc(x)}">`).join('')}</datalist></div>`}</div>

            <div class="paso-conf"><span class="etiqueta">2. Técnica</span>
              <div class="segmentos">${TECNICAS.map(t => `<button type="button" data-tec="${t.id}" class="${conf.tecnica === t.id ? 'activo' : ''}">${t.id}</button>`).join('')}</div>
              <div class="chico tenue" style="margin-top:4px">${esc(tec.ayuda)}</div></div>
            ${avisoSubli}

            <div class="paso-conf"><span class="etiqueta">3. ¿Dónde va estampada? <span class="tenue">(cada lugar es un planchado)</span></span>
              <div class="chips" style="margin:4px 0 0">${UBICACIONES.map(ub => `<button type="button" class="chip ${conf.ubicaciones.includes(ub) ? 'activo' : ''}" data-ub="${ub}">${conf.ubicaciones.includes(ub) ? '✓ ' : ''}${ub}</button>`).join('')}</div></div>

            <div class="paso-conf"><span class="etiqueta">4. Piezas por talla</span>
              <div class="tallas">${sel.tallas.map(t => {
                const precio = precioDe(t, nivel);
                return `<div class="talla-grupo ${precio != null ? '' : 'no-hay'}">
                  <div class="talla-cab"><strong>${esc(A.precios.nombreTalla(t))}</strong>
                    <span class="chico tenue" data-precio-grupo="${esc(t)}">${precio != null ? `${u.dinero(precio)} c/u` : 'No viene en este color'}</span></div>
                  ${precio != null ? `<div class="tallas-exactas">${exactas(t).map(x => {
                    const k = `${t}|${x}`;
                    const n = conf.cantidades[k] || 0;
                    return `<div class="talla-exacta"><span class="talla-nombre">${esc(x)}</span>
                      <div class="contador"><button type="button" data-menos="${esc(k)}" aria-label="Menos ${esc(x)}">−</button>
                        <input type="number" min="0" inputmode="numeric" data-cant="${esc(k)}" value="${n || ''}" placeholder="0" aria-label="Piezas talla ${esc(x)}">
                        <button type="button" data-mas="${esc(k)}" aria-label="Más ${esc(x)}">+</button></div></div>`;
                  }).join('')}</div>` : ''}
                </div>`;
              }).join('')}</div></div>

            <div class="resumen-conf" data-resumen-conf></div>
          </div>`;
        pintarResumenConf();
      }

      function pintarResumenConf() {
        const r = $('[data-resumen-conf]');
        if (!r) return;
        const nivel = nivelActual();
        const piezas = piezasConfig();
        const total = Object.entries(conf.cantidades).reduce((s, [k, n]) => {
          const p = precioDe(k.split('|')[0], nivel);
          return s + (p ? p * n : 0);
        }, 0);
        r.innerHTML = `<div><strong>${piezas} pieza${piezas === 1 ? '' : 's'}</strong> · ${u.dinero(total)}</div>
          <button type="button" class="btn" data-al-apartado ${piezas && conf.ubicaciones.length ? '' : 'disabled'}>＋ Apartar y elegir otro modelo</button>`;
      }

      // Actualiza precios sin redibujar (para no perder el cursor en las cantidades).
      function refrescarPrecios() {
        if (sel) {
          const nivel = nivelActual();
          u.$$('[data-precio-grupo]', cont).forEach(etq => {
            const p = precioDe(etq.dataset.precioGrupo, nivel);
            if (p != null) etq.textContent = `${u.dinero(p)} c/u`;
          });
          pintarResumenConf();
        }
        pintarApartado();
      }

      function apartarConfig() {
        if (!sel || !piezasConfig() || !conf.ubicaciones.length) return false;
        if (!(conf.colorExacto || '').trim()) { A.aviso('Escribe qué color exactamente (para pedirlo al proveedor).'); return false; }
        Object.entries(conf.cantidades).forEach(([k, cantidad]) => {
          const n = Number(cantidad) || 0;
          if (!n) return;
          const [t, x] = k.split('|');
          const d = { codigo: sel.codigo, talla: t, tallaExacta: x, color: conf.color, colorExacto: conf.colorExacto.trim(), tecnica: conf.tecnica, ubicaciones: [...conf.ubicaciones] };
          const existente = apartado.find(l => claveGrupo(l.detalle) === claveGrupo(d) && l.detalle.talla === t && l.detalle.tallaExacta === x);
          if (existente) existente.cantidad += n;
          else apartado.push(lineaPlayera(sel, d, n));
        });
        conf.cantidades = {};
        return true;
      }

      // ---------- Apartado ----------
      function pintarApartado() {
        const nivel = nivelActual();
        const aj = A.db.ajustes();
        const enConfig = piezasConfig();
        const total = piezasPrevias + piezasApartado() + enConfig;
        const faltan = aj.umbralMayoreo - total;
        const grupos = new Map();
        apartado.forEach((l, i) => {
          const k = claveGrupo(l.detalle);
          if (!grupos.has(k)) grupos.set(k, []);
          grupos.get(k).push({ l, i });
        });
        let suma = 0;
        const htmlGrupos = [...grupos.values()].map(items => {
          const d = items[0].l.detalle;
          const m = todos.find(x => x.codigo === d.codigo);
          return `<div class="grupo-ap">
            <div class="cabeza-grupo"><div><span class="clave">${esc(d.codigo)}</span> <strong>${esc(nombreCorto(m))}</strong>
              <div class="chico tenue">${esc(d.colorExacto || d.color)} · ${esc(d.tecnica)} · ${esc(textoUbicaciones(d.ubicaciones))}</div></div></div>
            ${items.map(({ l, i }) => {
              const r = A.precios.precioPlayera({ ...l.detalle, planchados: l.detalle.ubicaciones.length }, nivel);
              const p = r ? A.precios.paraVendedor(r.unitario, { categoria: 'Playeras', clave: l.detalle.codigo }) : null;
              const sub = p ? p * l.cantidad : 0;
              suma += sub;
              return `<div class="dato"><span>Talla ${esc(etiquetaTalla(l.detalle))} × ${l.cantidad}${p ? ` <span class="chico">(${u.dinero(p)})</span>` : ''}</span>
                <span class="num">${u.dinero(sub)} <button type="button" class="btn-icono chico" data-quitar-ap="${i}" aria-label="Quitar">✕</button></span></div>`;
            }).join('')}
          </div>`;
        }).join('');

        $('[data-apartado]').innerHTML = `
          <h3 style="margin-bottom:8px">Apartado</h3>
          ${htmlGrupos || '<div class="chico tenue" style="padding:6px 0 10px">Aquí se van juntando las playeras que elijas. Puedes mezclar modelos, colores y técnicas.</div>'}
          <div class="separador" style="margin:10px 0"></div>
          <div class="dato"><span>Piezas${piezasPrevias ? ` (+${piezasPrevias} ya en la cotización)` : ''}${enConfig ? ` (+${enConfig} eligiendo)` : ''}</span><strong>${total}</strong></div>
          <div class="dato"><span>Nivel</span><span><span class="insignia ${nivel === 'mayoreo' ? 'verde' : ''}">${nivel === 'mayoreo' ? 'Mayoreo' : 'Menudeo'}</span></span></div>
          ${faltan > 0 ? `<div class="chico tenue" style="margin-top:4px">Con ${faltan} pieza${faltan === 1 ? '' : 's'} más pasa a mayoreo.</div>` : ''}
          ${suma ? `<div class="dato"><span>Total apartado</span><strong class="num">${u.dinero(suma)}</strong></div>` : ''}
          <button type="button" class="btn primario bloque" data-terminar style="margin-top:12px" ${apartado.length || enConfig ? '' : 'disabled'}>${esc(textoBoton)}</button>`;
      }

      // ---------- Eventos ----------
      cont.addEventListener('input', e => {
        if (e.target.dataset.f === 'q') { filtros.q = e.target.value; pintarFiltros(); pintarModelos(); return; }
        if ('colorExacto' in e.target.dataset) { conf.colorExacto = e.target.value; return; }
        if (e.target.dataset.cant != null) {
          conf.cantidades[e.target.dataset.cant] = Math.max(0, parseInt(e.target.value, 10) || 0);
          refrescarPrecios();
        }
      });
      cont.addEventListener('click', e => {
        const b = e.target.closest('button');
        if (!b || b.disabled) return;
        if (b.dataset.fc) {
          filtros[b.dataset.fc] = filtros[b.dataset.fc] === b.dataset.v ? '' : b.dataset.v;
          pintarFiltros(); pintarModelos();
        } else if (b.dataset.cod) elegir(b.dataset.cod);
        else if ('cerrarConfig' in b.dataset) { sel = null; conf = null; pintarModelos(); pintarConfig(); pintarApartado(); }
        else if (b.dataset.color) { conf.color = b.dataset.color; conf.colorExacto = colorPorDefecto(conf.color); pintarConfig(); pintarApartado(); }
        else if (b.dataset.tec) { conf.tecnica = b.dataset.tec; pintarConfig(); pintarApartado(); }
        else if (b.dataset.ub) {
          const ub = b.dataset.ub;
          conf.ubicaciones = conf.ubicaciones.includes(ub) ? conf.ubicaciones.filter(x => x !== ub) : UBICACIONES.filter(x => x === ub || conf.ubicaciones.includes(x));
          pintarConfig(); pintarApartado();
        } else if (b.dataset.mas || b.dataset.menos) {
          const t = b.dataset.mas || b.dataset.menos;
          conf.cantidades[t] = Math.max(0, (conf.cantidades[t] || 0) + (b.dataset.mas ? 1 : -1));
          const inp = cont.querySelector(`[data-cant="${CSS.escape(t)}"]`);
          if (inp) inp.value = conf.cantidades[t] || '';
          refrescarPrecios();
        } else if ('alApartado' in b.dataset) {
          if (apartarConfig()) { sel = null; conf = { ...conf, cantidades: {} }; pintarModelos(); pintarConfig(); pintarApartado(); $('[data-modelos]').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
        } else if (b.dataset.quitarAp != null) {
          apartado.splice(Number(b.dataset.quitarAp), 1);
          refrescarPrecios();
        } else if ('terminar' in b.dataset) {
          if (conf && sel && piezasConfig() && !conf.ubicaciones.length) return A.aviso('Elige dónde va estampada.');
          if (conf && sel && piezasConfig() && !apartarConfig()) return; // falta el color exacto
          if (!apartado.length) return;
          alTerminar(apartado.map(l => ({ ...l, detalle: { ...l.detalle } })));
        }
      });

      pintarFiltros();
      pintarModelos();
      pintarConfig();
      pintarApartado();
    },

    // Abre el armador en una ventana; piezasPrevias cuenta para el nivel de mayoreo.
    abrir({ piezasPrevias = 0, alTerminar }) {
      A.modal.abrir('Agregar playeras', '<div data-armador></div>', {
        ancho: 'extra',
        alAbrir(m) {
          A.armadorPlayeras.montar(m.querySelector('[data-armador]'), {
            piezasPrevias,
            alTerminar(lineas) { A.modal.cerrar(); alTerminar(lineas); },
          });
        },
      });
    },
  };
})(window.App);

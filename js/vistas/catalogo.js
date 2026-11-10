// Precios: consulta rápida y edición del catálogo de imprenta y de playeras.
(function (A) {
  const u = A.u;
  const esc = u.esc;
  const UNIDADES = ['pieza', 'millar', '2 millares', 'm²', 'm lineal'];
  const pref = { pestana: 'imprenta', q: '', categoria: '', genero: '' };

  A.vistas.catalogo = {
    titulo: 'Precios',
    render(c) {
      c.innerHTML = `
        <div class="cabeza"><div><h1>Precios</h1><div class="subtitulo">Precios con IVA incluido</div></div>
          <div class="acciones"><div class="segmentos" id="cg-tab"><button data-t="imprenta">Imprenta</button><button data-t="playeras">Playeras</button></div>
          <button class="btn" id="cg-nuevo">＋ Producto</button></div></div>
        <div class="buscador"><input type="search" id="cg-q" placeholder="Escribe: tarjetas, lona, TER2, C0200…" value="${esc(pref.q)}" autofocus></div>
        <div class="chips" id="cg-chips"></div>
        <div id="cg-lista"></div>`;

      const pintar = () => {
        u.$$('#cg-tab button', c).forEach(b => b.classList.toggle('activo', b.dataset.t === pref.pestana));
        c.querySelector('#cg-nuevo').hidden = pref.pestana !== 'imprenta' || !A.esDueno();
        if (pref.pestana === 'imprenta') pintarImprenta(); else pintarPlayeras();
      };

      function pintarImprenta() {
        const cats = A.precios.categorias();
        c.querySelector('#cg-chips').innerHTML = `<button class="chip ${!pref.categoria ? 'activo' : ''}" data-cat="">Todo</button>` +
          cats.map(k => `<button class="chip ${pref.categoria === k ? 'activo' : ''}" data-cat="${esc(k)}">${esc(k)}</button>`).join('');
        const lista = A.precios.buscarProductos(pref.q, pref.categoria);
        c.querySelector('#cg-lista').innerHTML = lista.length ? `<div class="lista">${lista.map(p => `
          <div class="renglon" data-id="${p.id}">
            <div class="principal"><div class="titulo"><span class="clave">${esc(p.clave)}</span> ${esc(p.categoria)}</div>
              <div>${esc(p.descripcion)}</div>
              <div class="detalle">${esc(A.precios.textoDias(p.dias))} · ${esc(p.fabricacion || '')}</div></div>
            <div class="derecha"><div class="precio-grande">${p.precio == null ? 'A cotizar' : u.dinero(A.precios.paraVendedor(p.precio, p))}</div>
              <div class="detalle">por ${esc(p.unidad || 'pieza')}</div></div>
          </div>`).join('')}</div>` : '<div class="vacio">Sin resultados.</div>';
      }

      function pintarPlayeras() {
        const aj = A.db.ajustes();
        const generos = [...new Set(A.precios.playeras().map(p => p.genero))];
        c.querySelector('#cg-chips').innerHTML = `<button class="chip ${!pref.genero ? 'activo' : ''}" data-gen="">Todas</button>` +
          generos.map(g => `<button class="chip ${pref.genero === g ? 'activo' : ''}" data-gen="${esc(g)}">${esc(g)}</button>`).join('');
        const lista = A.precios.playeras().filter(p => {
          const at = A.precios.atributos(p);
          return (!pref.genero || p.genero === pref.genero) &&
            (!pref.q || u.coincide(`${p.codigo} ${p.descripcion} ${p.genero} ${p.talla} ${p.color} ${p.linea} ${at.tipo} ${at.tela}`, pref.q));
        });
        const blanca = (p, nivel) => nivel === 'mayoreo' && aj.playeraPrecioMayoreo && p.mayoreo ? p.mayoreo : p.menudeo;
        const celda = (p, tec) => {
          const men = A.precios.precioPlayera({ ...p, tecnica: tec, planchados: 1 }, 'menudeo');
          const may = A.precios.precioPlayera({ ...p, tecnica: tec, planchados: 1 }, 'mayoreo');
          const v = x => u.dinero(A.precios.paraVendedor(x, { categoria: 'Playeras', clave: p.codigo }));
          return `<td class="der num">${v(men.unitario)}<div class="chico tenue">${v(may.unitario)}</div></td>`;
        };
        c.querySelector('#cg-lista').innerHTML = `
          <div class="nota-info">Precio por pieza con 1 planchado: <strong>arriba menudeo</strong> (1 a ${aj.umbralMayoreo - 1} piezas), <strong>abajo mayoreo</strong> (${aj.umbralMayoreo} o más). Cada planchado extra suma ${u.dinero(aj.planchado.menudeo)} / ${u.dinero(aj.planchado.mayoreo)}. Para cotizar con filtros usa <a href="#/calculadora">Calculadora → Playeras</a>.${A.esDueno() ? ' Toca una fila para cambiar el precio de la playera.' : ''}</div>
          ${lista.length ? `<div class="tabla-envoltura"><table><thead><tr><th>Código</th><th>Playera</th><th>Talla</th><th>Color</th><th class="der">Playera sola</th><th class="der">DTF</th><th class="der">Vinil</th><th class="der">Sublimación</th></tr></thead><tbody>
          ${lista.map(p => { const at = A.precios.atributos(p); return `<tr data-pl="${p.id}" style="cursor:pointer"><td><span class="clave">${esc(p.codigo)}</span></td>
            <td>${esc(p.descripcion)}<div class="chico tenue">${esc([p.genero, at.tipo, at.tela].filter(Boolean).join(' · '))}</div></td>
            <td>${esc(A.precios.nombreTalla(p.talla))}</td><td>${esc(p.color === 'Todos' ? 'Cualquier color' : p.color)}</td>
            <td class="der num">${u.dinero(p.menudeo)}<div class="chico tenue">${u.dinero(blanca(p, 'mayoreo'))}</div></td>
            ${celda(p, 'DTF')}${celda(p, 'Vinil')}${celda(p, 'Sublimación')}</tr>`; }).join('')}
          </tbody></table></div>` : '<div class="vacio">Sin resultados.</div>'}`;
      }

      c.querySelector('#cg-q').addEventListener('input', e => { pref.q = e.target.value; pintar(); });
      c.querySelector('#cg-tab').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b) { pref.pestana = b.dataset.t; pintar(); } });
      c.querySelector('#cg-chips').addEventListener('click', e => {
        const b = e.target.closest('.chip');
        if (!b) return;
        if ('cat' in b.dataset) pref.categoria = b.dataset.cat;
        if ('gen' in b.dataset) pref.genero = b.dataset.gen;
        pintar();
      });
      c.querySelector('#cg-lista').addEventListener('click', e => {
        const r = e.target.closest('[data-id]');
        // Los colaboradores solo consultan; al tocar un producto lo pueden cotizar.
        if (r && !A.esDueno()) return cotizarProducto(A.db.obtener('productos', r.dataset.id));
        if (r) return editarProducto(A.db.obtener('productos', r.dataset.id), pintar);
        const pl = e.target.closest('[data-pl]');
        if (pl && A.esDueno()) editarPlayera(A.db.obtener('playeras', pl.dataset.pl), pintar);
      });
      c.querySelector('#cg-nuevo').addEventListener('click', () => editarProducto(null, pintar));
      pintar();
    },
  };

  function cotizarProducto(p) {
    A.borradorLineas = [{ tipo: 'producto', clave: p.clave, categoria: p.categoria, descripcion: `${p.categoria} · ${p.descripcion}`, unidad: p.unidad, cantidad: 1, precioUnit: p.precio || 0, dias: p.dias, fabricacion: p.fabricacion }];
    A.ir('#/cotizar');
  }

  function editarProducto(p, despues) {
    const nuevo = !p;
    p = p || { clave: '', categoria: '', descripcion: '', precio: null, unidad: 'pieza', dias: 0, fabricacion: 'En Innova' };
    const cats = A.precios.categorias();
    A.modal.abrir(nuevo ? 'Nuevo producto' : `${p.clave} · ${p.categoria}`, `
      <form id="fprod">
        <div class="fila">
          <div class="campo" style="flex:0 1 120px"><label for="pr-c">Clave</label><input type="text" id="pr-c" name="clave" value="${esc(p.clave)}" required></div>
          <div class="campo"><label for="pr-cat">Categoría</label><input type="text" id="pr-cat" name="categoria" list="pr-cats" value="${esc(p.categoria)}" required>
            <datalist id="pr-cats">${cats.map(k => `<option value="${esc(k)}">`).join('')}</datalist></div>
        </div>
        <div class="campo"><label for="pr-d">Descripción</label><input type="text" id="pr-d" name="descripcion" value="${esc(p.descripcion)}" required></div>
        <div class="fila">
          <div class="campo"><label for="pr-p">Precio (IVA incl.)</label><input type="number" id="pr-p" name="precio" step="0.01" min="0" value="${p.precio ?? ''}" placeholder="Vacío = a cotizar"></div>
          <div class="campo"><label for="pr-u">Por</label><select id="pr-u" name="unidad">${UNIDADES.map(x => `<option ${x === p.unidad ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
          <div class="campo"><label for="pr-costo">Te cuesta (opcional)</label><input type="number" id="pr-costo" name="costo" step="0.01" min="0" value="${p.id ? (A.costos.de(p.id) ?? '') : ''}" placeholder="Para la ganancia">${p.id && A.costos.estimado(p.id) ? '<span class="chico tenue">Costo estimado: cámbialo por el real</span>' : ''}</div>
        </div>
        <div class="fila">
          <div class="campo"><label for="pr-dias">Días hábiles de entrega</label><input type="number" id="pr-dias" name="dias" min="0" value="${p.dias ?? ''}"></div>
          <div class="campo"><label for="pr-f">Fabricación</label><input type="text" id="pr-f" name="fabricacion" value="${esc(p.fabricacion || '')}" list="pr-fabs">
            <datalist id="pr-fabs"><option value="En Innova"><option value="En Innova (al día siguiente)"><option value="Maquila externa (3-4 días)"></datalist></div>
        </div>
        ${!nuevo && p.actualizado > '2026-01-02' ? `<div class="chico tenue">Última modificación: ${esc(u.fechaHora(p.actualizado))}</div>` : ''}
        <div class="modal-pie">
          ${nuevo ? '' : '<button type="button" class="btn peligro" id="pr-borrar" style="margin-right:auto">Quitar</button><button type="button" class="btn" id="pr-cotizar">Cotizar este</button>'}
          <button type="button" class="btn" data-cerrar>Cancelar</button><button class="btn primario">Guardar</button>
        </div>
      </form>`, {
      alAbrir(m) {
        m.querySelector('#fprod').addEventListener('submit', e => {
          e.preventDefault();
          const d = u.datosForm(e.target);
          const precio = d.precio === '' ? null : u.redondear(d.precio);
          const dias = d.dias === '' ? null : Number(d.dias);
          const { costo, ...resto } = d;
          const guardado = A.db.guardar('productos', { ...p, ...resto, clave: d.clave.toUpperCase(), precio, dias, activo: true, orden: p.orden ?? 999 });
          // El costo va aparte, en la colección privada del dueño.
          if (costo !== (A.costos.de(guardado.id) ?? '').toString()) A.costos.poner(guardado.id, costo === '' ? null : costo);
          A.modal.cerrar(); A.aviso('Precio guardado'); despues();
        });
        const b = m.querySelector('#pr-borrar');
        if (b) b.addEventListener('click', async () => {
          if (!(await A.modal.confirmar('Quitar producto', `¿Quitar ${p.clave} del catálogo? Las cotizaciones y pedidos que ya lo tienen no cambian.`, 'Quitar'))) return;
          A.db.borrar('productos', p.id); despues();
        });
        const ct = m.querySelector('#pr-cotizar');
        if (ct) ct.addEventListener('click', () => {
          A.borradorLineas = [{ tipo: 'producto', clave: p.clave, descripcion: `${p.categoria} · ${p.descripcion}`, unidad: p.unidad, cantidad: 1, precioUnit: p.precio || 0, dias: p.dias, fabricacion: p.fabricacion }];
          A.ir('#/cotizar');
        });
      },
    });
  }

  function editarPlayera(p, despues) {
    A.modal.abrir(`${p.codigo} · Talla ${p.talla} · ${p.color}`, `
      <form id="fpl2">
        <p class="tenue chico">${esc(p.descripcion)} · ${esc(p.genero)} · ${esc(p.linea)}</p>
        <div class="fila">
          <div class="campo"><label for="pl-men">Precio menudeo</label><input type="number" id="pl-men" name="menudeo" step="0.01" min="0" value="${p.menudeo ?? ''}" required></div>
          <div class="campo"><label for="pl-may">Precio mayoreo</label><input type="number" id="pl-may" name="mayoreo" step="0.01" min="0" value="${p.mayoreo ?? ''}"></div>
          <div class="campo"><label for="pl-costo">Te cuesta</label><input type="number" id="pl-costo" name="costo" step="0.01" min="0" value="${A.costos.de(p.id) ?? ''}" placeholder="${A.costos.general().playeraDesdeMayoreo && p.mayoreo ? 'Vacío = ' + p.mayoreo : 'Para la ganancia'}"></div>
        </div>
        <div class="modal-pie"><button type="button" class="btn" data-cerrar>Cancelar</button><button class="btn primario">Guardar</button></div>
      </form>`, {
      alAbrir(m) {
        m.querySelector('#fpl2').addEventListener('submit', e => {
          e.preventDefault();
          const d = u.datosForm(e.target);
          A.db.guardar('playeras', { ...p, menudeo: u.redondear(d.menudeo), mayoreo: d.mayoreo === '' ? null : u.redondear(d.mayoreo) });
          if (d.costo !== (A.costos.de(p.id) ?? '').toString()) A.costos.poner(p.id, d.costo === '' ? null : d.costo);
          A.modal.cerrar(); A.aviso('Precio guardado'); despues();
        });
      },
    });
  }
})(window.App);

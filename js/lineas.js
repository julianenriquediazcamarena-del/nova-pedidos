// Editor de conceptos (líneas) compartido por cotizaciones y pedidos.
(function (A) {
  const u = A.u;
  const esc = u.esc;

  function htmlLinea(l, i) {
    const conMedidas = l.unidad === 'm²';
    const sub = [];
    if (l.clave) sub.push(`<span class="clave">${esc(l.clave)}</span>`);
    if (l.tipo === 'playera') {
      const ub = A.armadorPlayeras.textoUbicaciones(l.detalle.ubicaciones);
      sub.push(`${esc(l.detalle.tecnica)} · ${ub ? esc(ub) : `${l.detalle.planchados} planchado${l.detalle.planchados > 1 ? 's' : ''}`}`);
    }
    if (l.unidad && l.unidad !== 'pieza') sub.push(esc(l.unidad));
    sub.push(esc(A.precios.textoDias(A.precios.diasLinea(l))));
    return `<div class="linea-ed" data-i="${i}">
      <div><div class="desc">${esc(l.descripcion)}</div><div class="sub">${sub.join(' · ')}</div>
        ${conMedidas ? `<div class="fila" style="gap:6px;margin-top:6px;align-items:center">
          <input type="number" step="0.01" min="0" data-m="ancho" value="${l.medidas?.ancho ?? ''}" placeholder="Ancho m" style="width:90px" aria-label="Ancho en metros">
          <span>×</span><input type="number" step="0.01" min="0" data-m="alto" value="${l.medidas?.alto ?? ''}" placeholder="Alto m" style="width:90px" aria-label="Alto en metros">
          <span>×</span><input type="number" step="1" min="1" data-m="piezas" value="${l.medidas?.piezas ?? 1}" style="width:70px" aria-label="Piezas"><span class="chico tenue">pzas</span></div>` : ''}
      </div>
      <div class="lbl-movil" data-lbl="Cantidad"><input type="number" step="any" min="0" data-c="cantidad" value="${l.cantidad}" ${conMedidas && l.medidas?.ancho ? 'readonly' : ''} aria-label="Cantidad"></div>
      <div class="lbl-movil" data-lbl="Precio unit."><input type="number" step="0.01" min="0" data-c="precioUnit" value="${l.precioUnit}" aria-label="Precio unitario"></div>
      <div class="total-linea">${u.dinero(l.cantidad * l.precioUnit)}</div>
      <button class="btn-icono" data-quitar="${i}" title="Quitar" aria-label="Quitar concepto">✕</button>
    </div>`;
  }

  function textoFaltan(piezas) {
    const faltan = A.db.ajustes().umbralMayoreo - piezas;
    return faltan > 0 ? `Con ${faltan} más pasa a mayoreo` : '';
  }

  A.editorLineas = {
    montar(cont, doc, alCambiar) {
      doc.lineas = doc.lineas || [];
      cont.classList.add('editor-lineas');

      function pintar() {
        const info = A.precios.recalcular(doc.lineas);
        const t = A.precios.totales(doc.lineas);
        const conIndice = doc.lineas.map((l, i) => [l, i]);
        const otras = conIndice.filter(([l]) => l.tipo !== 'playera');
        const playeras = conIndice.filter(([l]) => l.tipo === 'playera');
        cont.innerHTML = `
          ${doc.lineas.length ? `<div class="linea-ed linea-cab"><span>Concepto</span><span>Cantidad</span><span>Precio unit.</span><span>Importe</span><span></span></div>` : ''}
          <div data-lineas>
            ${otras.map(([l, i]) => htmlLinea(l, i)).join('')}
            ${playeras.length ? `<div class="grupo-titulo"><h3>Playeras · <span data-np>${info.piezasPlayera}</span> piezas</h3>
              <span><span class="chico tenue" data-faltan>${textoFaltan(info.piezasPlayera)}</span>
              <span class="insignia ${info.nivel === 'mayoreo' ? 'verde' : ''}" data-nivel>${info.nivel === 'mayoreo' ? 'Mayoreo' : 'Menudeo'}</span></span></div>
              ${playeras.map(([l, i]) => htmlLinea(l, i)).join('')}` : ''}
            ${doc.lineas.length ? '' : '<div class="vacio">Agrega productos, playeras o un concepto libre.</div>'}
          </div>
          <div class="fila" style="margin-top:12px;gap:8px">
            <button class="btn" data-agregar="producto">＋ Producto</button>
            <button class="btn" data-agregar="playera">＋ Playeras</button>
            <button class="btn" data-agregar="diseno">＋ Diseño</button>
            <button class="btn" data-agregar="libre">＋ Concepto libre</button>
          </div>
          <div class="totales">
            <span class="tenue">Subtotal (sin IVA)</span><span data-t="subtotal">${u.dinero(t.subtotal)}</span>
            <span class="tenue">IVA</span><span data-t="iva">${u.dinero(t.iva)}</span>
            <span class="gran">Total</span><span class="gran" data-t="total">${u.dinero(t.total)}</span>
          </div>`;
        alCambiar && alCambiar(t);
      }

      // Actualiza importes sin volver a dibujar (para no perder el cursor mientras se escribe).
      function refrescar() {
        const info = A.precios.recalcular(doc.lineas);
        const t = A.precios.totales(doc.lineas);
        u.$$('.linea-ed[data-i]', cont).forEach(fila => {
          const l = doc.lineas[fila.dataset.i];
          const precio = fila.querySelector('[data-c=precioUnit]');
          const cant = fila.querySelector('[data-c=cantidad]');
          if (precio !== document.activeElement) precio.value = l.precioUnit;
          if (cant !== document.activeElement) cant.value = l.cantidad;
          fila.querySelector('.total-linea').textContent = u.dinero(l.cantidad * l.precioUnit);
        });
        const nivel = cont.querySelector('[data-nivel]');
        if (nivel) { nivel.textContent = info.nivel === 'mayoreo' ? 'Mayoreo' : 'Menudeo'; nivel.classList.toggle('verde', info.nivel === 'mayoreo'); }
        const np = cont.querySelector('[data-np]');
        if (np) np.textContent = info.piezasPlayera;
        const faltan = cont.querySelector('[data-faltan]');
        if (faltan) faltan.textContent = textoFaltan(info.piezasPlayera);
        ['subtotal', 'iva', 'total'].forEach(k => { cont.querySelector(`[data-t=${k}]`).textContent = u.dinero(t[k]); });
        alCambiar && alCambiar(t);
      }

      cont.oninput = e => {
        const fila = e.target.closest('.linea-ed[data-i]');
        if (!fila) return;
        const l = doc.lineas[fila.dataset.i];
        const v = parseFloat(e.target.value);
        if (e.target.dataset.c) {
          l[e.target.dataset.c] = Number.isFinite(v) ? v : 0;
          if (e.target.dataset.c === 'precioUnit' && l.tipo === 'playera') l.precioManual = true;
        }
        if (e.target.dataset.m) {
          l.medidas = l.medidas || {};
          l.medidas[e.target.dataset.m] = Number.isFinite(v) ? v : 0;
          fila.querySelector('[data-c=cantidad]').readOnly = !!(l.medidas.ancho && l.medidas.alto);
        }
        refrescar();
      };
      cont.onclick = e => {
        const q = e.target.closest('[data-quitar]');
        if (q) { doc.lineas.splice(Number(q.dataset.quitar), 1); pintar(); return; }
        const a = e.target.closest('[data-agregar]');
        if (a && a.dataset.agregar === 'playera') {
          const piezasPrevias = doc.lineas.filter(l => l.tipo === 'playera').reduce((n, l) => n + (Number(l.cantidad) || 0), 0);
          A.armadorPlayeras.abrir({ piezasPrevias, alTerminar: lineas => { doc.lineas.push(...lineas); pintar(); } });
        } else if (a) dialogos[a.dataset.agregar](linea => { doc.lineas.push(linea); pintar(); });
      };
      pintar();
      return { pintar };
    },
  };

  // ---- Diálogos para agregar conceptos ----
  const dialogos = {
    producto(agregar) {
      A.modal.abrir('Agregar producto', `
        <div class="buscador"><input type="search" id="bp" placeholder="Busca por clave o nombre: tarjetas, lona, TER2…" autocomplete="off"></div>
        <div class="resultados" id="rp"></div>`, {
        alAbrir(c) {
          const pintar = () => {
            const lista = A.precios.buscarProductos(c.querySelector('#bp').value).slice(0, 60);
            c.querySelector('#rp').innerHTML = lista.map(p => `<button class="resultado" data-id="${p.id}">
              <span><span class="clave">${esc(p.clave)}</span> <strong>${esc(p.categoria)}</strong> · ${esc(p.descripcion)}</span>
              <strong class="num">${p.precio == null ? 'A cotizar' : u.dinero(p.precio)}</strong></button>`).join('') || '<div class="vacio">Sin resultados</div>';
          };
          c.querySelector('#bp').addEventListener('input', pintar);
          c.querySelector('#bp').addEventListener('keydown', e => { if (e.key === 'Enter') { const b = c.querySelector('.resultado'); b && b.click(); } });
          c.querySelector('#rp').addEventListener('click', e => {
            const b = e.target.closest('[data-id]');
            if (!b) return;
            const p = A.db.obtener('productos', b.dataset.id);
            A.modal.cerrar();
            agregar({
              tipo: 'producto', clave: p.clave, categoria: p.categoria, descripcion: `${p.categoria} · ${p.descripcion}`, unidad: p.unidad,
              cantidad: 1, precioUnit: p.precio || 0, dias: p.dias, fabricacion: p.fabricacion,
            });
          });
          pintar();
        },
      });
    },

    // Diseño: se elige un tipo como referencia y el precio se ajusta a mano (cada diseño es distinto).
    diseno(agregar) {
      const tipos = A.precios.productos().filter(p => p.categoria === 'Diseño');
      A.modal.abrir('Agregar diseño', `
        <form id="fdis">
          <p class="chico tenue" style="margin-top:-6px">Elige el nivel como referencia y ajusta el precio según el trabajo.</p>
          <div class="opciones-diseno">${tipos.map((t, i) => `<label class="opcion-diseno"><input type="radio" name="tipo" value="${t.id}" ${i === 1 ? 'checked' : ''}>
            <span><strong>${esc(t.descripcion.split(' (')[0])}</strong>${t.descripcion.includes('(') ? `<span class="chico tenue"> (${esc(t.descripcion.split(' (').slice(1).join(' ('))}</span>` : ''}</span>
            <span class="num">${u.dinero(t.precio)}</span></label>`).join('')}</div>
          <div class="fila" style="margin-top:12px">
            <div class="campo"><label for="dis-p">Precio a cobrar (IVA incl.)</label><input type="number" id="dis-p" name="precio" step="1" min="0" required></div>
            <div class="campo" style="flex:2 1 220px"><label for="dis-n">Detalle (opcional)</label><input type="text" id="dis-n" name="nota" placeholder="Ej. invitación de XV años, 2 propuestas"></div>
          </div>
          <label class="check"><input type="checkbox" name="incluido"> Diseño incluido sin costo (aparece en la nota en $0)</label>
          <div class="modal-pie"><button type="button" class="btn" data-cerrar>Cancelar</button><button class="btn primario">Agregar</button></div>
        </form>`, {
        alAbrir(c) {
          const f = c.querySelector('#fdis');
          const precioDe = () => (A.db.obtener('productos', f.tipo.value) || {}).precio || 0;
          const sincronizar = () => { f.precio.value = f.incluido.checked ? 0 : precioDe(); f.precio.disabled = f.incluido.checked; };
          f.addEventListener('change', e => { if (e.target.name === 'tipo' || e.target.name === 'incluido') sincronizar(); });
          sincronizar();
          setTimeout(() => f.precio.select(), 60); // el cursor va al precio, que es lo que casi siempre se ajusta
          f.addEventListener('submit', e => {
            e.preventDefault();
            const t = A.db.obtener('productos', f.tipo.value);
            const nota = f.nota.value.trim();
            A.modal.cerrar();
            agregar({
              tipo: 'producto', clave: t.clave, categoria: 'Diseño', fabricacion: t.fabricacion, dias: t.dias, unidad: 'pieza', cantidad: 1,
              descripcion: `Diseño · ${t.descripcion.split(' (')[0]}${nota ? ` — ${nota}` : ''}${f.incluido.checked ? ' (incluido)' : ''}`,
              precioUnit: f.incluido.checked ? 0 : Math.max(0, Number(f.precio.value) || 0),
            });
          });
        },
      });
    },

    libre(agregar) {
      A.modal.abrir('Concepto libre', `
        <form id="fl">
          <div class="campo"><label for="ld">Descripción</label><input type="text" id="ld" name="descripcion" required placeholder="Ej. Diseño de logotipo, rótulo, instalación…"></div>
          <div class="fila">
            <div class="campo"><label for="lc">Cantidad</label><input type="number" id="lc" name="cantidad" step="any" min="0" value="1"></div>
            <div class="campo"><label for="lp">Precio unitario (IVA incl.)</label><input type="number" id="lp" name="precioUnit" step="0.01" min="0" required></div>
            <div class="campo"><label for="ldias">Días hábiles</label><input type="number" id="ldias" name="dias" min="0" value="0"></div>
          </div>
          <div class="modal-pie"><button type="button" class="btn" data-cerrar>Cancelar</button><button class="btn primario">Agregar</button></div>
        </form>`, {
        alAbrir(c) {
          c.querySelector('#fl').addEventListener('submit', e => {
            e.preventDefault();
            const d = u.datosForm(e.target);
            A.modal.cerrar();
            agregar({ tipo: 'libre', categoria: 'Otros', descripcion: d.descripcion, cantidad: Number(d.cantidad) || 1, precioUnit: Number(d.precioUnit) || 0, dias: Number(d.dias) || 0, unidad: 'pieza' });
          });
        },
      });
    },
  };

  // Selector de cliente reutilizable: busca en contactos o deja escribir uno nuevo.
  A.selectorCliente = function (cont, doc, alCambiar) {
    function pintar() {
      const c = doc.contactoId && A.db.obtener('contactos', doc.contactoId);
      cont.innerHTML = `
        <div class="fila">
          <div class="campo" style="flex:2 1 220px;position:relative"><label for="sc-nombre">Cliente</label>
            <input type="text" id="sc-nombre" value="${esc(doc.clienteNombre || '')}" placeholder="Busca o escribe el nombre" autocomplete="off">
            <div class="resultados" id="sc-res" style="position:absolute;top:100%;left:0;right:0;z-index:5;background:var(--superficie);box-shadow:var(--sombra);border-radius:10px"></div>
          </div>
          <div class="campo"><label for="sc-tel">Teléfono / WhatsApp</label><input type="tel" id="sc-tel" value="${esc(doc.telefono || '')}" placeholder="10 dígitos"></div>
        </div>
        ${c ? `<div class="chico tenue" style="margin:-6px 0 10px">Cliente registrado · <a href="#/contacto/${c.id}">ver ficha</a> · <button type="button" class="btn-icono chico" id="sc-quitar">desvincular</button></div>`
            : `<div class="fila" id="sc-nuevo" style="align-items:center;margin:-4px 0 10px;gap:8px" ${doc.clienteNombre ? '' : 'hidden'}>
                <span class="chico tenue">Cliente nuevo: se guardará en Contactos. ¿Cómo nos conoció?</span>
                <select id="sc-origen" style="width:auto;min-height:34px;padding:4px 8px"><option value="">—</option>${A.kpis.ORIGENES.map(o => `<option ${doc.origenCliente === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></div>`}`;
      const inp = cont.querySelector('#sc-nombre');
      const res = cont.querySelector('#sc-res');
      inp.addEventListener('input', () => {
        doc.clienteNombre = inp.value; doc.contactoId = null;
        cont.querySelector('#sc-nuevo').hidden = !inp.value.trim();
        const q = inp.value.trim();
        const lista = q ? A.db.todos('contactos').filter(x => u.coincide(`${x.nombre} ${x.telefono} ${x.giro || ''}`, q)).slice(0, 6) : [];
        res.innerHTML = lista.map(x => `<button type="button" class="resultado" data-id="${x.id}"><span><strong>${esc(x.nombre)}</strong> <span class="tenue">${esc(x.telefono || '')}</span></span><span class="tenue chico">${x.tipo === 'proveedor' ? 'Proveedor' : 'Cliente'}</span></button>`).join('');
        alCambiar && alCambiar();
      });
      inp.addEventListener('blur', () => setTimeout(() => { res.innerHTML = ''; }, 200));
      res.addEventListener('click', e => {
        const b = e.target.closest('[data-id]');
        if (!b) return;
        const x = A.db.obtener('contactos', b.dataset.id);
        doc.contactoId = x.id; doc.clienteNombre = x.nombre; doc.telefono = x.telefono || '';
        pintar(); alCambiar && alCambiar();
      });
      cont.querySelector('#sc-tel').addEventListener('input', e => { doc.telefono = e.target.value; });
      const origen = cont.querySelector('#sc-origen');
      if (origen) origen.addEventListener('change', e => { doc.origenCliente = e.target.value; alCambiar && alCambiar(); });
      const q = cont.querySelector('#sc-quitar');
      if (q) q.addEventListener('click', () => { doc.contactoId = null; pintar(); });
    }
    pintar();
  };

  // Al guardar un documento: si el cliente no existe, se crea en Contactos.
  A.asegurarCliente = function (doc) {
    if (doc.contactoId || !doc.clienteNombre) return;
    const existente = A.db.todos('contactos').find(c =>
      u.normalizar(c.nombre) === u.normalizar(doc.clienteNombre) ||
      (doc.telefono && u.soloDigitos(c.telefono).slice(-10) === u.soloDigitos(doc.telefono).slice(-10)));
    const c = existente || A.db.guardar('contactos', { tipo: 'cliente', nombre: doc.clienteNombre, telefono: doc.telefono || '', origen: doc.origenCliente || '' });
    doc.contactoId = c.id;
  };
})(window.App);

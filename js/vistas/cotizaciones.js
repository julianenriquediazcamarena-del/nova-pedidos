// Cotizaciones: lista, cotizador, impresión/PDF, envío por WhatsApp y paso a pedido.
(function (A) {
  const u = A.u;
  const esc = u.esc;

  const ESTADOS = { abierta: 'Abierta', aceptada: 'Pasó a pedido', rechazada: 'No aceptada' };

  function vence(c) { return u.sumarDias(c.fecha, Number(c.vigenciaDias) || 0); }
  function vencida(c) { return c.estado === 'abierta' && vence(c) < u.hoy(); }

  // ---------- Documento imprimible (cotización o nota de pedido) ----------
  A.documento = {
    html(tipo, d) {
      const neg = A.db.ajustes().negocio;
      const t = A.precios.totales(d.lineas || []);
      const esPedido = tipo === 'pedido';
      const pagado = esPedido ? A.pedidos.pagado(d) : 0;
      return `<div class="doc">
        <div class="doc-cabeza"><img src="img/wordmark.png" alt="${esc(neg.nombre)}">
          <div class="folio"><span>${esPedido ? 'NOTA DE PEDIDO' : 'COTIZACIÓN'}</span><strong>${esc(d.folio)}</strong>
          <span>${esc(u.fecha(esPedido ? d.fechaRecibido : d.fecha, { day: 'numeric', month: 'long', year: 'numeric' }))}</span></div></div>
        <div class="bloques">
          <div><strong>Cliente</strong><br>${esc(d.clienteNombre || '—')}<br>${esc(d.telefono || '')}</div>
          <div style="text-align:right">${esPedido
            ? `<strong>Fecha de entrega</strong><br>${esc(u.fecha(d.fechaEntrega, { weekday: 'long', day: 'numeric', month: 'long' }))}`
            : `<strong>Vigencia</strong><br>Hasta el ${esc(u.fecha(vence(d), { day: 'numeric', month: 'long', year: 'numeric' }))}`}</div>
        </div>
        <table><thead><tr><th>Concepto</th><th class="der">Cant.</th><th class="der">P. unit.</th><th class="der">Importe</th></tr></thead><tbody>
          ${(d.lineas || []).map(l => `<tr><td>${esc(l.descripcion)}${l.medidas && l.medidas.ancho ? `<br><small>${u.num(l.medidas.ancho)} × ${u.num(l.medidas.alto)} m × ${l.medidas.piezas || 1} pzas</small>` : ''}</td>
            <td class="der">${u.num(l.cantidad)}${l.unidad && l.unidad !== 'pieza' ? ' ' + esc(l.unidad) : ''}</td><td class="der">${u.dinero(l.precioUnit)}</td><td class="der">${u.dinero(l.cantidad * l.precioUnit)}</td></tr>`).join('')}
        </tbody></table>
        <div class="totales" style="margin-top:10px">
          <span>Subtotal</span><span>${u.dinero(t.subtotal)}</span>
          <span>IVA (${A.db.ajustes().iva}%)</span><span>${u.dinero(t.iva)}</span>
          <strong>Total</strong><strong>${u.dinero(t.total)}</strong>
          ${esPedido ? `${(d.pagos || []).length ? d.pagos.map((p, i) => `<span>${i === 0 ? 'Anticipo' : 'Abono'} · ${esc(u.fecha(p.fecha, { day: 'numeric', month: 'short' }))} · ${esc(p.metodo || 'Efectivo')}</span><span>${u.dinero(p.monto)}</span>`).join('') : '<span>Anticipo</span><span>Sin anticipo</span>'}
            <strong>${t.total - pagado > 0.004 ? 'Resta por pagar' : 'Pagado'}</strong><strong>${t.total - pagado > 0.004 ? u.dinero(t.total - pagado) : '✓'}</strong>` : ''}
        </div>
        ${d.notas ? `<p><strong>Notas:</strong> ${esc(d.notas).replace(/\n/g, '<br>')}</p>` : ''}
        ${esPedido ? '' : `<p class="chico">Precios con IVA incluido. Tiempo de entrega a partir de la confirmación y el anticipo.</p>`}
        <div class="pie">${esc(neg.nombre)} · ${esc(neg.direccion)} · WhatsApp ${esc(neg.telefono)}<br><em>${esc(neg.lema)}</em></div>
      </div>`;
    },
    imprimir(tipo, d) {
      document.getElementById('impresion').innerHTML = A.documento.html(tipo, d);
      const titulo = document.title;
      document.title = `${d.folio} ${d.clienteNombre || ''}`.trim();
      setTimeout(() => { window.print(); document.title = titulo; }, 80);
    },
  };

  function mensajeCotizacion(c) {
    const neg = A.db.ajustes().negocio;
    const t = A.precios.totales(c.lineas);
    const dias = c.lineas.length ? Math.max(...c.lineas.map(A.precios.diasLinea)) : 0;
    const nombre = (c.clienteNombre || '').split(' ')[0];
    return `Hola ${nombre}, te comparto la cotización ${c.folio} de ${neg.nombre}:\n` +
      c.lineas.map(l => `• ${u.num(l.cantidad)}${l.unidad && l.unidad !== 'pieza' ? ' ' + l.unidad : ''} × ${l.descripcion}: ${u.dinero(l.cantidad * l.precioUnit)}`).join('\n') +
      `\n\n*Total: ${u.dinero(t.total)}* (IVA incluido)` +
      `\nTiempo de entrega: ${A.precios.textoDias(dias).toLowerCase()} a partir de tu anticipo.` +
      `\nVigencia: hasta el ${u.fecha(vence(c), { day: 'numeric', month: 'long' })}.`;
  }

  // ---------- Lista ----------
  const pref = { q: '', filtro: 'abierta' };
  A.vistas.cotizaciones = {
    titulo: 'Cotizaciones',
    render(c) {
      c.innerHTML = `
        <div class="cabeza"><div><h1>Cotizaciones</h1></div><div class="acciones"><a class="btn primario" href="#/cotizar">＋ Nueva cotización</a></div></div>
        <div class="buscador"><input type="search" id="ct-q" placeholder="Buscar por cliente, folio o producto" value="${esc(pref.q)}"></div>
        <div class="chips" id="ct-f">${[['abierta', 'Abiertas'], ['aceptada', 'Pasaron a pedido'], ['rechazada', 'No aceptadas'], ['todas', 'Todas']].map(([k, t]) => `<button class="chip" data-f="${k}">${t}</button>`).join('')}</div>
        <div id="ct-lista"></div>`;
      const pintar = () => {
        u.$$('#ct-f .chip', c).forEach(b => b.classList.toggle('activo', b.dataset.f === pref.filtro));
        const lista = A.db.todos('cotizaciones')
          .filter(x => pref.filtro === 'todas' || x.estado === pref.filtro)
          .filter(x => !pref.q || u.coincide(`${x.folio} ${x.clienteNombre} ${(x.lineas || []).map(l => l.descripcion).join(' ')}`, pref.q))
          .sort((a, b) => (b.creado || '').localeCompare(a.creado || ''));
        c.querySelector('#ct-lista').innerHTML = lista.length ? `<div class="lista">${lista.map(x => `
          <a class="renglon" href="#/cotizacion/${x.id}">
            <div class="principal"><div class="titulo">${esc(x.clienteNombre || 'Sin cliente')} <span class="clave">${esc(x.folio)}</span></div>
              <div class="detalle">${esc(u.fecha(x.fecha))} · ${esc(A.pedidos.resumenLineas(x))}</div></div>
            <div class="derecha"><div class="precio-grande">${u.dinero(x.total)}</div>
              <span class="insignia ${x.estado === 'aceptada' ? 'verde' : vencida(x) ? 'ambar' : ''}">${vencida(x) ? 'Vencida' : ESTADOS[x.estado]}</span></div>
          </a>`).join('')}</div>` : '<div class="vacio">No hay cotizaciones aquí.</div>';
      };
      c.querySelector('#ct-q').addEventListener('input', e => { pref.q = e.target.value; pintar(); });
      c.querySelector('#ct-f').addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (b) { pref.filtro = b.dataset.f; pintar(); } });
      pintar();
    },
  };

  // ---------- Cotizador ----------
  A.vistas.cotizacion = {
    titulo: 'Cotizar',
    refrescar: false,
    render(c, id) {
      const guardada = id && A.db.obtener('cotizaciones', id);
      if (id && !guardada) { c.innerHTML = '<div class="vacio">Esa cotización no existe. <a href="#/cotizaciones">Ver cotizaciones</a></div>'; return; }
      const aj = A.db.ajustes();
      const doc = guardada ? structuredClone(guardada) : {
        folio: A.db.siguienteFolio('cotizaciones', A.comisiones.prefijo('C')), fecha: u.hoy(), vigenciaDias: aj.vigenciaCotizacion,
        ...A.comisiones.datosVendedor(),
        clienteNombre: '', contactoId: null, telefono: '', lineas: A.borradorLineas || [], notas: '', estado: 'abierta', total: 0,
      };
      A.borradorLineas = null;
      let temporizador;

      function guardar() {
        doc.total = A.precios.totales(doc.lineas).total;
        A.asegurarCliente(doc);
        Object.assign(doc, A.db.guardar('cotizaciones', doc));
      }
      let montado = false;
      function cambio() {
        if (!doc.id || !montado) return;
        clearTimeout(temporizador);
        temporizador = setTimeout(() => { temporizador = null; guardar(); }, 500);
      }

      c.innerHTML = `
        <div class="cabeza">
          <div><a href="#/cotizaciones" class="tenue chico">‹ Cotizaciones</a>
            <h1>${guardada ? 'Cotización' : 'Nueva cotización'} <span class="clave" style="font-size:.9rem">${esc(doc.folio)}</span></h1>
            <div class="subtitulo chico">${guardada ? 'Los cambios se guardan solos' : 'Arma la cotización y guárdala o mándala'}</div></div>
          <div class="acciones" id="cz-acciones"></div>
        </div>
        <div class="dos-col">
          <div>
            <div class="tarjeta"><h2>Conceptos</h2><div id="cz-lineas"></div></div>
            <div class="tarjeta"><h2>Notas para el cliente</h2><textarea id="cz-notas" placeholder="Condiciones, colores, si incluye diseño…">${esc(doc.notas)}</textarea></div>
          </div>
          <div>
            <div class="tarjeta"><h2>Cliente</h2><div id="cz-cliente"></div>
              <div class="fila">
                <div class="campo"><label for="cz-fecha">Fecha</label><input type="date" id="cz-fecha" value="${doc.fecha}"></div>
                <div class="campo"><label for="cz-vig">Vigencia (días)</label><input type="number" id="cz-vig" min="1" value="${doc.vigenciaDias}"></div>
              </div>
              <div class="chico tenue" id="cz-entrega"></div>
            </div>
            ${guardada ? `<div class="tarjeta"><h2>Estado</h2><div class="segmentos" id="cz-estado">${Object.entries(ESTADOS).map(([k, t]) => `<button data-e="${k}">${t}</button>`).join('')}</div>
              ${doc.pedidoId ? `<p class="chico">Pedido creado: <a href="#/pedido/${doc.pedidoId}">ver pedido</a></p>` : ''}</div>` : ''}
          </div>
        </div>`;

      A.selectorCliente(c.querySelector('#cz-cliente'), doc, cambio);
      A.editorLineas.montar(c.querySelector('#cz-lineas'), doc, t => {
        doc.total = t.total;
        const dias = doc.lineas.length ? Math.max(...doc.lineas.map(A.precios.diasLinea)) : 0;
        const e = c.querySelector('#cz-entrega');
        if (e) e.textContent = doc.lineas.length ? `Tiempo de entrega: ${A.precios.textoDias(dias)} · Si confirman hoy, entrega el ${u.fecha(A.precios.fechaEntrega(u.hoy(), doc.lineas), { weekday: 'long', day: 'numeric', month: 'short' })}` : '';
        cambio();
      });
      c.querySelector('#cz-notas').addEventListener('input', e => { doc.notas = e.target.value; cambio(); });
      c.querySelector('#cz-fecha').addEventListener('change', e => { doc.fecha = e.target.value || u.hoy(); cambio(); });
      c.querySelector('#cz-vig').addEventListener('input', e => { doc.vigenciaDias = Number(e.target.value) || 1; cambio(); });
      const est = c.querySelector('#cz-estado');
      const pintarEstado = () => est && u.$$('button', est).forEach(b => b.classList.toggle('activo', b.dataset.e === doc.estado));
      if (est) est.addEventListener('click', e => { const b = e.target.closest('[data-e]'); if (b) { doc.estado = b.dataset.e; pintarEstado(); cambio(); } });
      pintarEstado();

      function validar() {
        if (!doc.lineas.length) { A.aviso('Agrega al menos un concepto.'); return false; }
        return true;
      }
      const acc = c.querySelector('#cz-acciones');
      acc.innerHTML = `
        ${guardada ? '' : '<button class="btn" id="cz-guardar">Guardar</button>'}
        <button class="btn" id="cz-imagen">Imagen</button>
        <button class="btn" id="cz-imprimir">PDF / Imprimir</button>
        <a class="btn verde" id="cz-wa" target="_blank" rel="noopener" href="#">WhatsApp</a>
        ${doc.pedidoId ? '' : '<button class="btn primario" id="cz-pedido">Pasar a pedido</button>'}
        ${guardada && A.esDueno() ? '<button class="btn peligro" id="cz-borrar">Borrar</button>' : ''}`;
      const g = acc.querySelector('#cz-guardar');
      if (g) g.addEventListener('click', () => {
        if (!validar()) return;
        guardar(); A.aviso(`Cotización ${doc.folio} guardada`); A.ir('#/cotizacion/' + doc.id);
      });
      acc.querySelector('#cz-imagen').addEventListener('click', () => {
        if (!validar()) return;
        guardar(); A.notaImagen.mostrar('cotizacion', doc);
      });
      acc.querySelector('#cz-imprimir').addEventListener('click', () => {
        if (!validar()) return;
        guardar(); A.documento.imprimir('cotizacion', doc);
      });
      acc.querySelector('#cz-wa').addEventListener('click', e => {
        if (!validar()) { e.preventDefault(); return; }
        guardar();
        e.currentTarget.href = u.linkWhatsApp(doc.telefono, mensajeCotizacion(doc));
      });
      const p = acc.querySelector('#cz-pedido');
      if (p) p.addEventListener('click', () => {
        if (!validar()) return;
        if (!doc.clienteNombre) return A.aviso('Escribe el nombre del cliente.');
        guardar();
        A.borradorPedido = A.pedidos.nuevoDesde({ ...doc, cotizacionId: doc.id, folioCotizacion: doc.folio });
        // Se crea de inmediato y se liga a la cotización.
        const ped = A.db.guardar('pedidos', A.borradorPedido);
        A.borradorPedido = null;
        doc.estado = 'aceptada'; doc.pedidoId = ped.id;
        guardar();
        A.aviso(`Pedido ${ped.folio} creado`);
        A.ir('#/pedido/' + ped.id);
      });
      const b = acc.querySelector('#cz-borrar');
      if (b) b.addEventListener('click', async () => {
        if (!(await A.modal.confirmar('Borrar cotización', `¿Borrar la cotización ${doc.folio}?`, 'Borrar'))) return;
        clearTimeout(temporizador); temporizador = null;
        A.db.borrar('cotizaciones', doc.id);
        A.ir('#/cotizaciones');
      });

      montado = true;
      return () => { if (temporizador) { clearTimeout(temporizador); guardar(); } };
    },
  };
})(window.App);

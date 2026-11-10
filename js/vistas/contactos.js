// Contactos: clientes y proveedores/maquiladores, con su historial.
(function (A) {
  const u = A.u;
  const esc = u.esc;
  const pref = { tipo: 'cliente', q: '', filtro: 'todos' };
  const FILTROS = [
    ['todos', 'Todos'], ['saldo', 'Con saldo'], ['nuevos', 'Nuevos (30 días)'], ['inactivos', 'Sin comprar +60 días'],
  ];

  function formulario(c) {
    const prov = c.tipo === 'proveedor';
    return `<form id="fcont">
      <div class="segmentos" id="fc-tipo" style="margin-bottom:12px"><button type="button" data-t="cliente">Cliente</button><button type="button" data-t="proveedor">Proveedor / maquila</button></div>
      <input type="hidden" name="tipo" value="${esc(c.tipo)}">
      <div class="campo"><label for="fc-n">Nombre o negocio</label><input type="text" id="fc-n" name="nombre" value="${esc(c.nombre || '')}" required></div>
      <div class="fila">
        <div class="campo"><label for="fc-t">Teléfono / WhatsApp</label><input type="tel" id="fc-t" name="telefono" value="${esc(c.telefono || '')}"></div>
        <div class="campo"><label for="fc-e">Correo</label><input type="email" id="fc-e" name="correo" value="${esc(c.correo || '')}"></div>
      </div>
      <div class="fila">
        <div class="campo"><label for="fc-g" data-solo="cliente">Giro del negocio</label><label for="fc-g" data-solo="proveedor">Qué te maquila</label><input type="text" id="fc-g" name="giro" value="${esc(c.giro || '')}"></div>
        <div class="campo" data-solo="cliente"><label for="fc-c">Cumpleaños</label><input type="date" id="fc-c" name="cumpleanos" value="${esc(c.cumpleanos || '')}"></div>
      </div>
      <div class="fila">
        <div class="campo"><label for="fc-d">Dirección</label><input type="text" id="fc-d" name="direccion" value="${esc(c.direccion || '')}"></div>
        <div class="campo" data-solo="cliente"><label for="fc-r">RFC (si pide factura)</label><input type="text" id="fc-r" name="rfc" value="${esc(c.rfc || '')}"></div>
      </div>
      <div class="campo" data-solo="cliente"><label for="fc-o">¿Cómo nos conoció?</label><select id="fc-o" name="origen"><option value="">—</option>${A.kpis.ORIGENES.map(o => `<option ${c.origen === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></div>
      <div class="campo"><label for="fc-no">Notas</label><textarea id="fc-no" name="notas">${esc(c.notas || '')}</textarea></div>
      <div class="modal-pie"><button type="button" class="btn" data-cerrar>Cancelar</button><button class="btn primario">Guardar</button></div>
    </form>`;
  }

  function editar(c, despues) {
    c = c || { tipo: pref.tipo };
    A.modal.abrir(c.id ? 'Editar contacto' : 'Nuevo contacto', formulario(c), {
      alAbrir(m) {
        const f = m.querySelector('#fcont');
        const tipo = t => {
          f.tipo.value = t;
          u.$$('#fc-tipo button', m).forEach(b => b.classList.toggle('activo', b.dataset.t === t));
          u.$$('[data-solo]', m).forEach(el => { el.hidden = el.dataset.solo !== t; });
        };
        m.querySelector('#fc-tipo').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b) tipo(b.dataset.t); });
        tipo(c.tipo || 'cliente');
        f.addEventListener('submit', e => {
          e.preventDefault();
          const d = u.datosForm(f);
          const g = A.db.guardar('contactos', { ...c, ...d, rfc: (d.rfc || '').toUpperCase() });
          A.modal.cerrar(); A.aviso('Contacto guardado');
          despues && despues(g);
        });
      },
    });
  }
  A.editarContacto = editar;

  A.vistas.contactos = {
    titulo: 'Contactos',
    render(c) {
      c.innerHTML = `
        <div class="cabeza"><h1>Contactos</h1><div class="acciones">
          <div class="segmentos" id="ct-tipo"><button data-t="cliente">Clientes</button><button data-t="proveedor">Proveedores</button></div>
          <button class="btn primario" id="ct-nuevo">＋ Nuevo</button></div></div>
        <div class="buscador"><input type="search" id="ct-q" placeholder="Buscar por nombre, teléfono o giro" value="${esc(pref.q)}"></div>
        <div class="chips" id="ct-f"></div>
        <div id="ct-lista"></div>`;
      const pedidos = A.pedidos.todos().filter(p => p.estado !== 'cancelado');
      const ultimas = A.kpis.ultimasCompras();
      const hoy = u.hoy();
      const pintar = () => {
        u.$$('#ct-tipo button', c).forEach(b => b.classList.toggle('activo', b.dataset.t === pref.tipo));
        const esCliente = pref.tipo === 'cliente';
        c.querySelector('#ct-f').hidden = !esCliente;
        const datos = A.db.todos('contactos').filter(x => (x.tipo || 'cliente') === pref.tipo).map(x => {
          const suyos = pedidos.filter(p => p.contactoId === x.id);
          return { x, suyos, saldo: suyos.reduce((s, p) => s + A.pedidos.saldo(p), 0), ultima: ultimas.get(x.id) };
        });
        const cumple = {
          todos: () => true,
          saldo: d => d.saldo > 0,
          nuevos: d => (d.x.creado || '').slice(0, 10) >= u.sumarDias(hoy, -30),
          inactivos: d => d.ultima && u.diasEntre(d.ultima, hoy) > 60,
        };
        c.querySelector('#ct-f').innerHTML = FILTROS.map(([k, t]) => `<button class="chip ${pref.filtro === k ? 'activo' : ''}" data-f="${k}">${t} <span class="tenue">${datos.filter(cumple[k]).length}</span></button>`).join('');
        const lista = datos.filter(d => (!esCliente || cumple[pref.filtro](d)) && (!pref.q || u.coincide(`${d.x.nombre} ${d.x.telefono} ${d.x.giro} ${d.x.correo}`, pref.q)))
          .sort((a, b) => pref.filtro === 'inactivos' ? (a.ultima || '').localeCompare(b.ultima || '') : a.x.nombre.localeCompare(b.x.nombre, 'es'));
        c.querySelector('#ct-lista').innerHTML = lista.length ? `<div class="lista">${lista.map(({ x, suyos, saldo, ultima }) => `
          <a class="renglon" href="#/contacto/${x.id}"><div class="principal"><div class="titulo">${esc(x.nombre)}</div>
            <div class="detalle">${esc([x.telefono, x.giro, x.origen, x.vendedorNombre && !A.esVendedor() ? 'Cliente de ' + x.vendedorNombre : ''].filter(Boolean).join(' · ') || 'Sin datos')}</div></div>
            <div class="derecha">${esCliente ? `<div class="detalle">${suyos.length} pedido${suyos.length === 1 ? '' : 's'}${ultima ? ` · última compra ${esc(u.relativo(ultima).toLowerCase())}` : ''}</div>` : ''}
            ${saldo > 0 ? `<div class="detalle" style="color:var(--rojo-vivo)">Debe ${u.dinero(saldo)}</div>` : ''}</div></a>`).join('')}</div>`
          : `<div class="vacio">${pref.q || pref.filtro !== 'todos' ? 'Nadie aquí.' : esCliente ? 'Aún no hay clientes. Se agregan solos al crear pedidos o cotizaciones.' : 'Agrega a tus maquiladores y proveedores.'}</div>`;
      };
      c.querySelector('#ct-f').addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (b) { pref.filtro = b.dataset.f; pintar(); } });
      c.querySelector('#ct-q').addEventListener('input', e => { pref.q = e.target.value; pintar(); });
      c.querySelector('#ct-tipo').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b) { pref.tipo = b.dataset.t; pintar(); } });
      c.querySelector('#ct-nuevo').addEventListener('click', () => editar(null, g => A.ir('#/contacto/' + g.id)));
      pintar();
    },
  };

  A.vistas.contacto = {
    titulo: 'Contacto',
    render(c, id) {
      const x = A.db.obtener('contactos', id);
      if (!x) { c.innerHTML = '<div class="vacio">Ese contacto no existe. <a href="#/contactos">Ver contactos</a></div>'; return; }
      const pedidos = A.pedidos.todos().filter(p => p.contactoId === id).sort((a, b) => (b.fechaRecibido || '').localeCompare(a.fechaRecibido || ''));
      const cots = A.db.todos('cotizaciones').filter(p => p.contactoId === id).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
      const comprado = pedidos.filter(p => p.estado !== 'cancelado').reduce((s, p) => s + (p.total || 0), 0);
      const saldo = pedidos.reduce((s, p) => s + A.pedidos.saldo(p), 0);
      const tel = u.soloDigitos(x.telefono);
      c.innerHTML = `
        <div class="cabeza"><div><a href="#/contactos" class="tenue chico">‹ Contactos</a><h1>${esc(x.nombre)}</h1>
          <div class="subtitulo">${x.tipo === 'proveedor' ? 'Proveedor / maquila' : 'Cliente'}${x.giro ? ' · ' + esc(x.giro) : ''}</div></div>
          <div class="acciones">
            ${tel ? `<a class="btn verde" href="${u.linkWhatsApp(x.telefono)}" target="_blank" rel="noopener">WhatsApp</a><a class="btn" href="tel:${tel}">Llamar</a>` : ''}
            <button class="btn" id="co-editar">Editar</button>
            ${x.tipo !== 'proveedor' ? '<button class="btn primario" id="co-pedido">＋ Pedido</button>' : ''}
          </div></div>
        <div class="dos-col">
          <div>
            ${x.tipo !== 'proveedor' ? `<div class="indicadores">
              <div class="indicador"><div class="etq">Pedidos</div><div class="val">${pedidos.length}</div></div>
              <div class="indicador"><div class="etq">Comprado</div><div class="val">${u.dinero(comprado)}</div></div>
              <div class="indicador ${saldo ? 'alerta' : ''}"><div class="etq">Debe</div><div class="val">${u.dinero(saldo)}</div></div></div>
            <h2 style="margin-bottom:10px">Pedidos</h2>
            ${pedidos.length ? `<div class="lista">${pedidos.map(A.pedidos.renglon).join('')}</div>` : '<div class="vacio">Sin pedidos todavía.</div>'}
            ${cots.length ? `<h2 style="margin:20px 0 10px">Cotizaciones</h2><div class="lista">${cots.map(q => `<a class="renglon" href="#/cotizacion/${q.id}"><div class="principal"><div class="titulo">${esc(q.folio)}</div><div class="detalle">${esc(u.fecha(q.fecha))} · ${esc(A.pedidos.resumenLineas(q))}</div></div><div class="derecha precio-grande">${u.dinero(q.total)}</div></a>`).join('')}</div>` : ''}`
            : `<div class="tarjeta"><h2>Notas</h2><p>${esc(x.notas || 'Sin notas.').replace(/\n/g, '<br>')}</p></div>`}
          </div>
          <div class="tarjeta"><h2>Datos</h2>
            ${[['Teléfono', x.telefono], ['Correo', x.correo], ['Nos conoció por', x.origen], ['Cumpleaños', x.cumpleanos && u.fecha(x.cumpleanos, { day: 'numeric', month: 'long' })], ['Dirección', x.direccion], ['RFC', x.rfc], ['Alta', u.fecha(x.creado && x.creado.slice(0, 10))]]
              .filter(([, v]) => v).map(([k, v]) => `<div class="dato"><span>${k}</span><span>${esc(v)}</span></div>`).join('')}
            ${x.tipo !== 'proveedor' && x.notas ? `<p class="chico">${esc(x.notas).replace(/\n/g, '<br>')}</p>` : ''}
            ${A.esDueno() ? '<div style="margin-top:14px"><button class="btn peligro chico" id="co-borrar">Borrar contacto</button></div>' : ''}
          </div>
        </div>`;
      c.querySelector('#co-editar').addEventListener('click', () => editar(x, () => A.recargarVista()));
      const np = c.querySelector('#co-pedido');
      if (np) np.addEventListener('click', () => {
        A.borradorPedido = A.pedidos.nuevoDesde({ clienteNombre: x.nombre, contactoId: x.id, telefono: x.telefono });
        A.ir('#/pedido/nuevo');
      });
      if (A.esDueno()) c.querySelector('#co-borrar').addEventListener('click', async () => {
        if (!(await A.modal.confirmar('Borrar contacto', `¿Borrar a ${x.nombre}? Sus pedidos se conservan.`, 'Borrar'))) return;
        A.db.borrar('contactos', x.id); A.ir('#/contactos');
      });
    },
  };
})(window.App);

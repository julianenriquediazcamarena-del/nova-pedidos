// Pedidos: lista, tablero y ficha con fechas, estado, pagos e historial.
(function (A) {
  const u = A.u;
  const esc = u.esc;

  const ESTADOS = [
    { id: 'recibido', texto: 'Recibido' },
    { id: 'diseno', texto: 'Diseño' },
    { id: 'aprobacion', texto: 'Aprobación' },
    { id: 'produccion', texto: 'Producción' },
    { id: 'enviado', texto: 'Enviado a maquila' },
    { id: 'listo', texto: 'Listo' },
    { id: 'entregado', texto: 'Entregado' },
  ];
  const TEXTO_ESTADO = Object.fromEntries([...ESTADOS, { id: 'cancelado', texto: 'Cancelado' }].map(e => [e.id, e.texto]));
  // Orden de prioridad: lo más urgente arriba.
  const RANGO = { rojo: 0, naranja: 1, amarillo: 2, verde: 3, espera: 4, listo: 5, entregado: 6, cancelado: 7 };
  const DIAS_MAQUILA = 4;
  const SIGUIENTE = {
    enviar: { estado: 'enviado', texto: 'Ya se envió' },
    recibir: { estado: 'listo', texto: 'Ya llegó' },
    terminar: { estado: 'listo', texto: 'Ya está listo' },
    entregar: { estado: 'entregado', texto: 'Entregado' },
  };

  function esLineaMaquila(l) {
    const prod = l.tipo === 'producto' && A.db.todos('productos', { conBorrados: true }).find(x => x.clave === l.clave);
    return u.normalizar(l.fabricacion || (prod && prod.fabricacion) || '').includes('maquila');
  }

  A.pedidos = {
    ESTADOS,
    TEXTO_ESTADO,
    todos() { return A.db.todos('pedidos'); },
    pagado(p) { return u.redondear((p.pagos || []).reduce((s, x) => s + (Number(x.monto) || 0), 0)); },
    saldo(p) { return p.estado === 'cancelado' ? 0 : Math.max(0, u.redondear((p.total || 0) - A.pedidos.pagado(p))); },
    abierto(p) { return !['entregado', 'cancelado'].includes(p.estado); },

    // ---- Maquila ----
    detectarMaquila(p) { return (p.lineas || []).some(esLineaMaquila); },
    esMaquila(p) { return typeof p.maquila === 'boolean' ? p.maquila : A.pedidos.detectarMaquila(p); },
    // Último día para mandar el trabajo a maquila y que regrese a tiempo para la entrega.
    limiteEnvio(p) {
      const lineas = (p.lineas || []).filter(esLineaMaquila);
      const dias = lineas.length ? Math.max(...lineas.map(A.precios.diasLinea)) : DIAS_MAQUILA;
      return u.restarHabiles(p.fechaEntrega, dias, A.db.ajustes().conSabado);
    },
    // Pasos del pedido: con maquila se usa "Enviado a maquila" en lugar de "Producción".
    pasos(p) {
      const quitar = A.pedidos.esMaquila(p) ? 'produccion' : 'enviado';
      return ESTADOS.filter(e => e.id !== quitar || e.id === p.estado);
    },

    // ---- Urgencia ----
    // rojo: atrasado · naranja: hoy · amarillo: siguiente día hábil · verde: a tiempo.
    // En maquila, lo que cuenta es la fecha límite para enviarla, no la de entrega.
    urgencia(p) {
      if (p.estado === 'cancelado') return { nivel: 'cancelado', texto: 'Cancelado' };
      if (p.estado === 'entregado') return { nivel: 'entregado', texto: 'Entregado' };
      if (p.estado === 'listo') return { nivel: 'listo', texto: 'Listo para entregar', accion: 'entregar' };
      const maq = A.pedidos.esMaquila(p);
      const enviar = maq && p.estado !== 'enviado';
      const limite = enviar ? A.pedidos.limiteEnvio(p) : p.fechaEntrega;
      const faltan = u.habilesEntre(u.hoy(), limite, A.db.ajustes().conSabado);
      const nivel = faltan < 0 ? 'rojo' : faltan === 0 ? 'naranja' : faltan === 1 ? 'amarillo' : 'verde';
      const cuando = u.fechaCorta(limite);
      // "mañana" solo si de verdad es mañana; si en medio hay domingo, se dice el día.
      const siguiente = limite === u.sumarDias(u.hoy(), 1) ? 'mañana' : `el ${u.aFecha(limite).toLocaleDateString('es-MX', { weekday: 'long' })}`;
      if (enviar) {
        return { nivel, limite, accion: 'enviar',
          texto: { rojo: 'Enviar a maquila YA', naranja: 'Enviar a maquila hoy', amarillo: `Enviar a maquila ${siguiente}`, verde: `Enviar a maquila antes del ${cuando}` }[nivel] };
      }
      if (maq) {
        return { nivel: faltan <= 0 ? nivel : 'espera', limite, accion: 'recibir',
          texto: faltan < 0 ? 'Maquila atrasada' : faltan === 0 ? 'Llega hoy de maquila' : `En maquila · llega ${cuando}` };
      }
      return { nivel, limite, accion: 'terminar',
        texto: { rojo: 'Atrasado', naranja: 'Entregar hoy', amarillo: `Entregar ${siguiente}`, verde: `A tiempo · ${u.relativo(limite).toLowerCase()}` }[nivel] };
    },
    // Primero lo urgente; entre iguales, lo que hay que mandar a maquila; luego por fecha.
    comparar(a, b) {
      const ua = A.pedidos.urgencia(a), ub = A.pedidos.urgencia(b);
      return (RANGO[ua.nivel] - RANGO[ub.nivel]) ||
        ((ua.accion === 'enviar' ? 0 : 1) - (ub.accion === 'enviar' ? 0 : 1)) ||
        (ua.limite || a.fechaEntrega || '').localeCompare(ub.limite || b.fechaEntrega || '');
    },
    atrasado(p) { return A.pedidos.urgencia(p).nivel === 'rojo'; },
    semaforo(p) { return { rojo: 'rojo', naranja: 'naranja', amarillo: 'amarillo', verde: 'verde', listo: 'azul' }[A.pedidos.urgencia(p).nivel] || ''; },
    insigniaEstado(p) {
      const ur = A.pedidos.urgencia(p);
      const icono = { rojo: '⚠ ', naranja: '● ', amarillo: '◐ ', listo: '✓ ' }[ur.nivel] || '';
      return `<span class="insignia ${A.pedidos.semaforo(p)}">${icono}${esc(ur.texto)}</span>`;
    },
    siguientePaso(p) { return SIGUIENTE[A.pedidos.urgencia(p).accion] || null; },
    leyenda() {
      return `<div class="leyenda-urgencia">${[['rojo', 'Atrasado'], ['naranja', 'Hoy'], ['amarillo', 'Mañana'], ['verde', 'A tiempo'], ['azul', 'Listo']]
        .map(([c, t]) => `<span><i class="punto-urg ${c}"></i>${t}</span>`).join('')}<span class="tenue">· La maquila cuenta por su fecha límite de envío</span></div>`;
    },

    resumenLineas(p) {
      const l = p.lineas || [];
      if (!l.length) return 'Sin conceptos';
      const primero = `${u.num(l[0].cantidad)} × ${l[0].descripcion}`;
      return l.length > 1 ? `${primero} y ${l.length - 1} más` : primero;
    },
    botonAvanzar(p) {
      const sig = A.pedidos.siguientePaso(p);
      return sig ? `<button class="btn chico boton-paso" data-avanzar="${p.id}">✓ ${sig.texto}</button>` : '';
    },
    renglon(p) {
      const saldo = A.pedidos.saldo(p);
      return `<div class="renglon con-accion">
        <span class="franja ${A.pedidos.semaforo(p)}"></span>
        <a class="principal enlace" href="#/pedido/${p.id}">
          <div class="titulo">${esc(p.clienteNombre || 'Sin cliente')} <span class="clave">${esc(p.folio)}</span>${A.pedidos.esMaquila(p) ? ' <span class="etq-maquila">Maquila</span>' : ''}${p.vendedorNombre && !A.esVendedor() ? ` <span class="etq-maquila">Vendedor: ${esc(p.vendedorNombre)}</span>` : ''}${p.requiereFactura ? ' <span class="etq-maquila">Factura</span>' : ''}</div>
          <div class="detalle">${esc(A.pedidos.resumenLineas(p))}</div>
          <div class="detalle fila-estado">${A.pedidos.insigniaEstado(p)}<span>Entrega <strong>${esc(u.relativo(p.fechaEntrega).toLowerCase())}</strong></span>${saldo > 0 ? `<span style="color:var(--rojo-vivo)">Debe ${u.dinero(saldo)}</span>` : ''}</div>
        </a>
        ${A.pedidos.botonAvanzar(p)}
      </div>`;
    },
    nuevoDesde(base = {}) {
      const hoy = u.hoy();
      const lineas = structuredClone(base.lineas || []);
      return {
        id: u.id(), // se fija desde el inicio para poder subir fotos antes de crear el pedido
        folio: A.db.siguienteFolio('pedidos', A.comisiones.prefijo('P')),
        ...(base.vendedorId ? { vendedorId: base.vendedorId, vendedorNombre: base.vendedorNombre } : A.comisiones.datosVendedor()),
        recompra: base.vendedorId ? null : A.comisiones.recompraPara(base.contactoId),
        clienteNombre: base.clienteNombre || '', contactoId: base.contactoId || null, telefono: base.telefono || '',
        fechaRecibido: hoy, fechaEntrega: A.precios.fechaEntrega(hoy, lineas), fechaEntregaManual: false,
        lineas, total: A.precios.totales(lineas).total, pagos: [], estado: 'recibido', notas: base.notas || '',
        cotizacionId: base.cotizacionId || null,
        historial: [{ fecha: u.ahora(), texto: base.cotizacionId ? `Creado desde la cotización ${base.folioCotizacion}` : 'Pedido creado' }],
      };
    },

    // Al entregar con saldo pendiente, pregunta si ya pagó. Devuelve los pagos y una nota, o null si se canceló.
    async cobroAlEntregar(p) {
      const saldo = A.pedidos.saldo(p);
      if (A.esVendedor()) return { pagos: p.pagos || [], nota: 'Entregado por el vendedor' };
      if (saldo <= 0) return { pagos: p.pagos || [], nota: null };
      const r = await A.modal.elegir('Entregar pedido', `${p.clienteNombre || 'El cliente'} debe ${u.dinero(saldo)}. ¿Ya pagó?`,
        [['Efectivo', `Pagó ${u.dinero(saldo)} en efectivo`], ['Transferencia', 'Pagó por transferencia'], ['no', 'Entregar sin cobrar'], ['cancelar', 'Cancelar']]);
      if (r === 'cancelar') return null;
      if (r === 'no') return { pagos: p.pagos || [], nota: `Entregado con saldo de ${u.dinero(saldo)}` };
      return { pagos: [...(p.pagos || []), { id: u.id(), monto: saldo, fecha: u.hoy(), metodo: r, nota: 'Al entregar' }], nota: `Pago de ${u.dinero(saldo)} al entregar (${r})` };
    },
    // Botón rápido de las listas: pasa el pedido al siguiente paso.
    async avanzar(id) {
      const p = A.db.obtener('pedidos', id);
      const sig = p && A.pedidos.siguientePaso(p);
      if (!sig) return;
      const historial = [...(p.historial || []), { fecha: u.ahora(), texto: `Estado: ${TEXTO_ESTADO[sig.estado]}` }];
      const cambios = { estado: sig.estado };
      if (sig.estado === 'entregado') {
        const cobro = await A.pedidos.cobroAlEntregar(p);
        if (!cobro) return;
        cambios.entregadoEn = u.ahora();
        cambios.pagos = cobro.pagos;
        if (cobro.nota) historial.push({ fecha: u.ahora(), texto: cobro.nota });
      }
      A.db.guardar('pedidos', { ...p, ...cambios, historial });
      A.recargarVista();
      A.aviso(`${p.folio}: ${TEXTO_ESTADO[sig.estado]}`);
      if (sig.estado === 'listo') A.pedidos.ofrecerAviso({ ...p, ...cambios });
    },
    // Al quedar listo, ofrece avisarle al cliente por WhatsApp.
    ofrecerAviso(p) {
      if (!p.telefono) return;
      const saldo = A.pedidos.saldo(p);
      const texto = `Hola ${(p.clienteNombre || '').split(' ')[0]}, tu pedido ${p.folio} ya está listo para recoger en ${A.db.ajustes().negocio.nombre}.${saldo > 0 ? ` Saldo pendiente: ${u.dinero(saldo)}.` : ''} ¡Gracias!`;
      A.modal.abrir('Pedido listo', `<p>¿Le avisas a <strong>${esc(p.clienteNombre)}</strong> por WhatsApp?</p>
        <div class="modal-pie"><button class="btn" data-cerrar>Ahora no</button>
        <a class="btn verde" target="_blank" rel="noopener" href="${esc(u.linkWhatsApp(p.telefono, texto))}" data-cerrar>Avisar por WhatsApp</a></div>`);
    },
  };

  // ---------- Pedido al proveedor de playeras ----------
  // Junta las playeras de los pedidos que todavía no se piden, por modelo, color y talla exacta.
  const ORDEN_TALLA = ['1', '2', '3', '4', '6', '8', '10', '12', '14', '16', 'ECH', 'CH', 'M', 'G', 'EG', 'EEG', 'EEEG'];
  A.pedidos.pedidoProveedor = function () {
    const pedidos = A.pedidos.todos().filter(p => ['recibido', 'diseno', 'aprobacion', 'produccion'].includes(p.estado) && !p.playerasPedidas
      && (p.lineas || []).some(l => l.tipo === 'playera'));
    const grupos = new Map();
    pedidos.forEach(p => p.lineas.filter(l => l.tipo === 'playera').forEach(l => {
      const d = l.detalle || {};
      const modelo = A.precios.playera(d.codigo, d.talla, d.color) || {};
      const clave = `${d.codigo}|${d.colorExacto || d.color}`;
      if (!grupos.has(clave)) grupos.set(clave, { codigo: d.codigo, color: d.colorExacto || d.color, nombre: `${modelo.descripcion || ''} ${modelo.genero || ''}`.trim(), tallas: new Map(), total: 0 });
      const g = grupos.get(clave);
      const talla = d.tallaExacta || d.talla;
      g.tallas.set(talla, (g.tallas.get(talla) || 0) + (Number(l.cantidad) || 0));
      g.total += Number(l.cantidad) || 0;
    }));
    const lista = [...grupos.values()].sort((a, b) => a.codigo.localeCompare(b.codigo) || a.color.localeCompare(b.color));
    const tallasOrden = g => [...g.tallas.entries()].sort((a, b) => ORDEN_TALLA.indexOf(a[0]) - ORDEN_TALLA.indexOf(b[0]));
    const total = lista.reduce((s, g) => s + g.total, 0);
    const neg = A.db.ajustes().negocio.nombre;
    const texto = `Pedido de playeras · ${neg} · ${u.fecha(u.hoy())}\n\n` + lista.map(g =>
      `${g.codigo} ${g.nombre} · ${g.color}\n  ${tallasOrden(g).map(([t, n]) => `${t}: ${n}`).join(' · ')}  (${g.total} pzas)`).join('\n') + `\n\nTotal: ${total} piezas`;
    const proveedores = A.db.todos('contactos').filter(x => x.tipo === 'proveedor' && x.telefono);
    if (!lista.length) {
      A.modal.abrir('Pedido al proveedor', '<p>No hay playeras pendientes de pedir. Aquí aparecen las de los pedidos en Recibido, Diseño, Aprobación o Producción que todavía no marcas como pedidas.</p><div class="modal-pie"><button class="btn" data-cerrar>Cerrar</button></div>');
      return;
    }
    A.modal.abrir('Pedido al proveedor', `
      <p class="chico tenue" style="margin-top:-6px">${pedidos.length} pedido${pedidos.length === 1 ? '' : 's'}: ${pedidos.map(p => esc(p.folio)).join(', ')}</p>
      <div class="tabla-envoltura"><table><thead><tr><th>Modelo</th><th>Color</th><th>Tallas</th><th class="der">Piezas</th></tr></thead><tbody>
        ${lista.map(g => `<tr><td><span class="clave">${esc(g.codigo)}</span> ${esc(g.nombre)}</td><td>${esc(g.color)}</td>
          <td>${tallasOrden(g).map(([t, n]) => `<strong>${esc(t)}</strong> ${n}`).join(' · ')}</td><td class="der">${g.total}</td></tr>`).join('')}
      </tbody></table></div>
      <div class="dato" style="margin-top:8px"><span>Total</span><strong>${total} piezas</strong></div>
      ${proveedores.length ? `<div class="campo" style="margin-top:10px"><label for="pv-prov">Mandar a</label><select id="pv-prov">${proveedores.map(x => `<option value="${x.id}">${esc(x.nombre)}</option>`).join('')}</select></div>`
        : '<p class="chico tenue">Tip: registra a tu proveedor en Contactos (tipo Proveedor, con su WhatsApp) para mandárselo directo.</p>'}
      <div class="modal-pie">
        <button type="button" class="btn" id="pv-copiar">Copiar texto</button>
        <a class="btn verde" id="pv-wa" target="_blank" rel="noopener" href="#">WhatsApp</a>
        <button type="button" class="btn primario" id="pv-marcar">Ya lo pedí</button>
      </div>`, {
      ancho: true,
      alAbrir(m) {
        m.querySelector('#pv-copiar').addEventListener('click', async () => {
          try { await navigator.clipboard.writeText(texto); A.aviso('Pedido copiado'); } catch { A.aviso('No se pudo copiar'); }
        });
        m.querySelector('#pv-wa').addEventListener('click', e => {
          const sel = m.querySelector('#pv-prov');
          const prov = sel ? A.db.obtener('contactos', sel.value) : null;
          e.currentTarget.href = u.linkWhatsApp(prov ? prov.telefono : '', texto);
        });
        m.querySelector('#pv-marcar').addEventListener('click', () => {
          const hoy = u.hoy();
          pedidos.forEach(p => A.db.guardar('pedidos', { ...p, playerasPedidas: hoy,
            historial: [...(p.historial || []), { fecha: u.ahora(), texto: 'Playeras pedidas al proveedor' }] }));
          A.modal.cerrar();
          A.aviso(`${pedidos.length} pedido${pedidos.length === 1 ? '' : 's'} marcado${pedidos.length === 1 ? '' : 's'}: playeras pedidas`);
          A.recargarVista();
        });
      },
    });
  };

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-avanzar]');
    if (!b) return;
    e.preventDefault();
    A.pedidos.avanzar(b.dataset.avanzar);
  });

  // ---------- Lista ----------
  const FILTROS = [
    { id: 'activos', texto: 'En proceso', fn: p => A.pedidos.abierto(p) },
    { id: 'urgentes', texto: 'Urgentes', fn: p => ['rojo', 'naranja'].includes(A.pedidos.urgencia(p).nivel) },
    { id: 'porEnviar', texto: 'Por enviar a maquila', fn: p => A.pedidos.urgencia(p).accion === 'enviar' },
    { id: 'enMaquila', texto: 'En maquila', fn: p => p.estado === 'enviado' },
    { id: 'listos', texto: 'Listos', fn: p => p.estado === 'listo' },
    { id: 'cobrar', texto: 'Por cobrar', fn: p => A.pedidos.saldo(p) > 0 },
    { id: 'facturar', texto: 'Por facturar', fn: p => A.factura.pendiente(p) },
    { id: 'entregados', texto: 'Entregados', fn: p => p.estado === 'entregado' },
    { id: 'todos', texto: 'Todos', fn: () => true },
  ];
  const pref = { filtro: 'activos', modo: 'lista', q: '' };

  A.vistas.pedidos = {
    titulo: 'Pedidos',
    render(c) {
      c.innerHTML = `
        <div class="cabeza"><div><h1>Pedidos</h1><div class="subtitulo" id="pd-cuenta"></div></div>
          <div class="acciones"><div class="segmentos" id="pd-modo"><button data-m="lista">Lista</button><button data-m="tablero">Tablero</button></div>
          ${A.esVendedor() ? '' : '<button class="btn" id="pd-proveedor">Pedido al proveedor</button>'}
          <button class="btn" data-venta-rapida>Venta rápida</button>
          <a class="btn primario" href="#/pedido/nuevo">＋ Nuevo pedido</a></div></div>
        <div class="buscador"><input type="search" id="pd-q" placeholder="Buscar por cliente, folio o producto" value="${esc(pref.q)}"></div>
        <div class="chips" id="pd-filtros">${FILTROS.map(f => `<button class="chip" data-f="${f.id}">${f.texto} <span class="tenue" data-n="${f.id}"></span></button>`).join('')}</div>
        ${A.pedidos.leyenda()}
        <div id="pd-lista"></div>`;
      const pintar = () => {
        const base = A.pedidos.todos().filter(p => !pref.q || u.coincide(`${p.folio} ${p.clienteNombre} ${p.telefono} ${(p.lineas || []).map(l => l.descripcion).join(' ')} ${p.notas}`, pref.q));
        FILTROS.forEach(f => { c.querySelector(`[data-n=${f.id}]`).textContent = base.filter(f.fn).length; });
        u.$$('#pd-filtros .chip', c).forEach(b => b.classList.toggle('activo', b.dataset.f === pref.filtro));
        u.$$('#pd-modo button', c).forEach(b => b.classList.toggle('activo', b.dataset.m === pref.modo));
        const filtro = FILTROS.find(f => f.id === pref.filtro);
        const lista = base.filter(pref.modo === 'tablero' ? A.pedidos.abierto : filtro.fn)
          .sort(pref.filtro === 'entregados' && pref.modo === 'lista' ? (a, b) => (b.entregadoEn || '').localeCompare(a.entregadoEn || '') : A.pedidos.comparar);
        c.querySelector('#pd-cuenta').textContent = `${A.pedidos.todos().filter(A.pedidos.abierto).length} en proceso`;
        c.querySelector('#pd-filtros').hidden = pref.modo === 'tablero';
        const destino = c.querySelector('#pd-lista');
        if (pref.modo === 'tablero') {
          destino.innerHTML = `<div class="tablero">${ESTADOS.filter(e => e.id !== 'entregado').map(e => {
            const col = lista.filter(p => p.estado === e.id);
            return `<div class="columna"><h3>${e.texto}<span>${col.length}</span></h3>${col.map(p => `
              <div class="ficha ${A.pedidos.semaforo(p)}">
                <a class="enlace" href="#/pedido/${p.id}">
                  <div class="titulo">${esc(p.clienteNombre || 'Sin cliente')}${A.pedidos.esMaquila(p) ? ' <span class="etq-maquila">Maquila</span>' : ''}</div>
                  <div class="chico tenue">${esc(p.folio)} · ${esc(A.pedidos.resumenLineas(p))}</div>
                  <div style="margin-top:6px">${A.pedidos.insigniaEstado(p)}</div>
                </a>
                ${A.pedidos.botonAvanzar(p)}
              </div>`).join('') || '<div class="chico tenue" style="padding:6px">—</div>'}</div>`;
          }).join('')}</div>`;
        } else {
          destino.innerHTML = lista.length ? `<div class="lista">${lista.map(A.pedidos.renglon).join('')}</div>` : '<div class="vacio">No hay pedidos aquí.</div>';
        }
      };
      const bp = c.querySelector('#pd-proveedor');
      if (bp) bp.addEventListener('click', () => A.pedidos.pedidoProveedor());
      c.querySelector('#pd-q').addEventListener('input', e => { pref.q = e.target.value; pintar(); });
      c.querySelector('#pd-filtros').addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (b) { pref.filtro = b.dataset.f; pintar(); } });
      c.querySelector('#pd-modo').addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (b) { pref.modo = b.dataset.m; pintar(); } });
      pintar();
    },
  };

  // ---------- Ficha / edición ----------
  A.vistas.pedido = {
    titulo: id => id === 'nuevo' ? 'Nuevo pedido' : 'Pedido',
    refrescar: false,
    render(c, id) {
      const guardado = id !== 'nuevo' && A.db.obtener('pedidos', id);
      if (id !== 'nuevo' && !guardado) { c.innerHTML = '<div class="vacio">Ese pedido no existe o fue borrado. <a href="#/pedidos">Ver pedidos</a></div>'; return; }
      const doc = guardado ? structuredClone(guardado) : (A.borradorPedido ? A.borradorPedido : A.pedidos.nuevoDesde());
      A.borradorPedido = null;
      const esNuevo = !guardado;
      const aj = A.db.ajustes();
      let temporizador;

      function guardar(textoHistorial) {
        if (textoHistorial) doc.historial = [...(doc.historial || []), { fecha: u.ahora(), texto: textoHistorial }];
        doc.total = A.precios.totales(doc.lineas).total;
        A.asegurarCliente(doc);
        Object.assign(doc, A.db.guardar('pedidos', doc));
      }
      // En pedidos ya creados, cada cambio se guarda solo.
      let montado = false;
      function autoguardar() {
        if (esNuevo || !montado) return;
        clearTimeout(temporizador);
        temporizador = setTimeout(() => { temporizador = null; guardar(); marcarGuardado(); }, 500);
      }
      function marcarGuardado() { const e = c.querySelector('#pe-guardado'); if (e) e.textContent = 'Guardado ' + u.fechaHora(u.ahora()); }

      c.innerHTML = `
        <div class="cabeza">
          <div><a href="#/pedidos" class="tenue chico">‹ Pedidos</a><h1>${esNuevo ? 'Nuevo pedido' : 'Pedido'} <span class="clave" style="font-size:.9rem">${esc(doc.folio)}</span></h1>
            <div class="subtitulo chico" id="pe-guardado">${esNuevo ? 'Aún no se guarda' : 'Los cambios se guardan solos'}</div></div>
          <div class="acciones" id="pe-acciones"></div>
        </div>
        <div class="dos-col">
          <div>
            <div class="tarjeta"><h2>Cliente</h2><div id="pe-cliente"></div></div>
            <div class="tarjeta"><h2>Conceptos</h2><div id="pe-lineas"></div></div>
            <div class="tarjeta"><h2>Notas</h2><textarea id="pe-notas" placeholder="Medidas, colores, archivo del diseño, quién lo atiende…">${esc(doc.notas || '')}</textarea>
              <div class="etiqueta" style="margin:12px 0 4px">Fotos: logo, dibujo, idea o nota del cliente</div><div id="pe-fotos"></div></div>
            <div class="tarjeta"><h2>Factura</h2><div id="pe-factura"></div></div>
          </div>
          <div>
            <div class="tarjeta"><h2>Fechas</h2>
              <div class="fila">
                <div class="campo"><label for="pe-rec">Recibido</label><input type="date" id="pe-rec" value="${doc.fechaRecibido}"></div>
                <div class="campo"><label for="pe-ent">Entrega comprometida</label><input type="date" id="pe-ent" value="${doc.fechaEntrega}"></div>
              </div>
              <div class="chico tenue" id="pe-ent-info"></div>
              <label class="check" style="margin-top:12px"><input type="checkbox" id="pe-maq"> Se manda a maquila</label>
              <div class="chico tenue" id="pe-maq-info" style="margin-top:4px"></div>
            </div>
            <div class="tarjeta"><h2>Estado</h2><div class="pasos" id="pe-pasos"></div>
              <div style="margin-top:10px" class="chico"><button class="btn-icono chico" id="pe-cancelar"></button></div></div>
            <div class="tarjeta"><h2>Pagos</h2><div id="pe-pagos"></div></div>
            ${A.esVendedor() || (A.esDueno() && (doc.vendedorId || doc.recompra)) ? '<div class="tarjeta"><h2>Comisión del vendedor</h2><div id="pe-comision"></div></div>' : ''}
            ${A.esDueno() && !esNuevo ? '<div class="tarjeta"><h2>Costo y ganancia</h2><div id="pe-costo"></div></div>' : ''}
            ${esNuevo ? '' : '<div class="tarjeta"><h2>Historial</h2><ul class="historial" id="pe-hist"></ul></div>'}
          </div>
        </div>`;

      A.selectorCliente(c.querySelector('#pe-cliente'), doc, () => { autoguardar(); pintarAcciones(); });
      A.editorLineas.montar(c.querySelector('#pe-lineas'), doc, t => {
        doc.total = t.total;
        if (!doc.fechaEntregaManual) { doc.fechaEntrega = A.precios.fechaEntrega(doc.fechaRecibido, doc.lineas); const f = c.querySelector('#pe-ent'); if (f) f.value = doc.fechaEntrega; }
        pintarFechas(); pintarEstado(); pintarPagos(); pintarCosto(); if (montado) pintarAcciones(); autoguardar();
      });
      c.querySelector('#pe-notas').addEventListener('input', e => { doc.notas = e.target.value; autoguardar(); });
      A.adjuntos.montar(c.querySelector('#pe-fotos'), doc, { titulo: 'Tomar o subir foto', alCambiar: () => autoguardar() });
      A.factura.montar(c.querySelector('#pe-factura'), doc, () => autoguardar());
      c.querySelector('#pe-rec').addEventListener('change', e => {
        doc.fechaRecibido = e.target.value || u.hoy();
        if (!doc.fechaEntregaManual) { doc.fechaEntrega = A.precios.fechaEntrega(doc.fechaRecibido, doc.lineas); c.querySelector('#pe-ent').value = doc.fechaEntrega; }
        pintarFechas(); autoguardar();
      });
      c.querySelector('#pe-ent').addEventListener('change', e => { doc.fechaEntrega = e.target.value; doc.fechaEntregaManual = true; pintarFechas(); autoguardar(); });

      function pintarFechas() {
        const calc = A.precios.fechaEntrega(doc.fechaRecibido, doc.lineas);
        const dias = doc.lineas.length ? Math.max(...doc.lineas.map(A.precios.diasLinea)) : 0;
        c.querySelector('#pe-ent-info').innerHTML = doc.fechaEntregaManual && doc.fechaEntrega !== calc
          ? `Fecha puesta a mano. Según los productos sería el ${esc(u.fecha(calc))}. <button class="btn-icono chico" id="pe-recalc">Usar esa</button>`
          : `${esc(u.fecha(doc.fechaEntrega, { weekday: 'long', day: 'numeric', month: 'long' }))} · ${esc(A.precios.textoDias(dias))}${aj.conSabado ? '' : ' (sin sábados)'}`;
        const r = c.querySelector('#pe-recalc');
        if (r) r.addEventListener('click', () => { doc.fechaEntregaManual = false; doc.fechaEntrega = calc; c.querySelector('#pe-ent').value = calc; pintarFechas(); autoguardar(); });
        const maq = A.pedidos.esMaquila(doc);
        c.querySelector('#pe-maq').checked = maq;
        const auto = A.pedidos.detectarMaquila(doc);
        c.querySelector('#pe-maq-info').innerHTML = (maq ? `Enviar a maquila a más tardar el <strong>${esc(u.fecha(A.pedidos.limiteEnvio(doc), { weekday: 'long', day: 'numeric', month: 'long' }))}</strong>. ` : '') +
          (typeof doc.maquila === 'boolean' && doc.maquila !== auto ? 'Marcado a mano.' : auto ? 'Detectado por los productos.' : '') +
          `<div style="margin-top:6px">${A.pedidos.insigniaEstado(doc)}</div>`;
      }
      c.querySelector('#pe-maq').addEventListener('change', e => {
        // Si coincide con lo que dicen los productos se deja en automático.
        doc.maquila = e.target.checked === A.pedidos.detectarMaquila(doc) ? null : e.target.checked;
        pintarFechas(); pintarEstado(); pintarAcciones(); autoguardar();
      });

      async function cambiarEstado(nuevo) {
        if (nuevo === doc.estado) return;
        let notaCobro = null;
        if (nuevo === 'entregado' && !esNuevo) {
          const cobro = await A.pedidos.cobroAlEntregar(doc);
          if (!cobro) return;
          doc.pagos = cobro.pagos;
          notaCobro = cobro.nota;
        }
        doc.estado = nuevo;
        if (nuevo === 'entregado') doc.entregadoEn = u.ahora();
        if (!esNuevo) {
          if (notaCobro) doc.historial = [...(doc.historial || []), { fecha: u.ahora(), texto: notaCobro }];
          guardar(`Estado: ${TEXTO_ESTADO[nuevo]}`); marcarGuardado();
        }
        pintarEstado(); pintarFechas(); pintarPagos(); pintarHistorial(); pintarAcciones();
        if (!esNuevo && nuevo === 'listo') A.pedidos.ofrecerAviso(doc);
      }
      function pintarEstado() {
        const pasos = A.pedidos.pasos(doc);
        const idx = pasos.findIndex(e => e.id === doc.estado);
        c.querySelector('#pe-pasos').innerHTML = doc.estado === 'cancelado'
          ? '<span class="insignia">Pedido cancelado</span>'
          : pasos.map((e, i) => `<button class="paso ${i < idx ? 'hecho' : i === idx ? 'actual' : ''}" data-e="${e.id}">${e.texto}</button>`).join('');
        c.querySelector('#pe-cancelar').textContent = doc.estado === 'cancelado' ? 'Reactivar pedido' : 'Cancelar pedido';
      }
      c.querySelector('#pe-pasos').addEventListener('click', e => { const b = e.target.closest('[data-e]'); if (b) cambiarEstado(b.dataset.e); });
      c.querySelector('#pe-cancelar').addEventListener('click', async () => {
        if (doc.estado === 'cancelado') return cambiarEstado('recibido');
        if (await A.modal.confirmar('Cancelar pedido', `¿Cancelar el pedido ${doc.folio}? Seguirá en la lista de “Todos”.`, 'Cancelar pedido')) cambiarEstado('cancelado');
      });

      // Costo: estimado con los costos del catálogo, o el real que se capture.
      function pintarCosto() {
        const cont = c.querySelector('#pe-costo');
        if (!cont) return;
        if (document.activeElement && document.activeElement.id === 'pe-costo-real') { actualizarGanancia(); return; }
        const e = A.kpis.costoEstimado(doc);
        cont.innerHTML = `
          <div class="dato"><span>Costo estimado</span><strong class="num">${e.completo ? u.dinero(e.valor) : e.valor ? u.dinero(e.valor) + ' + ?' : '—'}</strong></div>
          ${e.faltan.length && doc.lineas.length ? `<div class="chico tenue" style="margin:4px 0">Sin costo registrado: ${e.faltan.map(l => esc(l.clave || l.descripcion)).join(', ')}. Escribe el costo real abajo o agrégalo en Precios.</div>` : ''}
          <div class="campo" style="margin:10px 0 4px"><label for="pe-costo-real">Costo real (lo que te costó)</label>
            <input type="number" id="pe-costo-real" step="0.01" min="0" value="${A.costos.de('ped-' + doc.id) ?? ''}" placeholder="${e.completo ? 'Vacío = usar el estimado' : 'Maquila, playeras, material…'}"></div>
          <div data-gan></div>`;
        actualizarGanancia();
      }
      function actualizarGanancia() {
        const g = c.querySelector('#pe-costo [data-gan]');
        if (!g) return;
        const cp = A.kpis.costoPedido(doc);
        if (cp.valor == null) { g.innerHTML = '<span class="chico tenue">Con el costo se calcula la ganancia del pedido.</span>'; return; }
        const gan = (doc.total || 0) - cp.valor;
        g.innerHTML = `${cp.comision ? `<div class="dato"><span>Comisión del vendedor</span><span class="num">${u.dinero(cp.comision)}</span></div>` : ''}
          <div class="dato"><span>Ganancia${cp.fuente === 'estimado' ? ' estimada' : ''}</span>
          <strong class="num" style="color:${gan >= 0 ? 'var(--verde)' : 'var(--rojo-vivo)'}">${u.dinero(gan)}${doc.total ? ` · ${Math.round(gan / doc.total * 100)}%` : ''}</strong></div>`;
      }
      if (c.querySelector('#pe-costo')) c.querySelector('#pe-costo').addEventListener('input', e => {
        if (e.target.id !== 'pe-costo-real') return;
        // El costo real va a la colección privada del dueño, no dentro del pedido.
        const v = parseFloat(e.target.value);
        clearTimeout(e.target._t);
        e.target._t = setTimeout(() => { A.costos.poner('ped-' + doc.id, Number.isFinite(v) ? v : null); actualizarGanancia(); }, 500);
      });

      function pintarComision() {
        const cont = c.querySelector('#pe-comision');
        if (!cont) return;
        const monto = A.comisiones.montoPedido(doc);
        const quien = doc.vendedorNombre || (doc.recompra && doc.recompra.vendedorNombre) || '';
        const tipo = doc.vendedorId ? 'Venta del vendedor (incluida en el precio)' : doc.recompra ? `Recompra ${doc.recompra.numero || ''} de ${A.db.ajustes().comisiones.recompraVeces} · ${doc.recompra.pct}% del total` : '';
        const liquidado = A.pedidos.saldo(doc) <= 0 && (doc.total || 0) > 0;
        const reg = A.db.obtener('comisiones', 'com-' + doc.id);
        const nota = reg && reg.pagada ? `Comisión pagada${reg.fechaPago ? ' el ' + u.fecha(reg.fechaPago) : ''}.`
          : liquidado ? 'Pedido liquidado: la comisión ya se puede pagar.' : 'Se paga cuando el pedido esté liquidado.';
        cont.innerHTML = `${quien && !A.esVendedor() ? `<div class="dato"><span>Vendedor</span><strong>${esc(quien)}</strong></div>` : ''}
          <div class="dato"><span>${esc(tipo)}</span><strong class="num">${u.dinero(monto)}</strong></div>
          <div class="chico tenue" style="margin-top:6px">${nota}</div>`;
      }

      function pintarPagos() {
        const pagado = A.pedidos.pagado(doc);
        const saldo = Math.max(0, u.redondear(doc.total - pagado));
        c.querySelector('#pe-pagos').innerHTML = `
          <div class="dato"><span>Total</span><strong class="num">${u.dinero(doc.total)}</strong></div>
          ${(doc.pagos || []).map((p, i) => `<div class="dato"><span>${esc(u.fecha(p.fecha))} · ${esc(p.metodo || 'Efectivo')}${p.nota ? ' · ' + esc(p.nota) : ''}${p.por ? ` <span class="tenue">· ${esc(p.por)}</span>` : ''}</span>
            <span class="num">${u.dinero(p.monto)}${A.esDueno() ? ` <button class="btn-icono chico" data-qp="${i}" aria-label="Quitar pago">✕</button>` : ''}</span></div>`).join('')}
          <div class="dato"><span>Saldo</span><strong class="num" style="color:${saldo > 0 ? 'var(--rojo-vivo)' : 'var(--verde)'}">${saldo > 0 ? u.dinero(saldo) : 'Pagado ✓'}</strong></div>
          ${A.esVendedor() ? `<p class="chico tenue" style="margin:10px 0 0">El cliente paga directo al negocio (los datos de pago vienen en la nota). Los pagos los registra el negocio.</p>` : `
          <div class="fila" style="margin-top:12px;gap:8px">
            <button class="btn chico" data-pago="anticipo" ${saldo <= 0 ? 'disabled' : ''}>Anticipo ${aj.anticipoSugerido}%</button>
            <button class="btn chico" data-pago="liquidar" ${saldo <= 0 ? 'disabled' : ''}>Liquidar</button>
            <button class="btn chico" data-pago="otro">Otro monto</button>
          </div>`}`;
        pintarComision();
      }
      c.querySelector('#pe-pagos').addEventListener('click', async e => {
        const q = e.target.closest('[data-qp]');
        if (q) {
          if (!(await A.modal.confirmar('Quitar pago', '¿Quitar este pago del pedido?', 'Quitar'))) return;
          const [p] = doc.pagos.splice(Number(q.dataset.qp), 1);
          doc.pagosEliminados = [...(doc.pagosEliminados || []), p.id]; // para que no regrese al sincronizar
          if (!esNuevo) guardar(`Pago quitado: ${u.dinero(p.monto)}`);
          pintarPagos(); pintarHistorial(); return;
        }
        const b = e.target.closest('[data-pago]');
        if (!b) return;
        const saldo = Math.max(0, u.redondear(doc.total - A.pedidos.pagado(doc)));
        const sugerido = b.dataset.pago === 'anticipo' ? u.redondear(doc.total * aj.anticipoSugerido / 100) : b.dataset.pago === 'liquidar' ? saldo : '';
        A.modal.abrir('Registrar pago', `<form id="fpago">
          <div class="fila">
            <div class="campo"><label for="pg-m">Monto</label><input type="number" id="pg-m" name="monto" step="0.01" min="0.01" value="${sugerido}" required></div>
            <div class="campo"><label for="pg-f">Fecha</label><input type="date" id="pg-f" name="fecha" value="${u.hoy()}"></div>
          </div>
          <div class="fila">
            <div class="campo"><label for="pg-t">Forma de pago</label><select id="pg-t" name="metodo"><option>Efectivo</option><option>Transferencia</option><option>Tarjeta</option><option>Depósito</option></select></div>
            <div class="campo"><label for="pg-n">Nota</label><input type="text" id="pg-n" name="nota" placeholder="Opcional"></div>
          </div>
          <div class="modal-pie"><button type="button" class="btn" data-cerrar>Cancelar</button><button class="btn primario">Registrar</button></div></form>`, {
          alAbrir(m) {
            m.querySelector('#fpago').addEventListener('submit', ev => {
              ev.preventDefault();
              const d = u.datosForm(ev.target);
              const pago = { id: u.id(), monto: u.redondear(d.monto), fecha: d.fecha || u.hoy(), metodo: d.metodo, nota: d.nota };
              doc.pagos = [...(doc.pagos || []), pago];
              A.modal.cerrar();
              if (!esNuevo) { guardar(`Pago de ${u.dinero(pago.monto)} (${pago.metodo})`); marcarGuardado(); }
              pintarPagos(); pintarHistorial();
            });
          },
        });
      });

      function pintarHistorial() {
        const h = c.querySelector('#pe-hist');
        if (h) h.innerHTML = [...(doc.historial || [])].reverse().map(x => `<li><span>${esc(x.texto)}${x.por ? ` <span class="tenue">· ${esc(x.por)}</span>` : ''}</span><span class="tenue">${esc(u.fechaHora(x.fecha))}</span></li>`).join('');
      }

      function pintarAcciones() {
        const a = c.querySelector('#pe-acciones');
        if (esNuevo) {
          a.innerHTML = '<button class="btn primario" id="pe-crear">Crear pedido</button>';
          a.querySelector('#pe-crear').addEventListener('click', () => {
            if (!doc.clienteNombre) return A.aviso('Escribe el nombre del cliente.');
            if (!doc.lineas.length) return A.aviso('Agrega al menos un concepto.');
            A.asegurarCliente(doc);
            if (!doc.vendedorId && !doc.recompra) doc.recompra = A.comisiones.recompraPara(doc.contactoId);
            guardar();
            A.aviso(`Pedido ${doc.folio} creado`);
            A.ir('#/pedido/' + doc.id);
          });
          return;
        }
        const sig = A.pedidos.siguientePaso(doc);
        a.innerHTML = `
          ${sig ? `<button class="btn primario" id="pe-sig">✓ ${sig.texto}</button>` : ''}
          ${doc.telefono ? `<a class="btn verde" target="_blank" rel="noopener" id="pe-wa">WhatsApp</a>` : ''}
          <button class="btn" id="pe-imagen">Nota para el cliente</button>
          <button class="btn" id="pe-imprimir">Imprimir</button>
          ${A.esDueno() ? '<button class="btn peligro" id="pe-borrar">Borrar</button>' : ''}`;
        const wa = a.querySelector('#pe-wa');
        if (wa) wa.addEventListener('click', () => { wa.href = u.linkWhatsApp(doc.telefono, mensajeWhatsApp(doc)); });
        a.querySelector('#pe-imprimir').addEventListener('click', () => A.documento.imprimir('pedido', doc));
        a.querySelector('#pe-imagen').addEventListener('click', () => A.notaImagen.mostrar('pedido', doc));
        const bs = a.querySelector('#pe-sig');
        if (bs) bs.addEventListener('click', () => cambiarEstado(sig.estado));
        if (A.esDueno()) a.querySelector('#pe-borrar').addEventListener('click', async () => {
          if (!(await A.modal.confirmar('Borrar pedido', `¿Borrar el pedido ${doc.folio}? Si solo no se hizo, mejor usa “Cancelar pedido”.`, 'Borrar'))) return;
          clearTimeout(temporizador); temporizador = null;
          A.db.borrar('pedidos', doc.id);
          A.aviso('Pedido borrado');
          A.ir('#/pedidos');
        });
      }

      pintarFechas(); pintarEstado(); pintarPagos(); pintarCosto(); pintarHistorial(); pintarAcciones();
      montado = true;
      return () => { if (temporizador) { clearTimeout(temporizador); guardar(); } };
    },
  };

  // Venta de mostrador: se cobra y entrega al momento; queda como pedido entregado para que cuente en ventas.
  A.ventaRapida = function (despues) {
    const cats = [...new Set(['Copias e impresiones', ...A.precios.categorias(), 'Playeras', 'Otros'])];
    A.modal.abrir('Venta rápida', `<form id="fvr">
      <p class="chico tenue" style="margin-top:-6px">Para lo que se cobra y entrega al momento. Cuenta en ventas y en Desempeño.</p>
      <div class="campo"><label for="vr-c">¿Qué se vendió?</label><input type="text" id="vr-c" name="concepto" required placeholder="Ej. 20 copias a color, 1 impresión tabloide"></div>
      <div class="fila">
        <div class="campo"><label for="vr-cat">Categoría</label><select id="vr-cat" name="categoria">${cats.map(k => `<option>${esc(k)}</option>`).join('')}</select></div>
        <div class="campo"><label for="vr-m">Cobrado (IVA incl.)</label><input type="number" id="vr-m" name="monto" step="0.01" min="0.01" required></div>
      </div>
      <div class="fila">
        ${A.esDueno() ? '<div class="campo"><label for="vr-costo">Costo (opcional)</label><input type="number" id="vr-costo" name="costo" step="0.01" min="0"></div>' : ''}
        <div class="campo"><label for="vr-p">Forma de pago</label><select id="vr-p" name="metodo"><option>Efectivo</option><option>Transferencia</option><option>Tarjeta</option></select></div>
      </div>
      <div class="fila">
        <div class="campo"><label for="vr-cli">Cliente (opcional)</label><input type="text" id="vr-cli" name="cliente"></div>
        <div class="campo"><label for="vr-f">Fecha</label><input type="date" id="vr-f" name="fecha" value="${u.hoy()}"></div>
      </div>
      <div class="modal-pie"><button type="button" class="btn" data-cerrar>Cancelar</button><button class="btn primario">Registrar venta</button></div>
    </form>`, {
      alAbrir(m) {
        m.querySelector('#fvr').addEventListener('submit', e => {
          e.preventDefault();
          const d = u.datosForm(e.target);
          const monto = u.redondear(d.monto);
          const fecha = d.fecha || u.hoy();
          const ped = {
            folio: A.db.siguienteFolio('pedidos', 'P'), origen: 'mostrador',
            clienteNombre: d.cliente || 'Mostrador', contactoId: null, telefono: '',
            fechaRecibido: fecha, fechaEntrega: fecha, fechaEntregaManual: true,
            lineas: [{ tipo: 'libre', categoria: d.categoria, descripcion: d.concepto, cantidad: 1, precioUnit: monto, dias: 0, unidad: 'pieza' }],
            total: monto, pagos: [{ id: u.id(), monto, fecha, metodo: d.metodo }],
            estado: 'entregado', entregadoEn: u.ahora(),
            notas: '', historial: [{ fecha: u.ahora(), texto: 'Venta rápida de mostrador' }],
          };
          if (d.cliente) A.asegurarCliente(ped);
          const guardado = A.db.guardar('pedidos', ped);
          if (d.costo) A.costos.poner('ped-' + guardado.id, d.costo);
          A.modal.cerrar();
          A.aviso(`Venta registrada: ${u.dinero(monto)}`);
          despues ? despues() : A.recargarVista();
        });
      },
    });
  };

  function mensajeWhatsApp(p) {
    const neg = A.db.ajustes().negocio.nombre;
    const saldo = A.pedidos.saldo(p);
    const nombre = (p.clienteNombre || '').split(' ')[0];
    if (p.estado === 'listo') {
      return `Hola ${nombre}, tu pedido ${p.folio} ya está listo para recoger en ${neg}.${saldo > 0 ? ` Saldo pendiente: ${u.dinero(saldo)}.` : ''} ¡Gracias!`;
    }
    if (p.estado === 'entregado') return `Hola ${nombre}, gracias por tu compra en ${neg}. ¡Esperamos verte pronto!`;
    return `Hola ${nombre}, recibimos tu pedido ${p.folio} en ${neg}.\n` +
      (p.lineas || []).map(l => `• ${u.num(l.cantidad)} × ${l.descripcion}`).join('\n') +
      `\nTotal: ${u.dinero(p.total)}${A.pedidos.pagado(p) ? ` · Abonado: ${u.dinero(A.pedidos.pagado(p))}` : ''}${saldo > 0 ? ` · Saldo: ${u.dinero(saldo)}` : ''}` +
      `\nFecha de entrega: ${u.fecha(p.fechaEntrega, { weekday: 'long', day: 'numeric', month: 'long' })}.`;
  }
})(window.App);

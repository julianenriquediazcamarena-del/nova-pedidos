// Comisiones: el dueño ve lo que debe a cada vendedor y las marca pagadas; el vendedor ve las suyas.
(function (A) {
  const u = A.u;
  const esc = u.esc;
  const ESTADOS = { pendiente: ['Pendiente de liquidar', ''], 'por pagar': ['Por pagar', 'ambar'], pagada: ['Pagada', 'verde'] };

  function renglon(x, conVendedor) {
    const [texto, clase] = ESTADOS[x.estado] || [x.estado, ''];
    const enlace = A.db.obtener('pedidos', x.pedidoId) ? `href="#/pedido/${x.pedidoId}"` : '';
    return `<a class="renglon" ${enlace} style="${enlace ? '' : 'cursor:default'}">
      <div class="principal"><div class="titulo">${esc(x.folio || '')} ${x.cliente ? '· ' + esc(x.cliente) : ''}</div>
        <div class="detalle">${esc(u.fecha(x.fecha))} · ${x.tipo === 'recompra' ? 'Recompra del cliente' : 'Venta del vendedor'}${conVendedor ? ' · ' + esc(x.vendedorNombre || 'Vendedor') : ''}${x.fechaPago ? ' · pagada el ' + esc(u.fecha(x.fechaPago)) : ''}</div></div>
      <div class="derecha"><div class="precio-grande">${u.dinero(x.monto)}</div><span class="insignia ${clase}">${texto}</span></div></a>`;
  }
  const suma = (l, estado) => l.filter(x => x.estado === estado).reduce((s, x) => s + x.monto, 0);

  A.vistas.comisiones = {
    titulo: 'Comisiones',
    render(c) {
      if (A.esDueno()) A.comisiones.actualizarRegistros();
      const lista = A.comisiones.lista();
      const aj = A.db.ajustes().comisiones;

      if (A.esVendedor()) {
        c.innerHTML = `
          <div class="cabeza"><div><h1>Mis comisiones</h1><div class="subtitulo">Se pagan cuando el cliente liquida su pedido.</div></div></div>
          <div class="indicadores">
            <div class="indicador ${suma(lista, 'por pagar') ? 'bien' : ''}"><div class="etq">Por cobrar</div><div class="val">${u.pesos(suma(lista, 'por pagar'))}</div></div>
            <div class="indicador"><div class="etq">Pendientes de liquidar</div><div class="val">${u.pesos(suma(lista, 'pendiente'))}</div></div>
            <div class="indicador"><div class="etq">Ya pagadas</div><div class="val">${u.pesos(suma(lista, 'pagada'))}</div></div>
          </div>
          <div class="nota-info">Tu comisión ya viene incluida en los precios que ves. Si un cliente que tú trajiste vuelve a comprar directo con el negocio, en sus siguientes ${aj.recompraVeces} compras recibes el ${aj.recompra}% del total.</div>
          ${lista.length ? `<div class="lista">${lista.map(x => renglon(x, false)).join('')}</div>` : '<div class="vacio">Todavía no tienes comisiones. Crea una cotización o un pedido y aquí aparecerán.</div>'}`;
        return;
      }

      // Dueño: agrupado por vendedor.
      const grupos = new Map();
      lista.forEach(x => { const k = x.vendedorId || 'sin'; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(x); });
      c.innerHTML = `
        <div class="cabeza"><div><h1>Comisiones de vendedores</h1><div class="subtitulo">Venta: ${aj.general}% general${Object.keys(aj.categorias).length ? ', ' + Object.entries(aj.categorias).map(([k, v]) => `${esc(k)} ${v}%`).join(', ') : ''} · Recompra: ${aj.recompra}% en las siguientes ${aj.recompraVeces} compras</div></div>
          <div class="acciones"><a class="btn" href="#/ajustes">Cambiar porcentajes</a></div></div>
        <div class="indicadores">
          <div class="indicador ${suma(lista, 'por pagar') ? 'atencion' : ''}"><div class="etq">Por pagar</div><div class="val">${u.pesos(suma(lista, 'por pagar'))}</div></div>
          <div class="indicador"><div class="etq">Pendientes de liquidar</div><div class="val">${u.pesos(suma(lista, 'pendiente'))}</div></div>
          <div class="indicador"><div class="etq">Pagadas</div><div class="val">${u.pesos(suma(lista, 'pagada'))}</div></div>
        </div>
        ${grupos.size ? [...grupos.entries()].map(([id, l]) => `
          <div class="tarjeta">
            <div class="cabeza" style="margin-bottom:8px"><h2>${esc(l[0].vendedorNombre || 'Vendedor')}</h2>
              ${suma(l, 'por pagar') ? `<button class="btn primario chico" data-pagar="${esc(id)}">Marcar pagadas · ${u.dinero(suma(l, 'por pagar'))}</button>` : ''}</div>
            <div class="lista">${l.map(x => renglon(x, false)).join('')}</div>
          </div>`).join('') : '<div class="vacio">Todavía no hay comisiones. Cuando un vendedor haga pedidos aparecerán aquí.</div>'}`;
      c.querySelectorAll('[data-pagar]').forEach(b => b.addEventListener('click', async () => {
        const l = grupos.get(b.dataset.pagar);
        if (!(await A.modal.confirmar('Pagar comisiones', `¿Ya le pagaste ${u.dinero(suma(l, 'por pagar'))} a ${l[0].vendedorNombre || 'el vendedor'}? Se marcarán como pagadas con fecha de hoy.`, 'Sí, ya le pagué'))) return;
        const n = A.comisiones.marcarPagadas(b.dataset.pagar);
        A.aviso(`${n} comisión${n === 1 ? '' : 'es'} marcada${n === 1 ? '' : 's'} como pagada${n === 1 ? '' : 's'}`);
        A.recargarVista();
      }));
    },
  };
})(window.App);

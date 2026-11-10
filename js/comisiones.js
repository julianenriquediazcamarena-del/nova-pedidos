// Comisiones de vendedores externos.
// - Venta del vendedor: su comisión es lo que se sumó al precio (el cliente la paga; el negocio cobra su precio normal).
// - Recompra: si un cliente que trajo el vendedor vuelve a comprar directo con el negocio, en sus siguientes
//   compras (3 por defecto) el vendedor recibe un porcentaje (10% por defecto) que sale de la ganancia del negocio.
// - Se paga cuando el pedido está liquidado. El dueño las marca como pagadas.
// Los registros de la colección "comisiones" los escribe el dueño; cada vendedor solo puede leer los suyos.
(function (A) {
  const u = A.u;

  function liquidado(p) { return p.estado !== 'cancelado' && (p.total || 0) > 0 && A.pedidos.saldo(p) <= 0; }

  A.comisiones = {
    // Datos del vendedor para un documento nuevo (cotización o pedido) creado por él.
    datosVendedor() {
      if (!A.esVendedor()) return {};
      return { vendedorId: (A.sync.perfil() || {}).id, vendedorNombre: A.sync.nombreUsuario() };
    },
    // Prefijo de folio: los vendedores usan el suyo para no chocar con los del negocio (ej. P-JV-0001).
    prefijo(base) {
      if (!A.esVendedor()) return base;
      const p = A.sync.perfil() || {};
      const cod = (p.codigo || (p.nombre || 'V').split(/\s+/).map(x => x[0]).join('').slice(0, 3)).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'V';
      return `${base}-${cod}`;
    },

    // Comisión de un pedido creado por un vendedor: lo que se le sumó a cada línea.
    deVenta(p) {
      if (!p.vendedorId) return 0;
      return u.redondear((p.lineas || []).reduce((s, l) => {
        if (l.precioBase == null) return s;
        return s + Math.max(0, (Number(l.precioUnit) || 0) - Number(l.precioBase)) * (Number(l.cantidad) || 0);
      }, 0));
    },
    deRecompra(p) {
      if (p.vendedorId || !p.recompra) return 0;
      return u.redondear((p.total || 0) * (Number(p.recompra.pct) || 0) / 100);
    },
    montoPedido(p) { return p.estado === 'cancelado' ? 0 : A.comisiones.deVenta(p) + A.comisiones.deRecompra(p); },

    // Al crear un pedido del negocio: ¿es recompra de un cliente que trajo un vendedor?
    recompraPara(contactoId) {
      if (!contactoId || A.esVendedor()) return null;
      const c = A.db.obtener('contactos', contactoId);
      if (!c || !c.vendedorId) return null;
      const aj = A.db.ajustes().comisiones;
      const previas = A.db.todos('pedidos').filter(p => p.contactoId === contactoId && !p.vendedorId && p.recompra && p.estado !== 'cancelado').length;
      if (previas >= (Number(aj.recompraVeces) || 0)) return null;
      return { vendedorId: c.vendedorId, vendedorNombre: c.vendedorNombre || '', pct: Number(aj.recompra) || 0, numero: previas + 1 };
    },

    // Lista de comisiones (dueño: todas; vendedor: las suyas) con su estado.
    lista() {
      const registros = new Map(A.db.todos('comisiones').map(r => [r.pedidoId, r]));
      const visibles = A.db.todos('pedidos').filter(p => p.estado !== 'cancelado' && (p.vendedorId || p.recompra));
      const salida = visibles.map(p => {
        const reg = registros.get(p.id) || {};
        const monto = A.comisiones.montoPedido(p);
        return {
          pedidoId: p.id, folio: p.folio, cliente: p.clienteNombre, fecha: p.fechaRecibido, total: p.total,
          vendedorId: p.vendedorId || p.recompra.vendedorId, vendedorNombre: p.vendedorNombre || p.recompra.vendedorNombre || reg.vendedorNombre || '',
          tipo: p.vendedorId ? 'venta' : 'recompra', monto,
          estado: reg.pagada ? 'pagada' : liquidado(p) ? 'por pagar' : 'pendiente', fechaPago: reg.fechaPago || null,
        };
      });
      // Recompras que el vendedor no puede ver como pedido (son del negocio): llegan solo como registro.
      registros.forEach(r => {
        if (salida.some(x => x.pedidoId === r.pedidoId)) return;
        salida.push({ ...r, cliente: r.cliente || '', estado: r.pagada ? 'pagada' : r.liquidado ? 'por pagar' : 'pendiente' });
      });
      return salida.filter(x => x.monto > 0).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
    },

    // El dueño guarda un registro por comisión para que el vendedor la vea (y para marcarla pagada).
    actualizarRegistros() {
      if (!A.esDueno()) return;
      A.comisiones.lista().forEach(x => {
        if (!x.vendedorId) return;
        const id = 'com-' + x.pedidoId;
        const previo = A.db.obtener('comisiones', id);
        const datos = { id, pedidoId: x.pedidoId, folio: x.folio, cliente: x.tipo === 'recompra' ? x.cliente : '', fecha: x.fecha,
          vendedorId: x.vendedorId, vendedorNombre: x.vendedorNombre, tipo: x.tipo, monto: x.monto,
          liquidado: x.estado !== 'pendiente', pagada: !!(previo && previo.pagada), fechaPago: previo ? previo.fechaPago || null : null };
        if (!previo || ['monto', 'liquidado', 'vendedorNombre', 'folio'].some(k => previo[k] !== datos[k])) A.db.guardar('comisiones', datos);
      });
    },
    marcarPagadas(vendedorId) {
      const hoy = u.hoy();
      let n = 0;
      A.comisiones.actualizarRegistros();
      A.comisiones.lista().filter(x => x.vendedorId === vendedorId && x.estado === 'por pagar').forEach(x => {
        const r = A.db.obtener('comisiones', 'com-' + x.pedidoId);
        if (r) { A.db.guardar('comisiones', { ...r, pagada: true, fechaPago: hoy }); n++; }
      });
      return n;
    },
  };
})(window.App);

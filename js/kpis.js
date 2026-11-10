// Cálculo de indicadores: periodos (semana/mes), costos estimados, ganancias y comparaciones.
(function (A) {
  const u = A.u;
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  const ORIGENES = ['Recomendación', 'Facebook', 'Instagram', 'TikTok', 'Google / Maps', 'WhatsApp', 'Pasaba por el local', 'Página web', 'Otro'];

  function fechaLocal(isoCompleto) { return isoCompleto ? u.isoFecha(new Date(isoCompleto)) : null; }

  A.kpis = {
    ORIGENES,

    // ---------- Periodos ----------
    // Semanas de lunes a domingo; meses naturales.
    periodo(tipo, iso) {
      const d = u.aFecha(iso);
      if (tipo === 'mes') {
        const inicio = u.isoFecha(new Date(d.getFullYear(), d.getMonth(), 1));
        const fin = u.isoFecha(new Date(d.getFullYear(), d.getMonth() + 1, 0));
        return { tipo, inicio, fin, etiqueta: `${MESES[d.getMonth()]} ${d.getFullYear()}`, corta: `${MESES_CORTOS[d.getMonth()]}${d.getMonth() === 0 ? ' ' + String(d.getFullYear()).slice(2) : ''}` };
      }
      const lunes = u.sumarDias(iso, -((d.getDay() + 6) % 7));
      const domingo = u.sumarDias(lunes, 6);
      const a = u.aFecha(lunes), b = u.aFecha(domingo);
      const txt = x => `${x.getDate()} ${MESES_CORTOS[x.getMonth()]}`;
      return { tipo, inicio: lunes, fin: domingo, etiqueta: `Semana del ${txt(a)} al ${txt(b)}`, corta: txt(a) };
    },
    mover(p, n) {
      if (p.tipo === 'mes') { const d = u.aFecha(p.inicio); return A.kpis.periodo('mes', u.isoFecha(new Date(d.getFullYear(), d.getMonth() + n, 1))); }
      return A.kpis.periodo('semana', u.sumarDias(p.inicio, 7 * n));
    },
    ultimos(p, n) {
      const lista = [];
      for (let i = n - 1; i >= 0; i--) lista.push(A.kpis.mover(p, -i));
      return lista;
    },
    dentro(iso, p) { return !!iso && iso >= p.inicio && iso <= p.fin; },
    diasDe(p) { return u.diasEntre(p.inicio, p.fin) + 1; },

    // ---------- Costos ----------
    categoriaLinea(l) {
      if (l.categoria) return l.categoria;
      if (l.tipo === 'playera') return 'Playeras';
      if (l.tipo === 'producto') {
        const p = A.db.todos('productos', { conBorrados: true }).find(x => x.clave === l.clave);
        if (p) return p.categoria;
      }
      return 'Otros';
    },
    costoLinea(l) {
      const aj = A.db.ajustes();
      const cant = Number(l.cantidad) || 0;
      if (l.costoUnit != null) return l.costoUnit * cant;
      if (l.tipo === 'producto') {
        const p = A.db.todos('productos', { conBorrados: true }).find(x => x.clave === l.clave);
        return p && p.costo != null && p.costo !== '' ? Number(p.costo) * cant : null;
      }
      if (l.tipo === 'playera') {
        const d = l.detalle || {};
        const pl = A.precios.playera(d.codigo, d.talla, d.color);
        if (!pl) return null;
        const playera = pl.costo != null && pl.costo !== '' ? Number(pl.costo) : (aj.costoPlayeraDesdeMayoreo && pl.mayoreo ? Number(pl.mayoreo) : null);
        const porLado = aj.costoTecnica[d.tecnica];
        if (playera == null || porLado == null || porLado === '') return null;
        return (playera + Number(porLado) * (Number(d.planchados) || 0)) * cant;
      }
      return null;
    },
    costoEstimado(pedido) {
      const lineas = pedido.lineas || [];
      let valor = 0, faltan = [];
      lineas.forEach(l => { const c = A.kpis.costoLinea(l); if (c == null) faltan.push(l); else valor += c; });
      return { valor: u.redondear(valor), completo: lineas.length > 0 && !faltan.length, faltan };
    },
    // Costo que cuenta para la ganancia: el que se capturó a mano, o el estimado si está completo.
    costoPedido(pedido) {
      if (pedido.costo != null && pedido.costo !== '') return { valor: Number(pedido.costo), fuente: 'real' };
      const e = A.kpis.costoEstimado(pedido);
      return e.completo ? { valor: e.valor, fuente: 'estimado' } : { valor: null, fuente: 'falta', parcial: e.valor, faltan: e.faltan };
    },

    // ---------- Indicadores de un periodo ----------
    metricas(p) {
      const pedidos = A.db.todos('pedidos').filter(x => x.estado !== 'cancelado');
      const enPeriodo = pedidos.filter(x => A.kpis.dentro(x.fechaRecibido, p));
      const ventas = enPeriodo.reduce((s, x) => s + (Number(x.total) || 0), 0);
      const cobrado = pedidos.flatMap(x => x.pagos || []).filter(pg => A.kpis.dentro(pg.fecha, p)).reduce((s, pg) => s + (Number(pg.monto) || 0), 0);

      let ventasConCosto = 0, costo = 0;
      const sinCosto = [];
      enPeriodo.forEach(x => {
        const c = A.kpis.costoPedido(x);
        if (c.valor == null) sinCosto.push(x);
        else { ventasConCosto += Number(x.total) || 0; costo += c.valor; }
      });
      const ganancia = ventasConCosto - costo;
      const gastos = A.db.todos('gastos').filter(g => A.kpis.dentro(g.fecha, p)).reduce((s, g) => s + (Number(g.monto) || 0), 0);

      // Clientes: nuevo = su primera compra cae en el periodo.
      const primera = A.kpis.primerasCompras(pedidos);
      const clientesPeriodo = new Set(enPeriodo.map(x => x.contactoId).filter(Boolean));
      const nuevos = [...clientesPeriodo].filter(id => A.kpis.dentro(primera.get(id), p));

      const cots = A.db.todos('cotizaciones').filter(c => A.kpis.dentro(c.fecha, p));
      const entregados = pedidos.filter(x => x.estado === 'entregado' && A.kpis.dentro(fechaLocal(x.entregadoEn), p) && x.origen !== 'mostrador');
      const aTiempo = entregados.filter(x => fechaLocal(x.entregadoEn) <= x.fechaEntrega).length;

      const porCategoria = new Map();
      enPeriodo.forEach(x => (x.lineas || []).forEach(l => {
        const k = A.kpis.categoriaLinea(l);
        porCategoria.set(k, (porCategoria.get(k) || 0) + (Number(l.cantidad) || 0) * (Number(l.precioUnit) || 0));
      }));

      return {
        periodo: p,
        ventas: u.redondear(ventas), cobrado: u.redondear(cobrado),
        pedidos: enPeriodo.length, ticket: enPeriodo.length ? u.redondear(ventas / enPeriodo.length) : 0,
        costo: u.redondear(costo), ventasConCosto: u.redondear(ventasConCosto), sinCosto,
        ganancia: u.redondear(ganancia), margen: ventasConCosto ? ganancia / ventasConCosto : null,
        gastos: u.redondear(gastos), utilidad: u.redondear(ganancia - gastos),
        clientes: clientesPeriodo.size, nuevos: nuevos.length, idsNuevos: nuevos,
        cotizaciones: cots.length, cotAceptadas: cots.filter(c => c.estado === 'aceptada').length,
        conversion: cots.length ? cots.filter(c => c.estado === 'aceptada').length / cots.length : null,
        entregados: entregados.length, aTiempo, pctATiempo: entregados.length ? aTiempo / entregados.length : null,
        porCategoria: [...porCategoria.entries()].sort((a, b) => b[1] - a[1]),
      };
    },
    primerasCompras(pedidos) {
      const m = new Map();
      (pedidos || A.db.todos('pedidos').filter(x => x.estado !== 'cancelado')).forEach(x => {
        if (!x.contactoId) return;
        const f = m.get(x.contactoId);
        if (!f || x.fechaRecibido < f) m.set(x.contactoId, x.fechaRecibido);
      });
      return m;
    },
    ultimasCompras() {
      const m = new Map();
      A.db.todos('pedidos').filter(x => x.estado !== 'cancelado').forEach(x => {
        if (!x.contactoId) return;
        const f = m.get(x.contactoId);
        if (!f || x.fechaRecibido > f) m.set(x.contactoId, x.fechaRecibido);
      });
      return m;
    },

    // Promedio semanal de ventas, pedidos y clientes nuevos entre dos fechas (incluidas).
    promedioSemanal(desde, hasta) {
      const dias = u.diasEntre(desde, hasta) + 1;
      if (dias <= 0) return null;
      const p = { tipo: 'rango', inicio: desde, fin: hasta };
      const m = A.kpis.metricas(p);
      const f = 7 / dias;
      return { dias, ventas: m.ventas * f, pedidos: m.pedidos * f, nuevos: m.nuevos * f };
    },
    // Efecto de una estrategia: 4 semanas antes contra lo que lleva (máx. 4 semanas o hasta su fin).
    efecto(e) {
      const hoy = u.hoy();
      if (e.fechaInicio > hoy) return { estado: 'futura' };
      const antes = A.kpis.promedioSemanal(u.sumarDias(e.fechaInicio, -28), u.sumarDias(e.fechaInicio, -1));
      let fin = u.sumarDias(e.fechaInicio, 27);
      if (e.fechaFin && e.fechaFin < fin) fin = e.fechaFin;
      if (fin > hoy) fin = hoy;
      const durante = A.kpis.promedioSemanal(e.fechaInicio, fin);
      return { estado: durante.dias < 7 ? 'pocos-datos' : 'ok', antes, durante, hasta: fin };
    },

    // Variación contra el periodo anterior (null si no hay base).
    delta(actual, anterior) {
      if (actual == null || anterior == null) return null;
      if (anterior === 0) return actual === 0 ? 0 : null;
      return (actual - anterior) / Math.abs(anterior);
    },
  };
})(window.App);

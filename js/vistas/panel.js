// Inicio: lo que hay que entregar, lo atrasado y lo que se debe.
(function (A) {
  const u = A.u;
  const esc = u.esc;

  function cumpleanosProximos(dias = 7) {
    const hoy = u.hoy();
    return A.db.todos('contactos').filter(c => c.cumpleanos).map(c => {
      const [, m, d] = c.cumpleanos.split('-');
      let fecha = `${hoy.slice(0, 4)}-${m}-${d}`;
      if (fecha < hoy) fecha = `${Number(hoy.slice(0, 4)) + 1}-${m}-${d}`;
      return { c, fecha, faltan: u.diasEntre(hoy, fecha) };
    }).filter(x => x.faltan <= dias).sort((a, b) => a.faltan - b.faltan);
  }

  A.vistas.panel = {
    titulo: 'Inicio',
    render(c) {
      const hoy = u.hoy();
      const pedidos = A.pedidos.todos();
      const abiertos = pedidos.filter(A.pedidos.abierto);
      const enProceso = abiertos.filter(p => p.estado !== 'listo');
      const urg = new Map(enProceso.map(p => [p.id, A.pedidos.urgencia(p)]));
      const nivel = p => urg.get(p.id).nivel;
      const atrasados = enProceso.filter(p => nivel(p) === 'rojo');
      const maquilaHoy = enProceso.filter(p => urg.get(p.id).accion === 'enviar' && ['rojo', 'naranja'].includes(nivel(p)));
      const paraHoy = enProceso.filter(p => urg.get(p.id).accion !== 'enviar' && p.fechaEntrega === hoy);
      const listos = abiertos.filter(p => p.estado === 'listo');
      const porCobrar = pedidos.reduce((s, p) => s + A.pedidos.saldo(p), 0);
      const mes = hoy.slice(0, 7);
      const ventasMes = pedidos.filter(p => p.estado !== 'cancelado' && (p.fechaRecibido || '').startsWith(mes)).reduce((s, p) => s + (p.total || 0), 0);
      const cobradoMes = pedidos.flatMap(p => p.pagos || []).filter(x => (x.fecha || '').startsWith(mes)).reduce((s, x) => s + (Number(x.monto) || 0), 0);
      // Prioridades: atrasado, hoy y mañana (la maquila por su fecha límite de envío); primero lo de maquila.
      const urgentes = enProceso.filter(p => ['rojo', 'naranja', 'amarillo'].includes(nivel(p))).sort(A.pedidos.comparar);
      const proximos = enProceso.filter(p => !urgentes.includes(p) && p.fechaEntrega <= u.sumarDias(hoy, 7)).sort(A.pedidos.comparar);
      const cumple = cumpleanosProximos();
      const nombreMes = new Date().toLocaleDateString('es-MX', { month: 'long' });

      c.innerHTML = `
        <div class="cabeza">
          <div><h1>${saludo()}</h1><div class="subtitulo">${esc(u.fecha(hoy, { weekday: 'long', day: 'numeric', month: 'long' }))}</div></div>
          <div class="acciones">
            <a class="btn" href="#/precios">Buscar precio</a>
            <a class="btn" href="#/cotizar">Cotizar</a>
            <button class="btn" data-venta-rapida>Venta rápida</button>
            <a class="btn primario" href="#/pedido/nuevo">＋ Nuevo pedido</a>
          </div>
        </div>
        <div class="indicadores">
          <div class="indicador ${atrasados.length ? 'alerta' : ''}"><div class="etq">Atrasados</div><div class="val">${atrasados.length}</div></div>
          <div class="indicador ${maquilaHoy.length ? 'atencion' : ''}"><div class="etq">Enviar a maquila hoy</div><div class="val">${maquilaHoy.length}</div></div>
          <div class="indicador ${paraHoy.length ? 'atencion' : ''}"><div class="etq">Entregar hoy</div><div class="val">${paraHoy.length}</div></div>
          <div class="indicador ${listos.length ? 'bien' : ''}"><div class="etq">Listos por entregar</div><div class="val">${listos.length}</div></div>
          <div class="indicador ${porCobrar ? 'alerta' : ''}"><div class="etq">Por cobrar</div><div class="val">${u.pesos(porCobrar)}</div></div>
          ${A.esDueno() ? `<div class="indicador"><div class="etq">Vendido en ${esc(nombreMes)}</div><div class="val">${u.pesos(ventasMes)}</div><div class="chico tenue">Cobrado ${u.pesos(cobradoMes)}</div></div>` : ''}
        </div>
        <div class="rejilla dos">
          <div>
            <div class="cabeza" style="margin-bottom:6px"><h2>Prioridades: atrasado, hoy y mañana</h2></div>
            ${A.pedidos.leyenda()}
            ${urgentes.length ? `<div class="lista">${urgentes.map(A.pedidos.renglon).join('')}</div>` : '<div class="vacio">Nada urgente. 👌</div>'}
            <div class="cabeza" style="margin:22px 0 10px"><h2>Listos para entregar</h2></div>
            ${listos.length ? `<div class="lista">${listos.map(A.pedidos.renglon).join('')}</div>` : '<div class="vacio">No hay pedidos esperando al cliente.</div>'}
          </div>
          <div>
            <div class="cabeza" style="margin-bottom:10px"><h2>Después: próximos 7 días</h2></div>
            ${proximos.length ? `<div class="lista">${proximos.map(A.pedidos.renglon).join('')}</div>` : '<div class="vacio">Nada más programado esta semana.</div>'}
            ${cumple.length ? `<div class="cabeza" style="margin:22px 0 10px"><h2>Cumpleaños de clientes</h2></div>
              <div class="lista">${cumple.map(x => `<a class="renglon" href="#/contacto/${x.c.id}"><div class="principal"><div class="titulo">🎂 ${esc(x.c.nombre)}</div>
                <div class="detalle">${x.faltan === 0 ? '¡Hoy!' : x.faltan === 1 ? 'Mañana' : `En ${x.faltan} días`} · ${esc(u.fecha(x.fecha, { day: 'numeric', month: 'long' }))}</div></div></a>`).join('')}</div>` : ''}
          </div>
        </div>`;
    },
  };

  function saludo() {
    const h = new Date().getHours();
    return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  }
})(window.App);

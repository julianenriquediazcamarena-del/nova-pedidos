// Desempeño: indicadores por semana o mes, gráficas, clientes (CRM), bitácora de estrategias y gastos.
(function (A) {
  const u = A.u;
  const esc = u.esc;
  const K = () => A.kpis;
  const PESTANAS = [['resumen', 'Resumen'], ['clientes', 'Clientes'], ['bitacora', 'Bitácora'], ['gastos', 'Gastos'], ['matriz', 'Matriz BCG']];
  const TIPOS_ESTRATEGIA = ['Promoción o descuento', 'Publicidad pagada', 'Publicaciones en redes', 'Precio nuevo', 'Producto o servicio nuevo',
    'Atención o proceso', 'Volanteo o visitas', 'Alianza o convenio', 'Otro'];
  const CATEGORIAS_GASTO = ['Material e insumos', 'Maquila', 'Renta', 'Luz, agua e internet', 'Sueldos', 'Publicidad', 'Mantenimiento y equipo', 'Otro'];
  const N_PERIODOS = 12;

  const pref = { pestana: 'resumen', tipo: 'semana', ancla: null, tabla: false };

  const pct = v => v == null ? '—' : `${Math.round(v * 100)}%`;
  const fmtPesos = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });
  const pesos = n => fmtPesos.format(Math.round(Number(n) || 0));
  let comparacionParcial = false;
  const nombreAnterior = () => comparacionParcial
    ? (pref.tipo === 'mes' ? 'los mismos días del mes anterior' : 'los mismos días de la semana anterior')
    : (pref.tipo === 'mes' ? 'el mes anterior' : 'la semana anterior');

  // Periodo con el que se compara. Si el actual va a la mitad, se toman los mismos días del anterior.
  function anterior(p) {
    const prev = K().mover(p, -1);
    const hoy = u.hoy();
    if (hoy < p.inicio || hoy > p.fin) return prev;
    const fin = u.sumarDias(prev.inicio, u.diasEntre(p.inicio, hoy));
    return { ...prev, fin: fin < prev.fin ? fin : prev.fin, parcial: true };
  }
  function metricasAnterior(p) {
    const a = anterior(p);
    comparacionParcial = !!a.parcial;
    return K().metricas(a);
  }

  // Variación con flecha y color según si subir es bueno o malo.
  function delta(actual, anterior, { subirEsBueno = true, puntos = false } = {}) {
    let v, txt;
    if (puntos) {
      if (actual == null || anterior == null) return '<div class="delta tenue">— sin comparación</div>';
      v = actual - anterior; txt = `${Math.abs(Math.round(v * 100))} pts`;
    } else {
      v = K().delta(actual, anterior);
      if (v == null) return '<div class="delta tenue">— sin comparación</div>';
      txt = `${Math.abs(Math.round(v * 100))}%`;
    }
    if (Math.abs(v) < 0.005) return '<div class="delta tenue">= sin cambio</div>';
    const bueno = (v > 0) === subirEsBueno;
    return `<div class="delta ${bueno ? 'delta-bien' : 'delta-mal'}" title="Comparado con ${nombreAnterior()}">${v > 0 ? '▲' : '▼'} ${txt}</div>`;
  }
  function tile(etq, valor, deltaHtml = '', nota = '', clase = '') {
    return `<div class="indicador ${clase}"><div class="etq">${etq}</div><div class="val">${valor}</div>${deltaHtml}${nota ? `<div class="chico tenue">${nota}</div>` : ''}</div>`;
  }

  function controles() {
    const p = K().periodo(pref.tipo, pref.ancla);
    const esActual = p.inicio === K().periodo(pref.tipo, u.hoy()).inicio;
    return `<div class="controles-periodo">
      <div class="segmentos" data-ctl="tipo"><button data-v="semana" class="${pref.tipo === 'semana' ? 'activo' : ''}">Semanal</button><button data-v="mes" class="${pref.tipo === 'mes' ? 'activo' : ''}">Mensual</button></div>
      <div class="navegador"><button class="btn-icono" data-ctl="atras" aria-label="Periodo anterior">‹</button>
        <strong>${esc(p.etiqueta)}</strong>
        <button class="btn-icono" data-ctl="adelante" aria-label="Periodo siguiente" ${esActual ? 'disabled' : ''}>›</button></div>
      ${esActual ? '' : '<button class="btn chico" data-ctl="hoy">Ir a hoy</button>'}
      <span class="chico tenue">▲▼ comparado con ${esActual ? `los mismos días ${pref.tipo === 'mes' ? 'del mes anterior' : 'de la semana anterior'} (${pref.tipo === 'mes' ? 'el mes' : 'la semana'} va en curso)` : pref.tipo === 'mes' ? 'el mes anterior' : 'la semana anterior'}</span>
    </div>`;
  }

  A.vistas.desempeno = {
    titulo: 'Desempeño',
    render(c, pestana) {
      if (pestana && PESTANAS.some(([k]) => k === pestana)) pref.pestana = pestana;
      if (!pref.ancla) pref.ancla = u.hoy();
      c.innerHTML = `
        <div class="cabeza"><div><h1>Desempeño</h1><div class="subtitulo">Ventas, ganancias, clientes y lo que has probado</div></div>
          <div class="acciones"><button class="btn" data-venta-rapida>Venta rápida</button></div></div>
        <div class="segmentos" id="dp-tab" style="margin-bottom:16px">${PESTANAS.map(([k, t]) => `<button data-t="${k}" class="${pref.pestana === k ? 'activo' : ''}">${t}</button>`).join('')}</div>
        <div id="dp-cuerpo"></div>`;
      const cuerpo = c.querySelector('#dp-cuerpo');
      const pintar = () => {
        u.$$('#dp-tab button', c).forEach(b => b.classList.toggle('activo', b.dataset.t === pref.pestana));
        VISTAS[pref.pestana](cuerpo, pintar);
      };
      c.querySelector('#dp-tab').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b) { pref.pestana = b.dataset.t; pintar(); } });
      cuerpo.addEventListener('click', e => {
        const tipo = e.target.closest('[data-ctl=tipo] [data-v]');
        if (tipo) { pref.tipo = tipo.dataset.v; pintar(); return; }
        const b = e.target.closest('button[data-ctl]');
        if (!b || b.disabled) return;
        const p = K().periodo(pref.tipo, pref.ancla);
        if (b.dataset.ctl === 'atras') pref.ancla = K().mover(p, -1).inicio;
        if (b.dataset.ctl === 'adelante') pref.ancla = K().mover(p, 1).inicio;
        if (b.dataset.ctl === 'hoy') pref.ancla = u.hoy();
        pintar();
      });
      pintar();
    },
  };

  // ---------------------------------------------------------------- Resumen
  function resumen(cont, repintar) {
    const p = K().periodo(pref.tipo, pref.ancla);
    const periodos = K().ultimos(p, N_PERIODOS);
    const datos = periodos.map(x => K().metricas(x));
    const m = datos[datos.length - 1];
    const ant = metricasAnterior(p);
    const estrategias = numerarEstrategias();
    const marcadores = estrategias
      .map(e => ({ e, indice: periodos.findIndex(x => K().dentro(e.fechaInicio, x)) }))
      .filter(x => x.indice >= 0)
      .map(x => ({ indice: x.indice, numero: x.e.numero, titulo: x.e.titulo, fecha: x.e.fechaInicio }));
    const unidad = pref.tipo === 'mes' ? 'meses' : 'semanas';

    cont.innerHTML = `
      ${controles()}
      <div class="indicadores amplios">
        ${tile('Ventas', pesos(m.ventas), delta(m.ventas, ant.ventas), '', 'principal')}
        ${tile('Cobrado', pesos(m.cobrado), delta(m.cobrado, ant.cobrado), 'Pagos recibidos en el periodo')}
        ${tile('Ganancia', pesos(m.ganancia), delta(m.ganancia, ant.ganancia), m.sinCosto.length ? `Sin contar ${m.sinCosto.length} pedido${m.sinCosto.length === 1 ? '' : 's'} sin costo` : 'Ventas menos costo de los pedidos')}
        ${tile('Margen', pct(m.margen), delta(m.margen, ant.margen, { puntos: true }))}
        ${tile('Gastos del negocio', pesos(m.gastos), delta(m.gastos, ant.gastos, { subirEsBueno: false }))}
        ${tile('Utilidad', pesos(m.utilidad), delta(m.utilidad, ant.utilidad), 'Ganancia menos gastos', m.utilidad < 0 ? 'alerta' : '')}
        ${tile('Pedidos', m.pedidos, delta(m.pedidos, ant.pedidos))}
        ${tile('Ticket promedio', pesos(m.ticket), delta(m.ticket, ant.ticket))}
        ${tile('Clientes nuevos', m.nuevos, delta(m.nuevos, ant.nuevos))}
        ${tile('Cotizaciones que se vendieron', pct(m.conversion), delta(m.conversion, ant.conversion, { puntos: true }), `${m.cotAceptadas} de ${m.cotizaciones}`)}
        ${tile('Entregas a tiempo', pct(m.pctATiempo), delta(m.pctATiempo, ant.pctATiempo, { puntos: true }), `${m.aTiempo} de ${m.entregados}`)}
      </div>
      ${m.sinCosto.length ? `<details class="nota-alerta"><summary>${m.sinCosto.length} pedido${m.sinCosto.length === 1 ? '' : 's'} de este periodo no tiene${m.sinCosto.length === 1 ? '' : 'n'} costo: la ganancia y el margen solo cuentan los que sí.</summary>
        <div style="margin-top:6px">${m.sinCosto.map(x => `<a href="#/pedido/${x.id}">${esc(x.folio)} · ${esc(x.clienteNombre)} · ${u.dinero(x.total)}</a>`).join('<br>')}</div>
        <div class="chico" style="margin-top:6px">Abre cada uno y escribe su costo real, o pon los costos en Precios y en Ajustes → Costos.</div></details>` : ''}

      <div class="tarjeta">
        <div class="cabeza" style="margin-bottom:6px"><h2>Ventas y ganancia · últimas ${N_PERIODOS} ${unidad}</h2>
          <div class="leyenda"><span><i class="viz-clave-linea" style="background:var(--serie-1)"></i>Ventas</span><span><i class="viz-clave-linea" style="background:var(--serie-2)"></i>Ganancia</span></div></div>
        <div class="chico tenue" style="margin-bottom:6px">Toca un punto para ver ese periodo. Los números arriba son estrategias de la bitácora.</div>
        <div id="dp-g1" class="viz-caja"></div>
        ${marcadores.length ? `<div class="marcas-lista">${marcadores.map(mk => `<span><b class="marca-num">${mk.numero}</b><span>${esc(mk.titulo)} <span class="tenue">· ${esc(u.fecha(mk.fecha, { day: 'numeric', month: 'short' }))}</span></span></span>`).join('')}</div>` : ''}
      </div>
      <div class="rejilla dos" style="margin-top:16px">
        <div class="tarjeta" style="margin:0"><h2>Pedidos por ${pref.tipo === 'mes' ? 'mes' : 'semana'}</h2><div id="dp-g2" class="viz-caja"></div></div>
        <div class="tarjeta" style="margin:0"><h2>Ventas por categoría</h2><div class="chico tenue" style="margin:-8px 0 10px">${esc(p.etiqueta)}</div><div id="dp-g3"></div></div>
      </div>
      <div class="tarjeta">
        <div class="cabeza" style="margin-bottom:8px"><h2>Historial por ${pref.tipo === 'mes' ? 'mes' : 'semana'}</h2>
          <div class="acciones"><button class="btn chico" data-tabla>${pref.tabla ? 'Ocultar tabla' : 'Ver tabla'}</button><button class="btn chico" data-csv>Descargar (Excel)</button></div></div>
        ${pref.tabla ? tablaPeriodos(datos) : '<div class="chico tenue">Todos los números de las últimas ' + N_PERIODOS + ' ' + unidad + ' en una tabla. La descarga abre en Excel.</div>'}
      </div>`;

    const elegir = i => { pref.ancla = periodos[i].inicio; repintar(); };
    A.graficas.lineas(cont.querySelector('#dp-g1'), {
      etiquetas: periodos.map(x => x.corta), titulos: periodos.map(x => x.etiqueta),
      series: [
        { nombre: 'Ventas', valores: datos.map(d => d.ventas), color: 'var(--serie-1)' },
        { nombre: 'Ganancia', valores: datos.map(d => d.ganancia), color: 'var(--serie-2)' },
      ],
      marcadores, seleccionado: N_PERIODOS - 1, alElegir: elegir, formato: pesos,
    });
    A.graficas.columnas(cont.querySelector('#dp-g2'), {
      etiquetas: periodos.map(x => x.corta), titulos: periodos.map(x => x.etiqueta), valores: datos.map(d => d.pedidos),
      nombre: 'Pedidos', color: 'var(--serie-1)', seleccionado: N_PERIODOS - 1, alElegir: elegir,
      formato: v => `${v} pedido${v === 1 ? '' : 's'}`,
    });
    A.graficas.barras(cont.querySelector('#dp-g3'), { items: m.porCategoria, color: 'var(--serie-1)', formato: pesos });

    cont.querySelector('[data-tabla]').addEventListener('click', () => { pref.tabla = !pref.tabla; repintar(); });
    cont.querySelector('[data-csv]').addEventListener('click', () => descargarCsv(datos));
  }

  const COLUMNAS = [
    ['Ventas', d => d.ventas, u.dinero], ['Cobrado', d => d.cobrado, u.dinero], ['Pedidos', d => d.pedidos, String],
    ['Ticket prom.', d => d.ticket, u.dinero], ['Costo', d => d.costo, u.dinero], ['Ganancia', d => d.ganancia, u.dinero],
    ['Margen', d => d.margen, pct], ['Gastos', d => d.gastos, u.dinero], ['Utilidad', d => d.utilidad, u.dinero],
    ['Clientes nuevos', d => d.nuevos, String], ['Cotizaciones', d => d.cotizaciones, String], ['Vendidas', d => d.cotAceptadas, String],
    ['A tiempo', d => d.pctATiempo, pct], ['Sin costo', d => d.sinCosto.length, String],
  ];
  function tablaPeriodos(datos) {
    return `<div class="tabla-envoltura"><table class="tabla-num"><thead><tr><th>Periodo</th>${COLUMNAS.map(([t]) => `<th class="der">${t}</th>`).join('')}</tr></thead><tbody>
      ${[...datos].reverse().map(d => `<tr><td>${esc(d.periodo.etiqueta)}</td>${COLUMNAS.map(([, f, fmt]) => `<td class="der">${esc(fmt(f(d)))}</td>`).join('')}</tr>`).join('')}
    </tbody></table></div>`;
  }
  function descargarCsv(datos) {
    const celda = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const filas = [['Periodo', 'Inicio', 'Fin', ...COLUMNAS.map(([t]) => t)].map(celda).join(',')];
    datos.forEach(d => filas.push([d.periodo.etiqueta, d.periodo.inicio, d.periodo.fin,
      ...COLUMNAS.map(([t, f]) => { const v = f(d); return ['Margen', 'A tiempo'].includes(t) ? (v == null ? '' : Math.round(v * 1000) / 10) : v; })].map(celda).join(',')));
    const blob = new Blob(['﻿' + filas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `desempeno-${pref.tipo === 'mes' ? 'mensual' : 'semanal'}-${u.hoy()}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------------------------------------------------------------- Clientes (CRM)
  function clientes(cont) {
    const p = K().periodo(pref.tipo, pref.ancla);
    const periodos = K().ultimos(p, N_PERIODOS);
    const m = K().metricas(p);
    const ant = metricasAnterior(p);
    const hoy = u.hoy();
    const pedidos = A.db.todos('pedidos').filter(x => x.estado !== 'cancelado');
    const ultimas = K().ultimasCompras();
    const contactos = A.db.todos('contactos').filter(x => (x.tipo || 'cliente') === 'cliente');
    const activos = contactos.filter(x => ultimas.get(x.id) && u.diasEntre(ultimas.get(x.id), hoy) <= 90).length;
    const recurrentes = m.clientes - m.nuevos;

    // Nuevos por origen en todo el rango de la gráfica.
    const primera = K().primerasCompras(pedidos);
    const desde = periodos[0].inicio, hasta = p.fin;
    const porOrigen = new Map();
    contactos.forEach(x => {
      const f = primera.get(x.id);
      if (f && f >= desde && f <= hasta) porOrigen.set(x.origen || 'Sin dato', (porOrigen.get(x.origen || 'Sin dato') || 0) + 1);
    });

    const enPeriodo = pedidos.filter(x => K().dentro(x.fechaRecibido, p) && x.contactoId);
    const top = new Map();
    enPeriodo.forEach(x => { const t = top.get(x.contactoId) || { n: 0, total: 0 }; t.n++; t.total += x.total || 0; top.set(x.contactoId, t); });
    const topLista = [...top.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 8);

    const seguimiento = A.db.todos('cotizaciones').filter(q => q.estado === 'abierta' && u.diasEntre(q.fecha, hoy) >= 2)
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
    const reactivar = contactos.map(x => ({ x, ultima: ultimas.get(x.id) }))
      .filter(d => d.ultima && u.diasEntre(d.ultima, hoy) > 60 && u.diasEntre(d.ultima, hoy) <= 365)
      .map(d => ({ ...d, total: pedidos.filter(q => q.contactoId === d.x.id).reduce((s, q) => s + (q.total || 0), 0) }))
      .sort((a, b) => b.total - a.total).slice(0, 15);
    const neg = A.db.ajustes().negocio.nombre;
    const primerNombre = n => (n || '').split(' ')[0];

    cont.innerHTML = `
      ${controles()}
      <div class="indicadores">
        ${tile('Clientes que compraron', m.clientes, delta(m.clientes, ant.clientes))}
        ${tile('Nuevos', m.nuevos, delta(m.nuevos, ant.nuevos), 'Su primera compra fue en este periodo')}
        ${tile('Volvieron a comprar', recurrentes, delta(recurrentes, ant.clientes - ant.nuevos), m.clientes ? `${Math.round(recurrentes / m.clientes * 100)}% de los que compraron` : '')}
        ${tile('Clientes activos', activos, '', 'Compraron en los últimos 90 días')}
      </div>
      <div class="rejilla dos">
        <div class="tarjeta" style="margin:0"><h2>¿Cómo nos conocieron?</h2>
          <div class="chico tenue" style="margin:-8px 0 10px">Clientes nuevos de las últimas ${N_PERIODOS} ${pref.tipo === 'mes' ? 'meses' : 'semanas'}. Se anota en la ficha del cliente.</div>
          <div id="dp-origen"></div></div>
        <div class="tarjeta" style="margin:0"><h2>Mejores clientes</h2><div class="chico tenue" style="margin:-8px 0 10px">${esc(p.etiqueta)}</div>
          ${topLista.length ? `<div class="lista">${topLista.map(([id, t]) => { const x = A.db.obtener('contactos', id); return x ? `<a class="renglon" href="#/contacto/${id}"><div class="principal"><div class="titulo">${esc(x.nombre)}</div><div class="detalle">${t.n} pedido${t.n === 1 ? '' : 's'}</div></div><div class="derecha precio-grande">${u.dinero(t.total)}</div></a>` : ''; }).join('')}</div>` : '<div class="vacio">Sin ventas a clientes registrados en este periodo.</div>'}
        </div>
      </div>
      <div class="rejilla dos" style="margin-top:16px">
        <div class="tarjeta" style="margin:0"><h2>Cotizaciones por dar seguimiento</h2>
          <div class="chico tenue" style="margin:-8px 0 10px">Abiertas desde hace 2 días o más. Un mensaje a tiempo cierra ventas.</div>
          ${seguimiento.length ? `<div class="lista">${seguimiento.map(q => `<div class="renglon">
            <a class="principal" href="#/cotizacion/${q.id}" style="text-decoration:none"><div class="titulo">${esc(q.clienteNombre || 'Sin cliente')} <span class="clave">${esc(q.folio)}</span></div>
              <div class="detalle">${esc(u.relativo(q.fecha))} · ${u.dinero(q.total)}</div></a>
            <div class="derecha" style="display:flex;gap:6px">
              ${q.telefono ? `<a class="btn chico verde" target="_blank" rel="noopener" href="${esc(u.linkWhatsApp(q.telefono, `Hola ${primerNombre(q.clienteNombre)}, te escribo de ${neg} sobre la cotización ${q.folio}. ¿Pudiste revisarla? Con gusto te ayudo con cualquier cambio.`))}">WhatsApp</a>` : ''}
              <button class="btn chico" data-rechazar="${q.id}">No se vendió</button></div></div>`).join('')}</div>` : '<div class="vacio">Nada pendiente. 👌</div>'}
        </div>
        <div class="tarjeta" style="margin:0"><h2>Clientes para reactivar</h2>
          <div class="chico tenue" style="margin:-8px 0 10px">Compraron antes pero llevan más de 60 días sin volver. Ordenados por lo que han comprado.</div>
          ${reactivar.length ? `<div class="lista">${reactivar.map(d => `<div class="renglon">
            <a class="principal" href="#/contacto/${d.x.id}" style="text-decoration:none"><div class="titulo">${esc(d.x.nombre)}</div>
              <div class="detalle">Última compra ${esc(u.relativo(d.ultima).toLowerCase())} · ${u.dinero(d.total)} en total</div></a>
            ${d.x.telefono ? `<a class="btn chico verde" target="_blank" rel="noopener" href="${esc(u.linkWhatsApp(d.x.telefono, `Hola ${primerNombre(d.x.nombre)}, ¿cómo estás? Te saluda ${neg}. ¿Necesitas algo impreso estos días? Con gusto te cotizamos.`))}">WhatsApp</a>` : ''}</div>`).join('')}</div>` : '<div class="vacio">Nadie por reactivar.</div>'}
        </div>
      </div>`;
    A.graficas.barras(cont.querySelector('#dp-origen'), {
      items: [...porOrigen.entries()].sort((a, b) => b[1] - a[1]), color: 'var(--serie-1)',
      formato: v => `${v} cliente${v === 1 ? '' : 's'}`, vacio: 'Aún no hay clientes nuevos con compras en este rango.',
    });
    cont.querySelectorAll('[data-rechazar]').forEach(b => b.addEventListener('click', () => {
      const q = A.db.obtener('cotizaciones', b.dataset.rechazar);
      A.db.guardar('cotizaciones', { ...q, estado: 'rechazada' });
      A.aviso(`${q.folio} marcada como no aceptada`);
      clientes(cont);
    }));
  }

  // ---------------------------------------------------------------- Bitácora
  // Número fijo por orden cronológico: el mismo que aparece en la gráfica.
  function numerarEstrategias() {
    return A.db.todos('bitacora').sort((a, b) => (a.fechaInicio + a.creado).localeCompare(b.fechaInicio + b.creado)).map((e, i) => ({ ...e, numero: i + 1 }));
  }

  function lineaEfecto(nombre, antes, despues, fmt) {
    const d = K().delta(despues, antes);
    const cls = d == null || Math.abs(d) < 0.005 ? 'tenue' : d > 0 ? 'delta-bien' : 'delta-mal';
    return `<div class="dato"><span>${nombre}</span><span class="num">${fmt(antes)} → <strong>${fmt(despues)}</strong>
      <span class="${cls}">${d == null ? '' : Math.abs(d) < 0.005 ? '=' : `${d > 0 ? '▲' : '▼'} ${Math.abs(Math.round(d * 100))}%`}</span></span></div>`;
  }

  function bitacora(cont, repintar) {
    const lista = numerarEstrategias().reverse();
    const uno = n => u.num(Math.round(n * 10) / 10);
    cont.innerHTML = `
      <div class="cabeza" style="margin-bottom:10px"><div class="subtitulo" style="max-width:640px">Anota aquí cada cosa nueva que pruebes: una promoción, un anuncio, un precio, un producto, un cambio en la atención. La app compara cómo iban las ventas antes y después, y la marca en la gráfica de Resumen.</div>
        <button class="btn primario" data-nueva>＋ Registrar estrategia</button></div>
      ${lista.length ? lista.map(e => {
        const ef = K().efecto(e);
        let efecto;
        if (ef.estado === 'futura') efecto = '<div class="chico tenue">Empieza más adelante.</div>';
        else {
          efecto = `<div class="efecto">
            <div class="chico tenue" style="margin-bottom:4px">Promedio por semana: 4 semanas antes → ${ef.estado === 'pocos-datos' ? 'lo que lleva (menos de una semana, aún es pronto)' : `durante (${u.fecha(e.fechaInicio, { day: 'numeric', month: 'short' })} a ${u.fecha(ef.hasta, { day: 'numeric', month: 'short' })})`}</div>
            ${lineaEfecto('Ventas', ef.antes.ventas, ef.durante.ventas, pesos)}
            ${lineaEfecto('Pedidos', ef.antes.pedidos, ef.durante.pedidos, uno)}
            ${lineaEfecto('Clientes nuevos', ef.antes.nuevos, ef.durante.nuevos, uno)}
          </div>`;
        }
        return `<div class="tarjeta estrategia">
          <div class="cabeza" style="margin-bottom:6px;flex-wrap:nowrap;align-items:flex-start">
            <div style="display:flex;gap:10px;align-items:flex-start"><b class="marca-num grande">${e.numero}</b>
              <div><h3>${esc(e.titulo)}</h3><div class="chico tenue">${esc(e.tipo)} · ${esc(u.fecha(e.fechaInicio))}${e.fechaFin ? ` al ${esc(u.fecha(e.fechaFin))}` : ' · sin fecha de fin'}${e.inversion ? ` · invertido ${pesos(e.inversion)}` : ''}</div></div></div>
            <div style="display:flex;gap:4px"><button class="btn chico" data-editar="${e.id}">Editar</button></div></div>
          ${e.descripcion ? `<p style="margin:6px 0">${esc(e.descripcion).replace(/\n/g, '<br>')}</p>` : ''}
          ${efecto}
          ${e.resultado ? `<div class="chico" style="margin-top:8px"><strong>Conclusión:</strong> ${esc(e.resultado).replace(/\n/g, '<br>')}</div>` : ''}
        </div>`;
      }).join('') : '<div class="vacio">Todavía no hay estrategias. Registra la primera cuando pruebes algo nuevo.</div>'}
      ${lista.length ? '<p class="chico tenue">Ojo: la comparación muestra lo que pasó, no prueba que lo causó la estrategia. Quincenas, temporadas (regreso a clases, diciembre) y clientes grandes también mueven las ventas; anótalo en la conclusión.</p>' : ''}`;
    cont.querySelector('[data-nueva]').addEventListener('click', () => editarEstrategia(null, repintar));
    cont.querySelectorAll('[data-editar]').forEach(b => b.addEventListener('click', () => editarEstrategia(A.db.obtener('bitacora', b.dataset.editar), repintar)));
  }

  function editarEstrategia(e, despues) {
    e = e || { titulo: '', tipo: TIPOS_ESTRATEGIA[0], fechaInicio: u.hoy(), fechaFin: '', inversion: '', descripcion: '', resultado: '' };
    A.modal.abrir(e.id ? 'Editar estrategia' : 'Nueva estrategia', `<form id="fes">
      <div class="campo"><label for="es-t">¿Qué hiciste?</label><input type="text" id="es-t" name="titulo" value="${esc(e.titulo)}" required placeholder="Ej. 2x1 en tarjetas, anuncio en Facebook, nuevo precio de lonas"></div>
      <div class="fila">
        <div class="campo"><label for="es-tipo">Tipo</label><select id="es-tipo" name="tipo">${TIPOS_ESTRATEGIA.map(t => `<option ${t === e.tipo ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        <div class="campo"><label for="es-inv">Inversión (opcional)</label><input type="number" id="es-inv" name="inversion" step="0.01" min="0" value="${e.inversion ?? ''}"></div>
      </div>
      <div class="fila">
        <div class="campo"><label for="es-i">Empezó</label><input type="date" id="es-i" name="fechaInicio" value="${e.fechaInicio}" required></div>
        <div class="campo"><label for="es-f">Terminó (si ya terminó)</label><input type="date" id="es-f" name="fechaFin" value="${e.fechaFin || ''}"></div>
      </div>
      <div class="campo"><label for="es-d">Detalles</label><textarea id="es-d" name="descripcion" placeholder="Dónde se publicó, a quién iba dirigida, condiciones…">${esc(e.descripcion || '')}</textarea></div>
      <div class="campo"><label for="es-r">Conclusión (puedes llenarla después)</label><textarea id="es-r" name="resultado" placeholder="¿Funcionó? ¿Qué aprendiste? ¿La repetirías?">${esc(e.resultado || '')}</textarea></div>
      <div class="modal-pie">${e.id ? '<button type="button" class="btn peligro" id="es-borrar" style="margin-right:auto">Borrar</button>' : ''}
        <button type="button" class="btn" data-cerrar>Cancelar</button><button class="btn primario">Guardar</button></div>
    </form>`, {
      alAbrir(m) {
        m.querySelector('#fes').addEventListener('submit', ev => {
          ev.preventDefault();
          const d = u.datosForm(ev.target);
          if (d.fechaFin && d.fechaFin < d.fechaInicio) return A.aviso('La fecha de fin es antes del inicio.');
          A.db.guardar('bitacora', { ...e, ...d, inversion: d.inversion === '' ? null : u.redondear(d.inversion) });
          A.modal.cerrar(); A.aviso('Estrategia guardada'); despues();
        });
        const b = m.querySelector('#es-borrar');
        if (b) b.addEventListener('click', async () => {
          if (!(await A.modal.confirmar('Borrar estrategia', `¿Borrar “${e.titulo}” de la bitácora?`, 'Borrar'))) return;
          A.db.borrar('bitacora', e.id); despues();
        });
      },
    });
  }

  // ---------------------------------------------------------------- Gastos
  function gastos(cont, repintar) {
    const p = K().periodo(pref.tipo, pref.ancla);
    const lista = A.db.todos('gastos').filter(g => K().dentro(g.fecha, p)).sort((a, b) => b.fecha.localeCompare(a.fecha));
    const total = lista.reduce((s, g) => s + (Number(g.monto) || 0), 0);
    const pa = anterior(p);
    comparacionParcial = !!pa.parcial;
    const ant = A.db.todos('gastos').filter(g => K().dentro(g.fecha, pa)).reduce((s, g) => s + (Number(g.monto) || 0), 0);
    const porCat = new Map();
    lista.forEach(g => porCat.set(g.categoria, (porCat.get(g.categoria) || 0) + (Number(g.monto) || 0)));
    cont.innerHTML = `
      ${controles()}
      <div class="cabeza" style="margin-bottom:10px"><div class="subtitulo" style="max-width:640px">Gastos del negocio que no son de un pedido en particular: renta, luz, sueldos, publicidad, material para tener en existencia. Lo que compras para un pedido va en el costo de ese pedido.</div>
        <button class="btn primario" data-nuevo>＋ Registrar gasto</button></div>
      <div class="indicadores">${tile('Total de gastos', pesos(total), delta(total, ant, { subirEsBueno: false }))}</div>
      <div class="rejilla dos">
        <div class="tarjeta" style="margin:0"><h2>Gastos</h2>
          ${lista.length ? `<div class="lista">${lista.map(g => `<button class="renglon" data-g="${g.id}" style="text-align:left;width:100%">
            <div class="principal"><div class="titulo">${esc(g.concepto)}</div><div class="detalle">${esc(u.fecha(g.fecha))} · ${esc(g.categoria)}</div></div>
            <div class="derecha precio-grande">${u.dinero(g.monto)}</div></button>`).join('')}</div>` : '<div class="vacio">Sin gastos en este periodo.</div>'}
        </div>
        <div class="tarjeta" style="margin:0"><h2>Por categoría</h2><div id="dp-gcat"></div></div>
      </div>`;
    A.graficas.barras(cont.querySelector('#dp-gcat'), { items: [...porCat.entries()].sort((a, b) => b[1] - a[1]), color: 'var(--serie-2)', formato: pesos });
    cont.querySelector('[data-nuevo]').addEventListener('click', () => editarGasto(null, repintar));
    cont.querySelectorAll('[data-g]').forEach(b => b.addEventListener('click', () => editarGasto(A.db.obtener('gastos', b.dataset.g), repintar)));
  }

  function editarGasto(g, despues) {
    g = g || { fecha: u.hoy(), concepto: '', categoria: CATEGORIAS_GASTO[0], monto: '', notas: '' };
    A.modal.abrir(g.id ? 'Editar gasto' : 'Nuevo gasto', `<form id="fga">
      <div class="campo"><label for="ga-c">Concepto</label><input type="text" id="ga-c" name="concepto" value="${esc(g.concepto)}" required placeholder="Ej. Renta de noviembre, rollo de vinil, anuncio en Facebook"></div>
      <div class="fila">
        <div class="campo"><label for="ga-cat">Categoría</label><select id="ga-cat" name="categoria">${CATEGORIAS_GASTO.map(t => `<option ${t === g.categoria ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        <div class="campo"><label for="ga-m">Monto</label><input type="number" id="ga-m" name="monto" step="0.01" min="0.01" value="${g.monto}" required></div>
        <div class="campo"><label for="ga-f">Fecha</label><input type="date" id="ga-f" name="fecha" value="${g.fecha}" required></div>
      </div>
      <div class="campo"><label for="ga-n">Notas</label><input type="text" id="ga-n" name="notas" value="${esc(g.notas || '')}"></div>
      <div class="modal-pie">${g.id ? '<button type="button" class="btn peligro" id="ga-borrar" style="margin-right:auto">Borrar</button>' : ''}
        <button type="button" class="btn" data-cerrar>Cancelar</button><button class="btn primario">Guardar</button></div>
    </form>`, {
      alAbrir(m) {
        m.querySelector('#fga').addEventListener('submit', ev => {
          ev.preventDefault();
          const d = u.datosForm(ev.target);
          A.db.guardar('gastos', { ...g, ...d, monto: u.redondear(d.monto) });
          A.modal.cerrar(); A.aviso('Gasto guardado'); despues();
        });
        const b = m.querySelector('#ga-borrar');
        if (b) b.addEventListener('click', async () => {
          if (!(await A.modal.confirmar('Borrar gasto', `¿Borrar “${g.concepto}”?`, 'Borrar'))) return;
          A.db.borrar('gastos', g.id); despues();
        });
      },
    });
  }

  // ---------------------------------------------------------------- Matriz BCG
  // Cruza el crecimiento del mercado (investigación, editable) con la fuerza de Nova en cada categoría.
  // Mientras haya pocas ventas en la app, la fuerza sale de la investigación; con 30 pedidos o más en
  // 6 meses, sale de las ventas reales (cuánto vende cada categoría frente a la que más vende).
  // Los datos viven en la colección privada "costos" (registro "mercado"): solo el dueño los ve.
  const CUADRANTES = {
    estrella: { t: 'Estrella', ico: '★', color: '#c9a227', consejo: 'Crece y aquí eres fuerte: métele publicidad, ten material a la mano y entrega rápido.' },
    incognita: { t: 'Incógnita', ico: '?', color: '#4f7fd1', consejo: 'El mercado crece pero aún vendes poco: prueba con una campaña o paquete pequeño. Si responde, sube a estrella; si no, déjalo bajo pedido.' },
    vaca: { t: 'Vaca lechera', ico: '$', color: '#2f9e6b', consejo: 'Vende parejo y deja dinero: cuida el margen y la rapidez sin gastar de más en anuncios. Úsalo para atraer clientes y ofrecerles lo demás.' },
    perro: { t: 'Perro', ico: '·', color: '#8a8a8a', consejo: 'Poco crecimiento y poca venta: solo bajo pedido o como complemento, sin publicidad ni inventario.' },
  };
  const ORDEN_CUADRANTE = ['estrella', 'incognita', 'vaca', 'perro'];
  const PEDIDOS_SUFICIENTES = 30;

  function datosMatriz() {
    const m = A.db.obtener('costos', 'mercado');
    if (!m || !m.categorias) return null;
    const hoy = u.hoy();
    const p1 = { inicio: u.sumarDias(hoy, -181), fin: hoy };
    const p0 = { inicio: u.sumarDias(hoy, -363), fin: u.sumarDias(hoy, -182) };
    const stats = new Map();
    const de = k => { if (!stats.has(k)) stats.set(k, { ventas: 0, previas: 0, conCosto: 0, costo: 0, pedidos: new Set() }); return stats.get(k); };
    let pedidos1 = 0;
    A.db.todos('pedidos').filter(x => x.estado !== 'cancelado').forEach(x => {
      const enP1 = K().dentro(x.fechaRecibido, p1), enP0 = K().dentro(x.fechaRecibido, p0);
      if (enP1) pedidos1++;
      (x.lineas || []).forEach(l => {
        const imp = (Number(l.cantidad) || 0) * (Number(l.precioUnit) || 0);
        const e = de(K().categoriaLinea(l));
        if (enP1) {
          e.ventas += imp; e.pedidos.add(x.id);
          const c = K().costoLinea(l);
          if (c != null) { e.conCosto += imp / 1.16; e.costo += c; } // precios con IVA, costos sin IVA
        } else if (enP0) e.previas += imp;
      });
    });
    const maxVentas = Math.max(0, ...[...stats.values()].map(e => e.ventas));
    const suficientes = pedidos1 >= PEDIDOS_SUFICIENTES;
    const uC = Number(m.umbralCrecimiento ?? 5), uP = Number(m.umbralPosicion ?? 0.5);
    const filas = Object.entries(m.categorias).map(([cat, r]) => {
      const e = stats.get(cat) || { ventas: 0, previas: 0, conCosto: 0, costo: 0, pedidos: new Set() };
      const crecimiento = Number(r.crecimiento) || 0;
      const posicion = suficientes ? (maxVentas ? e.ventas / maxVentas : 0) : Math.min(1, Math.max(0, Number(r.posicion) || 0));
      const cuadrante = crecimiento >= uC ? (posicion >= uP ? 'estrella' : 'incognita') : (posicion >= uP ? 'vaca' : 'perro');
      return { cat, ...r, crecimiento, posicion, cuadrante, ventas: u.redondear(e.ventas), pedidos: e.pedidos.size,
        propio: e.previas > 0 ? (e.ventas - e.previas) / e.previas : null,
        margen: e.conCosto ? (e.conCosto - e.costo) / e.conCosto : null };
    });
    return { m, filas, suficientes, pedidos1, uC, uP, maxVentas };
  }

  function graficaMatriz({ filas, uC, uP, maxVentas }) {
    const W = 640, H = 420, ml = 46, mr = 16, mt = 16, mb = 40;
    const minY = Math.min(-6, ...filas.map(f => f.crecimiento - 1)), maxY = Math.max(12, ...filas.map(f => f.crecimiento + 1));
    const x = v => ml + v * (W - ml - mr);
    const y = v => mt + (maxY - v) / (maxY - minY) * (H - mt - mb);
    const xm = x(uP), ym = y(uC);
    const esq = (k, tx, ty, ancla) => `<text x="${tx}" y="${ty}" text-anchor="${ancla}" font-size="13" font-weight="700" fill="${CUADRANTES[k].color}">${CUADRANTES[k].ico} ${CUADRANTES[k].t}</text>`;
    // Etiquetas: se recorren hacia abajo si chocan con otra ya puesta.
    const puestas = [];
    const puntos = filas.slice().sort((a, b) => b.ventas - a.ventas).map(f => {
      const r = maxVentas && f.ventas ? 7 + 15 * Math.sqrt(f.ventas / maxVentas) : 8;
      const cx = x(f.posicion), cy = y(f.crecimiento);
      const nombre = f.cat.replace(/\s*\(.*\)/, '');
      const ancho = nombre.length * 6.4;
      const derecha = cx + r + 4 + ancho < W - mr;
      const x0 = derecha ? cx + r + 4 : cx - r - 4 - ancho;
      let ly = cy + 4;
      for (let i = 0; i < 12 && puestas.some(p => Math.abs(p.y - ly) < 13 && x0 < p.x1 && x0 + ancho > p.x0); i++) ly += 13;
      puestas.push({ x0, x1: x0 + ancho, y: ly });
      return `<g><title>${esc(f.cat)} · crecimiento ${f.crecimiento}% · fuerza ${Math.round(f.posicion * 100)}%</title>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="${CUADRANTES[f.cuadrante].color}" fill-opacity=".75" stroke="var(--superficie)" stroke-width="1.5"></circle>
        <text x="${derecha ? x0 : x0 + ancho}" y="${ly}" text-anchor="${derecha ? 'start' : 'end'}" font-size="11.5" fill="var(--texto)">${esc(nombre)}</text></g>`;
    }).join('');
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Matriz BCG por categoría" style="width:100%;height:auto;display:block">
      <rect x="${xm}" y="${mt}" width="${W - mr - xm}" height="${ym - mt}" fill="#c9a227" fill-opacity=".07"></rect>
      <rect x="${ml}" y="${mt}" width="${xm - ml}" height="${ym - mt}" fill="#4f7fd1" fill-opacity=".07"></rect>
      <rect x="${xm}" y="${ym}" width="${W - mr - xm}" height="${H - mb - ym}" fill="#2f9e6b" fill-opacity=".07"></rect>
      <rect x="${ml}" y="${ym}" width="${xm - ml}" height="${H - mb - ym}" fill="#8a8a8a" fill-opacity=".07"></rect>
      <line x1="${xm}" y1="${mt}" x2="${xm}" y2="${H - mb}" stroke="var(--borde)" stroke-dasharray="4 4"></line>
      <line x1="${ml}" y1="${ym}" x2="${W - mr}" y2="${ym}" stroke="var(--borde)" stroke-dasharray="4 4"></line>
      ${y(0) > mt && y(0) < H - mb ? `<text x="${ml - 6}" y="${y(0) + 4}" text-anchor="end" font-size="11" fill="var(--texto-2)">0%</text>` : ''}
      <text x="${ml - 6}" y="${ym + 4}" text-anchor="end" font-size="11" fill="var(--texto-2)">${uC}%</text>
      <text x="${ml - 6}" y="${mt + 10}" text-anchor="end" font-size="11" fill="var(--texto-2)">${Math.round(maxY)}%</text>
      <text x="${ml}" y="${H - mb + 16}" font-size="11" fill="var(--texto-2)">Débil</text>
      <text x="${W - mr}" y="${H - mb + 16}" text-anchor="end" font-size="11" fill="var(--texto-2)">Fuerte</text>
      <text x="${(ml + W - mr) / 2}" y="${H - 6}" text-anchor="middle" font-size="12" fill="var(--texto-2)">Qué tan fuerte es Nova en esa categoría →</text>
      <text transform="translate(12 ${(mt + H - mb) / 2}) rotate(-90)" text-anchor="middle" font-size="12" fill="var(--texto-2)">Crecimiento del mercado (% al año) →</text>
      ${esq('incognita', ml + 8, mt + 18, 'start')}${esq('estrella', W - mr - 8, mt + 18, 'end')}
      ${esq('perro', ml + 8, H - mb - 10, 'start')}${esq('vaca', W - mr - 8, H - mb - 10, 'end')}
      ${puntos}
    </svg>`;
  }

  function matriz(cont, repintar) {
    if (!A.esDueno()) { cont.innerHTML = '<div class="vacio">Solo el dueño ve la matriz.</div>'; return; }
    const d = datosMatriz();
    if (!d) {
      cont.innerHTML = `<div class="tarjeta"><h2>Matriz BCG</h2>
        <p>Clasifica cada categoría en <strong>estrella, vaca lechera, incógnita o perro</strong> según cuánto crece su mercado y qué tan fuerte es Nova en ella.</p>
        <p class="chico tenue">Carga el archivo <strong>costos-y-mercado-nova-pedidos.json</strong> (lo tienes en la carpeta del negocio, no se publica). Trae la investigación de mercado y los costos estimados; los costos que ya hayas capturado no se tocan.</p>
        <label class="btn primario" style="margin-top:8px">Cargar archivo<input type="file" accept=".json,application/json" hidden id="mx-imp"></label></div>`;
      cont.querySelector('#mx-imp').addEventListener('change', async e => {
        const f = e.target.files[0];
        if (!f) return;
        try { A.db.importar(JSON.parse(await f.text())); A.aviso('Investigación y costos cargados'); repintar(); } catch (err) { A.aviso('No se pudo cargar: ' + err.message); }
      });
      return;
    }
    const grupos = ORDEN_CUADRANTE.map(k => [k, d.filas.filter(f => f.cuadrante === k).sort((a, b) => b.ventas - a.ventas || b.crecimiento - a.crecimiento)]);
    const fmtPct = v => v == null ? '—' : `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`;
    cont.innerHTML = `
      <div class="tarjeta">
        <div class="cabeza" style="margin-bottom:6px"><div><h2 style="margin:0">Matriz BCG por categoría</h2>
          <div class="subtitulo chico">${d.suficientes
            ? `La fuerza sale de tus ventas de los últimos 6 meses (${d.pedidos1} pedidos). El crecimiento, de la investigación.`
            : `Con pocas ventas en la app (${d.pedidos1} pedidos en 6 meses), la fuerza sale de la investigación. A partir de ${PEDIDOS_SUFICIENTES} pedidos se calcula con tus ventas reales.`}</div></div>
          <span class="chico tenue">Investigación del ${esc(u.fecha(d.m.fecha))}</span></div>
        ${graficaMatriz(d)}
        <p class="chico tenue" style="margin-top:6px">El tamaño del círculo es lo vendido en 6 meses. ${esc(d.m.fuentes || '')}</p>
      </div>
      ${grupos.filter(([, l]) => l.length).map(([k, lista]) => `
        <div class="tarjeta">
          <h2 style="color:${CUADRANTES[k].color}">${CUADRANTES[k].ico} ${CUADRANTES[k].t}</h2>
          <p class="chico" style="margin-top:-4px">${CUADRANTES[k].consejo}</p>
          <div class="tabla-envoltura"><table><thead><tr><th>Categoría</th><th class="der">Mercado</th><th class="der">Fuerza</th><th class="der">Ventas 6 m</th><th class="der">Tu cambio</th><th class="der">Margen</th></tr></thead><tbody>
            ${lista.map(f => `<tr data-cat="${esc(f.cat)}" style="cursor:pointer" title="Toca para editar">
              <td><strong>${esc(f.cat)}</strong><div class="chico tenue">${esc(f.nota || '')}</div></td>
              <td class="der num">${f.crecimiento > 0 ? '+' : ''}${f.crecimiento}%</td>
              <td class="der num">${Math.round(f.posicion * 100)}%</td>
              <td class="der num">${f.ventas ? pesos(f.ventas) : '—'}</td>
              <td class="der num">${fmtPct(f.propio)}</td>
              <td class="der num">${f.margen == null ? '—' : Math.round(f.margen * 100) + '%'}</td></tr>`).join('')}
          </tbody></table></div>
        </div>`).join('')}
      <p class="chico tenue">“Mercado”: cuánto crece la demanda al año (investigación, editable). “Tu cambio”: tus ventas de los últimos 6 meses contra los 6 anteriores. “Margen”: estimado con los costos del catálogo. Toca una categoría para ajustar sus datos.</p>`;
    cont.querySelectorAll('[data-cat]').forEach(tr => tr.addEventListener('click', () => editarMercado(d.m, tr.dataset.cat, repintar)));
  }

  function editarMercado(m, cat, despues) {
    const r = m.categorias[cat] || {};
    A.modal.abrir(cat, `<form id="fmx">
      <div class="fila">
        <div class="campo"><label for="mx-c">Crecimiento del mercado (% al año)</label><input type="number" id="mx-c" name="crecimiento" step="0.5" min="-50" max="100" value="${Number(r.crecimiento) || 0}" required></div>
        <div class="campo"><label for="mx-p">Fuerza de Nova (0 a 100)</label><input type="number" id="mx-p" name="posicion" step="5" min="0" max="100" value="${Math.round((Number(r.posicion) || 0) * 100)}" required></div>
      </div>
      <div class="campo"><label for="mx-n">Nota</label><input type="text" id="mx-n" name="nota" value="${esc(r.nota || '')}"></div>
      <p class="chico tenue">La fuerza se usa mientras haya menos de ${PEDIDOS_SUFICIENTES} pedidos en 6 meses; después se calcula con tus ventas.</p>
      <div class="modal-pie"><button type="button" class="btn" data-cerrar>Cancelar</button><button class="btn primario">Guardar</button></div>
    </form>`, {
      alAbrir(el) {
        el.querySelector('#fmx').addEventListener('submit', ev => {
          ev.preventDefault();
          const f = u.datosForm(ev.target);
          const categorias = { ...m.categorias, [cat]: { ...r, crecimiento: Number(f.crecimiento) || 0, posicion: Math.min(1, Math.max(0, (Number(f.posicion) || 0) / 100)), nota: f.nota } };
          A.db.guardar('costos', { ...m, categorias });
          A.modal.cerrar(); A.aviso('Guardado'); despues();
        });
      },
    });
  }

  const VISTAS = { resumen, clientes, bitacora, gastos, matriz };
})(window.App);

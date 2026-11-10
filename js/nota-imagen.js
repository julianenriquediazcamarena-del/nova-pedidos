// Nota del pedido (o cotización) como imagen PNG para mandarla al cliente por WhatsApp.
// Se dibuja con canvas (sin librerías) para que funcione sin internet.
(function (A) {
  const u = A.u;
  const W = 1080;
  const M = 64;
  const C = { negro: '#0c0c0c', rojo: '#a90000', texto: '#141414', tenue: '#6b6b6b', linea: '#e3e3e3', fondoTabla: '#f3f3f3', verde: '#1d7a46' };
  const F = {
    titulo: '700 46px Poppins, sans-serif',
    grande: '700 34px Poppins, sans-serif',
    fuerte: '600 28px Inter, sans-serif',
    importe: '600 26px Inter, sans-serif',
    normal: '400 26px Inter, sans-serif',
    chico: '400 22px Inter, sans-serif',
    etiqueta: '600 20px Inter, sans-serif',
  };

  function cargarImagen(src) {
    return new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
  }
  async function cargarFuentes() {
    if (!document.fonts) return;
    try { await Promise.all(['700 46px Poppins', '600 28px Inter', '400 26px Inter'].map(f => document.fonts.load(f))); } catch { /* usa la fuente del sistema */ }
  }
  // Parte un texto en renglones que quepan en 'ancho'.
  function renglones(ctx, texto, ancho) {
    const salida = [];
    String(texto || '').split('\n').forEach(parrafo => {
      let linea = '';
      parrafo.split(/\s+/).filter(Boolean).forEach(palabra => {
        const prueba = linea ? `${linea} ${palabra}` : palabra;
        if (ctx.measureText(prueba).width <= ancho) { linea = prueba; return; }
        if (linea) salida.push(linea);
        linea = palabra;
        while (ctx.measureText(linea).width > ancho && linea.length > 1) {
          let corte = linea.length - 1;
          while (corte > 1 && ctx.measureText(linea.slice(0, corte)).width > ancho) corte--;
          salida.push(linea.slice(0, corte));
          linea = linea.slice(corte);
        }
      });
      salida.push(linea);
    });
    return salida;
  }
  function texto(ctx, t, x, y, fuente, color, alinear = 'left') {
    ctx.font = fuente; ctx.fillStyle = color; ctx.textAlign = alinear; ctx.fillText(t, x, y);
  }

  function componer(ctx, tipo, d, logo) {
    const esFactura = tipo === 'factura';
    const neg = A.db.ajustes().negocio;
    const iva = A.db.ajustes().iva;
    const esPedido = tipo === 'pedido' || esFactura;
    const t = A.precios.totales(d.lineas || []);
    let y;

    // Encabezado
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, ctx.canvas.height);
    ctx.fillStyle = C.negro; ctx.fillRect(0, 0, W, 210);
    if (logo) { const h = 116; ctx.drawImage(logo, M, 47, (logo.width * h) / logo.height, h); }
    else texto(ctx, neg.nombre, M, 125, F.titulo, '#fff');
    texto(ctx, esFactura ? 'SOLICITUD DE FACTURA' : esPedido ? 'NOTA DE PEDIDO' : 'COTIZACIÓN', W - M, 80, F.etiqueta, '#bdbdbd', 'right');
    texto(ctx, d.folio, W - M, 134, F.titulo, '#fff', 'right');
    texto(ctx, u.fecha(esPedido ? d.fechaRecibido : d.fecha, { day: 'numeric', month: 'long', year: 'numeric' }), W - M, 172, F.chico, '#bdbdbd', 'right');
    ctx.fillStyle = C.rojo; ctx.fillRect(0, 210, W, 8);

    // Cliente y fecha
    y = 280;
    texto(ctx, 'CLIENTE', M, y, F.etiqueta, C.tenue);
    texto(ctx, esPedido ? 'FECHA DE ENTREGA' : 'VÁLIDA HASTA', W - M, y, F.etiqueta, C.tenue, 'right');
    y += 42;
    ctx.font = F.fuerte;
    const nombre = renglones(ctx, d.clienteNombre || '—', 560);
    nombre.forEach((l, i) => texto(ctx, l, M, y + i * 36, F.fuerte, C.texto));
    const fechaDer = esPedido ? u.fecha(d.fechaEntrega, { weekday: 'long', day: 'numeric', month: 'long' })
      : u.fecha(u.sumarDias(d.fecha, Number(d.vigenciaDias) || 0), { day: 'numeric', month: 'long', year: 'numeric' });
    texto(ctx, fechaDer, W - M, y, F.fuerte, C.texto, 'right');
    y += (nombre.length - 1) * 36;
    if (d.telefono) { y += 36; texto(ctx, d.telefono, M, y, F.chico, C.tenue); }
    y += 50;

    // Datos fiscales del receptor (solo en la hoja para el contador)
    if (esFactura) {
      const f = d.factura || {};
      const filaF = (etq, val) => {
        texto(ctx, etq, M + 16, y, F.etiqueta, C.tenue);
        ctx.font = F.normal;
        renglones(ctx, val || '—', W - 2 * M - 300).forEach((l, i) => texto(ctx, l, M + 280, y + i * 32, F.normal, C.texto));
        y += 32 * Math.max(1, renglones(ctx, val || '—', W - 2 * M - 300).length) + 10;
      };
      ctx.fillStyle = '#f7f2f2'; ctx.fillRect(M, y - 10, W - 2 * M, 8);
      y += 30;
      filaF('RFC', f.rfc);
      filaF('RAZÓN SOCIAL', f.razonSocial);
      filaF('RÉGIMEN FISCAL', f.regimen ? `${f.regimen} · ${A.factura.nombreRegimen(f.regimen)}` : '');
      filaF('C.P. FISCAL', f.cp);
      filaF('USO DEL CFDI', f.uso ? `${f.uso} · ${A.factura.nombreUso(f.uso)}` : '');
      filaF('FORMA DE PAGO', f.formaPago ? `${f.formaPago} · ${A.factura.nombreForma(f.formaPago)}` : '');
      filaF('MÉTODO DE PAGO', f.metodoPago ? `${f.metodoPago} · ${A.factura.nombreMetodo(f.metodoPago)}` : '');
      filaF('CORREO', f.correo);
      if ((d.adjuntos || []).some(a => a.tipo === 'fiscal')) filaF('CONSTANCIA', 'Se adjunta foto en el pedido');
      if (f.notas) filaF('NOTAS', f.notas);
      y += 20;
    }

    // Conceptos
    // Columnas: concepto (con saltos de línea) | cantidad | precio unitario | importe, sin encimarse.
    const xImp = W - M - 16, xUnit = xImp - 170, xCant = xUnit - 150, anchoDesc = xCant - 140 - (M + 16);
    ctx.fillStyle = C.fondoTabla; ctx.fillRect(M, y, W - 2 * M, 52);
    texto(ctx, 'CONCEPTO', M + 16, y + 34, F.etiqueta, C.tenue);
    texto(ctx, 'CANT.', xCant, y + 34, F.etiqueta, C.tenue, 'right');
    texto(ctx, esFactura ? 'V. UNIT. S/IVA' : 'P. UNIT.', xUnit, y + 34, F.etiqueta, C.tenue, 'right');
    texto(ctx, 'IMPORTE', xImp, y + 34, F.etiqueta, C.tenue, 'right');
    y += 52;
    (d.lineas || []).forEach(l => {
      ctx.font = F.normal;
      let desc = l.descripcion;
      if (l.tipo === 'playera' && l.detalle && l.detalle.ubicaciones) desc += ` · ${l.detalle.tecnica} ${A.armadorPlayeras.textoUbicaciones(l.detalle.ubicaciones).toLowerCase()}`;
      if (l.medidas && l.medidas.ancho) desc += ` (${u.num(l.medidas.ancho)} × ${u.num(l.medidas.alto)} m × ${l.medidas.piezas || 1})`;
      const ls = renglones(ctx, desc, anchoDesc);
      const yIni = y + 40;
      ls.forEach((t2, i) => texto(ctx, t2, M + 16, yIni + i * 34, F.normal, C.texto));
      const cant = `${u.num(l.cantidad)}${l.unidad && l.unidad !== 'pieza' ? ' ' + l.unidad : ''}`;
      texto(ctx, cant, xCant, yIni, F.normal, C.texto, 'right');
      const div = esFactura ? 1 + iva / 100 : 1; // para el contador: valores antes de IVA
      texto(ctx, u.dinero(l.precioUnit / div), xUnit, yIni, F.normal, C.texto, 'right');
      texto(ctx, u.dinero(l.cantidad * l.precioUnit / div), xImp, yIni, F.importe, C.texto, 'right');
      y += 24 + ls.length * 34 + 10;
      ctx.fillStyle = C.linea; ctx.fillRect(M, y, W - 2 * M, 2);
    });

    // Totales con desglose de IVA
    y += 50;
    const xEtq = W - M - 250, xVal = W - M;
    const fila = (etq, val, fuente = F.normal, color = C.texto, salto = 42) => {
      texto(ctx, etq, xEtq, y, fuente, color === C.texto ? C.tenue : color, 'right');
      texto(ctx, val, xVal, y, fuente, color, 'right');
      y += salto;
    };
    fila('Subtotal', u.dinero(t.subtotal));
    fila(`IVA (${iva}%)`, u.dinero(t.iva));
    ctx.fillStyle = C.linea; ctx.fillRect(xEtq - 300, y - 22, W - M - (xEtq - 300), 2);
    y += 14;
    fila('Total', u.dinero(t.total), F.grande, C.texto, 56);

    if (esPedido && !esFactura) {
      const pagos = d.pagos || [];
      if (!pagos.length) fila('Anticipo', 'Sin anticipo', F.normal, C.texto);
      pagos.forEach((p, i) => fila(`${i === 0 ? 'Anticipo' : 'Abono'} · ${u.fecha(p.fecha, { day: 'numeric', month: 'short' })} · ${p.metodo || 'Efectivo'}`, u.dinero(p.monto)));
      const saldo = Math.max(0, u.redondear(t.total - A.pedidos.pagado(d)));
      y += 18;
      const altoCaja = 84;
      ctx.fillStyle = saldo > 0 ? '#fbeaea' : '#e3f3e9';
      ctx.fillRect(xEtq - 300, y - 54, W - M - (xEtq - 300), altoCaja);
      texto(ctx, saldo > 0 ? 'Resta por pagar' : 'Pagado', xEtq, y, F.grande, saldo > 0 ? C.rojo : C.verde, 'right');
      texto(ctx, saldo > 0 ? u.dinero(saldo) : '✓', xVal - 16, y, F.grande, saldo > 0 ? C.rojo : C.verde, 'right');
      y += altoCaja - 20;
    } else if (esFactura) {
      const pagado = A.pedidos.pagado(d);
      texto(ctx, `Pagado: ${u.dinero(pagado)}${pagado < t.total ? ` · Saldo: ${u.dinero(t.total - pagado)}` : ' (liquidado)'}`, M, y, F.chico, C.tenue);
      y += 36;
    } else {
      const dias = d.lineas && d.lineas.length ? Math.max(...d.lineas.map(A.precios.diasLinea)) : 0;
      texto(ctx, `Tiempo de entrega: ${A.precios.textoDias(dias).toLowerCase()} a partir del anticipo.`, M, y, F.chico, C.tenue);
      y += 36;
    }
    texto(ctx, esFactura ? 'Valores unitarios e importes sin IVA; el total ya incluye IVA.' : 'Precios con IVA incluido.', M, y, F.chico, C.tenue);
    y += 30;

    // Datos para pagar directo al negocio (nota y cotización para el cliente)
    const pago = A.db.ajustes().pago || {};
    if (!esFactura && (pago.clabe || pago.tarjeta || pago.liga)) {
      y += 26;
      ctx.fillStyle = '#f3f6fb'; const yCaja = y - 30;
      const lineasPago = [
        pago.banco || pago.titular ? `${pago.banco || ''}${pago.banco && pago.titular ? ' · ' : ''}${pago.titular ? 'A nombre de ' + pago.titular : ''}` : '',
        pago.clabe ? `CLABE: ${pago.clabe.replace(/(\d{3})(\d{3})(\d{11})(\d)/, '$1 $2 $3 $4')}` : '',
        pago.tarjeta ? `Tarjeta: ${pago.tarjeta.replace(/(\d{4})(?=\d)/g, '$1 ')}` : '',
        pago.liga ? `Pago en línea: ${pago.liga}` : '',
      ].filter(Boolean);
      ctx.fillRect(M, yCaja, W - 2 * M, 50 + lineasPago.length * 34);
      texto(ctx, 'PARA PAGAR (directo a ' + neg.nombre + ')', M + 16, y, F.etiqueta, C.tenue);
      y += 36;
      lineasPago.forEach(l => { texto(ctx, l, M + 16, y, F.normal, C.texto); y += 34; });
    }

    // Notas: solo en la cotización ("Notas para el cliente"). Las del pedido son internas y no salen en la nota.
    if (d.notas && !esPedido) {
      y += 30;
      texto(ctx, 'NOTAS', M, y, F.etiqueta, C.tenue);
      y += 36;
      ctx.font = F.chico;
      renglones(ctx, d.notas, W - 2 * M).forEach(l => { texto(ctx, l, M, y, F.chico, C.texto); y += 32; });
    }

    // Pie
    y += 40;
    ctx.fillStyle = C.rojo; ctx.fillRect(M, y, W - 2 * M, 4);
    y += 52;
    texto(ctx, neg.nombre, W / 2, y, F.fuerte, C.texto, 'center');
    y += 38;
    ctx.font = F.chico;
    renglones(ctx, [neg.direccion, neg.telefono ? `WhatsApp ${neg.telefono}` : ''].filter(Boolean).join(' · '), W - 2 * M)
      .forEach(l => { texto(ctx, l, W / 2, y, F.chico, C.tenue, 'center'); y += 32; });
    if (neg.lema) { texto(ctx, neg.lema, W / 2, y + 6, 'italic 400 22px Inter, sans-serif', C.rojo, 'center'); y += 32; }
    return y + 40;
  }

  A.notaImagen = {
    // Dibuja en un lienzo alto y recorta a lo que ocupó.
    async generar(tipo, d) {
      await cargarFuentes();
      const logo = await cargarImagen('img/wordmark.png');
      const borrador = document.createElement('canvas');
      borrador.width = W; borrador.height = 5000;
      const alto = Math.min(5000, Math.ceil(componer(borrador.getContext('2d'), tipo, d, logo)));
      const final = document.createElement('canvas');
      final.width = W; final.height = alto;
      final.getContext('2d').drawImage(borrador, 0, 0, W, alto, 0, 0, W, alto);
      return new Promise(res => final.toBlob(res, 'image/png'));
    },
    // Muestra la imagen con botones para descargarla o compartirla (en el celular abre WhatsApp y demás).
    async mostrar(tipo, d) {
      A.aviso('Preparando la imagen…');
      const blob = await A.notaImagen.generar(tipo, d);
      const nombre = `${{ pedido: 'Nota', factura: 'Factura' }[tipo] || 'Cotizacion'} ${d.folio} ${d.clienteNombre || ''}`.trim().replace(/[\\/:*?"<>|]+/g, '') + '.png';
      const archivo = new File([blob], nombre, { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      const puedeCompartir = !!(navigator.canShare && navigator.canShare({ files: [archivo] }));
      A.modal.abrir({ pedido: 'Nota para el cliente', factura: 'Hoja para el contador' }[tipo] || 'Cotización en imagen', `
        <img src="${url}" alt="Vista previa de ${u.esc(nombre)}" class="vista-nota">
        <p class="chico tenue">${puedeCompartir ? 'Con “Compartir” la mandas directo por WhatsApp.' : `Descárgala y adjúntala en el chat de WhatsApp ${tipo === 'factura' ? 'del contador' : 'del cliente'}.`}${tipo === 'factura' && (d.adjuntos || []).some(a => a.tipo === 'fiscal') ? ' Mándale también la foto de la constancia.' : ''}</p>
        <div class="modal-pie">
          <button type="button" class="btn" data-cerrar>Cerrar</button>
          <a class="btn ${puedeCompartir ? '' : 'primario'}" href="${url}" download="${u.esc(nombre)}">Descargar imagen</a>
          ${puedeCompartir ? '<button type="button" class="btn primario" id="nota-compartir">Compartir</button>' : ''}
        </div>`, {
        ancho: true,
        alAbrir(c) {
          const b = c.querySelector('#nota-compartir');
          if (b) b.addEventListener('click', () => navigator.share({ files: [archivo], title: nombre }).catch(() => {}));
        },
      });
    },
  };
})(window.App);

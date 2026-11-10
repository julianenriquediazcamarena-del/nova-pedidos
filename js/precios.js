// Reglas de precios y tiempos de entrega (mismas fórmulas que la hoja "Cotizador" del Excel).
(function (A) {
  const u = A.u;
  const ORDEN_TALLAS = ['1-2-3', 'CH(4A)-EG(14A)', 'CH(4A)-EEG(16A)', 'ECH-EG', 'CH-EG', 'EEG', 'EEEG'];

  A.precios = {
    productos() {
      return A.db.todos('productos').filter(p => p.activo !== false).sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999));
    },
    categorias() { return [...new Set(A.precios.productos().map(p => p.categoria))]; },
    buscarProductos(consulta, categoria) {
      return A.precios.productos().filter(p =>
        (!categoria || p.categoria === categoria) &&
        (!consulta || u.coincide(`${p.clave} ${p.categoria} ${p.descripcion}`, consulta)));
    },

    // ---- Playeras ----
    playeras() { return A.db.todos('playeras').sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999)); },
    modelos() {
      const vistos = new Map();
      A.precios.playeras().forEach(p => { if (!vistos.has(p.codigo)) vistos.set(p.codigo, p); });
      return [...vistos.values()];
    },
    tallas(codigo) {
      const t = [...new Set(A.precios.playeras().filter(p => p.codigo === codigo).map(p => p.talla))];
      return t.sort((a, b) => ORDEN_TALLAS.indexOf(a) - ORDEN_TALLAS.indexOf(b));
    },
    colores(codigo, talla) {
      return [...new Set(A.precios.playeras().filter(p => p.codigo === codigo && p.talla === talla).map(p => p.color))];
    },
    playera(codigo, talla, color) {
      return A.precios.playeras().find(p => p.codigo === codigo && p.talla === talla && p.color === color) || null;
    },
    nivel(piezasPlayera) {
      return piezasPlayera >= A.db.ajustes().umbralMayoreo ? 'mayoreo' : 'menudeo';
    },
    // Características que se deducen del catálogo, para poder filtrar.
    atributos(p) {
      const d = u.normalizar(p.descripcion);
      const tipo = p.linea === 'SubliTee' || p.linea === 'Sublimación' ? 'Para sublimar'
        : p.linea === 'ActiviTee' || /^[A-Z]1[35]/.test(p.codigo) ? 'Deportiva' : 'Casual';
      const tela = { 'Mid Weight': 'Algodón ligero', 'Heavy Weight': 'Algodón grueso', 'Poly-CottonTee': 'Poliéster-algodón',
        SubliTee: 'Poliéster para sublimar', Sublimación: 'Poliéster para sublimar', ActiviTee: 'Dry-fit', Nuevo: 'Dry-fit' }[p.linea] || (d.includes('pique') ? 'Piqué' : '');
      return {
        tipo,
        tela,
        cuello: d.includes('polo') ? 'Polo' : d.includes('cuello v') ? 'Cuello V' : 'Redondo',
        manga: d.includes('manga larga') ? 'Larga' : d.includes('sin mangas') ? 'Sin mangas' : 'Corta',
        silueta: d.includes('silueta'),
      };
    },
    nombreTalla(t) {
      return { 'CH-EG': 'CH a EG', EEG: 'EEG (2XL)', EEEG: 'EEEG (3XL)', 'ECH-EG': 'Juvenil ECH a EG',
        'CH(4A)-EG(14A)': 'Niño 4 a 14 años', 'CH(4A)-EEG(16A)': 'Niño 4 a 16 años', '1-2-3': 'Bebé 1 a 3 años' }[t] || t;
    },
    // Precio unitario (IVA incluido) = playera + cargo de técnica + planchados.
    // La playera va a precio de menudeo; en mayoreo usa el precio de mayoreo del catálogo si así está en Ajustes.
    precioPlayera({ codigo, talla, color, tecnica, planchados }, nivel) {
      const aj = A.db.ajustes();
      const p = A.precios.playera(codigo, talla, color);
      if (!p) return null;
      const blanca = Number(nivel === 'mayoreo' && aj.playeraPrecioMayoreo && p.mayoreo ? p.mayoreo : p.menudeo) || 0;
      const cargoTecnica = (aj.tecnicas[tecnica] || {})[nivel] || 0;
      const cargoPlanchado = (Number(planchados) || 0) * (aj.planchado[nivel] || 0);
      return { blanca, cargoTecnica, cargoPlanchado, unitario: u.redondear(blanca + cargoTecnica + cargoPlanchado) };
    },

    // ---- Comisión de vendedores externos ----
    // Porcentaje que se suma al precio: por producto, por categoría o general (Ajustes → Comisiones).
    comisionPct({ categoria, clave }) {
      const c = A.db.ajustes().comisiones;
      if (clave && c.productos[clave] != null) return Number(c.productos[clave]);
      if (categoria && c.categorias[categoria] != null) return Number(c.categorias[categoria]);
      return Number(c.general) || 0;
    },
    // Precio que ve quien está usando la app: el vendedor ya lo ve con su comisión incluida.
    paraVendedor(precio, item) {
      if (precio == null || !(A.esVendedor && A.esVendedor())) return precio;
      return u.redondear(precio * (1 + A.precios.comisionPct(item) / 100));
    },
    // Marca una línea nueva hecha por un vendedor: guarda el precio base y le suma su comisión.
    // Si el precio que escribió ya es el final (diseño, concepto libre), se calcula el base hacia atrás.
    lineaDeVendedor(l, { precioFinal = false } = {}) {
      if (!(A.esVendedor && A.esVendedor())) return l;
      const pct = A.precios.comisionPct({ categoria: l.categoria, clave: l.clave });
      const f = 1 + pct / 100;
      if (precioFinal) return { ...l, comisionPct: pct, precioBase: u.redondear(l.precioUnit / f) };
      return { ...l, comisionPct: pct, precioBase: l.precioUnit, precioUnit: u.redondear(l.precioUnit * f) };
    },

    // ---- Totales de un documento (cotización o pedido) ----
    // Recalcula el precio de las líneas de playera según el nivel del total de piezas
    // (con la comisión del vendedor si la línea la trae).
    recalcular(lineas) {
      const piezas = lineas.filter(l => l.tipo === 'playera').reduce((n, l) => n + (Number(l.cantidad) || 0), 0);
      const nivel = A.precios.nivel(piezas);
      lineas.forEach(l => {
        if (l.tipo === 'playera' && !l.precioManual) {
          const r = A.precios.precioPlayera(l.detalle, nivel);
          if (r) {
            if (l.comisionPct) { l.precioBase = r.unitario; l.precioUnit = u.redondear(r.unitario * (1 + l.comisionPct / 100)); }
            else l.precioUnit = r.unitario;
          }
        }
        if (l.medidas && l.medidas.ancho && l.medidas.alto) {
          l.cantidad = u.redondear(l.medidas.ancho * l.medidas.alto * (l.medidas.piezas || 1));
        }
      });
      return { piezasPlayera: piezas, nivel };
    },
    totales(lineas) {
      const iva = A.db.ajustes().iva / 100;
      const total = u.redondear(lineas.reduce((s, l) => s + (Number(l.cantidad) || 0) * (Number(l.precioUnit) || 0), 0));
      const subtotal = u.redondear(total / (1 + iva));
      return { subtotal, iva: u.redondear(total - subtotal), total };
    },

    // ---- Tiempos de entrega ----
    diasLinea(l) {
      if (l.dias != null && l.dias !== '') return Number(l.dias);
      if (l.tipo === 'playera') return A.db.ajustes().diasPlayeras;
      return 0;
    },
    fechaEntrega(fechaRecibido, lineas) {
      const dias = lineas.length ? Math.max(...lineas.map(A.precios.diasLinea)) : 0;
      return u.sumarHabiles(fechaRecibido || u.hoy(), dias, A.db.ajustes().conSabado);
    },
    textoDias(dias) {
      if (dias == null || dias === '') return 'A cotizar';
      if (Number(dias) === 0) return 'Mismo día';
      if (Number(dias) === 1) return '1 día hábil';
      return `${dias} días hábiles`;
    },
  };
})(window.App);

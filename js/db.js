// Almacenamiento local (localStorage) con marcas de tiempo para poder sincronizar.
// Cada registro lleva: id, creado, actualizado y _borrado (los borrados se conservan para sincronizar).
(function (A) {
  const u = A.u;
  const PREFIJO = 'nova.';
  const COLECCIONES = ['productos', 'playeras', 'contactos', 'cotizaciones', 'pedidos', 'ajustes', 'gastos', 'bitacora', 'costos', 'comisiones'];
  const FECHA_SEMILLA = '2026-01-01T00:00:00.000Z';

  const AJUSTES_BASE = {
    id: 'general',
    negocio: {
      nombre: 'Impresos Nova',
      telefono: '33 3404 2790',
      direccion: 'Av. Estrella, Tlajomulco de Zúñiga, Jal.',
      lema: 'Visible. Memorable. Inolvidable.',
    },
    iva: 16,
    conSabado: true,
    vigenciaCotizacion: 7,
    anticipoSugerido: 50,
    // Reglas del cotizador de playeras (igual que el Excel): el nivel lo decide el total de piezas del pedido.
    umbralMayoreo: 12,
    tecnicas: {
      DTF: { menudeo: 110, mayoreo: 100 },
      Vinil: { menudeo: 70, mayoreo: 60 },
      // Sublimación (tamaño carta por lado) con la playera de otro proveedor a $80:
      // menudeo 80 + 40 + 20 = $140 a un lado, $160 a dos; mayoreo 80 + 30 + 15 = $125 y $140.
      Sublimación: { menudeo: 40, mayoreo: 30 },
    },
    planchado: { menudeo: 20, mayoreo: 15 },
    // En mayoreo, la playera se cobra con el precio de mayoreo del catálogo (si no, siempre menudeo).
    playeraPrecioMayoreo: true,
    diasPlayeras: 2,
    // Costos para estimar la ganancia de cada pedido (null = no se sabe todavía).
    // Comisión de vendedores externos: se suma al precio que ven (el cliente la paga, el negocio cobra su precio normal).
    comisiones: {
      general: 15,
      categorias: { Termos: 17, 'Vinil y Lona': 17 },
      productos: { TAB5: 17, TAB6: 17 }, // etiquetas recortadas
      recompra: 10, // si el cliente que trajo el vendedor vuelve a comprar directo con el negocio…
      recompraVeces: 3, // …durante sus siguientes compras
    },
    // Datos para que el cliente pague directo al negocio (salen en la nota y la cotización).
    pago: { banco: '', titular: '', clabe: '', tarjeta: '', liga: '' },
  };

  const memoria = {};
  const oyentes = [];
  let pendientes = leer('pendientes', {});

  function leer(clave, porDefecto) {
    try { const v = localStorage.getItem(PREFIJO + clave); return v ? JSON.parse(v) : porDefecto; } catch { return porDefecto; }
  }
  function escribir(clave, valor) {
    try { localStorage.setItem(PREFIJO + clave, JSON.stringify(valor)); }
    catch (e) { A.aviso && A.aviso('No se pudo guardar: el almacenamiento del navegador está lleno.'); throw e; }
  }
  function persistir(col) { escribir('col.' + col, Object.values(memoria[col])); }
  function marcarPendiente(col, id) {
    (pendientes[col] = pendientes[col] || {})[id] = true;
    escribir('pendientes', pendientes);
  }
  function avisar(col, origen) { oyentes.forEach(fn => { try { fn(col, origen); } catch (e) { console.error(e); } }); }

  // Cobro de diseño (precios del negocio: de $30 a $200 según la complejidad; el diseñador ajusta cada caso).
  // Costo 0 porque es trabajo propio.
  const DISENO = { categoria: 'Diseño', unidad: 'pieza', fabricacion: 'En Innova', dias: 0 };
  const PRODUCTOS_EXTRA = [
    { clave: 'DIS1', descripcion: 'Ajuste rápido (cambiar un texto, acomodar)', precio: 30 },
    { clave: 'DIS2', descripcion: 'Diseño sencillo (texto y logo)', precio: 50 },
    { clave: 'DIS3', descripcion: 'Diseño medio (varios elementos o dos caras)', precio: 100 },
    { clave: 'DIS4', descripcion: 'Diseño complejo (fotos, ilustración, gran formato)', precio: 200 },
  ].map((p, i) => ({ ...DISENO, ...p, orden: 900 + i }));
  // Semillas que ya no se usan; si nunca se editaron, se quitan.
  const PRODUCTOS_RETIRADOS = ['DIS5', 'DIS6'];

  // Playeras que no vienen en el catálogo de Yazbek (se compran con otro proveedor).
  const PLAYERAS_EXTRA = [
    { codigo: 'SUBLI', descripcion: 'Playera para sublimar Cuello Redondo Manga Corta', linea: 'Sublimación', genero: 'Unisex',
      talla: 'CH-EG', color: 'Blanco', mayoreo: 80, menudeo: 80, orden: -1 },
  ];

  // Pedidos: si dos personas lo cambian casi al mismo tiempo, se conservan los pagos y el historial de ambas.
  // 'base' decide lo demás (estado, fechas…). Los pagos que alguien quitó quedan en pagosEliminados para que no regresen.
  function fusionarPedido(base, otro) {
    if (!otro) return base;
    const eliminados = [...new Set([...(base.pagosEliminados || []), ...(otro.pagosEliminados || [])])];
    const adjEliminados = [...new Set([...(base.adjuntosEliminados || []), ...(otro.adjuntosEliminados || [])])];
    const juntar = (a, b, clave) => {
      const lista = [...(a || [])];
      const vistos = new Set(lista.map(clave));
      (b || []).forEach(x => { if (!vistos.has(clave(x))) lista.push(x); });
      return lista.sort((x, y) => (x.fecha || '').localeCompare(y.fecha || ''));
    };
    return {
      ...base,
      pagos: juntar(base.pagos, otro.pagos, p => p.id).filter(p => !eliminados.includes(p.id)),
      historial: juntar(base.historial, otro.historial, h => `${h.fecha}|${h.texto}`),
      pagosEliminados: eliminados,
      adjuntos: juntar(base.adjuntos, otro.adjuntos, a => a.id).filter(a => !adjEliminados.includes(a.id)),
      adjuntosEliminados: adjEliminados,
    };
  }
  const usuarioActual = () => (A.sync ? A.sync.nombreUsuario() : '');

  // Lo que llega de otro dispositivo (o de un respaldo) se limpia antes de usarse: ids con formato válido
  // y números que sí son números. Así un registro alterado no puede meter HTML en la pantalla de nadie.
  const ID_VALIDO = /^[\w-]{1,80}$/;
  const CAMPOS_NUMERO = new Set(['cantidad', 'precioUnit', 'precioBase', 'comisionPct', 'valor', 'total', 'monto', 'precio', 'costo', 'costoUnit', 'menudeo', 'mayoreo',
    'dias', 'orden', 'ancho', 'alto', 'piezas', 'planchados', 'vigenciaDias', 'inversion', 'iva', 'anticipoSugerido', 'umbralMayoreo', 'diasPlayeras']);
  function sanear(valor, clave) {
    if (Array.isArray(valor)) return valor.map(v => sanear(v));
    if (valor && typeof valor === 'object') {
      const limpio = {};
      Object.keys(valor).forEach(k => { if (k !== '__proto__' && k !== 'constructor' && k !== 'prototype') limpio[k] = sanear(valor[k], k); });
      return limpio;
    }
    if (CAMPOS_NUMERO.has(clave)) {
      if (valor === null || valor === '' || valor === undefined) return null;
      const n = Number(valor);
      return Number.isFinite(n) ? n : null;
    }
    if (/^(id|contactoId|cotizacionId|pedidoId)$/.test(clave || '') && valor != null && !ID_VALIDO.test(String(valor))) return null;
    return valor;
  }

  function idPlayera(p) { return 'play-' + u.normalizar(`${p.codigo}-${p.talla}-${p.color}`).replace(/[^a-z0-9]+/g, '-'); }

  // El catálogo inicial (js/datos-iniciales.js) NO se publica: solo se carga si existe en la compu del dueño.
  // En la app publicada, el catálogo llega desde la base del negocio después de entrar.
  function sembrar() {
    const D = window.DATOS_INICIALES || { productos: [], playeras: [] };
    // Agrega lo que falte del catálogo inicial y actualiza lo que nunca se ha editado (para que tome
    // los valores de versiones nuevas). Lo que se editó o se quitó a mano no se toca.
    const semilla = (col, id, datos) => {
      const previo = memoria[col][id];
      if (previo && previo.actualizado !== FECHA_SEMILLA) return false;
      const nuevo = { ...datos, id, creado: FECHA_SEMILLA, actualizado: FECHA_SEMILLA, _borrado: false };
      if (previo && JSON.stringify(previo) === JSON.stringify({ ...previo, ...nuevo })) return false;
      memoria[col][id] = nuevo;
      return true;
    };
    let retirados = false;
    PRODUCTOS_RETIRADOS.forEach(clave => {
      const id = 'prod-' + u.normalizar(clave);
      const p = memoria.productos[id];
      if (p && p.actualizado === FECHA_SEMILLA && !p._borrado) { memoria.productos[id] = { ...p, _borrado: true }; retirados = true; }
    });
    let nuevos = [...D.productos.map((p, i) => ({ ...p, orden: i })), ...PRODUCTOS_EXTRA]
      .map(p => semilla('productos', 'prod-' + u.normalizar(p.clave), { ...p, activo: true }));
    if (nuevos.some(Boolean) || retirados) persistir('productos');
    nuevos = [...D.playeras.map((p, i) => ({ ...p, orden: i })), ...PLAYERAS_EXTRA].map(p => semilla('playeras', idPlayera(p), p));
    if (nuevos.some(Boolean)) persistir('playeras');
    // Los ajustes solo guardan lo que se cambia; lo demás sale de AJUSTES_BASE.
    // Si nunca se editaron, se rehacen para que tomen los valores nuevos de cada versión.
    const aj = memoria.ajustes.general;
    if (!aj || aj.actualizado === FECHA_SEMILLA) {
      memoria.ajustes.general = { id: 'general', creado: FECHA_SEMILLA, actualizado: FECHA_SEMILLA, _borrado: false };
      persistir('ajustes');
    }
  }

  A.db = {
    COLECCIONES,
    iniciar() {
      COLECCIONES.forEach(col => {
        memoria[col] = {};
        leer('col.' + col, []).forEach(r => { memoria[col][r.id] = r; });
      });
      sembrar();
    },
    todos(col, { conBorrados = false } = {}) {
      return Object.values(memoria[col] || {}).filter(r => conBorrados || !r._borrado);
    },
    obtener(col, id) {
      const r = memoria[col] && memoria[col][id];
      return r && !r._borrado ? r : null;
    },
    guardar(col, datos) {
      const previo = datos.id && memoria[col][datos.id];
      const ahora = u.ahora();
      let r = { ...(previo || {}), ...datos, id: datos.id || u.id(), creado: (previo && previo.creado) || datos.creado || ahora, actualizado: ahora, _borrado: false };
      // Quién hizo el cambio (solo cuando hay sesión de equipo).
      const quien = usuarioActual();
      if (quien) {
        r.por = quien;
        if (col === 'pedidos') {
          r.historial = (r.historial || []).map(h => (h.por ? h : { ...h, por: quien }));
          r.pagos = (r.pagos || []).map(p => (p.por ? p : { ...p, por: quien }));
        }
      }
      if (col === 'pedidos' && previo) r = fusionarPedido(r, previo);
      memoria[col][r.id] = r;
      persistir(col);
      marcarPendiente(col, r.id);
      avisar(col, 'local');
      return r;
    },
    // Guarda el registro tal cual, sin mezclar con lo anterior (para quitar campos).
    reemplazar(col, datos) {
      const previo = memoria[col][datos.id];
      const r = { ...datos, creado: (previo && previo.creado) || datos.creado || u.ahora(), actualizado: u.ahora(), _borrado: false };
      memoria[col][r.id] = r;
      persistir(col);
      marcarPendiente(col, r.id);
      avisar(col, 'local');
      return r;
    },
    borrar(col, id) {
      const r = memoria[col][id];
      if (!r) return;
      memoria[col][id] = { ...r, _borrado: true, actualizado: u.ahora() };
      persistir(col);
      marcarPendiente(col, id);
      avisar(col, 'local');
    },
    ajustes() {
      const a = memoria.ajustes.general || {};
      // Mezcla con la base por si una versión nueva agrega campos.
      const base = structuredClone(AJUSTES_BASE);
      return {
        ...base, ...a,
        negocio: { ...base.negocio, ...(a.negocio || {}) },
        tecnicas: { ...base.tecnicas, ...(a.tecnicas || {}) },
        planchado: { ...base.planchado, ...(a.planchado || {}) },
        comisiones: { ...base.comisiones, ...(a.comisiones || {}),
          categorias: { ...base.comisiones.categorias, ...((a.comisiones || {}).categorias || {}) },
          productos: { ...base.comisiones.productos, ...((a.comisiones || {}).productos || {}) } },
        pago: { ...base.pago, ...(a.pago || {}) },
      };
    },
    guardarAjustes(cambios) { return A.db.guardar('ajustes', { ...A.db.ajustes(), ...cambios, id: 'general' }); },
    alCambiar(fn) { oyentes.push(fn); },

    // Folio legible y consecutivo: P-0001 (pedidos), C-0001 (cotizaciones).
    siguienteFolio(col, prefijo) {
      // Solo cuenta folios con el mismo prefijo (los vendedores usan el suyo, ej. P-JV-0001).
      const patron = new RegExp('^' + prefijo.replace(/[^\w-]/g, '') + '-(\\d+)$');
      const max = A.db.todos(col, { conBorrados: true }).reduce((m, r) => {
        const coincide = String(r.folio || '').match(patron);
        const n = coincide ? parseInt(coincide[1], 10) : NaN;
        return Number.isFinite(n) && n > m ? n : m;
      }, 0);
      return `${prefijo}-${String(max + 1).padStart(4, '0')}`;
    },

    // ---- Para la sincronización ----
    pendientes() { return pendientes; },
    registroCrudo(col, id) { return memoria[col] && memoria[col][id]; },
    limpiarPendientes(col, ids) {
      ids.forEach(id => { if (pendientes[col]) delete pendientes[col][id]; });
      escribir('pendientes', pendientes);
    },
    // Aplica registros que vienen del servidor; gana el que tenga la fecha de actualización más reciente.
    aplicarRemotos(lista) {
      const tocadas = new Set();
      lista.forEach(({ coleccion, id, datos, actualizado, borrado }) => {
        if (!memoria[coleccion] || !ID_VALIDO.test(String(id)) || typeof actualizado !== 'string') return;
        datos = sanear(datos);
        const local = memoria[coleccion][id];
        // Pedido con cambios locales sin subir: se juntan ambos y se sube el resultado.
        if (local && coleccion === 'pedidos' && !borrado && pendientes.pedidos && pendientes.pedidos[id]) {
          const remoto = { ...datos, id, actualizado, _borrado: false };
          const [base, otro] = local.actualizado >= actualizado ? [local, remoto] : [remoto, local];
          memoria[coleccion][id] = { ...fusionarPedido(base, otro), actualizado: new Date(Math.max(Date.now(), Date.parse(actualizado) + 1)).toISOString() };
          tocadas.add(coleccion);
          return;
        }
        if (local && local.actualizado >= actualizado) return;
        memoria[coleccion][id] = { ...datos, id, actualizado, _borrado: !!borrado };
        if (pendientes[coleccion]) delete pendientes[coleccion][id];
        tocadas.add(coleccion);
      });
      tocadas.forEach(persistir);
      escribir('pendientes', pendientes);
      tocadas.forEach(col => avisar(col, 'remoto'));
      return tocadas.size;
    },
    // Marca colecciones completas para subirlas (el dueño sube su catálogo la primera vez).
    marcarPendientes(cols) {
      cols.forEach(col => Object.keys(memoria[col] || {}).forEach(id => { (pendientes[col] = pendientes[col] || {})[id] = true; }));
      escribir('pendientes', pendientes);
    },
    // Borra todo lo guardado en este dispositivo (al cerrar sesión en un equipo prestado o de alguien que se va).
    borrarDispositivo() {
      Object.keys(localStorage).filter(k => k.startsWith(PREFIJO)).forEach(k => localStorage.removeItem(k));
    },
    leerMeta(clave, porDefecto) { return leer('meta.' + clave, porDefecto); },
    escribirMeta(clave, valor) { escribir('meta.' + clave, valor); },

    // ---- Respaldo ----
    exportar() {
      const datos = { app: 'nova-pedidos', version: 1, exportado: u.ahora(), colecciones: {} };
      COLECCIONES.forEach(col => { datos.colecciones[col] = A.db.todos(col, { conBorrados: true }); });
      return datos;
    },
    importar(datos) {
      if (!datos || datos.app !== 'nova-pedidos' || !datos.colecciones) throw new Error('El archivo no es un respaldo de Nova Pedidos.');
      COLECCIONES.forEach(col => {
        (datos.colecciones[col] || []).forEach(original => {
          const r = sanear(original);
          if (!r || !ID_VALIDO.test(String(r.id))) return;
          const local = memoria[col][r.id];
          if (!local || local.actualizado <= r.actualizado) { memoria[col][r.id] = r; marcarPendiente(col, r.id); }
        });
        persistir(col);
        avisar(col, 'importado');
      });
    },
  };
})(window.App);

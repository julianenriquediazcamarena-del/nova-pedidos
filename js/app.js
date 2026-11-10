// Arranque, navegación y rutas.
(function (A) {
  const u = A.u;

  const MENU = [
    { ruta: '#/', ico: '⌂', texto: 'Inicio', vista: 'panel' },
    { ruta: '#/pedidos', ico: '▤', texto: 'Pedidos', vista: 'pedidos' },
    { ruta: '#/cotizaciones', ico: '✎', texto: 'Cotizaciones', vista: 'cotizaciones' },
    { ruta: '#/precios', ico: '$', texto: 'Precios', vista: 'catalogo' },
    { ruta: '#/desempeno', ico: '↗', texto: 'Desempeño', vista: 'desempeno', soloDueno: true },
    { ruta: '#/calculadora', ico: '±', texto: 'Calculadora', vista: 'calculadora' },
    { ruta: '#/contactos', ico: '☺', texto: 'Contactos', vista: 'contactos' },
    { ruta: '#/ajustes', ico: '⚙', texto: 'Ajustes', vista: 'ajustes' },
  ];
  const PESTANAS = [
    { ruta: '#/', ico: '⌂', texto: 'Inicio', vista: 'panel' },
    { ruta: '#/pedidos', ico: '▤', texto: 'Pedidos', vista: 'pedidos' },
    { ruta: '#/cotizar', ico: '✎', texto: 'Cotizar', vista: 'cotizaciones' },
    { ruta: '#/precios', ico: '$', texto: 'Precios', vista: 'catalogo' },
    { ruta: '#/mas', ico: '☰', texto: 'Más', vista: 'mas' },
  ];

  // patrón de ruta → [vista, función que extrae parámetros]
  const RUTAS = [
    [/^#?\/?$/, 'panel'],
    [/^#\/pedidos$/, 'pedidos'],
    [/^#\/pedido\/([\w-]+)$/, 'pedido'],
    [/^#\/cotizaciones$/, 'cotizaciones'],
    [/^#\/cotizar$/, 'cotizacion'],
    [/^#\/cotizacion\/([\w-]+)$/, 'cotizacion'],
    [/^#\/precios$/, 'catalogo'],
    [/^#\/calculadora$/, 'calculadora'],
    [/^#\/contactos$/, 'contactos'],
    [/^#\/contacto\/([\w-]+)$/, 'contacto'],
    [/^#\/ajustes$/, 'ajustes'],
    [/^#\/desempeno(?:\/(\w+))?$/, 'desempeno'],
    [/^#\/mas$/, 'mas'],
    [/^#\/conectar\/([\w-]+)$/, 'conectar'],
  ];
  // Secciones que solo ve el dueño (ganancias, gastos, bitácora).
  const SOLO_DUENO = ['desempeno'];

  A.esDueno = () => A.sync.rol() === 'dueno';

  // Publicada en internet, la app no muestra nada sin sesión (ni el catálogo). En la compu, abierta como
  // archivo o en localhost, se puede usar sola sin cuenta.
  const enInternet = location.protocol === 'https:' && !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  A.requiereSesion = () => enInternet || !!(window.NOVA_CONFIG || {}).requiereSesion;
  A.bloqueado = () => A.requiereSesion() && (!A.sync.conSesion() || A.sync.rol() === 'pendiente');
  const menuVisible = () => MENU.filter(m => !m.soloDueno || A.esDueno());

  A.vistas = A.vistas || {};
  A.vistas.mas = {
    titulo: 'Más',
    render(c) {
      c.innerHTML = `<div class="cabeza"><h1>Más</h1></div><div class="lista">
        ${menuVisible().filter(m => !['panel', 'pedidos', 'catalogo'].includes(m.vista)).map(m => `
          <a class="renglon" href="${m.ruta}"><span class="ico" style="width:24px;text-align:center;font-size:1.2rem">${m.ico}</span><span class="principal titulo">${m.texto}</span><span class="tenue">›</span></a>`).join('')}
      </div>`;
    },
  };

  // Enlace de invitación: deja la app conectada a la base del negocio y manda a iniciar sesión.
  A.vistas.conectar = {
    titulo: 'Conectar',
    render(c, datos) {
      try {
        A.sync.leerInvitacion(datos);
        A.aviso('App conectada al equipo. Entra con tu correo y contraseña.');
      } catch {
        A.aviso('El enlace de invitación no es válido.');
      }
      c.innerHTML = '';
      setTimeout(() => location.replace('#/ajustes'), 0);
    },
  };

  A.vistas.entrar = {
    titulo: 'Entrar',
    render(c) {
      const pendiente = A.sync.conSesion() && A.sync.rol() === 'pendiente';
      c.innerHTML = `<div class="pantalla-entrada">
        <div class="logo-entrada"><img src="img/wordmark.png" alt="Impresos Nova"></div>
        <div class="tarjeta"><h2>${pendiente ? 'Cuenta en espera' : 'Entrar'}</h2><div id="en-cuerpo"></div></div>
        <p class="chico tenue">Acceso solo para el equipo de Impresos Nova.</p></div>`;
      const cuerpo = c.querySelector('#en-cuerpo');
      if (!pendiente) { A.cuenta.pintar(cuerpo); return; }
      cuerpo.innerHTML = `<p>Tu cuenta (${u.esc(A.sync.correo() || '')}) ya existe, pero el dueño todavía no la aprueba. Pídele que entre a <strong>Ajustes → Equipo</strong> y te asigne un rol.</p>
        <div class="fila" style="gap:8px"><button class="btn primario" id="en-revisar">Ya me aprobó</button><button class="btn" id="en-salir">Cerrar sesión</button></div>`;
      cuerpo.querySelector('#en-revisar').addEventListener('click', async () => { await A.sync.sincronizar(); mostrar(); });
      cuerpo.querySelector('#en-salir').addEventListener('click', () => { A.sync.cerrarSesion(); mostrar(); });
    },
  };

  let actual = null;

  function resolver() {
    const hash = location.hash || '#/';
    for (const [re, vista] of RUTAS) {
      const m = hash.match(re);
      if (m) return { vista, params: m.slice(1) };
    }
    return { vista: 'panel', params: [] };
  }

  function grupo(vista) {
    return { pedido: 'pedidos', cotizacion: 'cotizaciones', contacto: 'contactos' }[vista] || vista;
  }

  function mostrar() {
    const { vista, params } = resolver();
    if (SOLO_DUENO.includes(vista) && !A.esDueno()) { location.replace('#/'); return; }
    const bloqueado = A.bloqueado() && vista !== 'conectar';
    document.body.classList.toggle('bloqueado', bloqueado);
    const def = A.vistas[bloqueado ? 'entrar' : vista];
    const cont = document.getElementById('vista');
    if (actual && actual.limpiar) actual.limpiar();
    A.modal.cerrar();
    actual = { vista: bloqueado ? 'entrar' : vista, params, limpiar: def.render(cont, ...params) };
    document.getElementById('titulo-movil').textContent = typeof def.titulo === 'function' ? def.titulo(...params) : def.titulo;
    const g = grupo(vista);
    u.$$('#menu a').forEach(a => a.classList.toggle('activo', a.dataset.vista === g));
    u.$$('#pestanas a').forEach(a => {
      const v = a.dataset.vista;
      a.classList.toggle('activo', v === g || (v === 'mas' && ['calculadora', 'contactos', 'ajustes', 'desempeno', 'mas'].includes(g)));
    });
    window.scrollTo(0, 0);
  }

  // Si llegan cambios de otro dispositivo, se vuelve a dibujar la vista (salvo en formularios en edición).
  function alCambiarDatos(col, origen) {
    if (origen === 'local' || !actual) return;
    const def = A.vistas[actual.vista];
    if (def.refrescar === false) return;
    mostrar();
  }

  function pintarSync(estado) {
    const clase = { ok: 'ok', error: 'error', pendiente: 'pendiente', sincronizando: 'pendiente', local: '' }[estado.modo] || '';
    const ultima = estado.ultima ? ` · ${u.fechaHora(estado.ultima)}` : '';
    document.getElementById('estado-sync').innerHTML = `<span class="punto ${clase}"></span>${u.esc(estado.mensaje)}${estado.modo === 'ok' ? ultima : ''}`;
    document.getElementById('estado-sync-movil').innerHTML = `<span class="punto ${clase}" title="${u.esc(estado.mensaje)}"></span>`;
  }

  function pintarMenu() {
    document.getElementById('menu').innerHTML = menuVisible().map(m => `<a href="${m.ruta}" data-vista="${m.vista}"><span class="ico">${m.ico}</span>${m.texto}</a>`).join('');
    const p = A.sync.conSesion() && A.sync.perfil();
    document.getElementById('usuario-actual').innerHTML = p
      ? `<strong>${u.esc(A.sync.nombreUsuario())}</strong><span>${p.rol === 'dueno' ? 'Dueño' : 'Colaborador'}</span>` : '';
  }

  // En la compu se carga el catálogo inicial privado si existe; publicada no se pide (no está en internet).
  function cargarCatalogoLocal() {
    return new Promise(listo => {
      if (enInternet || window.DATOS_INICIALES) return listo();
      const s = document.createElement('script');
      s.src = 'js/datos-iniciales.js';
      s.onload = s.onerror = () => listo();
      document.head.appendChild(s);
    });
  }

  async function iniciar() {
    // No se deja mostrar dentro de otra página (evita que la disfracen para robar clics o contraseñas).
    if (window.top !== window.self) { document.body.textContent = 'Abre la app directamente.'; return; }
    await cargarCatalogoLocal();
    A.db.iniciar();
    pintarMenu();
    document.getElementById('pestanas').innerHTML = PESTANAS.map(m => `<a href="${m.ruta}" data-vista="${m.vista}"><span class="ico">${m.ico}</span>${m.texto}</a>`).join('');
    window.addEventListener('hashchange', mostrar);
    document.addEventListener('click', e => { if (e.target.closest('[data-venta-rapida]')) A.ventaRapida(); });
    A.db.alCambiar(alCambiarDatos);
    A.sync.alCambiar(pintarSync);
    // Si cambia la persona o su rol, se rehace el menú y la vista.
    A.sync.alCambiarPerfil(() => { pintarMenu(); mostrar(); });
    mostrar();
    A.sync.arrancar();
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').catch(e => console.warn('Sin modo sin conexión:', e));
    }
  }

  A.ir = ruta => { if (location.hash === ruta) mostrar(); else location.hash = ruta; };
  A.recargarVista = mostrar;
  document.addEventListener('DOMContentLoaded', iniciar);
})(window.App);

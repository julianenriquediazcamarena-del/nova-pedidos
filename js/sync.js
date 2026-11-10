// Sincronización con Supabase usando su API REST (sin librerías externas).
// Todo se guarda primero en el dispositivo; cuando hay conexión y sesión, se suben los cambios
// pendientes y se bajan los de otros dispositivos. Si dos dispositivos editan lo mismo, gana el cambio más reciente
// (en pedidos, los pagos y el historial se juntan para no perder nada; ver db.js).
// Cada usuario tiene un perfil con su nombre y rol: dueño (todo) o colaborador (pedidos, cotizaciones y clientes).
(function (A) {
  const TABLA = 'registros';
  const LOTE = 500;
  const TRASLAPE_MS = 5000; // se vuelve a pedir un margen de tiempo para no perder registros concurrentes
  const COLECCIONES_COLABORADOR = ['pedidos', 'cotizaciones', 'contactos'];

  let estado = { modo: 'local', mensaje: 'Solo en este dispositivo' };
  let enCurso = null;
  let temporizador = null;
  const oyentes = [];
  const oyentesPerfil = [];

  // La conexión puede venir fija en js/config.js (para todo el equipo) o capturada en Ajustes.
  const config = () => {
    const fija = window.NOVA_CONFIG || {};
    if (fija.supabaseUrl && fija.supabaseClave) return { url: fija.supabaseUrl, clave: fija.supabaseClave, fija: true };
    return A.db.leerMeta('sync', null);
  };
  const sesion = () => A.db.leerMeta('sesion', null);
  const perfil = () => A.db.leerMeta('perfil', null);

  function fijarPerfil(p) {
    const antes = perfil();
    A.db.escribirMeta('perfil', p);
    if (JSON.stringify(antes) !== JSON.stringify(p)) oyentesPerfil.forEach(fn => fn(p));
  }
  async function cargarPerfil() {
    const s = sesion();
    if (!s || !s.uid) return;
    try {
      const filas = await pedir(`/rest/v1/perfiles?select=id,email,nombre,rol&id=eq.${s.uid}`);
      fijarPerfil(filas[0] || { id: s.uid, email: s.email, nombre: (s.email || '').split('@')[0], rol: 'colaborador' });
    } catch (e) {
      // Base sin la tabla de perfiles (supabase.sql viejo): se trata como dueño y se avisa en Ajustes.
      if (e.estado === 404 || /perfiles/.test(e.message)) fijarPerfil({ id: s.uid, email: s.email, nombre: (s.email || '').split('@')[0], rol: 'dueno', sinTabla: true });
      else throw e;
    }
  }

  function fijarEstado(modo, mensaje) {
    estado = { modo, mensaje, ultima: A.db.leerMeta('ultimaSync', null) };
    oyentes.forEach(fn => fn(estado));
  }

  async function pedir(ruta, { metodo = 'GET', cuerpo, encabezados = {}, conToken = true } = {}) {
    const c = config();
    const h = { apikey: c.clave, 'Content-Type': 'application/json', ...encabezados };
    if (conToken) h.Authorization = 'Bearer ' + (await token());
    const r = await fetch(c.url.replace(/\/+$/, '') + ruta, { method: metodo, headers: h, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
    const texto = await r.text();
    const datos = texto ? JSON.parse(texto) : null;
    if (!r.ok) {
      const msg = (datos && (datos.error_description || datos.msg || datos.message || datos.error)) || `Error ${r.status}`;
      const err = new Error(msg); err.estado = r.status; throw err;
    }
    return datos;
  }

  function guardarSesion(d) {
    A.db.escribirMeta('sesion', {
      access_token: d.access_token,
      refresh_token: d.refresh_token,
      expira: Date.now() + (d.expires_in || 3600) * 1000,
      email: d.user && d.user.email,
      uid: d.user && d.user.id,
    });
  }

  async function token() {
    const s = sesion();
    if (!s) throw new Error('Sin sesión');
    if (Date.now() < s.expira - 60000) return s.access_token;
    const d = await pedir('/auth/v1/token?grant_type=refresh_token', { metodo: 'POST', cuerpo: { refresh_token: s.refresh_token }, conToken: false });
    guardarSesion({ ...d, user: d.user || { email: s.email, id: s.uid } });
    return d.access_token;
  }

  async function bajar() {
    let cursor = A.db.leerMeta('cursor', '1970-01-01T00:00:00Z');
    let desde = new Date(new Date(cursor).getTime() - TRASLAPE_MS).toISOString();
    let total = 0;
    for (;;) {
      const filas = await pedir(`/rest/v1/${TABLA}?select=coleccion,id,datos,actualizado,borrado,servidor_ts&servidor_ts=gt.${encodeURIComponent(desde)}&order=servidor_ts.asc&limit=1000`);
      if (!filas.length) break;
      total += A.db.aplicarRemotos(filas);
      const ultimo = filas[filas.length - 1].servidor_ts;
      if (new Date(ultimo) > new Date(cursor)) cursor = ultimo;
      if (filas.length < 1000) break;
      desde = ultimo;
    }
    A.db.escribirMeta('cursor', cursor);
    return total;
  }

  async function subir() {
    const pend = A.db.pendientes();
    const filas = [];
    // Un colaborador solo sube lo que la base le permite; lo demás se queda en su dispositivo.
    // Una cuenta pendiente de aprobar no sube nada.
    const rol = A.sync.rol();
    if (rol === 'pendiente') return 0;
    const permitidas = rol === 'dueno' ? null : COLECCIONES_COLABORADOR;
    Object.keys(pend).filter(col => !permitidas || permitidas.includes(col)).forEach(col => Object.keys(pend[col]).forEach(id => {
      const r = A.db.registroCrudo(col, id);
      if (r) filas.push({ coleccion: col, id, datos: r, actualizado: r.actualizado, borrado: !!r._borrado });
    }));
    for (let i = 0; i < filas.length; i += LOTE) {
      const lote = filas.slice(i, i + LOTE);
      await pedir(`/rest/v1/${TABLA}?on_conflict=coleccion,id`, {
        metodo: 'POST', cuerpo: lote, encabezados: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      });
      const porCol = {};
      lote.forEach(f => (porCol[f.coleccion] = porCol[f.coleccion] || []).push(f.id));
      Object.entries(porCol).forEach(([col, ids]) => A.db.limpiarPendientes(col, ids));
    }
    return filas.length;
  }

  // La primera vez que el dueño se conecta, si la base todavía no tiene catálogo, sube el de su dispositivo.
  // (El catálogo no viaja en el código publicado: solo vive en la base, protegido con sesión.)
  async function subirCatalogoSiFalta() {
    if (A.sync.rol() !== 'dueno' || A.db.leerMeta('catalogoRevisado', false)) return;
    const hay = await pedir(`/rest/v1/${TABLA}?select=id&coleccion=eq.productos&limit=1`);
    if (!hay.length && A.db.todos('productos').length) A.db.marcarPendientes(['productos', 'playeras', 'ajustes']);
    A.db.escribirMeta('catalogoRevisado', true);
  }

  function contarPendientes() {
    const p = A.db.pendientes();
    return Object.values(p).reduce((n, o) => n + Object.keys(o).length, 0);
  }

  A.sync = {
    estado: () => estado,
    alCambiar(fn) { oyentes.push(fn); fn(estado); },
    configurada: () => !!(config() && config().url && config().clave),
    conSesion: () => !!sesion(),
    correo: () => (sesion() || {}).email,
    config,
    perfil,
    // Sin sesión (app en un solo dispositivo) quien la usa es el dueño.
    rol: () => (sesion() && perfil() ? perfil().rol : 'dueno'),
    nombreUsuario: () => { const p = perfil(); return (p && p.nombre) || ((sesion() || {}).email || '').split('@')[0] || ''; },
    alCambiarPerfil(fn) { oyentesPerfil.push(fn); },
    guardarConfig(url, clave) {
      const limpia = url.trim().replace(/\/+$/, '');
      if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(limpia)) throw new Error('La URL debe ser la de tu proyecto: https://xxxx.supabase.co');
      A.db.escribirMeta('sync', { url: limpia, clave: clave.trim() });
    },
    // Enlace para que un colaborador abra la app ya conectada a la base (la clave pública no es secreta).
    enlaceInvitacion() {
      const c = config();
      if (!c) return '';
      // Con la conexión fija en config.js basta el link normal de la app.
      if (c.fija) return `${location.origin}${location.pathname}`;
      const datos = btoa(JSON.stringify({ u: c.url, k: c.clave })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      return `${location.origin}${location.pathname}#/conectar/${datos}`;
    },
    leerInvitacion(datos) {
      // Con la conexión fija en config.js, los enlaces no cambian nada (evita enlaces falsos que apunten a otra base).
      if (config() && config().fija) return;
      const json = JSON.parse(atob(datos.replace(/-/g, '+').replace(/_/g, '/')));
      if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(json.u) || typeof json.k !== 'string' || json.k.length > 400) throw new Error('Enlace no válido');
      A.sync.guardarConfig(json.u, json.k);
    },
    async iniciarSesion(email, password) {
      const d = await pedir('/auth/v1/token?grant_type=password', { metodo: 'POST', cuerpo: { email, password }, conToken: false });
      guardarSesion(d);
      await cargarPerfil();
      await A.sync.sincronizar();
    },
    cerrarSesion({ borrarDatos = false } = {}) {
      if (borrarDatos) {
        // Se conserva solo la conexión a la base para poder volver a entrar.
        const cfg = A.db.leerMeta('sync', null);
        A.db.borrarDispositivo();
        if (cfg) A.db.escribirMeta('sync', cfg);
        location.reload();
        return;
      }
      A.db.escribirMeta('sesion', null);
      fijarPerfil(null);
      fijarEstado('local', 'Sesión cerrada');
    },
    // ---- Archivos (fotos de pedidos) en la carpeta privada "adjuntos" de Supabase Storage ----
    async archivo(metodo, ruta, cuerpo, tipo) {
      const c = config();
      if (!c || !sesion()) throw new Error('Entra con tu cuenta para usar fotos');
      const r = await fetch(`${c.url}/storage/v1/object/${metodo === 'GET' ? 'authenticated/' : ''}adjuntos/${ruta}`, {
        method: metodo,
        headers: { apikey: c.clave, Authorization: 'Bearer ' + (await token()), ...(tipo ? { 'Content-Type': tipo, 'x-upsert': 'false' } : {}) },
        body: cuerpo,
      });
      if (!r.ok) {
        let msg = `Error ${r.status}`;
        try { const d = await r.json(); msg = d.message || d.error || msg; } catch { /* sin cuerpo */ }
        throw new Error(msg);
      }
      return r;
    },
    // ---- Equipo (solo el dueño puede ver a todos y cambiarlos) ----
    async equipo() { return pedir('/rest/v1/perfiles?select=id,email,nombre,rol,creado&order=creado.asc'); },
    async actualizarPerfil(id, cambios) {
      await pedir(`/rest/v1/perfiles?id=eq.${id}`, { metodo: 'PATCH', cuerpo: cambios, encabezados: { Prefer: 'return=minimal' } });
      if (id === (sesion() || {}).uid) await cargarPerfil();
    },
    async sincronizar() {
      if (!A.sync.configurada() || !A.sync.conSesion()) { fijarEstado('local', 'Solo en este dispositivo'); return; }
      if (!navigator.onLine) { fijarEstado('pendiente', `Sin internet · ${contarPendientes()} cambios por subir`); return; }
      if (enCurso) return enCurso;
      fijarEstado('sincronizando', 'Sincronizando…');
      enCurso = (async () => {
        try {
          await cargarPerfil();
          if (A.sync.rol() === 'pendiente') { fijarEstado('pendiente', 'Tu cuenta espera la aprobación del dueño'); return; }
          await bajar();
          await subirCatalogoSiFalta();
          if (A.sync.rol() === 'dueno') { A.costos.migrar(); A.comisiones.actualizarRegistros(); }
          await subir();
          A.db.escribirMeta('ultimaSync', A.u.ahora());
          fijarEstado('ok', 'Sincronizado');
        } catch (e) {
          console.error(e);
          if (e.estado === 401 || e.estado === 400 && /refresh/i.test(e.message)) {
            A.db.escribirMeta('sesion', null);
            fijarPerfil(null);
            fijarEstado('error', 'La sesión venció: vuelve a entrar en Ajustes');
          } else {
            fijarEstado('error', 'No se pudo sincronizar: ' + e.message);
          }
        } finally { enCurso = null; }
      })();
      return enCurso;
    },
    programar(ms = 2000) {
      clearTimeout(temporizador);
      temporizador = setTimeout(() => A.sync.sincronizar(), ms);
    },
    arrancar() {
      A.db.alCambiar((col, origen) => { if (origen !== 'remoto') A.sync.programar(); });
      window.addEventListener('online', () => A.sync.sincronizar());
      window.addEventListener('offline', () => A.sync.sincronizar());
      document.addEventListener('visibilitychange', () => { if (!document.hidden) A.sync.sincronizar(); });
      setInterval(() => { if (!document.hidden) A.sync.sincronizar(); }, 60000);
      A.sync.sincronizar();
    },
  };
})(window.App);

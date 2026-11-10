// Utilidades compartidas: formato, fechas, búsqueda, modal y avisos.
window.App = window.App || {};
window.App.vistas = window.App.vistas || {};

(function (A) {
  const fmtDinero = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
  const fmtNum = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 });
  const fmtPesos = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

  A.u = {
    esc(s) {
      return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },
    dinero(n) { return fmtDinero.format(Number(n) || 0); },
    // Sin centavos, para cifras grandes en cuadros de resumen.
    pesos(n) { return fmtPesos.format(Math.round(Number(n) || 0)); },
    num(n) { return fmtNum.format(Number(n) || 0); },
    redondear(n) { return Math.round((Number(n) || 0) * 100) / 100; },
    id() {
      if (crypto.randomUUID) return crypto.randomUUID();
      return 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    },
    ahora() { return new Date().toISOString(); },

    // Quita acentos y pasa a minúsculas para buscar sin importar cómo se escriba.
    normalizar(s) { return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); },
    coincide(texto, consulta) {
      const t = A.u.normalizar(texto);
      return A.u.normalizar(consulta).split(/\s+/).filter(Boolean).every(p => t.includes(p));
    },

    // ---- Fechas (siempre como 'AAAA-MM-DD' en hora local) ----
    hoy() { return A.u.isoFecha(new Date()); },
    isoFecha(d) {
      const z = n => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
    },
    aFecha(iso) { const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number); return new Date(a, m - 1, d); },
    sumarDias(iso, n) { const d = A.u.aFecha(iso); d.setDate(d.getDate() + n); return A.u.isoFecha(d); },
    diasEntre(desde, hasta) { return Math.round((A.u.aFecha(hasta) - A.u.aFecha(desde)) / 86400000); },
    esHabil(d, conSabado) { const dia = d.getDay(); return dia !== 0 && (conSabado || dia !== 6); },
    // Suma días hábiles; si la fecha de inicio no es hábil, el conteo arranca el siguiente día hábil.
    sumarHabiles(iso, n, conSabado = true) {
      const d = A.u.aFecha(iso);
      while (!A.u.esHabil(d, conSabado)) d.setDate(d.getDate() + 1);
      let resta = n;
      while (resta > 0) {
        d.setDate(d.getDate() + 1);
        if (A.u.esHabil(d, conSabado)) resta--;
      }
      return A.u.isoFecha(d);
    },
    restarHabiles(iso, n, conSabado = true) {
      const d = A.u.aFecha(iso);
      let resta = n;
      while (resta > 0) {
        d.setDate(d.getDate() - 1);
        if (A.u.esHabil(d, conSabado)) resta--;
      }
      return A.u.isoFecha(d);
    },
    // Días hábiles que faltan de 'desde' a 'hasta' (negativo, en días naturales, si 'hasta' ya pasó).
    habilesEntre(desde, hasta, conSabado = true) {
      if (hasta <= desde) return A.u.diasEntre(desde, hasta);
      const d = A.u.aFecha(desde);
      let n = 0;
      while (A.u.isoFecha(d) < hasta) {
        d.setDate(d.getDate() + 1);
        if (A.u.esHabil(d, conSabado)) n++;
      }
      return n;
    },
    fecha(iso, opciones) {
      if (!iso) return '—';
      return A.u.aFecha(iso).toLocaleDateString('es-MX', opciones || { day: 'numeric', month: 'short', year: 'numeric' });
    },
    fechaCorta(iso) { return iso ? A.u.aFecha(iso).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }) : '—'; },
    fechaHora(isoCompleto) {
      if (!isoCompleto) return '—';
      return new Date(isoCompleto).toLocaleString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    },
    // Texto relativo para fechas de entrega: "Hoy", "Mañana", "Hace 2 días"...
    relativo(iso) {
      const d = A.u.diasEntre(A.u.hoy(), iso);
      if (d === 0) return 'Hoy';
      if (d === 1) return 'Mañana';
      if (d === -1) return 'Ayer';
      if (d < 0) return `Hace ${-d} días`;
      if (d < 7) return `En ${d} días`;
      return A.u.fechaCorta(iso);
    },

    // ---- Teléfono / WhatsApp ----
    soloDigitos(t) { return String(t ?? '').replace(/\D/g, ''); },
    linkWhatsApp(telefono, texto) {
      let n = A.u.soloDigitos(telefono);
      if (n.length === 10) n = '52' + n;
      const base = n ? `https://wa.me/${n}` : 'https://wa.me/';
      return base + (texto ? `?text=${encodeURIComponent(texto)}` : '');
    },

    // ---- DOM ----
    $(sel, raiz = document) { return raiz.querySelector(sel); },
    $$(sel, raiz = document) { return Array.from(raiz.querySelectorAll(sel)); },
    datosForm(form) {
      const o = {};
      new FormData(form).forEach((v, k) => { o[k] = typeof v === 'string' ? v.trim() : v; });
      A.u.$$('input[type=checkbox][name]', form).forEach(c => { o[c.name] = c.checked; });
      return o;
    },
  };

  // ---- Aviso flotante ----
  let temporizador;
  A.aviso = function (texto) {
    const el = document.getElementById('aviso');
    el.textContent = texto;
    el.classList.add('visible');
    clearTimeout(temporizador);
    temporizador = setTimeout(() => el.classList.remove('visible'), 2600);
  };

  // ---- Modal ----
  const fondo = () => document.getElementById('modal');
  A.modal = {
    abrir(titulo, html, { ancho = false, alAbrir } = {}) {
      document.getElementById('modal-titulo').textContent = titulo;
      document.getElementById('modal-cuerpo').innerHTML = html;
      fondo().querySelector('.modal').classList.toggle('ancho', !!ancho);
      fondo().querySelector('.modal').classList.toggle('extra', ancho === 'extra');
      fondo().hidden = false;
      const primero = fondo().querySelector('input:not([type=hidden]), select, textarea');
      if (primero) setTimeout(() => primero.focus(), 30);
      if (alAbrir) alAbrir(document.getElementById('modal-cuerpo'));
    },
    cerrar() { fondo().hidden = true; document.getElementById('modal-cuerpo').innerHTML = ''; },
    // opciones: [[valor, texto], ...]; la primera es la principal. Resuelve con el valor elegido.
    elegir(titulo, texto, opciones) {
      return new Promise(resolver => {
        A.modal.abrir(titulo, `<p>${A.u.esc(texto)}</p>
          <div class="modal-pie">${[...opciones].reverse().map(([v, t], i) => `<button class="btn ${i === opciones.length - 1 ? 'primario' : ''}" data-r="${A.u.esc(v)}">${A.u.esc(t)}</button>`).join('')}</div>`,
        { alAbrir: c => c.addEventListener('click', e => {
          const b = e.target.closest('[data-r]');
          if (!b) return;
          A.modal.cerrar();
          resolver(b.dataset.r);
        }) });
      });
    },
    confirmar(titulo, texto, textoBoton = 'Sí, continuar') {
      return new Promise(resolver => {
        A.modal.abrir(titulo, `<p>${A.u.esc(texto)}</p>
          <div class="modal-pie"><button class="btn" data-r="no">Cancelar</button><button class="btn primario" data-r="si">${A.u.esc(textoBoton)}</button></div>`,
        { alAbrir: c => c.addEventListener('click', e => {
          const b = e.target.closest('[data-r]');
          if (!b) return;
          A.modal.cerrar();
          resolver(b.dataset.r === 'si');
        }) });
      });
    },
  };
  document.addEventListener('click', e => {
    if (e.target.closest('[data-cerrar]') || e.target === fondo()) A.modal.cerrar();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !fondo().hidden) A.modal.cerrar(); });
})(window.App);

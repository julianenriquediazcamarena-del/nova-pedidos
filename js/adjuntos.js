// Fotos de los pedidos (logos, dibujos, notas del cliente, constancias fiscales).
// Se achican en el celular antes de subirlas y se guardan en la carpeta privada "adjuntos" de Supabase:
// solo las ve el equipo con sesión (un vendedor, solo las que él subió).
(function (A) {
  const u = A.u;
  const MAX_LADO = 1600;
  const cache = new Map(); // ruta → URL local para mostrarla

  async function comprimir(archivo) {
    const img = await createImageBitmap(archivo).catch(() => null);
    if (!img) throw new Error('No se pudo leer la imagen');
    const escala = Math.min(1, MAX_LADO / Math.max(img.width, img.height));
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.round(img.width * escala);
    lienzo.height = Math.round(img.height * escala);
    const ctx = lienzo.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, lienzo.width, lienzo.height);
    ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);
    return new Promise(res => lienzo.toBlob(res, 'image/jpeg', 0.78));
  }

  A.adjuntos = {
    disponible: () => A.sync.configurada() && A.sync.conSesion(),
    // Sube una foto y devuelve el dato que se guarda en el pedido.
    async subir(pedidoId, archivo, tipo = 'referencia') {
      if (!navigator.onLine) throw new Error('Necesitas internet para subir fotos');
      const blob = await comprimir(archivo);
      const id = u.id();
      const ruta = `${pedidoId}/${id}.jpg`;
      await A.sync.archivo('POST', ruta, blob, 'image/jpeg');
      cache.set(ruta, URL.createObjectURL(blob));
      return { id, ruta, tipo, fecha: u.ahora(), por: A.sync.nombreUsuario(), porId: (A.sync.perfil() || {}).id || null };
    },
    async url(ruta) {
      if (cache.has(ruta)) return cache.get(ruta);
      const r = await A.sync.archivo('GET', ruta);
      const url = URL.createObjectURL(await r.blob());
      cache.set(ruta, url);
      return url;
    },
    async borrar(ruta) {
      await A.sync.archivo('DELETE', ruta);
      if (cache.has(ruta)) { URL.revokeObjectURL(cache.get(ruta)); cache.delete(ruta); }
    },

    // Galería dentro de un contenedor. opciones: tipo (referencia | fiscal), alCambiar(doc)
    montar(cont, doc, { tipo = 'referencia', titulo = 'Agregar foto', alCambiar } = {}) {
      const propias = () => (doc.adjuntos || []).filter(a => (a.tipo || 'referencia') === tipo);
      function pintar() {
        const lista = propias();
        cont.innerHTML = `
          <div class="galeria">${lista.map(a => `<button type="button" class="miniatura" data-ver="${u.esc(a.id)}" aria-label="Ver foto"><span class="chico tenue">Cargando…</span></button>`).join('')}</div>
          ${A.adjuntos.disponible()
            ? `<label class="btn chico" style="margin-top:8px">📷 ${u.esc(titulo)}<input type="file" accept="image/*" capture="environment" multiple hidden data-subir></label>`
            : '<p class="chico tenue">Para guardar fotos entra con tu cuenta del equipo.</p>'}`;
        lista.forEach(a => {
          A.adjuntos.url(a.ruta).then(url => {
            const b = cont.querySelector(`[data-ver="${CSS.escape(a.id)}"]`);
            if (b) { b.innerHTML = ''; const img = document.createElement('img'); img.src = url; img.alt = 'Foto del pedido'; b.appendChild(img); }
          }).catch(() => {
            const b = cont.querySelector(`[data-ver="${CSS.escape(a.id)}"]`);
            if (b) b.innerHTML = '<span class="chico tenue">Sin acceso</span>';
          });
        });
      }
      cont.addEventListener('change', async e => {
        if (!('subir' in e.target.dataset)) return;
        const archivos = [...e.target.files];
        e.target.value = '';
        for (const f of archivos) {
          A.aviso('Subiendo foto…');
          try {
            const a = await A.adjuntos.subir(doc.id, f, tipo);
            doc.adjuntos = [...(doc.adjuntos || []), a];
            alCambiar && alCambiar(doc);
            pintar();
            A.aviso('Foto guardada');
          } catch (err) { A.aviso('No se pudo subir: ' + err.message); }
        }
      });
      cont.addEventListener('click', async e => {
        const b = e.target.closest('[data-ver]');
        if (!b) return;
        const a = (doc.adjuntos || []).find(x => x.id === b.dataset.ver);
        if (!a) return;
        const puedeBorrar = A.esDueno() || a.porId === (A.sync.perfil() || {}).id;
        let url = '';
        try { url = await A.adjuntos.url(a.ruta); } catch { /* se muestra sin imagen */ }
        A.modal.abrir('Foto', `${url ? `<img src="${url}" alt="Foto del pedido" class="vista-nota">` : '<p>No se pudo cargar la foto.</p>'}
          <p class="chico tenue">Subida ${u.esc(u.fechaHora(a.fecha))}${a.por ? ' por ' + u.esc(a.por) : ''}</p>
          <div class="modal-pie">${puedeBorrar ? '<button type="button" class="btn peligro" id="adj-borrar" style="margin-right:auto">Borrar foto</button>' : ''}
            ${url ? `<a class="btn" href="${url}" download="foto-${u.esc(doc.folio || 'pedido')}.jpg">Descargar</a>` : ''}
            <button type="button" class="btn primario" data-cerrar>Cerrar</button></div>`, {
          ancho: true,
          alAbrir(m) {
            const borrar = m.querySelector('#adj-borrar');
            if (borrar) borrar.addEventListener('click', async () => {
              if (!(await A.modal.confirmar('Borrar foto', '¿Borrar esta foto del pedido? No se puede recuperar.', 'Borrar'))) return;
              try { await A.adjuntos.borrar(a.ruta); } catch (err) { A.aviso('No se pudo borrar en el servidor: ' + err.message); }
              doc.adjuntos = (doc.adjuntos || []).filter(x => x.id !== a.id);
              doc.adjuntosEliminados = [...(doc.adjuntosEliminados || []), a.id];
              alCambiar && alCambiar(doc);
              pintar();
            });
          },
        });
      });
      pintar();
    },
  };
})(window.App);

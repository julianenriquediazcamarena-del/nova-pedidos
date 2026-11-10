// Ajustes: datos del negocio, reglas de precios y entregas, costos, equipo, cuenta y respaldo.
// El dueño ve todo; un colaborador solo ve su cuenta.
(function (A) {
  const u = A.u;
  const esc = u.esc;

  function tarjetasDueno(aj) {
    return `
      <form class="tarjeta" id="aj-neg"><h2>Negocio</h2>
        <p class="chico tenue" style="margin-top:-6px">Aparece en cotizaciones, notas y mensajes.</p>
        <div class="campo"><label for="aj-n">Nombre</label><input type="text" id="aj-n" name="nombre" value="${esc(aj.negocio.nombre)}"></div>
        <div class="fila"><div class="campo"><label for="aj-t">WhatsApp</label><input type="tel" id="aj-t" name="telefono" value="${esc(aj.negocio.telefono)}"></div>
          <div class="campo"><label for="aj-l">Lema</label><input type="text" id="aj-l" name="lema" value="${esc(aj.negocio.lema)}"></div></div>
        <div class="campo"><label for="aj-d">Dirección</label><input type="text" id="aj-d" name="direccion" value="${esc(aj.negocio.direccion)}"></div>
        <button class="btn primario">Guardar</button>
      </form>

      <form class="tarjeta" id="aj-reglas"><h2>Entregas y cobro</h2>
        <label class="check" style="margin-bottom:12px"><input type="checkbox" name="conSabado" ${aj.conSabado ? 'checked' : ''}> Los sábados cuentan como día hábil</label>
        <div class="fila">
          <div class="campo"><label for="aj-vig">Vigencia de cotización (días)</label><input type="number" id="aj-vig" name="vigenciaCotizacion" min="1" value="${aj.vigenciaCotizacion}"></div>
          <div class="campo"><label for="aj-ant">Anticipo sugerido %</label><input type="number" id="aj-ant" name="anticipoSugerido" min="0" max="100" value="${aj.anticipoSugerido}"></div>
          <div class="campo"><label for="aj-iva">IVA %</label><input type="number" id="aj-iva" name="iva" min="0" value="${aj.iva}"></div>
        </div>
        <p class="chico tenue">Los días de entrega de cada producto se cambian en Precios (toca el producto).</p>
        <button class="btn primario">Guardar</button>
      </form>

      <form class="tarjeta" id="aj-play"><h2>Playeras personalizadas</h2>
        <p class="chico tenue" style="margin-top:-6px">Precio por pieza = playera + cargo de técnica + planchados (uno por cada lugar estampado). El nivel lo decide el total de playeras del pedido.</p>
        <label class="check" style="margin-bottom:12px"><input type="checkbox" name="playeraPrecioMayoreo" ${aj.playeraPrecioMayoreo ? 'checked' : ''}> En mayoreo, la playera se cobra a su precio de mayoreo del catálogo</label>
        <div class="fila">
          <div class="campo"><label for="aj-um">Mayoreo desde (piezas)</label><input type="number" id="aj-um" name="umbralMayoreo" min="2" value="${aj.umbralMayoreo}"></div>
          <div class="campo"><label for="aj-dp">Días de entrega</label><input type="number" id="aj-dp" name="diasPlayeras" min="0" value="${aj.diasPlayeras}"></div>
        </div>
        <div class="tabla-envoltura"><table><thead><tr><th>Cargo por pieza</th><th>Menudeo</th><th>Mayoreo</th></tr></thead><tbody>
          <tr><td>Técnica DTF</td><td><input type="number" name="DTF.menudeo" value="${aj.tecnicas.DTF.menudeo}" step="0.5"></td><td><input type="number" name="DTF.mayoreo" value="${aj.tecnicas.DTF.mayoreo}" step="0.5"></td></tr>
          <tr><td>Técnica Vinil</td><td><input type="number" name="Vinil.menudeo" value="${aj.tecnicas.Vinil.menudeo}" step="0.5"></td><td><input type="number" name="Vinil.mayoreo" value="${aj.tecnicas.Vinil.mayoreo}" step="0.5"></td></tr>
          <tr><td>Técnica Sublimación</td><td><input type="number" name="Sublimación.menudeo" value="${aj.tecnicas['Sublimación'].menudeo}" step="0.5"></td><td><input type="number" name="Sublimación.mayoreo" value="${aj.tecnicas['Sublimación'].mayoreo}" step="0.5"></td></tr>
          <tr><td>Cada planchado</td><td><input type="number" name="planchado.menudeo" value="${aj.planchado.menudeo}" step="0.5"></td><td><input type="number" name="planchado.mayoreo" value="${aj.planchado.mayoreo}" step="0.5"></td></tr>
        </tbody></table></div>
        <button class="btn primario" style="margin-top:12px">Guardar</button>
      </form>

      <form class="tarjeta" id="aj-costos"><h2>Costos (para calcular ganancias)</h2>
        <p class="chico tenue" style="margin-top:-6px">Con esto cada pedido calcula solo su costo y su ganancia. El costo de cada producto se pone en Precios. Si un pedido no tiene costo completo, puedes escribir el costo real en el pedido.</p>
        <div class="etiqueta" style="margin-bottom:6px">Lo que te cuesta cada estampado de playera (por lado, incluye hoja/película)</div>
        <div class="fila">
          ${['DTF', 'Vinil', 'Sublimación'].map(t => `<div class="campo"><label for="aj-ct-${t}">${t}</label><input type="number" id="aj-ct-${t}" name="${t}" step="0.5" min="0" value="${aj.costoTecnica[t] ?? ''}" placeholder="No sé"></div>`).join('')}
        </div>
        <label class="check" style="margin-bottom:12px"><input type="checkbox" name="costoPlayeraDesdeMayoreo" ${aj.costoPlayeraDesdeMayoreo ? 'checked' : ''}> Si una playera no tiene costo propio, usar su precio de mayoreo del catálogo como costo</label>
        <button class="btn primario">Guardar</button>
      </form>`;
  }

  A.vistas.ajustes = {
    titulo: 'Ajustes',
    refrescar: false,
    render(c) {
      const aj = A.db.ajustes();
      const dueno = A.esDueno();
      const enEquipo = A.sync.configurada() && A.sync.conSesion();
      c.innerHTML = `
        <div class="cabeza"><h1>${dueno ? 'Ajustes' : 'Mi cuenta'}</h1></div>
        <div class="rejilla dos">
          ${dueno ? `<div>${tarjetasDueno(aj)}</div>` : ''}
          <div>
            <div class="tarjeta" id="aj-sync"><h2>${enEquipo ? 'Mi cuenta' : 'Conectar al equipo'}</h2><div id="aj-sync-cuerpo"></div></div>
            ${dueno && enEquipo ? '<div class="tarjeta" id="aj-equipo"><h2>Equipo</h2><div id="aj-equipo-cuerpo"><div class="chico tenue">Cargando…</div></div></div>' : ''}
            ${dueno ? `<div class="tarjeta"><h2>Respaldo</h2>
              <p class="chico tenue" style="margin-top:-6px">Descarga una copia de todo (pedidos, clientes, precios). Guárdala en tu Drive de vez en cuando.</p>
              <div class="fila" style="gap:8px"><button class="btn" id="aj-exp">Descargar respaldo</button>
                <label class="btn">Cargar respaldo<input type="file" id="aj-imp" accept=".json,application/json" hidden></label></div>
            </div>` : ''}
          </div>
        </div>`;

      if (dueno) conectarFormulariosDueno(c, aj);
      pintarCuenta(c.querySelector('#aj-sync-cuerpo'));
      const equipo = c.querySelector('#aj-equipo-cuerpo');
      if (equipo) pintarEquipo(equipo);
    },
  };

  function conectarFormulariosDueno(c, aj) {
    c.querySelector('#aj-neg').addEventListener('submit', e => {
      e.preventDefault();
      A.db.guardarAjustes({ negocio: { ...aj.negocio, ...u.datosForm(e.target) } });
      A.aviso('Datos del negocio guardados');
    });
    c.querySelector('#aj-reglas').addEventListener('submit', e => {
      e.preventDefault();
      const d = u.datosForm(e.target);
      A.db.guardarAjustes({ conSabado: d.conSabado, vigenciaCotizacion: Number(d.vigenciaCotizacion) || 7, anticipoSugerido: Number(d.anticipoSugerido) || 0, iva: Number(d.iva) || 0 });
      A.aviso('Reglas guardadas');
    });
    c.querySelector('#aj-play').addEventListener('submit', e => {
      e.preventDefault();
      const d = u.datosForm(e.target);
      const n = k => Number(d[k]) || 0;
      A.db.guardarAjustes({
        umbralMayoreo: n('umbralMayoreo') || 12, diasPlayeras: n('diasPlayeras'),
        tecnicas: {
          DTF: { menudeo: n('DTF.menudeo'), mayoreo: n('DTF.mayoreo') },
          Vinil: { menudeo: n('Vinil.menudeo'), mayoreo: n('Vinil.mayoreo') },
          Sublimación: { menudeo: n('Sublimación.menudeo'), mayoreo: n('Sublimación.mayoreo') },
        },
        planchado: { menudeo: n('planchado.menudeo'), mayoreo: n('planchado.mayoreo') },
        playeraPrecioMayoreo: d.playeraPrecioMayoreo,
      });
      A.aviso('Precios de playeras guardados');
      A.recargarVista();
    });
    c.querySelector('#aj-costos').addEventListener('submit', e => {
      e.preventDefault();
      const d = u.datosForm(e.target);
      const v = k => d[k] === '' ? null : Number(d[k]);
      A.db.guardarAjustes({ costoTecnica: { DTF: v('DTF'), Vinil: v('Vinil'), Sublimación: v('Sublimación') }, costoPlayeraDesdeMayoreo: d.costoPlayeraDesdeMayoreo });
      A.aviso('Costos guardados');
    });
    c.querySelector('#aj-exp').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(A.db.exportar(), null, 1)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `respaldo-nova-pedidos-${u.hoy()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    c.querySelector('#aj-imp').addEventListener('change', async e => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        A.db.importar(JSON.parse(await f.text()));
        A.aviso('Respaldo cargado');
      } catch (err) { A.aviso('No se pudo cargar: ' + err.message); }
      e.target.value = '';
    });
  }

  // ---- Cuenta: entrar, ver estado, cerrar sesión ----
  A.cuenta = { pintar: c => pintarCuenta(c) };
  function pintarCuenta(cuerpo) {
    const est = A.sync.estado();
    const cfg = A.sync.config() || {};
    if (A.sync.configurada() && A.sync.conSesion()) {
      const p = A.sync.perfil() || {};
      cuerpo.innerHTML = `
        ${p.sinTabla ? '<div class="nota-alerta">Tu base de datos tiene la versión anterior. Vuelve a correr <strong>supabase.sql</strong> en Supabase para activar el equipo y los permisos.</div>' : ''}
        <div class="dato"><span>Nombre</span><strong>${esc(A.sync.nombreUsuario())}</strong></div>
        <div class="dato"><span>Rol</span><span>${p.rol === 'dueno' ? 'Dueño · ve todo' : 'Colaborador · pedidos, cotizaciones y clientes'}</span></div>
        <div class="dato"><span>Correo</span><span>${esc(A.sync.correo() || '')}</span></div>
        <div class="dato"><span>Estado</span><span>${esc(est.mensaje)}</span></div>
        <div class="dato"><span>Última vez</span><span>${esc(u.fechaHora(est.ultima))}</span></div>
        <div class="fila" style="gap:8px;margin-top:12px"><button class="btn primario" id="sy-ahora">Sincronizar ahora</button><button class="btn" id="sy-salir">Cerrar sesión</button></div>`;
      cuerpo.querySelector('#sy-ahora').addEventListener('click', async () => { await A.sync.sincronizar(); pintarCuenta(cuerpo); A.aviso(A.sync.estado().mensaje); });
      cuerpo.querySelector('#sy-salir').addEventListener('click', async () => {
        const r = await A.modal.elegir('Cerrar sesión', 'Si este celular o compu no es tuyo, o ya no vas a usarlo, borra también los datos guardados en él.',
          [['salir', 'Cerrar sesión'], ['borrar', 'Cerrar sesión y borrar datos de este dispositivo'], ['no', 'Cancelar']]);
        if (r === 'no') return;
        A.sync.cerrarSesion({ borrarDatos: r === 'borrar' });
        A.recargarVista();
      });
      return;
    }
    // Si la conexión ya viene del enlace de invitación o de config.js, solo se piden correo y contraseña.
    const yaConectada = A.sync.configurada();
    cuerpo.innerHTML = `
      <p class="chico tenue" style="margin-top:-6px">${yaConectada
        ? 'La app ya está conectada a la base del negocio. Entra con el correo y la contraseña que te dio el dueño.'
        : A.requiereSesion()
          ? 'Abre el enlace de invitación que te mandó el dueño, o captura aquí los datos de la base del negocio.'
          : 'Mientras no entres, todo se guarda solo en este dispositivo. Para trabajar en equipo, conecta la base de Supabase del negocio (los pasos están en LEEME.md) o abre el enlace de invitación que te mandaron.'}</p>
      <form id="sy-form">
        <div id="sy-base" ${yaConectada ? 'hidden' : ''}>
          <div class="campo"><label for="sy-url">URL del proyecto</label><input type="url" id="sy-url" name="url" value="${esc(cfg.url || '')}" placeholder="https://xxxx.supabase.co" ${yaConectada ? '' : 'required'}></div>
          <div class="campo"><label for="sy-key">Clave pública (anon / publishable)</label><input type="text" id="sy-key" name="clave" value="${esc(cfg.clave || '')}" autocomplete="off" ${yaConectada ? '' : 'required'}></div>
        </div>
        <div class="fila">
          <div class="campo"><label for="sy-mail">Correo</label><input type="email" id="sy-mail" name="email" required autocomplete="username"></div>
          <div class="campo"><label for="sy-pass">Contraseña</label><input type="password" id="sy-pass" name="password" required autocomplete="current-password"></div>
        </div>
        ${est.modo === 'error' ? `<div class="nota-alerta">${esc(est.mensaje)}</div>` : ''}
        <div class="fila" style="gap:8px;align-items:center">
          <button class="btn primario" id="sy-entrar">Entrar</button>
          ${yaConectada && !cfg.fija ? '<button type="button" class="btn-icono chico" id="sy-cambiar">Cambiar base de datos</button>' : ''}
        </div>
      </form>`;
    const cambiar = cuerpo.querySelector('#sy-cambiar');
    if (cambiar) cambiar.addEventListener('click', () => {
      cuerpo.querySelector('#sy-base').hidden = false;
      cuerpo.querySelectorAll('#sy-base input').forEach(i => { i.required = true; });
      cambiar.remove();
    });
    cuerpo.querySelector('#sy-form').addEventListener('submit', async e => {
      e.preventDefault();
      const d = u.datosForm(e.target);
      const b = cuerpo.querySelector('#sy-entrar');
      b.disabled = true; b.textContent = 'Entrando…';
      try {
        if (!cuerpo.querySelector('#sy-base').hidden) A.sync.guardarConfig(d.url, d.clave);
        if (!A.sync.configurada()) throw new Error('Falta conectar la base de datos del negocio');
        await A.sync.iniciarSesion(d.email, d.password);
        A.aviso(`Hola, ${A.sync.nombreUsuario()}. ${A.sync.estado().mensaje}`);
        A.recargarVista();
      } catch (err) {
        A.aviso('No se pudo entrar: ' + (/invalid login/i.test(err.message) ? 'correo o contraseña incorrectos' : err.message));
        b.disabled = false; b.textContent = 'Entrar';
      }
    });
  }

  // ---- Equipo: nombres y roles; invitar colaboradores ----
  async function pintarEquipo(cuerpo) {
    let lista;
    try { lista = await A.sync.equipo(); } catch (e) {
      cuerpo.innerHTML = `<div class="nota-alerta">No se pudo cargar el equipo: ${esc(e.message)}. Revisa que hayas corrido la versión nueva de supabase.sql.</div>`;
      return;
    }
    const yo = (A.sync.perfil() || {}).id;
    const enlace = A.sync.enlaceInvitacion();
    const textoInvitacion = `Te invito a la app de pedidos de ${A.db.ajustes().negocio.nombre}. Ábrela aquí y entra con el correo y la contraseña que te di: ${enlace}`;
    cuerpo.innerHTML = `
      <div class="lista">${lista.map(p => `
        <form class="miembro" data-id="${p.id}">
          <div class="fila" style="align-items:flex-end;gap:8px">
            <div class="campo" style="flex:2 1 160px;margin:0"><label>Nombre${p.id === yo ? ' (tú)' : ''}</label><input type="text" name="nombre" value="${esc(p.nombre || '')}" required></div>
            <div class="campo" style="flex:1 1 130px;margin:0"><label>Rol</label><select name="rol">
              <option value="pendiente" ${p.rol === 'pendiente' ? 'selected' : ''}>Sin acceso</option>
              <option value="colaborador" ${p.rol === 'colaborador' ? 'selected' : ''}>Colaborador</option>
              <option value="dueno" ${p.rol === 'dueno' ? 'selected' : ''}>Dueño</option></select></div>
            <button class="btn">Guardar</button>
          </div>
          <div class="chico tenue" style="margin-top:4px">${esc(p.email || '')}${p.rol === 'pendiente' ? ' · <strong style="color:var(--ambar)">Esperando tu aprobación</strong>' : ''}</div>
        </form>`).join('')}</div>
      <div class="separador"></div>
      <h3 style="margin-bottom:6px">Agregar a alguien</h3>
      <ol class="pasos-lista chico">
        <li>En <strong>supabase.com</strong>, abre tu proyecto → <strong>Authentication → Users → Add user → Create new user</strong>. Escribe su correo y una contraseña y marca <em>Auto Confirm User</em>.</li>
        <li>Mándale este enlace junto con su contraseña. Al abrirlo, la app queda conectada y solo tiene que entrar.</li>
        <li>Cuando entre por primera vez aparecerá aquí como <strong>Sin acceso</strong>: no ve nada hasta que le pongas el rol <strong>Colaborador</strong> y su nombre (el nombre sale en el historial de los pedidos).</li>
      </ol>
      <div class="fila" style="gap:8px;margin-top:8px">
        <input type="text" readonly value="${esc(enlace)}" id="eq-enlace" style="flex:1 1 220px">
        <button type="button" class="btn" id="eq-copiar">Copiar enlace</button>
        <a class="btn verde" target="_blank" rel="noopener" href="${esc(u.linkWhatsApp('', textoInvitacion))}">Enviar por WhatsApp</a>
      </div>
      <p class="chico tenue" style="margin-top:10px">Los colaboradores ven pedidos, cotizaciones, clientes, precios y la calculadora. No ven costos, ganancias, Desempeño, gastos ni Ajustes, y no pueden borrar ni cambiar precios. Para quitarle el acceso a alguien, ponle <strong>Sin acceso</strong> aquí o bórralo en Supabase → Authentication → Users.</p>`;
    cuerpo.querySelectorAll('.miembro').forEach(f => f.addEventListener('submit', async e => {
      e.preventDefault();
      const d = u.datosForm(f);
      const duenos = lista.filter(p => p.rol === 'dueno' && p.id !== f.dataset.id).length;
      if (d.rol !== 'dueno' && duenos === 0) { f.rol.value = 'dueno'; return A.aviso('Debe quedar al menos un dueño.'); }
      try {
        await A.sync.actualizarPerfil(f.dataset.id, { nombre: d.nombre, rol: d.rol });
        A.aviso('Guardado');
        pintarEquipo(cuerpo);
      } catch (err) { A.aviso('No se pudo guardar: ' + err.message); }
    }));
    cuerpo.querySelector('#eq-copiar').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(enlace); A.aviso('Enlace copiado'); }
      catch { cuerpo.querySelector('#eq-enlace').select(); A.aviso('Selecciónalo y cópialo'); }
    });
  }
})(window.App);

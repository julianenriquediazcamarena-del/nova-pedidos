// Datos para facturar un pedido. Por ahora la factura la hace el contador: la app junta los datos fiscales
// (capturados o en foto) y arma una hoja para mandársela. Los datos quedan guardados en el cliente para la próxima.
(function (A) {
  const u = A.u;
  const esc = u.esc;

  // Catálogos del SAT (CFDI 4.0) más usados.
  const REGIMENES = [
    ['601', 'General de Ley Personas Morales'], ['603', 'Personas Morales con Fines no Lucrativos'],
    ['605', 'Sueldos y Salarios'], ['606', 'Arrendamiento'], ['608', 'Demás ingresos'],
    ['612', 'Personas Físicas con Actividades Empresariales y Profesionales'], ['616', 'Sin obligaciones fiscales'],
    ['621', 'Incorporación Fiscal'], ['625', 'Actividades Empresariales por Plataformas Tecnológicas'],
    ['626', 'Régimen Simplificado de Confianza (RESICO)'],
  ];
  const USOS = [
    ['G01', 'Adquisición de mercancías'], ['G03', 'Gastos en general'], ['I02', 'Mobiliario y equipo de oficina'],
    ['I04', 'Equipo de cómputo y accesorios'], ['I08', 'Otra maquinaria y equipo'], ['S01', 'Sin efectos fiscales'],
  ];
  const FORMAS = [['01', 'Efectivo'], ['03', 'Transferencia'], ['04', 'Tarjeta de crédito'], ['28', 'Tarjeta de débito'], ['02', 'Cheque'], ['99', 'Por definir']];
  const METODOS = [['PUE', 'Pago en una sola exhibición'], ['PPD', 'Pago en parcialidades o diferido']];
  const ESTADOS = [['pendiente', 'Pendiente'], ['enviada', 'Enviada al contador'], ['emitida', 'Factura emitida']];
  const nombre = (lista, clave) => (lista.find(x => x[0] === clave) || [clave, ''])[1];
  const opciones = (lista, valor) => lista.map(([k, t]) => `<option value="${k}" ${k === valor ? 'selected' : ''}>${k} · ${esc(t)}</option>`).join('');

  // Forma de pago sugerida según los pagos registrados.
  function formaSugerida(doc) {
    const m = ((doc.pagos || [])[0] || {}).metodo;
    return { Efectivo: '01', Transferencia: '03', Tarjeta: '04', Depósito: '03' }[m] || '99';
  }

  A.factura = {
    REGIMENES, USOS, FORMAS, METODOS,
    nombreRegimen: k => nombre(REGIMENES, k), nombreUso: k => nombre(USOS, k), nombreForma: k => nombre(FORMAS, k), nombreMetodo: k => nombre(METODOS, k),
    pendiente: p => !!p.requiereFactura && (p.factura || {}).estado !== 'emitida' && p.estado !== 'cancelado',

    // Tarjeta "Factura" dentro del pedido.
    montar(cont, doc, alCambiar) {
      function datosIniciales() {
        const cliente = doc.contactoId ? A.db.obtener('contactos', doc.contactoId) : null;
        const prev = (cliente && cliente.fiscal) || {};
        return { rfc: prev.rfc || (cliente && cliente.rfc) || '', razonSocial: prev.razonSocial || '', regimen: prev.regimen || '', cp: prev.cp || '',
          uso: prev.uso || 'G03', correo: prev.correo || (cliente && cliente.correo) || '', formaPago: formaSugerida(doc),
          metodoPago: A.pedidos.saldo(doc) > 0 ? 'PPD' : 'PUE', notas: '', estado: 'pendiente', folioFiscal: '' };
      }
      function guardarEnCliente() {
        if (!doc.contactoId || !doc.factura) return;
        const c = A.db.obtener('contactos', doc.contactoId);
        if (!c) return;
        const { rfc, razonSocial, regimen, cp, uso, correo } = doc.factura;
        const fiscal = { rfc, razonSocial, regimen, cp, uso, correo };
        if (JSON.stringify(c.fiscal || {}) !== JSON.stringify(fiscal)) A.db.guardar('contactos', { ...c, fiscal, rfc: rfc || c.rfc });
      }
      function pintar() {
        const f = doc.factura;
        cont.innerHTML = `
          <label class="check"><input type="checkbox" data-requiere ${doc.requiereFactura ? 'checked' : ''}> El cliente requiere factura</label>
          ${doc.requiereFactura ? `
          <div class="nota-info" style="margin-top:10px">Captura los datos o, si el cliente los trae en foto o mensaje, súbela abajo. Se guardan en el cliente para la próxima.</div>
          <form data-fiscal autocomplete="off">
            <div class="fila">
              <div class="campo"><label for="fa-rfc">RFC</label><input type="text" id="fa-rfc" name="rfc" maxlength="13" value="${esc(f.rfc)}" placeholder="XAXX010101000" style="text-transform:uppercase"></div>
              <div class="campo"><label for="fa-cp">C.P. fiscal</label><input type="text" id="fa-cp" name="cp" maxlength="5" inputmode="numeric" value="${esc(f.cp)}"></div>
            </div>
            <div class="campo"><label for="fa-rs">Nombre o razón social (como en la constancia, sin "S.A. de C.V.")</label><input type="text" id="fa-rs" name="razonSocial" value="${esc(f.razonSocial)}"></div>
            <div class="campo"><label for="fa-reg">Régimen fiscal</label><select id="fa-reg" name="regimen"><option value="">—</option>${opciones(REGIMENES, f.regimen)}</select></div>
            <div class="fila">
              <div class="campo"><label for="fa-uso">Uso del CFDI</label><select id="fa-uso" name="uso">${opciones(USOS, f.uso)}</select></div>
              <div class="campo"><label for="fa-correo">Correo para enviarla</label><input type="email" id="fa-correo" name="correo" value="${esc(f.correo)}"></div>
            </div>
            <div class="fila">
              <div class="campo"><label for="fa-forma">Forma de pago</label><select id="fa-forma" name="formaPago">${opciones(FORMAS, f.formaPago)}</select></div>
              <div class="campo"><label for="fa-met">Método de pago</label><select id="fa-met" name="metodoPago">${opciones(METODOS, f.metodoPago)}</select></div>
            </div>
            <div class="campo"><label for="fa-notas">Notas para el contador</label><input type="text" id="fa-notas" name="notas" value="${esc(f.notas)}" placeholder="Opcional"></div>
            <div class="fila">
              <div class="campo"><label for="fa-est">Estado</label><select id="fa-est" name="estado">${ESTADOS.map(([k, t]) => `<option value="${k}" ${k === f.estado ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
              <div class="campo"><label for="fa-uuid">Folio fiscal (cuando se emita)</label><input type="text" id="fa-uuid" name="folioFiscal" value="${esc(f.folioFiscal)}" placeholder="Opcional"></div>
            </div>
          </form>
          <div class="etiqueta" style="margin:4px 0">Constancia o datos del cliente en foto</div>
          <div data-fotos-fiscales></div>
          <div class="fila" style="gap:8px;margin-top:12px">
            <button type="button" class="btn" data-hoja>Hoja para el contador</button>
          </div>` : ''}`;
        const fotos = cont.querySelector('[data-fotos-fiscales]');
        if (fotos) A.adjuntos.montar(fotos, doc, { tipo: 'fiscal', titulo: 'Foto de constancia o datos', alCambiar });
      }
      cont.addEventListener('change', e => {
        if ('requiere' in e.target.dataset) {
          doc.requiereFactura = e.target.checked;
          if (doc.requiereFactura && !doc.factura) doc.factura = datosIniciales();
          alCambiar(doc); pintar();
        }
      });
      cont.addEventListener('input', e => {
        const form = e.target.closest('[data-fiscal]');
        if (!form) return;
        const d = u.datosForm(form);
        doc.factura = { ...doc.factura, ...d, rfc: (d.rfc || '').toUpperCase().trim(), cp: u.soloDigitos(d.cp) };
        const rfcOk = !doc.factura.rfc || /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(doc.factura.rfc);
        form.querySelector('[name=rfc]').classList.toggle('invalido', !rfcOk);
        alCambiar(doc);
        clearTimeout(cont._t);
        cont._t = setTimeout(guardarEnCliente, 800);
      });
      cont.addEventListener('click', e => {
        if (!e.target.closest('[data-hoja]')) return;
        const f = doc.factura || {};
        const faltan = [['rfc', 'RFC'], ['razonSocial', 'razón social'], ['regimen', 'régimen'], ['cp', 'código postal']].filter(([k]) => !f[k]).map(x => x[1]);
        const fotos = (doc.adjuntos || []).filter(a => a.tipo === 'fiscal').length;
        if (faltan.length && !fotos) return A.aviso(`Falta: ${faltan.join(', ')} (o sube la foto de la constancia).`);
        A.notaImagen.mostrar('factura', doc);
      });
      pintar();
      // Si los datos se capturaron antes de crear el pedido (aún sin cliente), se guardan en el cliente al abrirlo.
      if (doc.requiereFactura) guardarEnCliente();
    },
  };
})(window.App);

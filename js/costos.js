// Costos del negocio. Viven aparte, en la colección "costos", que solo el dueño puede leer
// (la base de datos no se la entrega a colaboradores ni a vendedores).
(function (A) {
  const u = A.u;
  const BASE_GENERAL = {
    id: 'general',
    tecnicas: { DTF: null, Vinil: null, Sublimación: 10 }, // costo por cada lado estampado (incluye hoja o película)
    playeraDesdeMayoreo: true, // si una playera no tiene costo propio, se toma su precio de mayoreo del catálogo
  };

  A.costos = {
    general() {
      const g = A.db.obtener('costos', 'general') || {};
      return { ...BASE_GENERAL, ...g, tecnicas: { ...BASE_GENERAL.tecnicas, ...(g.tecnicas || {}) } };
    },
    guardarGeneral(cambios) { return A.db.guardar('costos', { ...A.costos.general(), ...cambios, id: 'general' }); },

    // Costo de un registro (producto, playera o pedido) por su id; null si no se sabe.
    de(id) {
      const r = A.db.obtener('costos', 'c-' + id);
      return r && r.valor != null && r.valor !== '' ? Number(r.valor) : null;
    },
    estimado(id) { const r = A.db.obtener('costos', 'c-' + id); return !!(r && r.estimado); },
    poner(id, valor, extra = {}) {
      const clave = 'c-' + id;
      if (valor == null || valor === '' || !Number.isFinite(Number(valor))) {
        if (A.db.obtener('costos', clave)) A.db.borrar('costos', clave);
        return;
      }
      A.db.guardar('costos', { id: clave, ref: id, valor: u.redondear(valor), estimado: false, ...extra });
    },

    // Versiones anteriores guardaban el costo dentro del producto, la playera, los ajustes o el pedido.
    // El dueño los pasa aquí y los quita de esos registros (que sí ven colaboradores y vendedores).
    migrar() {
      if (!A.esDueno || !A.esDueno()) return;
      ['productos', 'playeras'].forEach(col => A.db.todos(col).forEach(r => {
        if (!('costo' in r)) return;
        if (r.costo != null && r.costo !== '' && r.categoria !== 'Diseño' && A.costos.de(r.id) == null) A.costos.poner(r.id, r.costo);
        const { costo, ...limpio } = r;
        A.db.reemplazar(col, limpio);
      }));
      A.db.todos('pedidos').forEach(p => {
        if (!('costo' in p)) return;
        if (p.costo != null && p.costo !== '' && A.costos.de('ped-' + p.id) == null) A.costos.poner('ped-' + p.id, p.costo);
        const { costo, ...limpio } = p;
        A.db.reemplazar('pedidos', limpio);
      });
      const aj = A.db.obtener('ajustes', 'general');
      if (aj && ('costoTecnica' in aj || 'costoPlayeraDesdeMayoreo' in aj)) {
        if (!A.db.obtener('costos', 'general')) {
          A.costos.guardarGeneral({ tecnicas: { ...BASE_GENERAL.tecnicas, ...(aj.costoTecnica || {}) }, playeraDesdeMayoreo: aj.costoPlayeraDesdeMayoreo !== false });
        }
        const { costoTecnica, costoPlayeraDesdeMayoreo, ...limpio } = aj;
        A.db.reemplazar('ajustes', limpio);
      }
    },
  };
})(window.App);

// Eventos de precios (Cyber Day, Black Friday, Día del Padre…).
// Cada evento tiene nombre, fechas, modo (automático: empieza y termina solo; manual: lo prenden y apagan ellos)
// y reglas de precio, todas opcionales:
//   - ganancia por tramos: según cuánto le ganan hoy a un perfume, cuánto le ganan en el evento (necesita costo cargado);
//   - descuento %: a los que no tienen costo, o a todos;
//   - piso: nunca ganarle menos de X dólares (si tiene costo);
//   - a mano: ganancia o precio de un perfume en particular, o sacarlo del evento.
// Al activarlo, el precio del evento pasa a ser el precio y el de antes queda tachado; se guarda una foto de los
// precios originales para devolverlos solos al terminar.
import { leerAjustes, sentenciaVersion } from './util.js';

export const CONFIG_INICIAL = {
  tramos: { activo: true, lista: [{ hasta: 40, ganancia: 25 }, { hasta: 70, ganancia: 40 }, { hasta: null, ganancia: 50 }] },
  porcentaje: { activo: false, valor: 15, aQuien: 'sinCosto' },
  piso: { activo: true, valor: 25 },
  alcance: { marcas: [], tipos: [] },
  manuales: {},
  redondeo: true,
  mostrarPorcentaje: true, // en la tienda: cartel con el % de descuento, o solo el precio de antes tachado
};

// "2026-11-03T14:30" en hora de Argentina (así se guardan las fechas de los eventos).
export function ahoraArgentina() {
  return new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 16);
}

const numero = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const positivo = (v) => { const n = numero(v); return n === null ? null : Math.max(0, n); };
const fecha = (v) => (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v || '') ? v : '');

export function limpiarConfig(c = {}) {
  const base = CONFIG_INICIAL;
  const lista = Array.isArray(c.tramos?.lista) ? c.tramos.lista : base.tramos.lista;
  const manuales = {};
  for (const [clave, m] of Object.entries(c.manuales || {}).slice(0, 3000)) {
    if (!/^[a-z0-9-]+\|\d+$/.test(clave) || !m) continue;
    if (m.excluir) manuales[clave] = { excluir: true };
    else if (positivo(m.ganancia) !== null) manuales[clave] = { ganancia: positivo(m.ganancia) };
    else if (positivo(m.precio) !== null) manuales[clave] = { precio: positivo(m.precio) };
  }
  return {
    tramos: {
      activo: c.tramos ? !!c.tramos.activo : base.tramos.activo,
      lista: lista.slice(0, 8).map((t) => ({ hasta: positivo(t.hasta), ganancia: positivo(t.ganancia) ?? 0 }))
        .sort((a, b) => (a.hasta ?? Infinity) - (b.hasta ?? Infinity)),
    },
    porcentaje: {
      activo: !!c.porcentaje?.activo,
      valor: Math.min(90, positivo(c.porcentaje?.valor) ?? base.porcentaje.valor),
      aQuien: c.porcentaje?.aQuien === 'todos' ? 'todos' : 'sinCosto',
    },
    piso: { activo: c.piso ? !!c.piso.activo : base.piso.activo, valor: positivo(c.piso?.valor) ?? base.piso.valor },
    alcance: {
      marcas: Array.isArray(c.alcance?.marcas) ? c.alcance.marcas.map(String).slice(0, 200) : [],
      tipos: Array.isArray(c.alcance?.tipos) ? c.alcance.tipos.map(String).slice(0, 10) : [],
    },
    manuales,
    redondeo: c.redondeo !== false,
    mostrarPorcentaje: c.mostrarPorcentaje !== false,
  };
}

export function limpiarEvento(d) {
  return {
    nombre: String(d.nombre ?? '').trim().slice(0, 60),
    desde: fecha(d.desde),
    hasta: fecha(d.hasta),
    modo: d.modo === 'auto' ? 'auto' : 'manual',
    config: limpiarConfig(d.config),
  };
}

// Precio que en pesos termina en 900 (redondeando para arriba, así nunca se gana menos de lo pensado).
function redondear900(usd, cot) {
  if (!(cot > 0)) return Math.ceil(usd);
  const pesos = Math.ceil((usd * cot - 900) / 1000) * 1000 + 900;
  return Math.round((pesos / cot) * 10000) / 10000;
}

/**
 * Precio del evento para cada tamaño de cada perfume (los perfumes traen presentaciones con costo).
 * Devuelve una fila por tamaño: precio de hoy, costo, ganancia de hoy, precio y ganancia del evento, y qué regla se usó.
 */
export function calcularPrecios(perfumes, config, cot) {
  const { tramos, porcentaje, piso, alcance, manuales } = config;
  const filas = [];
  for (const p of perfumes) {
    if (alcance.tipos.length && !alcance.tipos.includes(p.tipo)) continue;
    if (alcance.marcas.length && !alcance.marcas.includes(p.marca)) continue;
    for (const x of p.presentaciones) {
      const clave = `${p.id}|${x.ml}`;
      const manual = manuales[clave] || {};
      const costo = x.costo > 0 ? x.costo : null;
      const ganancia = costo !== null ? Math.round((x.precio - costo) * 100) / 100 : null;
      let nuevo = null;
      let regla = 'sin cambio';
      if (manual.excluir) {
        regla = 'excluido';
      } else if (manual.ganancia !== undefined && costo !== null) {
        nuevo = costo + manual.ganancia;
        regla = 'a mano';
      } else if (manual.precio !== undefined) {
        nuevo = manual.precio;
        regla = 'a mano';
      } else if (tramos.activo && costo !== null) {
        const t = tramos.lista.find((y) => y.hasta === null || ganancia <= y.hasta);
        if (t) {
          nuevo = costo + Math.min(t.ganancia, ganancia);
          regla = 'tramos';
        }
      } else if (porcentaje.activo && (porcentaje.aQuien === 'todos' || costo === null)) {
        nuevo = x.precio * (1 - porcentaje.valor / 100);
        regla = `${porcentaje.valor}%`;
      }
      if (nuevo !== null) {
        // El piso solo se puede controlar si el perfume tiene costo (y nunca sube un precio "a mano").
        if (piso.activo && costo !== null && regla !== 'a mano') nuevo = Math.max(nuevo, costo + piso.valor);
        nuevo = config.redondeo ? redondear900(nuevo, cot) : Math.round(nuevo * 100) / 100;
        if (nuevo >= x.precio - 0.005) {
          nuevo = null;
          if (regla !== 'a mano') regla = 'sin cambio';
        }
      }
      filas.push({
        clave, id: p.id, marca: p.marca, nombre: p.nombre, ml: x.ml,
        precio: x.precio, costo, ganancia, nuevo,
        gananciaNueva: nuevo !== null && costo !== null ? Math.round((nuevo - costo) * 100) / 100 : null,
        regla,
      });
    }
  }
  return filas;
}

async function perfumesConCosto(env, ids = null) {
  const sql = ids
    ? 'SELECT id, marca, tipo, nombre, presentaciones FROM perfumes WHERE id IN (SELECT value FROM json_each(?))'
    : 'SELECT id, marca, tipo, nombre, presentaciones FROM perfumes WHERE visible = 1';
  const consulta = env.DB.prepare(sql);
  const { results } = await (ids ? consulta.bind(JSON.stringify(ids)) : consulta).all();
  return results.map((r) => ({ ...r, presentaciones: JSON.parse(r.presentaciones || '[]') }));
}

export async function vistaPrevia(env, config) {
  const { cotizacion } = await leerAjustes(env);
  return calcularPrecios(await perfumesConCosto(env), config, cotizacion);
}

async function guardarPerfumes(env, perfumes) {
  const sentencias = perfumes.map((p) => env.DB.prepare("UPDATE perfumes SET presentaciones = ?, actualizado = datetime('now') WHERE id = ?").bind(JSON.stringify(p.presentaciones), p.id));
  for (let i = 0; i < sentencias.length; i += 100) await env.DB.batch(sentencias.slice(i, i + 100));
}

// Pone los precios del evento y guarda los de antes para devolverlos al terminar.
export async function activar(env, evento) {
  const otro = await env.DB.prepare("SELECT nombre FROM eventos WHERE estado IN ('activo', 'aplicando') AND id != ?").bind(evento.id).first();
  if (otro) throw new Error(`Ya está activo "${otro.nombre}". Terminalo antes de activar otro.`);
  const config = limpiarConfig(JSON.parse(evento.config || '{}'));
  const { cotizacion } = await leerAjustes(env);
  const perfumes = await perfumesConCosto(env);
  const nuevos = new Map(calcularPrecios(perfumes, config, cotizacion).filter((f) => f.nuevo !== null).map((f) => [f.clave, f.nuevo]));
  const foto = [];
  const cambiados = [];
  for (const p of perfumes) {
    let cambio = false;
    p.presentaciones = p.presentaciones.map((x) => {
      const nuevo = nuevos.get(`${p.id}|${x.ml}`);
      if (nuevo === undefined) return x;
      cambio = true;
      foto.push({ id: p.id, ml: x.ml, precio: x.precio, precioAnterior: x.precioAnterior ?? null, evento: nuevo });
      return { ...x, precio: nuevo, precioAnterior: Math.max(x.precioAnterior || 0, x.precio) };
    });
    if (cambio) cambiados.push(p);
  }
  await guardarPerfumes(env, cambiados);
  await env.DB.batch([
    env.DB.prepare("UPDATE eventos SET estado = 'activo', aplicado = ?, activado = datetime('now') WHERE id = ?").bind(JSON.stringify(foto), evento.id),
    sentenciaVersion(env),
  ]);
  return foto.length;
}

// Devuelve los precios de antes. Si alguien cambió a mano el precio de un perfume durante el evento, ese se respeta.
export async function terminar(env, evento) {
  const foto = JSON.parse(evento.aplicado || '[]');
  const ids = [...new Set(foto.map((f) => f.id))];
  const perfumes = ids.length ? await perfumesConCosto(env, ids) : [];
  const porClave = new Map(foto.map((f) => [`${f.id}|${f.ml}`, f]));
  const cambiados = [];
  for (const p of perfumes) {
    let cambio = false;
    p.presentaciones = p.presentaciones.map((x) => {
      const f = porClave.get(`${p.id}|${x.ml}`);
      if (!f || Math.abs(x.precio - f.evento) > 0.001) return x;
      cambio = true;
      return { ...x, precio: f.precio, precioAnterior: f.precioAnterior };
    });
    if (cambio) cambiados.push(p);
  }
  await guardarPerfumes(env, cambiados);
  await env.DB.batch([
    env.DB.prepare("UPDATE eventos SET estado = 'terminado', terminado = datetime('now') WHERE id = ?").bind(evento.id),
    sentenciaVersion(env),
  ]);
}

// Eventos automáticos: los que llegaron a su fecha de inicio se activan y los que llegaron al final se terminan.
// Se llama en cada visita (catálogo y /api/vivo): es una consulta chica y casi nunca hay nada que hacer.
export async function revisarEventos(env) {
  const ahora = ahoraArgentina();
  const { results } = await env.DB.prepare(
    `SELECT * FROM eventos WHERE modo = 'auto' AND ((estado = 'programado' AND desde != '' AND desde <= ?) OR (estado = 'activo' AND hasta != '' AND hasta <= ?))`,
  ).bind(ahora, ahora).all();
  let cambio = false;
  for (const ev of results) {
    // Se "toma" el evento primero, así dos visitas al mismo tiempo no lo aplican dos veces.
    const siguiente = ev.estado === 'programado' ? 'aplicando' : 'terminando';
    const r = await env.DB.prepare('UPDATE eventos SET estado = ? WHERE id = ? AND estado = ?').bind(siguiente, ev.id, ev.estado).run();
    if (!r.meta?.changes) continue;
    try {
      if (ev.estado === 'programado') {
        if (ev.hasta && ev.hasta <= ahora) await env.DB.prepare("UPDATE eventos SET estado = 'terminado' WHERE id = ?").bind(ev.id).run();
        else await activar(env, ev);
      } else {
        await terminar(env, ev);
      }
      cambio = true;
    } catch (e) {
      console.error('Evento', ev.nombre, e.message);
      await env.DB.prepare('UPDATE eventos SET estado = ? WHERE id = ?').bind(ev.estado, ev.id).run();
    }
  }
  return cambio;
}

// El evento activo, para la tienda: nombre, cuándo termina y qué perfumes tienen precio de evento.
export async function eventoActivo(env) {
  const ev = await env.DB.prepare("SELECT nombre, hasta, modo, aplicado, config FROM eventos WHERE estado = 'activo' LIMIT 1").first();
  if (!ev) return null;
  const ids = [...new Set(JSON.parse(ev.aplicado || '[]').map((f) => f.id))];
  const { mostrarPorcentaje } = limpiarConfig(JSON.parse(ev.config || '{}'));
  return { nombre: ev.nombre, hasta: ev.modo === 'auto' ? ev.hasta : '', ids, porcentaje: mostrarPorcentaje };
}

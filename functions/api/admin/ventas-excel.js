// POST /api/admin/ventas-excel {filas: [{fecha, nombre, costo, precio, comision}]} (montos en pesos)
// Carga ventas viejas de la planilla "control ventas": cada fila queda como una venta entregada,
// con su ingreso, su costo (para la ganancia) y la comisión del pasante como gasto.
// Es seguro importar el mismo archivo dos veces: cada fila tiene un id fijo y no se duplica.
import { manejar, json, leerJSON, texto, numero, leerAjustes, sentenciaVersion, ErrorCliente } from '../../../lib/util.js';

async function huella(texto) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(buf).slice(0, 6), (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

const redondear = (n) => Math.round(n * 100) / 100;

export const onRequestPost = manejar(async ({ request, env }) => {
  const { filas } = await leerJSON(request, 500_000);
  if (!Array.isArray(filas) || !filas.length || filas.length > 200) throw new ErrorCliente(400, 'Mandá las ventas en tandas de hasta 200.');
  const dolar = (await leerAjustes(env)).cotizacion;
  if (!dolar) throw new ErrorCliente(400, 'Cargá el valor del dólar en Ajustes antes de importar ventas en pesos.');

  // Primero se calculan los ids; las ventas que ya están (aunque se hayan editado después) no se tocan.
  const vistas = new Map();
  const lista = [];
  for (const f of filas) {
    const fecha = /^\d{4}-\d{2}-\d{2}$/.test(f.fecha || '') ? f.fecha : null;
    const nombre = texto(f.nombre, 160);
    const precio = numero(f.precio, 0);
    if (!fecha || !nombre || precio <= 0) continue;
    const costo = Math.max(0, numero(f.costo, 0));
    const comision = Math.max(0, numero(f.comision, 0));
    const base = `${fecha}|${nombre.toLowerCase()}|${precio}`;
    const n = (vistas.get(base) || 0) + 1;
    vistas.set(base, n);
    const id = `X-${fecha.slice(2).replace(/-/g, '')}-${await huella(`${base}|${n}`)}`;
    lista.push({ id, fecha, nombre, precio, costo, comision });
  }
  const { results: yaEstan } = lista.length
    ? await env.DB.prepare('SELECT id FROM pedidos WHERE id IN (SELECT value FROM json_each(?))').bind(JSON.stringify(lista.map((x) => x.id))).all()
    : { results: [] };
  const existentes = new Set(yaEstan.map((r) => r.id));
  const sentencias = [];
  let validas = 0;
  for (const { id, fecha, nombre, precio, costo, comision } of lista) {
    validas++;
    if (existentes.has(id)) continue;
    const item = { id: null, marca: '', nombre, concentracion: '', ml: 0, cantidad: 1, precio: redondear(precio / dolar), costo: costo ? redondear(costo / dolar) : null };

    sentencias.push(env.DB.prepare(
      `INSERT OR IGNORE INTO pedidos (id, creado, origen, estado, nombre, items, total, costo_total, cobrado, cobrado_en, notas)
       VALUES (?, ?, 'excel', 'entregado', '', ?, ?, ?, ?, ?, 'Importada de la planilla de ventas')`,
    ).bind(id, `${fecha} 12:00:00`, JSON.stringify([item]), item.precio, item.costo || 0, item.precio, fecha));
    sentencias.push(env.DB.prepare(
      `INSERT OR IGNORE INTO movimientos (id, fecha, tipo, categoria, descripcion, monto, moneda, monto_original, cotizacion, pedido)
       VALUES (?, ?, 'ingreso', 'Venta', ?, ?, 'ARS', ?, ?, ?)`,
    ).bind(`${id}-V`, fecha, `Venta · ${nombre}`, item.precio, precio, dolar, id));
    if (comision > 0) {
      sentencias.push(env.DB.prepare(
        `INSERT OR IGNORE INTO movimientos (id, fecha, tipo, categoria, descripcion, monto, moneda, monto_original, cotizacion, pedido)
         VALUES (?, ?, 'egreso', 'Comisiones', ?, ?, 'ARS', ?, ?, ?)`,
      ).bind(`${id}-C`, fecha, `Comisión pasante · ${nombre}`, redondear(comision / dolar), comision, dolar, id));
    }
  }
  if (!validas) throw new ErrorCliente(400, 'No encontramos ventas válidas (fecha, nombre y precio de venta).');
  const antes = await env.DB.prepare("SELECT count(*) AS n FROM pedidos WHERE origen = 'excel'").first();
  for (let i = 0; i < sentencias.length; i += 90) await env.DB.batch(sentencias.slice(i, i + 90));
  const despues = await env.DB.prepare("SELECT count(*) AS n FROM pedidos WHERE origen = 'excel'").first();
  await sentenciaVersion(env).run();
  return json({ ok: true, leidas: validas, nuevas: despues.n - antes.n });
});

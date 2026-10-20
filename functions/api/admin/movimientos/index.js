// GET /api/admin/movimientos?mes=AAAA-MM · POST → cargar un ingreso o gasto
import { manejar, json, leerJSON, idAleatorio, hoyArgentina } from '../../../../lib/util.js';
import { CATEGORIAS, limpiarMovimiento } from '../../../../lib/movimientos.js';

export const onRequestGet = manejar(async ({ request, env }) => {
  const mes = new URL(request.url).searchParams.get('mes');
  const filtro = /^\d{4}-\d{2}$/.test(mes || '') ? mes : hoyArgentina().slice(0, 7);
  const { results } = await env.DB.prepare(
    "SELECT * FROM movimientos WHERE substr(fecha, 1, 7) = ? ORDER BY fecha DESC, creado DESC",
  ).bind(filtro).all();
  return json({ mes: filtro, movimientos: results, categorias: CATEGORIAS });
});

export const onRequestPost = manejar(async ({ request, env }) => {
  const m = await limpiarMovimiento(env, await leerJSON(request, 10_000));
  const id = idAleatorio(12);
  await env.DB.prepare(
    `INSERT INTO movimientos (id, fecha, tipo, categoria, descripcion, monto, moneda, monto_original, cotizacion)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(id, m.fecha, m.tipo, m.categoria, m.descripcion, m.monto, m.moneda, m.monto_original, m.cotizacion).run();
  return json({ ok: true, id }, 201);
});

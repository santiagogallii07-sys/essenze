// GET /api/admin/movimientos?mes=AAAA-MM (o ?q=texto: busca en todos los meses, también por perfume vendido) · POST → cargar un ingreso o gasto
import { manejar, json, leerJSON, idAleatorio, hoyArgentina, texto, sentenciaCambio } from '../../../../lib/util.js';
import { CATEGORIAS, limpiarMovimiento } from '../../../../lib/movimientos.js';

export const onRequestGet = manejar(async ({ request, env }) => {
  const u = new URL(request.url).searchParams;
  const q = texto(u.get('q'), 60).replace(/^#/, '');
  if (q) {
    const patron = `%${q}%`;
    const { results } = await env.DB.prepare(
      `SELECT m.* FROM movimientos m LEFT JOIN pedidos p ON p.id = m.pedido
       WHERE m.descripcion LIKE ? OR m.categoria LIKE ? OR p.items LIKE ? OR p.nombre LIKE ? OR CAST(p.numero AS TEXT) = ?
       ORDER BY m.fecha DESC, m.creado DESC LIMIT 200`,
    ).bind(patron, patron, patron, patron, q).all();
    return json({ q, movimientos: results, categorias: CATEGORIAS });
  }
  const mes = u.get('mes');
  const filtro = /^\d{4}-\d{2}$/.test(mes || '') ? mes : hoyArgentina().slice(0, 7);
  const { results } = await env.DB.prepare(
    "SELECT * FROM movimientos WHERE substr(fecha, 1, 7) = ? ORDER BY fecha DESC, creado DESC",
  ).bind(filtro).all();
  return json({ mes: filtro, movimientos: results, categorias: CATEGORIAS });
});

export const onRequestPost = manejar(async ({ request, env }) => {
  const m = await limpiarMovimiento(env, await leerJSON(request, 10_000));
  const id = idAleatorio(12);
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO movimientos (id, fecha, tipo, categoria, descripcion, monto, moneda, monto_original, cotizacion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, m.fecha, m.tipo, m.categoria, m.descripcion, m.monto, m.moneda, m.monto_original, m.cotizacion),
    sentenciaCambio(env),
  ]);
  return json({ ok: true, id }, 201);
});

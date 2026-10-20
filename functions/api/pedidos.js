// POST /api/pedidos → guarda el pedido que el cliente manda por WhatsApp.
// Los precios se recalculan acá con los de la base: nunca se confía en lo que manda el navegador.
import { manejar, json, error, leerJSON, texto, numero, ipDe, idAleatorio, hoyArgentina } from '../../lib/util.js';

export const onRequestPost = manejar(async ({ request, env }) => {
  const d = await leerJSON(request, 50_000);
  if (d.sitio) return json({ ok: true, numero: d.numero || '' }); // trampa para robots

  const nombre = texto(d.nombre, 120);
  const email = texto(d.email, 160);
  const telefono = texto(d.telefono, 40);
  if (nombre.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || telefono.replace(/\D/g, '').length < 8) {
    return error(400, 'Revisá tus datos: nombre, email y teléfono.');
  }
  const pedidos = Array.isArray(d.items) ? d.items.slice(0, 40) : [];
  if (!pedidos.length) return error(400, 'El pedido está vacío.');

  const ip = ipDe(request);
  const recientes = await env.DB.prepare(
    "SELECT count(*) AS n FROM pedidos WHERE ip = ? AND creado > datetime('now', '-1 hour')",
  ).bind(ip).first();
  if (recientes.n >= 15) return error(429, 'Recibimos muchos pedidos seguidos desde tu conexión. Escribinos directo por WhatsApp.');

  const ids = [...new Set(pedidos.map((i) => texto(i.id, 100)))];
  const { results } = await env.DB.prepare(
    `SELECT id, marca, nombre, concentracion, presentaciones FROM perfumes WHERE id IN (${ids.map(() => '?').join(',')})`,
  ).bind(...ids).all();
  const porId = new Map(results.map((r) => [r.id, { ...r, presentaciones: JSON.parse(r.presentaciones || '[]') }]));

  const items = [];
  for (const i of pedidos) {
    const p = porId.get(texto(i.id, 100));
    const ml = Math.round(numero(i.ml, -1));
    const pres = p?.presentaciones.find((x) => x.ml === ml);
    const cantidad = Math.min(50, Math.max(1, Math.round(numero(i.cantidad, 1))));
    if (!p || !pres) continue;
    items.push({ id: p.id, marca: p.marca, nombre: p.nombre, concentracion: p.concentracion, ml, cantidad, precio: pres.precio, costo: pres.costo ?? null });
  }
  if (!items.length) return error(400, 'Los perfumes del pedido ya no están disponibles.');

  const total = Math.round(items.reduce((n, i) => n + i.precio * i.cantidad, 0) * 100) / 100;
  let numeroPedido = /^E-\d{6}-[A-Z0-9]{4}$/.test(d.numero) ? d.numero : `E-${hoyArgentina().slice(2).replace(/-/g, '')}-${idAleatorio(4).toUpperCase()}`;
  const existe = await env.DB.prepare('SELECT 1 FROM pedidos WHERE id = ?').bind(numeroPedido).first();
  if (existe) numeroPedido = `${numeroPedido}-${idAleatorio(2).toUpperCase()}`;

  await env.DB.prepare(
    `INSERT INTO pedidos (id, origen, estado, nombre, email, telefono, comentario, items, total, ip)
     VALUES (?, 'web', 'nuevo', ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(numeroPedido, nombre, email, telefono, texto(d.comentario, 600), JSON.stringify(items), total, ip).run();

  return json({ ok: true, numero: numeroPedido, total });
});

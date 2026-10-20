// GET /api/admin/pedidos?estado=&q= · POST → registrar una venta hecha fuera de la web (local, Instagram…)
import { manejar, json, error, leerJSON, texto, numero, idAleatorio, hoyArgentina, sentenciaVersion } from '../../../../lib/util.js';
import { ESTADOS, filaAPedido, sentenciasCobro } from '../../../../lib/pedidos.js';

export const onRequestGet = manejar(async ({ request, env }) => {
  const u = new URL(request.url).searchParams;
  const condiciones = [];
  const valores = [];
  if (ESTADOS.includes(u.get('estado'))) { condiciones.push('estado = ?'); valores.push(u.get('estado')); }
  const q = texto(u.get('q'), 60);
  if (q) {
    condiciones.push('(id LIKE ? OR nombre LIKE ? OR telefono LIKE ? OR email LIKE ?)');
    valores.push(...Array(4).fill(`%${q}%`));
  }
  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const { results } = await env.DB.prepare(`SELECT * FROM pedidos ${where} ORDER BY creado DESC LIMIT 300`).bind(...valores).all();
  const { results: cuentas } = await env.DB.prepare('SELECT estado, count(*) AS n FROM pedidos GROUP BY estado').all();
  return json({ pedidos: results.map(filaAPedido), cuentas: Object.fromEntries(cuentas.map((c) => [c.estado, c.n])) });
});

export const onRequestPost = manejar(async ({ request, env }) => {
  const d = await leerJSON(request, 50_000);
  const pedidos = Array.isArray(d.items) ? d.items.slice(0, 40) : [];
  const ids = [...new Set(pedidos.map((i) => texto(i.id, 100)))];
  if (!ids.length) return error(400, 'Agregá al menos un perfume a la venta.');
  const { results } = await env.DB.prepare('SELECT id, marca, nombre, concentracion, presentaciones FROM perfumes WHERE id IN (SELECT value FROM json_each(?))')
    .bind(JSON.stringify(ids)).all();
  const porId = new Map(results.map((r) => [r.id, { ...r, presentaciones: JSON.parse(r.presentaciones || '[]') }]));

  const items = [];
  for (const i of pedidos) {
    const p = porId.get(texto(i.id, 100));
    const ml = Math.round(numero(i.ml, -1));
    const pres = p?.presentaciones.find((x) => x.ml === ml);
    if (!p || !pres) continue;
    const precio = i.precio === undefined || i.precio === '' ? pres.precio : Math.max(0, numero(i.precio, pres.precio));
    items.push({ id: p.id, marca: p.marca, nombre: p.nombre, concentracion: p.concentracion, ml, cantidad: Math.max(1, Math.round(numero(i.cantidad, 1))), precio, costo: pres.costo ?? null });
  }
  if (!items.length) return error(400, 'Los perfumes elegidos no existen.');

  const total = Math.round(items.reduce((n, i) => n + i.precio * i.cantidad, 0) * 100) / 100;
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(d.fecha || '') ? d.fecha : hoyArgentina();
  const pedido = {
    id: `V-${fecha.slice(2).replace(/-/g, '')}-${idAleatorio(4).toUpperCase()}`,
    nombre: texto(d.nombre, 120),
    telefono: texto(d.telefono, 40),
    items,
    total,
  };
  const estado = d.estado === 'entregado' ? 'entregado' : 'cobrado';
  const cobro = await sentenciasCobro(env, pedido, true, { monto: d.cobrado === undefined || d.cobrado === '' ? total : numero(d.cobrado, total), metodo: texto(d.metodo_pago, 40), fecha });
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO pedidos (id, creado, origen, estado, nombre, telefono, comentario, items, total, notas)
       VALUES (?, ?, 'manual', ?, ?, ?, '', ?, ?, ?)`,
    ).bind(pedido.id, `${fecha} 12:00:00`, estado, pedido.nombre, pedido.telefono, JSON.stringify(items), total, texto(d.notas, 600)),
    ...cobro,
    sentenciaVersion(env),
  ]);
  return json({ ok: true, id: pedido.id }, 201);
});

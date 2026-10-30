// GET /api/admin/pedidos?estado=&q= · POST → registrar una venta hecha fuera de la web (local, Instagram…)
import { manejar, json, error, leerJSON, texto, numero, idAleatorio, hoyArgentina, sentenciaVersion, leerAjustes } from '../../../../lib/util.js';
import { ESTADOS, filaAPedido, sentenciasCobro, armarItems, conNumeroNuevo, clienteDeEmail } from '../../../../lib/pedidos.js';
import { asegurarEsquema } from '../../../../lib/esquema.js';

export const onRequestGet = manejar(async ({ request, env }) => {
  const u = new URL(request.url).searchParams;
  const condiciones = [];
  const valores = [];
  if (ESTADOS.includes(u.get('estado'))) { condiciones.push('p.estado = ?'); valores.push(u.get('estado')); }
  const q = texto(u.get('q'), 60).replace(/^#/, '');
  if (q) {
    // Número, cliente o perfume (los ítems guardan marca y nombre de cada perfume).
    condiciones.push('(CAST(p.numero AS TEXT) = ? OR p.id LIKE ? OR p.nombre LIKE ? OR p.telefono LIKE ? OR p.email LIKE ? OR p.items LIKE ?)');
    valores.push(q, ...Array(5).fill(`%${q}%`));
  }
  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  await asegurarEsquema(env);
  // Pesos exactos cobrados (si la venta se cobró en pesos), para mostrarlos sin redondeos del dólar.
  const { results } = await env.DB.prepare(
    `SELECT p.*, (SELECT m.monto_original FROM movimientos m WHERE m.pedido = p.id AND m.categoria = 'Venta' AND m.moneda = 'ARS' LIMIT 1) AS cobrado_ars
     FROM pedidos p ${where} ORDER BY p.creado DESC, p.numero DESC LIMIT 300`,
  ).bind(...valores).all();
  const { results: cuentas } = await env.DB.prepare('SELECT estado, count(*) AS n FROM pedidos GROUP BY estado').all();
  return json({ pedidos: results.map(filaAPedido), cuentas: Object.fromEntries(cuentas.map((c) => [c.estado, c.n])) });
});

export const onRequestPost = manejar(async ({ request, env }) => {
  const d = await leerJSON(request, 50_000);
  if (!Array.isArray(d.items) || !d.items.length) return error(400, 'Agregá al menos un perfume a la venta.');
  const nombre = texto(d.nombre, 120);
  if (nombre.length < 2) return error(400, 'Escribí el nombre del cliente.');
  const dolar = (await leerAjustes(env)).cotizacion;
  const { items, recordar } = await armarItems(env, d.items, dolar);
  if (!items.length) return error(400, 'Los perfumes elegidos no existen.');

  const total = Math.round(items.reduce((n, i) => n + i.precio * i.cantidad, 0) * 100) / 100;
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(d.fecha || '') ? d.fecha : hoyArgentina();
  const email = texto(d.email, 160);
  const base = {
    id: `V-${fecha.slice(2).replace(/-/g, '')}-${idAleatorio(4).toUpperCase()}`,
    nombre,
    telefono: texto(d.telefono, 40),
    email,
    cliente: await clienteDeEmail(env, email),
    items,
    total,
  };
  const estado = d.estado === 'entregado' ? 'entregado' : 'cobrado';
  const pedido = await conNumeroNuevo(env, async (n) => {
    const nuevo = { ...base, numero: n };
    // El cobro registra la venta, la comisión, el costo cargado (como gasto) y deja ese costo como el último del perfume.
    const cobro = await sentenciasCobro(env, nuevo, true, {
      monto: d.cobrado === undefined || d.cobrado === '' ? undefined : numero(d.cobrado, total),
      montoArs: d.cobradoArs === undefined || d.cobradoArs === '' ? undefined : numero(d.cobradoArs, 0),
      metodo: texto(d.metodo_pago, 40),
      fecha,
      recordar,
    });
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO pedidos (id, numero, creado, origen, estado, nombre, email, telefono, cliente, comentario, items, total, notas)
         VALUES (?, ?, ?, 'manual', ?, ?, ?, ?, ?, '', ?, ?, ?)`,
      ).bind(nuevo.id, n, `${fecha} 12:00:00`, estado, nuevo.nombre, nuevo.email, nuevo.telefono, nuevo.cliente, JSON.stringify(items), total, texto(d.notas, 600)),
      ...cobro,
      sentenciaVersion(env),
    ]);
    return nuevo;
  });
  return json({ ok: true, id: pedido.id, numero: pedido.numero }, 201);
});

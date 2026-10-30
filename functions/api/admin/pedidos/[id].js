// GET /api/admin/pedidos/:id → pedido con sus movimientos de caja (para editarlo)
// PUT /api/admin/pedidos/:id {estado?, notas?, metodo_pago?, cobrado?, fecha?} · cambio rápido de estado
// PUT con items → edición completa: perfumes, precios, costos, cliente, fecha, estado, cobro y comisión.
// Al pasar a cobrado/entregado se registra el ingreso y se descuenta stock; al anular, se revierte.
// Si se edita una venta ya cobrada, se deshace y se vuelve a cobrar con los datos nuevos y el dólar de esa venta.
import { manejar, json, error, leerJSON, texto, numero, sentenciaVersion, sentenciaCambio, leerAjustes } from '../../../../lib/util.js';
import { ESTADOS, estaCobrado, filaAPedido, sentenciasCobro, armarItems, clienteDeEmail } from '../../../../lib/pedidos.js';
import { asegurarEsquema } from '../../../../lib/esquema.js';

async function buscar(env, id) {
  const f = await env.DB.prepare('SELECT * FROM pedidos WHERE id = ?').bind(id).first();
  return f ? filaAPedido(f) : null;
}

const vacio = (v) => v === undefined || v === null || v === '';

export const onRequestGet = manejar(async ({ params, env }) => {
  await asegurarEsquema(env);
  const pedido = await buscar(env, String(params.id));
  if (!pedido) return error(404, 'No existe ese pedido.');
  const { results } = await env.DB.prepare('SELECT * FROM movimientos WHERE pedido = ? ORDER BY creado').bind(pedido.id).all();
  return json({ pedido, movimientos: results });
});

async function editar(env, pedido, d) {
  const estado = ESTADOS.includes(d.estado) ? d.estado : pedido.estado;
  if (d.nombre !== undefined && texto(d.nombre, 120).length < 2) return error(400, 'Escribí el nombre del cliente.');
  // El dólar de la venta original se mantiene: editar una venta vieja no la revalúa al dólar de hoy.
  const dolarVenta = await env.DB.prepare("SELECT cotizacion FROM movimientos WHERE pedido = ? AND categoria = 'Venta' LIMIT 1").bind(pedido.id).first('cotizacion');
  const dolar = dolarVenta || (await leerAjustes(env)).cotizacion || 0;
  const { items, recordar } = await armarItems(env, d.items, dolar, pedido.items);
  if (!items.length) return error(400, 'La venta tiene que tener al menos un perfume.');

  const total = Math.round(items.reduce((n, i) => n + i.precio * i.cantidad, 0) * 100) / 100;
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(d.fecha || '') ? d.fecha : String(pedido.cobrado_en || pedido.creado).slice(0, 10);
  const nuevo = {
    ...pedido,
    estado,
    nombre: d.nombre !== undefined ? texto(d.nombre, 120) : pedido.nombre,
    telefono: d.telefono !== undefined ? texto(d.telefono, 40) : pedido.telefono,
    email: d.email !== undefined ? texto(d.email, 160) : pedido.email,
    comentario: d.comentario !== undefined ? texto(d.comentario, 1000) : pedido.comentario,
    notas: d.notas !== undefined ? texto(d.notas, 1000) : pedido.notas,
    metodo_pago: d.metodo_pago !== undefined ? texto(d.metodo_pago, 40) : pedido.metodo_pago,
    items,
    total,
  };
  // Si cambia el email, la venta pasa a la cuenta de cliente con ese email (si hay una).
  if (nuevo.email !== pedido.email) nuevo.cliente = await clienteDeEmail(env, nuevo.email);
  const hora = String(pedido.creado).slice(10) || ' 12:00:00';
  const sentencias = [env.DB.prepare(
    'UPDATE pedidos SET estado = ?, nombre = ?, telefono = ?, email = ?, cliente = ?, comentario = ?, notas = ?, metodo_pago = ?, items = ?, total = ?, creado = ? WHERE id = ?',
  ).bind(estado, nuevo.nombre, nuevo.telefono, nuevo.email, nuevo.cliente ?? null, nuevo.comentario, nuevo.notas, nuevo.metodo_pago, JSON.stringify(items), total, `${fecha}${hora}`, pedido.id)];

  const antes = estaCobrado(pedido.estado);
  if (estaCobrado(estado)) {
    sentencias.push(...(await sentenciasCobro(env, nuevo, true, {
      monto: vacio(d.cobrado) ? undefined : numero(d.cobrado, total),
      montoArs: vacio(d.cobradoArs) ? undefined : numero(d.cobradoArs, 0),
      comisionArs: vacio(d.comisionArs) ? undefined : d.comisionArs,
      comision: vacio(d.comision) ? undefined : d.comision,
      metodo: nuevo.metodo_pago,
      fecha,
      cotizacion: dolar || undefined,
      anterior: antes ? pedido : null,
      recordar,
    })));
  } else if (antes) {
    sentencias.push(...(await sentenciasCobro(env, pedido, false)));
  }
  sentencias.push(sentenciaVersion(env));
  await env.DB.batch(sentencias);
  return json({ ok: true, pedido: await buscar(env, pedido.id) });
}

export const onRequestPut = manejar(async ({ params, request, env }) => {
  const pedido = await buscar(env, String(params.id));
  if (!pedido) return error(404, 'No existe ese pedido.');
  const d = await leerJSON(request, 50_000);
  if (Array.isArray(d.items)) return editar(env, pedido, d);

  const estado = ESTADOS.includes(d.estado) ? d.estado : pedido.estado;
  const sentencias = [];
  const antes = estaCobrado(pedido.estado);
  const despues = estaCobrado(estado);
  const opciones = {
    monto: vacio(d.cobrado) ? undefined : numero(d.cobrado, pedido.total),
    montoArs: vacio(d.cobradoArs) ? undefined : numero(d.cobradoArs, 0),
    metodo: d.metodo_pago !== undefined ? texto(d.metodo_pago, 40) : undefined,
    fecha: /^\d{4}-\d{2}-\d{2}$/.test(d.fecha || '') ? d.fecha : undefined,
  };
  if (!antes && despues) sentencias.push(...(await sentenciasCobro(env, pedido, true, opciones)));
  if (antes && !despues) sentencias.push(...(await sentenciasCobro(env, pedido, false)));

  sentencias.push(env.DB.prepare('UPDATE pedidos SET estado = ?, notas = ?, metodo_pago = ? WHERE id = ?').bind(
    estado,
    d.notas !== undefined ? texto(d.notas, 1000) : pedido.notas,
    opciones.metodo ?? pedido.metodo_pago,
    pedido.id,
  ));
  // Con cobro cambian la caja, el stock y los más vendidos; si no, solo se avisa al panel.
  sentencias.push(sentencias.length > 1 ? sentenciaVersion(env) : sentenciaCambio(env));
  await env.DB.batch(sentencias);
  return json({ ok: true, pedido: await buscar(env, pedido.id) });
});

export const onRequestDelete = manejar(async ({ params, env }) => {
  const pedido = await buscar(env, String(params.id));
  if (!pedido) return error(404, 'No existe ese pedido.');
  const sentencias = estaCobrado(pedido.estado) ? await sentenciasCobro(env, pedido, false) : [];
  sentencias.push(env.DB.prepare('DELETE FROM pedidos WHERE id = ?').bind(pedido.id), sentenciaVersion(env));
  await env.DB.batch(sentencias);
  return json({ ok: true });
});

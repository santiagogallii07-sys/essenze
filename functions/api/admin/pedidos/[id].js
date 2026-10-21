// PUT /api/admin/pedidos/:id {estado?, notas?, metodo_pago?, cobrado?, fecha?} · DELETE
// Al pasar a cobrado/entregado se registra el ingreso y se descuenta stock; al anular, se revierte.
import { manejar, json, error, leerJSON, texto, numero, sentenciaVersion } from '../../../../lib/util.js';
import { ESTADOS, estaCobrado, filaAPedido, sentenciasCobro } from '../../../../lib/pedidos.js';

async function buscar(env, id) {
  const f = await env.DB.prepare('SELECT * FROM pedidos WHERE id = ?').bind(id).first();
  return f ? filaAPedido(f) : null;
}

export const onRequestPut = manejar(async ({ params, request, env }) => {
  const pedido = await buscar(env, String(params.id));
  if (!pedido) return error(404, 'No existe ese pedido.');
  const d = await leerJSON(request, 20_000);
  const estado = ESTADOS.includes(d.estado) ? d.estado : pedido.estado;
  const sentencias = [];

  const antes = estaCobrado(pedido.estado);
  const despues = estaCobrado(estado);
  const opciones = {
    monto: d.cobrado === undefined || d.cobrado === '' ? undefined : numero(d.cobrado, pedido.total),
    montoArs: d.cobradoArs === undefined || d.cobradoArs === '' ? undefined : numero(d.cobradoArs, 0),
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
  if (sentencias.length > 1) sentencias.push(sentenciaVersion(env));
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

// PUT / DELETE /api/admin/movimientos/:id (los movimientos de ventas se manejan desde el pedido)
import { manejar, json, error, leerJSON, sentenciaCambio } from '../../../../lib/util.js';
import { limpiarMovimiento } from '../../../../lib/movimientos.js';

async function buscar(env, id) {
  return env.DB.prepare('SELECT * FROM movimientos WHERE id = ?').bind(id).first();
}

export const onRequestPut = manejar(async ({ params, request, env }) => {
  const actual = await buscar(env, String(params.id));
  if (!actual) return error(404, 'No existe ese movimiento.');
  if (actual.pedido) return error(409, 'Este ingreso viene de un pedido: cambialo desde Pedidos.');
  const m = await limpiarMovimiento(env, await leerJSON(request, 10_000));
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE movimientos SET fecha = ?, tipo = ?, categoria = ?, descripcion = ?, monto = ?, moneda = ?, monto_original = ?, cotizacion = ?
       WHERE id = ?`,
    ).bind(m.fecha, m.tipo, m.categoria, m.descripcion, m.monto, m.moneda, m.monto_original, m.cotizacion, actual.id),
    sentenciaCambio(env),
  ]);
  return json({ ok: true });
});

export const onRequestDelete = manejar(async ({ params, env }) => {
  const actual = await buscar(env, String(params.id));
  if (!actual) return error(404, 'No existe ese movimiento.');
  if (actual.pedido) return error(409, 'Este ingreso viene de un pedido: anulá el cobro desde Pedidos.');
  await env.DB.batch([env.DB.prepare('DELETE FROM movimientos WHERE id = ?').bind(actual.id), sentenciaCambio(env)]);
  return json({ ok: true });
});

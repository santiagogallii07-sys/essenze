// DELETE /api/admin/stock/compras/:id → deshacer una compra (stock, costo, caja y deuda vuelven a como estaban)
import { manejar, json, error, sentenciaVersion, sentenciaCambio } from '../../../../../lib/util.js';
import { sentenciasDeshacerCompra } from '../../../../../lib/stock.js';

export const onRequestDelete = manejar(async ({ params, env }) => {
  const compra = await env.DB.prepare('SELECT * FROM compras WHERE id = ?').bind(String(params.id)).first();
  if (!compra) return error(404, 'No existe esa compra.');
  const { sentencias, catalogo } = await sentenciasDeshacerCompra(env, compra);
  await env.DB.batch([...sentencias, catalogo ? sentenciaVersion(env) : sentenciaCambio(env)]);
  return json({ ok: true });
});

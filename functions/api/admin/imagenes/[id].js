// DELETE /api/admin/imagenes/:id → borra una foto si nadie la usa.
import { manejar, json, error } from '../../../../lib/util.js';

export const onRequestDelete = manejar(async ({ params, env }) => {
  const id = String(params.id);
  const usada = await env.DB.prepare(
    `SELECT 1 FROM perfumes WHERE imagen = ?1 OR imagenes LIKE '%"' || ?1 || '"%'
     UNION SELECT 1 FROM ofertas WHERE imagen = ?1 LIMIT 1`,
  ).bind(id).first();
  if (usada) return error(409, 'La foto está en uso.');
  await env.DB.prepare('DELETE FROM imagenes WHERE id = ?').bind(id).run();
  return json({ ok: true });
});

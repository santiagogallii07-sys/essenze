// DELETE /api/admin/imagenes/:id → borra una foto si nadie la usa.
import { manejar, json, error } from '../../../../lib/util.js';
import { asegurarEsquema } from '../../../../lib/esquema.js';

export const onRequestDelete = manejar(async ({ params, env }) => {
  await asegurarEsquema(env);
  const id = String(params.id);
  const usada = await env.DB.prepare(
    `SELECT 1 FROM perfumes WHERE imagen = ?1 OR imagenes LIKE '%"' || ?1 || '"%'
     UNION SELECT 1 FROM ofertas WHERE imagen = ?1 OR imagen_movil = ?1 LIMIT 1`,
  ).bind(id).first();
  if (usada) return error(409, 'La foto está en uso.');
  // Con la foto se va su copia chica (fotos subidas en lote).
  await env.DB.prepare('DELETE FROM imagenes WHERE id = ?1 OR id = ?1 || \'-m\'').bind(id).run();
  return json({ ok: true });
});

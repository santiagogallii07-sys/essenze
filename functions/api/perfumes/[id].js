// GET /api/perfumes/:id → ficha completa de un perfume visible.
import { manejar, json, error } from '../../../lib/util.js';
import { filaAPerfume } from '../../../lib/perfumes.js';

export const onRequestGet = manejar(async ({ params, env }) => {
  const fila = await env.DB.prepare(
    `SELECT id, marca, nombre, concentracion, tipo, genero, familia, perfil, descripcion, notas, acordes,
            estaciones, ocasiones, presentaciones, imagen, imagen_fondo, imagenes, modelo3d, frasco, destacado, visible
     FROM perfumes WHERE id = ? AND visible = 1`,
  ).bind(String(params.id)).first();
  if (!fila) return error(404, 'No encontramos este perfume.');
  const p = filaAPerfume(fila);
  // El costo es interno: nunca sale en la web pública.
  p.presentaciones = p.presentaciones.map(({ costo, ...resto }) => resto);
  return json(p, 200, { 'Cache-Control': 'public, max-age=30' });
});

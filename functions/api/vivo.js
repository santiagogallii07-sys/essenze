// GET /api/vivo → versión del catálogo. Las páginas abiertas de la tienda preguntan cada 20 segundos:
// si cambió (un precio, el stock, una oferta o el dólar), traen el catálogo de nuevo y se actualizan solas.
import { manejar, json } from '../../lib/util.js';

export const onRequestGet = manejar(async ({ env }) => {
  const v = await env.DB.prepare("SELECT valor FROM ajustes WHERE clave = 'version'").first('valor');
  return json({ v: Number(v) || 1 });
});

// GET /api/vivo → versión del catálogo. Las páginas abiertas de la tienda preguntan cada 20 segundos:
// si cambió (un precio, el stock, una oferta, el dólar o empezó/terminó un evento), traen el catálogo de nuevo y se actualizan solas.
import { manejar, json } from '../../lib/util.js';
import { asegurarEsquema } from '../../lib/esquema.js';
import { revisarEventos } from '../../lib/eventos.js';

export const onRequestGet = manejar(async ({ env }) => {
  await asegurarEsquema(env);
  await revisarEventos(env);
  const v = await env.DB.prepare("SELECT valor FROM ajustes WHERE clave = 'version'").first('valor');
  return json({ v: Number(v) || 1 });
});

// GET /foto/:id → imagen guardada en la base. Los ids no se reutilizan, así que se cachea para siempre.
import { aBytes } from '../../lib/util.js';

export async function onRequestGet({ request, params, env, waitUntil }) {
  const id = String(params.id || '').replace(/\.\w+$/, '');
  if (!/^[a-z0-9-]{6,40}$/.test(id)) return new Response('No encontrada', { status: 404 });

  const cache = caches.default;
  const guardada = await cache.match(request);
  if (guardada) return guardada;

  const fila = await env.DB.prepare('SELECT tipo, datos FROM imagenes WHERE id = ?').bind(id).first();
  if (!fila) return new Response('No encontrada', { status: 404 });

  const respuesta = new Response(aBytes(fila.datos), {
    headers: {
      'Content-Type': fila.tipo,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
  waitUntil(cache.put(request, respuesta.clone()));
  return respuesta;
}

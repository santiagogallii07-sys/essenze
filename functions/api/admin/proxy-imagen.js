// GET /api/admin/proxy-imagen?url=… → trae una imagen de otra página para procesarla en el panel
// (los navegadores no dejan leer imágenes de otros sitios directamente).
import { error } from '../../../lib/util.js';

const MAXIMO = 8_000_000;

export async function onRequestGet({ request }) {
  const destino = new URL(request.url).searchParams.get('url') || '';
  let url;
  try {
    url = new URL(destino);
  } catch {
    return error(400, 'El link no es válido.');
  }
  if (!['http:', 'https:'].includes(url.protocol)) return error(400, 'El link tiene que empezar con http o https.');

  let res;
  try {
    res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EssenzePanel/1.0)', Accept: 'image/*' },
      redirect: 'follow',
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    return error(502, 'No pudimos descargar la imagen de ese link.');
  }
  const tipo = (res.headers.get('Content-Type') || '').split(';')[0];
  if (!res.ok || !tipo.startsWith('image/')) return error(422, 'Ese link no es una imagen. Copiá el link de la imagen (clic derecho → Copiar dirección de imagen).');
  const datos = await res.arrayBuffer();
  if (datos.byteLength > MAXIMO) return error(413, 'La imagen pesa más de 8 MB.');
  return new Response(datos, { headers: { 'Content-Type': tipo, 'Cache-Control': 'no-store' } });
}

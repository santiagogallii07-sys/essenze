// POST /api/admin/imagenes → sube una foto ya procesada en el navegador (cuerpo binario).
// Encabezados: Content-Type (image/webp|png|jpeg), X-Fondo (recorte|foto), X-Ancho, X-Alto.
// GET /api/admin/imagenes?ids=a,b → indica cuáles existen.
import { manejar, json, error, idAleatorio } from '../../../../lib/util.js';

const TIPOS = ['image/webp', 'image/png', 'image/jpeg'];
const MAXIMO = 1_800_000; // D1 admite filas de hasta 2 MB

export const onRequestPost = manejar(async ({ request, env }) => {
  const tipo = (request.headers.get('Content-Type') || '').split(';')[0].trim();
  if (!TIPOS.includes(tipo)) return error(415, 'Formato de imagen no admitido. Usá WebP, PNG o JPG.');
  const datos = await request.arrayBuffer();
  if (!datos.byteLength) return error(400, 'La imagen está vacía.');
  if (datos.byteLength > MAXIMO) return error(413, 'La imagen pesa demasiado (máximo 1,8 MB después de procesarla).');

  const id = idAleatorio(14);
  const fondo = request.headers.get('X-Fondo') === 'recorte' ? 'recorte' : 'foto';
  const ancho = parseInt(request.headers.get('X-Ancho'), 10) || null;
  const alto = parseInt(request.headers.get('X-Alto'), 10) || null;
  await env.DB.prepare('INSERT INTO imagenes (id, tipo, fondo, ancho, alto, datos) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, tipo, fondo, ancho, alto, datos).run();
  return json({ ok: true, id, fondo, url: `/foto/${id}` }, 201);
});

export const onRequestGet = manejar(async ({ request, env }) => {
  const ids = (new URL(request.url).searchParams.get('ids') || '').split(',').filter(Boolean).slice(0, 500);
  if (!ids.length) return json({ existentes: [] });
  const { results } = await env.DB.prepare('SELECT id FROM imagenes WHERE id IN (SELECT value FROM json_each(?))')
    .bind(JSON.stringify(ids)).all();
  return json({ existentes: results.map((r) => r.id) });
});

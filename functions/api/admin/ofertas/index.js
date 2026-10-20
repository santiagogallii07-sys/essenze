// GET /api/admin/ofertas · POST (crear) · PUT {orden: [ids]} (reordenar la cartelera)
import { manejar, json, leerJSON, idAleatorio, sentenciaVersion } from '../../../../lib/util.js';
import { limpiarOferta } from '../../../../lib/ofertas.js';

export const onRequestGet = manejar(async ({ env }) => {
  const { results } = await env.DB.prepare('SELECT * FROM ofertas ORDER BY orden, creado').all();
  return json(results.map((o) => ({ ...o, activa: !!o.activa })));
});

export const onRequestPost = manejar(async ({ request, env }) => {
  const o = limpiarOferta(await leerJSON(request, 20_000));
  const id = idAleatorio(10);
  const { n } = await env.DB.prepare('SELECT coalesce(max(orden), 0) + 1 AS n FROM ofertas').first();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO ofertas (id, etiqueta, titulo, texto, boton, enlace, perfume, imagen, activa, desde, hasta, orden)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(id, o.etiqueta, o.titulo, o.texto, o.boton, o.enlace, o.perfume, o.imagen, o.activa, o.desde, o.hasta, n),
    sentenciaVersion(env),
  ]);
  return json({ ok: true, id }, 201);
});

export const onRequestPut = manejar(async ({ request, env }) => {
  const { orden } = await leerJSON(request, 20_000);
  const ids = Array.isArray(orden) ? orden.slice(0, 50) : [];
  await env.DB.batch([
    ...ids.map((id, i) => env.DB.prepare('UPDATE ofertas SET orden = ? WHERE id = ?').bind(i + 1, String(id))),
    sentenciaVersion(env),
  ]);
  return json({ ok: true });
});

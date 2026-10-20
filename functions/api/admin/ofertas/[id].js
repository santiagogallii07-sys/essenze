// PUT / DELETE /api/admin/ofertas/:id
import { manejar, json, error, leerJSON, sentenciaVersion } from '../../../../lib/util.js';
import { limpiarOferta } from '../../../../lib/ofertas.js';

export const onRequestPut = manejar(async ({ params, request, env }) => {
  const o = limpiarOferta(await leerJSON(request, 20_000));
  const r = await env.DB.prepare(
    `UPDATE ofertas SET etiqueta = ?, titulo = ?, texto = ?, boton = ?, enlace = ?, perfume = ?, imagen = ?,
       activa = ?, desde = ?, hasta = ? WHERE id = ?`,
  ).bind(o.etiqueta, o.titulo, o.texto, o.boton, o.enlace, o.perfume, o.imagen, o.activa, o.desde, o.hasta, String(params.id)).run();
  if (!r.meta?.changes) return error(404, 'No existe esa oferta.');
  await sentenciaVersion(env).run();
  return json({ ok: true });
});

export const onRequestDelete = manejar(async ({ params, env }) => {
  await env.DB.batch([env.DB.prepare('DELETE FROM ofertas WHERE id = ?').bind(String(params.id)), sentenciaVersion(env)]);
  return json({ ok: true });
});

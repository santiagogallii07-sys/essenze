// GET / PUT / PATCH / DELETE /api/admin/perfumes/:id
import { manejar, json, error, leerJSON, sentenciaVersion } from '../../../../lib/util.js';
import { limpiarPerfume, sentenciaGuardar, filaAPerfume } from '../../../../lib/perfumes.js';
import { asegurarEsquema } from '../../../../lib/esquema.js';

async function buscar(env, id) {
  return filaAPerfume(await env.DB.prepare('SELECT * FROM perfumes WHERE id = ?').bind(id).first());
}

export const onRequestGet = manejar(async ({ params, env }) => {
  const p = await buscar(env, String(params.id));
  return p ? json(p) : error(404, 'No existe ese perfume.');
});

// Reemplazo completo desde el editor.
export const onRequestPut = manejar(async ({ params, request, env }) => {
  const actual = await buscar(env, String(params.id));
  if (!actual) return error(404, 'No existe ese perfume.');
  const p = limpiarPerfume({ ...(await leerJSON(request)), id: actual.id });
  await env.DB.batch([sentenciaGuardar(env, p), sentenciaVersion(env)]);
  return json({ ok: true, id: p.id });
});

// Cambios rápidos desde la lista: visible, destacado, stock/precio de un tamaño.
export const onRequestPatch = manejar(async ({ params, request, env }) => {
  const actual = await buscar(env, String(params.id));
  if (!actual) return error(404, 'No existe ese perfume.');
  const cambios = await leerJSON(request, 20_000);
  const p = { ...actual };
  if ('visible' in cambios) p.visible = !!cambios.visible;
  if ('destacado' in cambios) p.destacado = !!cambios.destacado;
  if ('revisar' in cambios) p.revisar = '';
  if (Array.isArray(cambios.presentaciones)) p.presentaciones = cambios.presentaciones;
  const limpio = limpiarPerfume(p);
  await env.DB.batch([sentenciaGuardar(env, limpio), sentenciaVersion(env)]);
  return json({ ok: true, perfume: limpio });
});

export const onRequestDelete = manejar(async ({ params, env }) => {
  await asegurarEsquema(env);
  const actual = await buscar(env, String(params.id));
  if (!actual) return error(404, 'No existe ese perfume.');
  const fotos = [actual.imagen, ...actual.imagenes].filter(Boolean);
  const sentencias = [env.DB.prepare('DELETE FROM perfumes WHERE id = ?').bind(actual.id), sentenciaVersion(env)];
  // Borra las fotos que solo usaba este perfume.
  for (const f of fotos) {
    sentencias.push(env.DB.prepare(
      `DELETE FROM imagenes WHERE id = ?1
       AND NOT EXISTS (SELECT 1 FROM perfumes WHERE imagen = ?1 OR imagenes LIKE '%"' || ?1 || '"%')
       AND NOT EXISTS (SELECT 1 FROM ofertas WHERE imagen = ?1 OR imagen_movil = ?1)`,
    ).bind(f));
  }
  await env.DB.batch(sentencias);
  return json({ ok: true });
});

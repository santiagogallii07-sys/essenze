// GET /api/admin/perfumes → todos (incluidos los ocultos) · POST → crear uno
import { manejar, json, jsonCrudo, error, leerJSON, sentenciaVersion } from '../../../../lib/util.js';
import { limpiarPerfume, sentenciaGuardar, listaJSON } from '../../../../lib/perfumes.js';

export const onRequestGet = manejar(async ({ env }) => jsonCrudo(await listaJSON(env, { soloVisibles: false, completa: true })));

export const onRequestPost = manejar(async ({ request, env }) => {
  const p = limpiarPerfume(await leerJSON(request));
  const existe = await env.DB.prepare('SELECT 1 FROM perfumes WHERE id = ?').bind(p.id).first();
  if (existe) return error(409, 'Ya existe un perfume con ese nombre. Cambiá el nombre o la concentración.');
  await env.DB.batch([sentenciaGuardar(env, p), sentenciaVersion(env)]);
  return json({ ok: true, id: p.id }, 201);
});

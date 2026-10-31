// GET /api/admin/eventos → lista de eventos de precios · POST {nombre} → crea uno nuevo (con la configuración de base)
import { manejar, json, error, leerJSON, idAleatorio, texto, sentenciaCambio } from '../../../../lib/util.js';
import { CONFIG_INICIAL, revisarEventos } from '../../../../lib/eventos.js';

export const onRequestGet = manejar(async ({ env }) => {
  await revisarEventos(env);
  const { results } = await env.DB.prepare(
    `SELECT id, nombre, desde, hasta, modo, estado, creado, activado, terminado, json_array_length(aplicado) AS precios
     FROM eventos ORDER BY CASE estado WHEN 'activo' THEN 0 WHEN 'programado' THEN 1 WHEN 'borrador' THEN 2 ELSE 3 END, creado DESC`,
  ).all();
  return json({ eventos: results });
});

export const onRequestPost = manejar(async ({ request, env }) => {
  const nombre = texto((await leerJSON(request, 2000)).nombre, 60);
  if (nombre.length < 2) return error(400, 'Ponele un nombre al evento (ej. Cyber Day).');
  const id = idAleatorio(10);
  await env.DB.batch([
    env.DB.prepare('INSERT INTO eventos (id, nombre, config) VALUES (?, ?, ?)').bind(id, nombre, JSON.stringify(CONFIG_INICIAL)),
    sentenciaCambio(env),
  ]);
  return json({ ok: true, id }, 201);
});

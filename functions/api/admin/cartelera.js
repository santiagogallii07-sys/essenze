// PUT /api/admin/cartelera {segundos, orden, prioridad, personajeDespuesDe} → cómo pasan los banners del inicio.
import { manejar, json, leerJSON, leerAjustes, limpiarCartelera, sentenciaVersion } from '../../../lib/util.js';

export const onRequestPut = manejar(async ({ request, env }) => {
  const valor = limpiarCartelera(await leerJSON(request, 4000));
  await env.DB.batch([
    env.DB.prepare("INSERT INTO ajustes (clave, valor) VALUES ('cartelera', ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor").bind(JSON.stringify(valor)),
    sentenciaVersion(env),
  ]);
  return json((await leerAjustes(env)).cartelera);
});

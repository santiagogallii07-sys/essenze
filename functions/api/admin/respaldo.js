// GET /api/admin/respaldo → descarga todos los datos (sin las fotos) en un archivo JSON.
import { manejar, hoyArgentina } from '../../../lib/util.js';

export const onRequestGet = manejar(async ({ env }) => {
  const tablas = ['perfumes', 'ofertas', 'pedidos', 'movimientos', 'ajustes'];
  const resultados = await env.DB.batch(tablas.map((t) => env.DB.prepare(`SELECT * FROM ${t}`)));
  const datos = { creado: new Date().toISOString(), ...Object.fromEntries(tablas.map((t, i) => [t, resultados[i].results])) };
  return new Response(JSON.stringify(datos), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="essenze-respaldo-${hoyArgentina()}.json"`,
    },
  });
});

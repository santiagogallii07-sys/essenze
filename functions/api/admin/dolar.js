// POST /api/admin/dolar → trae el dólar de hoy (del tipo elegido en Ajustes) y lo deja como el de esta semana.
import { manejar, json, error, leerAjustes } from '../../../lib/util.js';
import { fijarDolarDeHoy } from '../../../lib/dolar.js';

export const onRequestPost = manejar(async ({ env }) => {
  const { dolarFuente } = await leerAjustes(env);
  try {
    return json({ ok: true, cotizacion: await fijarDolarDeHoy(env, dolarFuente) });
  } catch {
    return error(502, 'No se pudo consultar el dólar en este momento. Probá en un rato.');
  }
});

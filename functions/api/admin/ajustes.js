// GET / PUT /api/admin/ajustes → datos de la tienda y cotización del dólar.
import { manejar, json, leerJSON, leerAjustes, texto, numero, sentenciaVersion, ErrorCliente } from '../../../lib/util.js';

export const onRequestGet = manejar(async ({ env }) => json(await leerAjustes(env)));

export const onRequestPut = manejar(async ({ request, env }) => {
  const d = await leerJSON(request, 5000);
  const whatsapp = String(d.whatsapp || '').replace(/\D/g, '');
  if (whatsapp.length < 10) throw new ErrorCliente(400, 'El WhatsApp tiene que tener código de país y área, ej. 5493512484272.');
  const valores = {
    whatsapp,
    ciudad: texto(d.ciudad, 80),
    instagram: texto(d.instagram, 60).replace(/^@/, ''),
    cotizacion: String(Math.max(0, numero(d.cotizacion, 0))),
    mostrar_ars: d.mostrarArs ? '1' : '0',
    comision_usd: String(Math.max(0, numero(d.comision, 3))),
  };
  await env.DB.batch([
    ...Object.entries(valores).map(([k, v]) =>
      env.DB.prepare('INSERT INTO ajustes (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor').bind(k, v)),
    sentenciaVersion(env),
  ]);
  return json(await leerAjustes(env));
});

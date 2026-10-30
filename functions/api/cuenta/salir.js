// POST /api/cuenta/salir → cierra la sesión del cliente.
import { manejar, json } from '../../../lib/util.js';
import { cerrarSesion } from '../../../lib/cuentas.js';
import { esHttps } from '../../../lib/sesion.js';

export const onRequestPost = manejar(async ({ request, env }) => {
  const cookie = await cerrarSesion(env, request, esHttps(request));
  return json({ ok: true }, 200, { 'Set-Cookie': cookie });
});

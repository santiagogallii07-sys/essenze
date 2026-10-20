// Protege todo /api/admin/*: exige sesión y, en los cambios, el encabezado propio del panel.
import { error } from '../../../lib/util.js';
import { sesionValida } from '../../../lib/sesion.js';

export async function onRequest(context) {
  const { request, env, next } = context;
  const ruta = new URL(request.url).pathname;
  const cambia = request.method !== 'GET' && request.method !== 'HEAD';

  // Defensa extra contra envíos desde otros sitios (además de la cookie SameSite=Strict).
  if (cambia && request.headers.get('X-Essenze') !== '1') return error(403, 'Solicitud no permitida.');
  if (ruta === '/api/admin/login') return next();

  try {
    if (!(await sesionValida(request, env))) return error(401, 'Tu sesión terminó. Volvé a entrar.');
  } catch (e) {
    return error(500, e.message);
  }
  const respuesta = await next();
  respuesta.headers.set('Cache-Control', 'no-store');
  return respuesta;
}

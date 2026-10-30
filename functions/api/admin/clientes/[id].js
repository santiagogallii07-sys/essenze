// PUT /api/admin/clientes/:id {contrasena} → contraseña nueva (para el cliente que se la olvidó; cierra sus sesiones).
// DELETE /api/admin/clientes/:id → borra la cuenta (sus pedidos quedan, sin cuenta).
import { manejar, json, error, leerJSON, sentenciaCambio } from '../../../../lib/util.js';
import { hashContrasena } from '../../../../lib/cuentas.js';

async function buscar(env, id) {
  return env.DB.prepare('SELECT id FROM clientes WHERE id = ?').bind(String(id)).first();
}

export const onRequestPut = manejar(async ({ params, request, env }) => {
  const c = await buscar(env, params.id);
  if (!c) return error(404, 'No existe esa cuenta.');
  const contrasena = String((await leerJSON(request, 2000)).contrasena || '');
  if (contrasena.length < 6) return error(400, 'La contraseña tiene que tener al menos 6 letras o números.');
  await env.DB.batch([
    env.DB.prepare('UPDATE clientes SET clave = ? WHERE id = ?').bind(await hashContrasena(contrasena), c.id),
    env.DB.prepare('DELETE FROM sesiones_clientes WHERE cliente = ?').bind(c.id),
  ]);
  return json({ ok: true });
});

export const onRequestDelete = manejar(async ({ params, env }) => {
  const c = await buscar(env, params.id);
  if (!c) return error(404, 'No existe esa cuenta.');
  await env.DB.batch([
    env.DB.prepare('UPDATE pedidos SET cliente = NULL WHERE cliente = ?').bind(c.id),
    env.DB.prepare('DELETE FROM sesiones_clientes WHERE cliente = ?').bind(c.id),
    env.DB.prepare('DELETE FROM clientes WHERE id = ?').bind(c.id),
    sentenciaCambio(env),
  ]);
  return json({ ok: true });
});

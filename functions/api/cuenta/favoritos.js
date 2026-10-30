// PUT /api/cuenta/favoritos {favoritos: [ids]} → guarda los favoritos en la cuenta (se ven en cualquier celular o compu).
import { manejar, json, error, leerJSON } from '../../../lib/util.js';
import { clienteDeSesion } from '../../../lib/cuentas.js';

export const onRequestPut = manejar(async ({ request, env }) => {
  const c = await clienteDeSesion(env, request);
  if (!c) return error(401, 'Tu sesión terminó. Volvé a ingresar.');
  const d = await leerJSON(request, 20_000);
  const favoritos = Array.isArray(d.favoritos) ? [...new Set(d.favoritos.filter((x) => typeof x === 'string' && x.length <= 100))].slice(0, 60) : [];
  await env.DB.prepare('UPDATE clientes SET favoritos = ? WHERE id = ?').bind(JSON.stringify(favoritos), c.id).run();
  return json({ ok: true });
});

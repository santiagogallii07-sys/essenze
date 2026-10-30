// GET /api/cuenta → la cuenta abierta (o null): datos, puntos, pedidos y favoritos.
import { manejar, json } from '../../../lib/util.js';
import { asegurarEsquema } from '../../../lib/esquema.js';
import { clienteDeSesion, puntosDe } from '../../../lib/cuentas.js';

export const onRequestGet = manejar(async ({ request, env }) => {
  await asegurarEsquema(env);
  const c = await clienteDeSesion(env, request);
  if (!c) return json({ cuenta: null });
  const [puntos, { results: pedidos }] = await Promise.all([
    puntosDe(env, c.id),
    env.DB.prepare(
      `SELECT numero, creado, estado, items, total FROM pedidos WHERE cliente = ? AND estado != 'cancelado'
       ORDER BY creado DESC LIMIT 50`,
    ).bind(c.id).all(),
  ]);
  return json({
    cuenta: { email: c.email, nombre: c.nombre, telefono: c.telefono, creado: c.creado, puntos },
    favoritos: JSON.parse(c.favoritos || '[]'),
    pedidos: pedidos.map((p) => ({
      numero: p.numero,
      creado: p.creado,
      estado: p.estado,
      total: p.total,
      items: JSON.parse(p.items || '[]').map((i) => ({ id: i.id, marca: i.marca, nombre: i.nombre, ml: i.ml, cantidad: i.cantidad })),
    })),
  });
});

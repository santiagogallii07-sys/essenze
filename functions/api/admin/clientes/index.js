// GET /api/admin/clientes?q= → cuentas de clientes con sus pedidos y puntos.
import { manejar, json, texto } from '../../../../lib/util.js';

export const onRequestGet = manejar(async ({ request, env }) => {
  const q = texto(new URL(request.url).searchParams.get('q'), 80);
  const where = q ? 'WHERE c.email LIKE ? OR c.nombre LIKE ?' : '';
  const { results } = await env.DB.prepare(
    `SELECT c.id, c.email, c.nombre, c.creado, c.ultimo_ingreso,
       json_array_length(c.favoritos) AS favoritos,
       (SELECT count(*) FROM pedidos p WHERE p.cliente = c.id AND p.estado != 'cancelado') AS pedidos,
       (SELECT COALESCE(SUM(ROUND(COALESCE(p.cobrado, p.total))), 0) FROM pedidos p WHERE p.cliente = c.id AND p.estado IN ('cobrado', 'entregado')) AS puntos
     FROM clientes c ${where} ORDER BY c.creado DESC LIMIT 500`,
  ).bind(...(q ? [`%${q}%`, `%${q}%`] : [])).all();
  const { total } = await env.DB.prepare('SELECT count(*) AS total FROM clientes').first();
  return json({ clientes: results, total });
});

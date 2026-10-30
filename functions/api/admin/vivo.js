// GET /api/admin/vivo → contador de cambios y pedidos nuevos. El panel abierto pregunta cada 5 segundos:
// si alguien (el otro dueño, un cliente que mandó un pedido) cambió algo, la pantalla se actualiza sola.
import { manejar, json } from '../../../lib/util.js';

export const onRequestGet = manejar(async ({ env }) => {
  const [cambios, nuevos] = await Promise.all([
    env.DB.prepare("SELECT valor FROM ajustes WHERE clave = 'cambios'").first('valor'),
    env.DB.prepare("SELECT count(*) AS n FROM pedidos WHERE estado = 'nuevo'").first('n'),
  ]);
  return json({ cambios: Number(cambios) || 0, nuevos: Number(nuevos) || 0 });
});

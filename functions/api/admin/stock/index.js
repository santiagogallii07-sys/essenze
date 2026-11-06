// GET /api/admin/stock → perfumes fuera del catálogo con stock y las últimas compras
//   (el stock del catálogo lo trae el panel con la lista liviana de perfumes)
// PUT {id, ml, stock} → cambiar a mano el stock de un tamaño del catálogo
import { manejar, json, error, leerJSON, texto, numero, sentenciaVersion } from '../../../../lib/util.js';
import { asegurarEsquema } from '../../../../lib/esquema.js';

export const onRequestGet = manejar(async ({ env }) => {
  await asegurarEsquema(env);
  const [{ results: libres }, { results: compras }] = await Promise.all([
    env.DB.prepare('SELECT * FROM stock_libre ORDER BY marca, nombre, ml').all(),
    env.DB.prepare('SELECT * FROM compras ORDER BY fecha DESC, creado DESC LIMIT 15').all(),
  ]);
  return json({ libres, compras: compras.map((c) => ({ ...c, items: JSON.parse(c.items || '[]') })) });
});

export const onRequestPut = manejar(async ({ request, env }) => {
  const d = await leerJSON(request, 2000);
  const id = texto(d.id, 100);
  const ml = Math.round(numero(d.ml, -1));
  const fila = await env.DB.prepare('SELECT presentaciones FROM perfumes WHERE id = ?').bind(id).first();
  if (!fila) return error(404, 'No existe ese perfume.');
  const pres = JSON.parse(fila.presentaciones || '[]');
  const x = pres.find((p) => p.ml === ml);
  if (!x) return error(404, 'Ese perfume no tiene ese tamaño.');
  x.stock = Math.max(0, Math.round(numero(d.stock, 0)));
  // Cambia "Entrega inmediata" en la tienda: se sube la versión para que se actualice.
  await env.DB.batch([
    env.DB.prepare("UPDATE perfumes SET presentaciones = ?, actualizado = datetime('now') WHERE id = ?").bind(JSON.stringify(pres), id),
    sentenciaVersion(env),
  ]);
  return json({ ok: true, stock: x.stock });
});

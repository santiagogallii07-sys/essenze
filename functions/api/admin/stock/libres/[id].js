// PUT /api/admin/stock/libres/:id {marca, nombre, ml, cantidad, costo} → editar un perfume fuera del catálogo
// DELETE → sacarlo de la lista de stock
import { manejar, json, error, leerJSON, texto, numero, sentenciaCambio } from '../../../../../lib/util.js';

export const onRequestPut = manejar(async ({ params, request, env }) => {
  const actual = await env.DB.prepare('SELECT * FROM stock_libre WHERE id = ?').bind(String(params.id)).first();
  if (!actual) return error(404, 'No existe ese perfume.');
  const d = await leerJSON(request, 3000);
  const nombre = d.nombre === undefined ? actual.nombre : texto(d.nombre, 120);
  if (nombre.length < 2) return error(400, 'Escribí el nombre del perfume.');
  const costo = d.costo === undefined ? actual.costo : d.costo === '' || d.costo === null ? null : Math.max(0, numero(d.costo, 0));
  await env.DB.batch([
    env.DB.prepare("UPDATE stock_libre SET marca = ?, nombre = ?, ml = ?, cantidad = ?, costo = ?, actualizado = datetime('now') WHERE id = ?").bind(
      d.marca === undefined ? actual.marca : texto(d.marca, 80),
      nombre,
      d.ml === undefined ? actual.ml : Math.max(0, Math.round(numero(d.ml, 0))),
      d.cantidad === undefined ? actual.cantidad : Math.max(0, Math.round(numero(d.cantidad, 0))),
      costo,
      actual.id,
    ),
    sentenciaCambio(env),
  ]);
  return json({ ok: true });
});

export const onRequestDelete = manejar(async ({ params, env }) => {
  await env.DB.batch([env.DB.prepare('DELETE FROM stock_libre WHERE id = ?').bind(String(params.id)), sentenciaCambio(env)]);
  return json({ ok: true });
});

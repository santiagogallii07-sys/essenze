// POST /api/admin/descuentos → aplica o quita un % de descuento a una marca, un tipo o perfumes elegidos.
// Aplicar: el precio actual pasa a "precio anterior" (tachado) y el nuevo precio queda con el descuento.
// Quitar: vuelve el precio anterior.
import { manejar, json, leerJSON, numero, texto, sentenciaVersion, ErrorCliente } from '../../../lib/util.js';

export const onRequestPost = manejar(async ({ request, env }) => {
  const d = await leerJSON(request, 200_000);
  const accion = d.accion === 'quitar' ? 'quitar' : 'aplicar';
  const porcentaje = numero(d.porcentaje, 0);
  if (accion === 'aplicar' && (porcentaje <= 0 || porcentaje >= 90)) throw new ErrorCliente(400, 'El descuento tiene que estar entre 1% y 89%.');

  const condiciones = [];
  const valores = [];
  if (d.marca) { condiciones.push('marca = ?'); valores.push(texto(d.marca, 80)); }
  if (d.tipo) { condiciones.push('tipo = ?'); valores.push(texto(d.tipo, 40)); }
  if (Array.isArray(d.ids) && d.ids.length) { condiciones.push('id IN (SELECT value FROM json_each(?))'); valores.push(JSON.stringify(d.ids.slice(0, 2000))); }
  if (!condiciones.length) throw new ErrorCliente(400, 'Elegí una marca, un tipo o perfumes.');

  const { results } = await env.DB.prepare(`SELECT id, presentaciones FROM perfumes WHERE ${condiciones.join(' AND ')}`).bind(...valores).all();
  const sentencias = [];
  for (const fila of results) {
    const pres = JSON.parse(fila.presentaciones || '[]').map((x) => {
      const base = x.precioAnterior && x.precioAnterior > x.precio ? x.precioAnterior : x.precio;
      if (accion === 'quitar') return { ...x, precio: base, precioAnterior: null };
      return { ...x, precio: Math.max(1, Math.round(base * (1 - porcentaje / 100))), precioAnterior: base };
    });
    sentencias.push(env.DB.prepare("UPDATE perfumes SET presentaciones = ?, actualizado = datetime('now') WHERE id = ?").bind(JSON.stringify(pres), fila.id));
  }
  for (let i = 0; i < sentencias.length; i += 100) await env.DB.batch(sentencias.slice(i, i + 100));
  await sentenciaVersion(env).run();
  return json({ ok: true, perfumes: results.length });
});

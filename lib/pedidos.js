// Efectos de cobrar o anular un pedido: movimiento de caja, stock y costo de lo vendido.
import { idAleatorio, hoyArgentina } from './util.js';

export const ESTADOS = ['nuevo', 'confirmado', 'cobrado', 'entregado', 'cancelado'];
export const estaCobrado = (estado) => estado === 'cobrado' || estado === 'entregado';

export function filaAPedido(f) {
  return { ...f, items: JSON.parse(f.items || '[]') };
}

// Devuelve las sentencias para pasar un pedido a cobrado (cobrar=true) o deshacer el cobro (cobrar=false).
export async function sentenciasCobro(env, pedido, cobrar, { monto, metodo, fecha } = {}) {
  const ids = [...new Set(pedido.items.map((i) => i.id))];
  const { results } = ids.length
    ? await env.DB.prepare('SELECT id, presentaciones FROM perfumes WHERE id IN (SELECT value FROM json_each(?))').bind(JSON.stringify(ids)).all()
    : { results: [] };
  const perfumes = new Map(results.map((r) => [r.id, JSON.parse(r.presentaciones || '[]')]));

  const sentencias = [];
  let costoTotal = 0;
  for (const item of pedido.items) {
    const pres = perfumes.get(item.id);
    const p = pres?.find((x) => x.ml === item.ml);
    const costo = p?.costo ?? item.costo ?? null;
    if (costo !== null) costoTotal += costo * item.cantidad;
    if (p && p.stock !== null && p.stock !== undefined) {
      p.stock = Math.max(0, p.stock + (cobrar ? -item.cantidad : item.cantidad));
    }
  }
  for (const [id, pres] of perfumes) {
    sentencias.push(env.DB.prepare("UPDATE perfumes SET presentaciones = ?, actualizado = datetime('now') WHERE id = ?").bind(JSON.stringify(pres), id));
  }

  if (cobrar) {
    const importe = monto ?? pedido.total;
    const dia = fecha || hoyArgentina();
    sentencias.push(env.DB.prepare(
      `INSERT INTO movimientos (id, fecha, tipo, categoria, descripcion, monto, moneda, pedido)
       VALUES (?, ?, 'ingreso', 'Venta', ?, ?, 'USD', ?)`,
    ).bind(idAleatorio(12), dia, `Pedido ${pedido.id}${pedido.nombre ? ` · ${pedido.nombre}` : ''}`, importe, pedido.id));
    sentencias.push(env.DB.prepare(
      'UPDATE pedidos SET cobrado = ?, costo_total = ?, metodo_pago = ?, cobrado_en = ? WHERE id = ?',
    ).bind(importe, Math.round(costoTotal * 100) / 100, metodo || pedido.metodo_pago || '', dia, pedido.id));
  } else {
    sentencias.push(env.DB.prepare('DELETE FROM movimientos WHERE pedido = ?').bind(pedido.id));
    sentencias.push(env.DB.prepare('UPDATE pedidos SET cobrado = NULL, costo_total = 0, cobrado_en = NULL WHERE id = ?').bind(pedido.id));
  }
  return sentencias;
}

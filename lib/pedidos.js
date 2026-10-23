// Efectos de cobrar o anular un pedido: movimientos de caja (venta y comisión), stock y costo de lo vendido.
import { idAleatorio, hoyArgentina, leerAjustes } from './util.js';

export const ESTADOS = ['nuevo', 'confirmado', 'cobrado', 'entregado', 'cancelado'];
export const estaCobrado = (estado) => estado === 'cobrado' || estado === 'entregado';

export function filaAPedido(f) {
  return { ...f, items: JSON.parse(f.items || '[]') };
}

const redondear = (n) => Math.round(n * 100) / 100;

/**
 * Sentencias para pasar un pedido a cobrado (cobrar=true) o deshacer el cobro (cobrar=false).
 * El cobro se puede informar en pesos (montoArs) o en dólares (monto). Siempre se guarda el dólar del día
 * para que la caja muestre los pesos reales de ese momento.
 */
export async function sentenciasCobro(env, pedido, cobrar, { monto, montoArs, metodo, fecha } = {}) {
  const ids = [...new Set(pedido.items.map((i) => i.id).filter(Boolean))];
  const { results } = ids.length
    ? await env.DB.prepare('SELECT id, presentaciones FROM perfumes WHERE id IN (SELECT value FROM json_each(?))').bind(JSON.stringify(ids)).all()
    : { results: [] };
  const perfumes = new Map(results.map((r) => [r.id, JSON.parse(r.presentaciones || '[]')]));

  const sentencias = [];
  let costoTotal = 0;
  let unidades = 0;
  for (const item of pedido.items) {
    unidades += item.cantidad;
    const pres = perfumes.get(item.id);
    const p = pres?.find((x) => x.ml === item.ml);
    const costo = item.costoManual ? item.costo : p?.costo ?? item.costo ?? null;
    if (costo !== null) costoTotal += costo * item.cantidad;
    if (p && p.stock !== null && p.stock !== undefined) {
      p.stock = Math.max(0, p.stock + (cobrar ? -item.cantidad : item.cantidad));
    }
  }
  for (const [id, pres] of perfumes) {
    sentencias.push(env.DB.prepare("UPDATE perfumes SET presentaciones = ?, actualizado = datetime('now') WHERE id = ?").bind(JSON.stringify(pres), id));
  }

  if (cobrar) {
    const ajustes = await leerAjustes(env);
    const dolar = ajustes.cotizacion || null;
    const dia = fecha || hoyArgentina();
    const enPesos = montoArs !== undefined && montoArs !== null && dolar;
    const importeUsd = enPesos ? redondear(montoArs / dolar) : monto ?? pedido.total;
    const detalle = `Pedido ${pedido.id}${pedido.nombre ? ` · ${pedido.nombre}` : ''}`;
    sentencias.push(env.DB.prepare(
      `INSERT INTO movimientos (id, fecha, tipo, categoria, descripcion, monto, moneda, monto_original, cotizacion, pedido)
       VALUES (?, ?, 'ingreso', 'Venta', ?, ?, ?, ?, ?, ?)`,
    ).bind(idAleatorio(12), dia, detalle, importeUsd, enPesos ? 'ARS' : 'USD', enPesos ? montoArs : null, dolar, pedido.id));
    // Comisión del pasante: un monto fijo por perfume vendido, como gasto del mismo pedido.
    if (ajustes.comision > 0 && unidades > 0) {
      sentencias.push(env.DB.prepare(
        `INSERT INTO movimientos (id, fecha, tipo, categoria, descripcion, monto, moneda, cotizacion, pedido)
         VALUES (?, ?, 'egreso', 'Comisiones', ?, ?, 'USD', ?, ?)`,
      ).bind(idAleatorio(12), dia, `Comisión pasante · ${unidades} ${unidades === 1 ? 'perfume' : 'perfumes'} · ${pedido.id}`, redondear(ajustes.comision * unidades), dolar, pedido.id));
    }
    sentencias.push(env.DB.prepare(
      'UPDATE pedidos SET cobrado = ?, costo_total = ?, metodo_pago = ?, cobrado_en = ? WHERE id = ?',
    ).bind(importeUsd, redondear(costoTotal), metodo || pedido.metodo_pago || '', dia, pedido.id));
  } else {
    sentencias.push(env.DB.prepare('DELETE FROM movimientos WHERE pedido = ?').bind(pedido.id));
    sentencias.push(env.DB.prepare('UPDATE pedidos SET cobrado = NULL, costo_total = 0, cobrado_en = NULL WHERE id = ?').bind(pedido.id));
  }
  return sentencias;
}

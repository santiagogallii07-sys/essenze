// Efectos de cobrar, anular o editar un pedido: movimientos de caja (venta, comisión y costo), stock,
// costo de lo vendido y el "último costo" de cada perfume (memoria para la próxima venta).
import { idAleatorio, hoyArgentina, leerAjustes, texto, numero } from './util.js';

export const ESTADOS = ['nuevo', 'confirmado', 'cobrado', 'entregado', 'cancelado'];
export const estaCobrado = (estado) => estado === 'cobrado' || estado === 'entregado';

export function filaAPedido(f) {
  return { ...f, items: JSON.parse(f.items || '[]') };
}

const redondear = (n) => Math.round(n * 100) / 100;
const vacio = (v) => v === undefined || v === null || v === '';
const positivo = (v) => Math.max(0, numero(v, 0));

/**
 * Arma los ítems de una venta cargada en el panel. Precio y costo pueden venir en pesos (precioArs, costoArs,
 * convertidos con `dolar`) o en dólares (precio, costo); siempre se guardan en dólares y se recuerdan los pesos tal cual.
 * Al editar, `anteriores` son los ítems guardados y cada línea indica de cuál viene (`origen`): si el perfume ya no
 * existe se conserva lo guardado, y un costo sin cambios mantiene si iba o no a la caja.
 * Devuelve también `recordar`: los costos nuevos o cambiados, para guardarlos como último costo del perfume.
 */
export async function armarItems(env, entrada, dolar, anteriores = []) {
  const lista = Array.isArray(entrada) ? entrada.slice(0, 40) : [];
  const ids = [...new Set(lista.map((i) => texto(i.id, 100)).filter(Boolean))];
  const { results } = ids.length
    ? await env.DB.prepare('SELECT id, marca, nombre, concentracion, presentaciones FROM perfumes WHERE id IN (SELECT value FROM json_each(?))').bind(JSON.stringify(ids)).all()
    : { results: [] };
  const porId = new Map(results.map((r) => [r.id, { ...r, presentaciones: JSON.parse(r.presentaciones || '[]') }]));

  const items = [];
  const recordar = new Map();
  for (const i of lista) {
    const previo = Number.isInteger(i.origen) ? anteriores[i.origen] ?? null : null;
    const p = porId.get(texto(i.id, 100));
    const ml = Math.round(numero(i.ml, -1));
    const pres = p?.presentaciones.find((x) => x.ml === ml);
    let base = null;
    if (p && pres) base = { id: p.id, marca: p.marca, nombre: p.nombre, concentracion: p.concentracion, ml };
    else if (previo) base = { id: previo.id ?? null, marca: previo.marca || '', nombre: previo.nombre, concentracion: previo.concentracion || '', ml: previo.ml ?? 0 };
    if (!base) continue;

    const cantidad = Math.max(1, Math.round(numero(i.cantidad, 1)));
    let precio = pres?.precio ?? previo?.precio ?? 0;
    let precioArs = null;
    if (dolar && !vacio(i.precioArs)) {
      precioArs = positivo(i.precioArs);
      precio = redondear(precioArs / dolar);
    } else if (!vacio(i.precio)) {
      precio = positivo(i.precio);
    }

    let costo;
    let costoArs = null;
    let costoManual = false;
    if (dolar && !vacio(i.costoArs)) {
      costoArs = positivo(i.costoArs);
      costo = redondear(costoArs / dolar);
      costoManual = true;
    } else if (!vacio(i.costo)) {
      costo = positivo(i.costo);
      costoManual = true;
    } else {
      // Sin costo: en una venta nueva vale el último costo del perfume (no va a la caja); al editar, se borró.
      costo = previo ? null : pres?.costo ?? null;
    }
    const cambio = !previo || previo.costo === null || previo.costo === undefined || Math.abs((costo ?? 0) - previo.costo) >= 0.005;
    if (previo && costoManual && !cambio) costoManual = !!previo.costoManual;
    if (costoManual && pres && cambio) recordar.set(`${base.id}|${ml}`, costo);

    items.push({
      ...base,
      cantidad,
      precio,
      ...(precioArs !== null ? { precioArs } : {}),
      costo,
      ...(costoArs !== null ? { costoArs } : {}),
      costoManual,
    });
  }
  return { items, recordar };
}

/**
 * Sentencias para pasar un pedido a cobrado (cobrar=true) o deshacer el cobro (cobrar=false).
 * El cobro se puede informar en pesos (montoArs) o en dólares (monto). Se guarda el dólar de la venta
 * (cotizacion, o el de Ajustes) para que la caja muestre los pesos reales de ese momento.
 * Al editar una venta ya cobrada, `anterior` es la versión guardada: primero se deshace (stock y caja) y se vuelve a cobrar.
 * comisionArs / comision: comisión total a mano (si no, la fija por perfume de Ajustes).
 * recordar: Map "perfume|ml" → costo en dólares, que queda como último costo del perfume.
 */
export async function sentenciasCobro(env, pedido, cobrar, { monto, montoArs, metodo, fecha, cotizacion, comisionArs, comision, anterior = null, recordar = null } = {}) {
  const ids = [...new Set([...pedido.items, ...(anterior?.items || [])].map((i) => i.id).filter(Boolean))];
  const { results } = ids.length
    ? await env.DB.prepare('SELECT id, presentaciones FROM perfumes WHERE id IN (SELECT value FROM json_each(?))').bind(JSON.stringify(ids)).all()
    : { results: [] };
  const perfumes = new Map(results.map((r) => [r.id, JSON.parse(r.presentaciones || '[]')]));
  const presDe = (item) => perfumes.get(item.id)?.find((x) => x.ml === item.ml);
  const moverStock = (item, cantidad) => {
    const p = presDe(item);
    if (p && p.stock !== null && p.stock !== undefined) p.stock = Math.max(0, p.stock + cantidad);
  };

  const sentencias = [];
  if (anterior) {
    for (const item of anterior.items) moverStock(item, item.cantidad);
    sentencias.push(env.DB.prepare('DELETE FROM movimientos WHERE pedido = ?').bind(anterior.id));
  }

  let costoTotal = 0;
  let unidades = 0;
  for (const item of pedido.items) {
    unidades += item.cantidad;
    const p = presDe(item);
    const costo = item.costoManual ? item.costo : p?.costo ?? item.costo ?? null;
    if (costo !== null && costo !== undefined) costoTotal += costo * item.cantidad;
    moverStock(item, cobrar ? -item.cantidad : item.cantidad);
  }
  if (recordar) {
    for (const [clave, costo] of recordar) {
      const [id, ml] = clave.split('|');
      const p = perfumes.get(id)?.find((x) => x.ml === Number(ml));
      if (p) p.costo = costo;
    }
  }
  for (const [id, pres] of perfumes) {
    sentencias.push(env.DB.prepare("UPDATE perfumes SET presentaciones = ?, actualizado = datetime('now') WHERE id = ?").bind(JSON.stringify(pres), id));
  }

  if (cobrar) {
    const ajustes = await leerAjustes(env);
    const dolar = cotizacion || ajustes.cotizacion || null;
    const dia = fecha || hoyArgentina();
    // Sin total a mano: si los precios se cargaron en pesos, se cobra la suma exacta en pesos.
    if (vacio(montoArs) && vacio(monto) && dolar && pedido.items.every((i) => !vacio(i.precioArs))) {
      montoArs = pedido.items.reduce((n, i) => n + i.precioArs * i.cantidad, 0);
    }
    const enPesos = !vacio(montoArs) && dolar;
    const importeUsd = enPesos ? redondear(montoArs / dolar) : monto ?? pedido.total;
    const nombre = pedido.nombre ? ` · ${pedido.nombre}` : '';
    sentencias.push(env.DB.prepare(
      `INSERT INTO movimientos (id, fecha, tipo, categoria, descripcion, monto, moneda, monto_original, cotizacion, pedido)
       VALUES (?, ?, 'ingreso', 'Venta', ?, ?, ?, ?, ?, ?)`,
    ).bind(idAleatorio(12), dia, `Pedido ${pedido.id}${nombre}`, importeUsd, enPesos ? 'ARS' : 'USD', enPesos ? montoArs : null, dolar, pedido.id));

    // Comisión del pasante: a mano (al editar) o un monto fijo por perfume vendido, como gasto del mismo pedido.
    const detalleComision = `Comisión pasante · ${unidades} ${unidades === 1 ? 'perfume' : 'perfumes'} · ${pedido.id}`;
    if (!vacio(comisionArs) && dolar) {
      const ars = positivo(comisionArs);
      if (ars > 0) {
        sentencias.push(env.DB.prepare(
          `INSERT INTO movimientos (id, fecha, tipo, categoria, descripcion, monto, moneda, monto_original, cotizacion, pedido)
           VALUES (?, ?, 'egreso', 'Comisiones', ?, ?, 'ARS', ?, ?, ?)`,
        ).bind(idAleatorio(12), dia, detalleComision, redondear(ars / dolar), ars, dolar, pedido.id));
      }
    } else {
      const usd = !vacio(comision) ? positivo(comision) : ajustes.comision > 0 ? ajustes.comision * unidades : 0;
      if (usd > 0 && unidades > 0) {
        sentencias.push(env.DB.prepare(
          `INSERT INTO movimientos (id, fecha, tipo, categoria, descripcion, monto, moneda, cotizacion, pedido)
           VALUES (?, ?, 'egreso', 'Comisiones', ?, ?, 'USD', ?, ?)`,
        ).bind(idAleatorio(12), dia, detalleComision, redondear(usd), dolar, pedido.id));
      }
    }

    // El costo cargado a mano se registra como gasto del mismo pedido (si se anula la venta, se borra junto).
    let costoCaja = 0;
    for (const i of pedido.items) {
      if (!i.costoManual || i.costo === null || i.costo === undefined) continue;
      costoCaja += (dolar ? i.costoArs ?? i.costo * dolar : i.costo) * i.cantidad;
    }
    if (costoCaja > 0) {
      sentencias.push(env.DB.prepare(
        `INSERT INTO movimientos (id, fecha, tipo, categoria, descripcion, monto, moneda, monto_original, cotizacion, pedido)
         VALUES (?, ?, 'egreso', 'Costo de mercadería', ?, ?, ?, ?, ?, ?)`,
      ).bind(idAleatorio(12), dia, `Costo · ${pedido.id}${nombre}`, redondear(dolar ? costoCaja / dolar : costoCaja), dolar ? 'ARS' : 'USD', dolar ? redondear(costoCaja) : null, dolar, pedido.id));
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

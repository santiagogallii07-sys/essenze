// Stock: compras de mercadería (suman stock, dejan el último costo y van a la caja o a Deudas)
// y el stock de perfumes que no están en el catálogo (tabla stock_libre).
import { idAleatorio, texto, numero, hoyArgentina, leerAjustes, ErrorCliente } from './util.js';

const redondear = (n) => Math.round(n * 100) / 100;
const clave = (marca, nombre, ml) => `${marca} ${nombre} ${ml}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

/**
 * Registra una compra. d = {fecha, proveedor, moneda ('USD'|'ARS'), pago ('pagado'|'deuda'|'sin_caja'), metodo, items}
 * items: [{id, ml, cantidad, costo}] del catálogo, o [{libre: true, stockLibre?, marca, nombre, ml, cantidad, costo}];
 * el costo viene en la moneda de la compra y se guarda en dólares como último costo.
 * Devuelve las sentencias (para un solo batch) y si cambió el stock del catálogo (para avisar a la tienda).
 */
export async function sentenciasCompra(env, d) {
  const moneda = d.moneda === 'ARS' ? 'ARS' : 'USD';
  const dolar = (await leerAjustes(env)).cotizacion;
  if (moneda === 'ARS' && !dolar) throw new ErrorCliente(400, 'Cargá la cotización del dólar en Ajustes.');
  const aUsd = (n) => (moneda === 'ARS' ? redondear(n / dolar) : redondear(n));
  const entrada = Array.isArray(d.items) ? d.items.slice(0, 80) : [];
  if (!entrada.length) throw new ErrorCliente(400, 'Agregá al menos un perfume a la compra.');

  const ids = [...new Set(entrada.filter((i) => !i.libre).map((i) => texto(i.id, 100)).filter(Boolean))];
  const { results } = ids.length
    ? await env.DB.prepare('SELECT id, marca, nombre, presentaciones FROM perfumes WHERE id IN (SELECT value FROM json_each(?))').bind(JSON.stringify(ids)).all()
    : { results: [] };
  const perfumes = new Map(results.map((r) => [r.id, { ...r, presentaciones: JSON.parse(r.presentaciones || '[]') }]));
  const { results: libres } = await env.DB.prepare('SELECT * FROM stock_libre').all();
  const porClave = new Map(libres.map((l) => [clave(l.marca, l.nombre, l.ml), l]));
  const porIdLibre = new Map(libres.map((l) => [l.id, l]));

  const sentencias = [];
  const items = [];
  let total = 0;
  for (const i of entrada) {
    const cantidad = Math.max(1, Math.round(numero(i.cantidad, 1)));
    const costoOriginal = i.costo === '' || i.costo === null || i.costo === undefined ? null : Math.max(0, numero(i.costo, 0));
    const costo = costoOriginal === null ? null : aUsd(costoOriginal);
    if (costoOriginal !== null) total += costoOriginal * cantidad;
    if (i.libre) {
      const nombre = texto(i.nombre, 120);
      if (nombre.length < 2) throw new ErrorCliente(400, 'Escribí el nombre de cada perfume que no está en el catálogo.');
      const marca = texto(i.marca, 80);
      const ml = Math.max(0, Math.round(numero(i.ml, 0)));
      // Si ya hay stock de ese mismo perfume fuera del catálogo, se suma ahí.
      let l = porIdLibre.get(texto(i.stockLibre, 40)) || porClave.get(clave(marca, nombre, ml));
      if (!l) {
        l = { id: idAleatorio(12), marca, nombre, ml, cantidad: 0, costo: null, nuevo: true };
        porClave.set(clave(marca, nombre, ml), l);
        porIdLibre.set(l.id, l);
      }
      items.push({ libre: true, stockLibre: l.id, marca: l.marca, nombre: l.nombre, ml: l.ml, cantidad, costo, costoAntes: l.costo ?? null });
      l.cantidad += cantidad;
      if (costo !== null) l.costo = costo;
      l.tocado = true;
    } else {
      const p = perfumes.get(texto(i.id, 100));
      const ml = Math.round(numero(i.ml, -1));
      const pres = p?.presentaciones.find((x) => x.ml === ml);
      if (!pres) continue;
      items.push({ id: p.id, marca: p.marca, nombre: p.nombre, ml, cantidad, costo, costoAntes: pres.costo ?? null });
      pres.stock = (Number(pres.stock) || 0) + cantidad;
      if (costo !== null) pres.costo = costo;
      p.tocado = true;
    }
  }
  if (!items.length) throw new ErrorCliente(400, 'Los perfumes elegidos no existen.');

  for (const p of perfumes.values()) {
    if (p.tocado) sentencias.push(env.DB.prepare("UPDATE perfumes SET presentaciones = ?, actualizado = datetime('now') WHERE id = ?").bind(JSON.stringify(p.presentaciones), p.id));
  }
  for (const l of porIdLibre.values()) {
    if (!l.tocado) continue;
    sentencias.push(l.nuevo
      ? env.DB.prepare('INSERT INTO stock_libre (id, marca, nombre, ml, cantidad, costo) VALUES (?, ?, ?, ?, ?, ?)').bind(l.id, l.marca, l.nombre, l.ml, l.cantidad, l.costo)
      : env.DB.prepare("UPDATE stock_libre SET cantidad = ?, costo = ?, actualizado = datetime('now') WHERE id = ?").bind(l.cantidad, l.costo, l.id));
  }

  const id = idAleatorio(12);
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(d.fecha || '') ? d.fecha : hoyArgentina();
  const proveedor = texto(d.proveedor, 120);
  const pago = ['deuda', 'sin_caja'].includes(d.pago) ? d.pago : 'pagado';
  total = redondear(total);
  const unidades = items.reduce((n, i) => n + i.cantidad, 0);
  const detalle = texto(`Compra${proveedor ? ` a ${proveedor}` : ''} · ${unidades} ${unidades === 1 ? 'perfume' : 'perfumes'}`, 200);
  if (pago === 'pagado' && total > 0) {
    const metodo = texto(d.metodo, 40);
    sentencias.push(env.DB.prepare(
      `INSERT INTO movimientos (id, fecha, tipo, categoria, descripcion, monto, moneda, monto_original, cotizacion, compra)
       VALUES (?, ?, 'egreso', 'Compra de mercadería', ?, ?, ?, ?, ?, ?)`,
    ).bind(idAleatorio(12), fecha, `${detalle}${metodo ? ` · ${metodo}` : ''}`, aUsd(total), moneda, moneda === 'ARS' ? total : null, dolar || null, id));
  }
  if (pago === 'deuda' && total > 0) {
    sentencias.push(env.DB.prepare(
      "INSERT INTO deudas (id, tipo, compra, nombre, concepto, moneda, monto, fecha) VALUES (?, 'pagar', ?, ?, ?, ?, ?, ?)",
    ).bind(idAleatorio(12), id, proveedor || 'Proveedor', detalle, moneda, total, fecha));
  }
  sentencias.push(env.DB.prepare('INSERT INTO compras (id, fecha, proveedor, items, moneda, total, pago) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, fecha, proveedor, JSON.stringify(items), moneda, total, pago));
  return { id, sentencias, catalogo: items.some((i) => !i.libre) };
}

// Deshace una compra: resta el stock que sumó, vuelve el costo de antes (si nadie lo cambió después)
// y borra su gasto de la caja o su deuda (con los pagos de esa deuda).
export async function sentenciasDeshacerCompra(env, compra) {
  const items = JSON.parse(compra.items || '[]');
  const ids = [...new Set(items.filter((i) => !i.libre).map((i) => i.id))];
  const { results } = ids.length
    ? await env.DB.prepare('SELECT id, presentaciones FROM perfumes WHERE id IN (SELECT value FROM json_each(?))').bind(JSON.stringify(ids)).all()
    : { results: [] };
  const perfumes = new Map(results.map((r) => [r.id, JSON.parse(r.presentaciones || '[]')]));
  const sentencias = [];
  const libres = new Map();
  for (const i of items) {
    if (i.libre) {
      const l = libres.get(i.stockLibre) || { resta: 0, costo: undefined };
      l.resta += i.cantidad;
      l.costoAntes = i.costoAntes;
      l.costo = i.costo;
      libres.set(i.stockLibre, l);
      continue;
    }
    const pres = perfumes.get(i.id)?.find((x) => x.ml === i.ml);
    if (!pres) continue;
    pres.stock = Math.max(0, (Number(pres.stock) || 0) - i.cantidad);
    if (i.costo !== null && Math.abs((pres.costo ?? -1) - i.costo) < 0.005) pres.costo = i.costoAntes;
  }
  for (const [id, pres] of perfumes) {
    sentencias.push(env.DB.prepare("UPDATE perfumes SET presentaciones = ?, actualizado = datetime('now') WHERE id = ?").bind(JSON.stringify(pres), id));
  }
  for (const [id, l] of libres) {
    sentencias.push(env.DB.prepare(
      `UPDATE stock_libre SET cantidad = MAX(0, cantidad - ?), costo = CASE WHEN ? IS NOT NULL AND abs(coalesce(costo, -1) - ?) < 0.005 THEN ? ELSE costo END, actualizado = datetime('now') WHERE id = ?`,
    ).bind(l.resta, l.costo ?? null, l.costo ?? 0, l.costoAntes ?? null, id));
  }
  sentencias.push(
    env.DB.prepare('DELETE FROM movimientos WHERE compra = ?').bind(compra.id),
    env.DB.prepare('DELETE FROM movimientos WHERE deuda IN (SELECT id FROM deudas WHERE compra = ?)').bind(compra.id),
    env.DB.prepare('DELETE FROM deudas WHERE compra = ?').bind(compra.id),
    env.DB.prepare('DELETE FROM compras WHERE id = ?').bind(compra.id),
  );
  return { sentencias, catalogo: ids.length > 0 };
}

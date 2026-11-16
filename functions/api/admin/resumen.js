// GET /api/admin/resumen?mes=AAAA-MM → números del tablero: caja del mes, 6 meses, pedidos y catálogo.
// Los montos salen en pesos (si hay dólar cargado); cada movimiento usa el dólar del día en que se registró.
// Las deudas cuentan en el mes en que se anotaron, completas: lo que les deben es ingreso (ya es plata ganada)
// y lo que deben ellos es egreso. Por eso los cobros y pagos de deudas no se vuelven a sumar.
import { manejar, json, hoyArgentina, leerAjustes } from '../../../lib/util.js';
import { asegurarEsquema } from '../../../lib/esquema.js';
import { PAGADO_SQL } from '../../../lib/deudas.js';

function mesesAtras(mes, n) {
  const [a, m] = mes.split('-').map(Number);
  const lista = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(a, m - 1 - i, 1));
    lista.push(d.toISOString().slice(0, 7));
  }
  return lista;
}

export const onRequestGet = manejar(async ({ request, env }) => {
  const pedido = new URL(request.url).searchParams.get('mes');
  const mes = /^\d{4}-\d{2}$/.test(pedido || '') ? pedido : hoyArgentina().slice(0, 7);
  const meses = mesesAtras(mes, 6);
  const DB = env.DB;
  await asegurarEsquema(env);
  const dolar = Number((await leerAjustes(env)).cotizacion) || 0;
  const moneda = dolar ? 'ARS' : 'USD';
  const M = dolar ? `(CASE WHEN m.moneda = 'ARS' THEN m.monto_original ELSE m.monto * COALESCE(m.cotizacion, ${dolar}) END)` : 'm.monto';
  // Deudas en la moneda del panel (las de pesos sin dólar cargado no se pueden pasar a dólares).
  const D = (x) => (dolar ? `(CASE WHEN d.moneda = 'ARS' THEN ${x} ELSE ${x} * ${dolar} END)` : `(CASE WHEN d.moneda = 'USD' THEN ${x} ELSE 0 END)`);
  const SIN_DEUDA = 'm.deuda IS NULL';
  const dolarPedido = dolar
    ? `COALESCE((SELECT v.cotizacion FROM movimientos v WHERE v.pedido = p.id AND v.categoria = 'Venta' LIMIT 1), ${dolar})`
    : '1';

  const [caja, historia, costo, categorias, estados, catalogo, stockBajo, masVendidos, ultimos, deudasMes, deudasHistoria, deudasCategorias] = await DB.batch([
    DB.prepare(`SELECT
        coalesce(sum(CASE WHEN m.tipo = 'ingreso' AND ${SIN_DEUDA} THEN ${M} END), 0) AS ingresos,
        coalesce(sum(CASE WHEN m.tipo = 'egreso' AND ${SIN_DEUDA} THEN ${M} END), 0) AS egresos,
        coalesce(sum(CASE WHEN m.tipo = 'ingreso' AND m.categoria = 'Venta' THEN ${M} END), 0) AS ventas,
        coalesce(sum(CASE WHEN m.tipo = 'egreso' AND m.categoria = 'Comisiones' THEN ${M} END), 0) AS comisiones
      FROM movimientos m WHERE substr(m.fecha, 1, 7) = ?`).bind(mes),
    DB.prepare(`SELECT substr(m.fecha, 1, 7) AS mes,
        coalesce(sum(CASE WHEN m.tipo = 'ingreso' AND ${SIN_DEUDA} THEN ${M} END), 0) AS ingresos,
        coalesce(sum(CASE WHEN m.tipo = 'egreso' AND ${SIN_DEUDA} THEN ${M} END), 0) AS egresos
      FROM movimientos m WHERE substr(m.fecha, 1, 7) BETWEEN ? AND ? GROUP BY 1`).bind(meses[0], meses.at(-1)),
    DB.prepare(`SELECT coalesce(sum(p.costo_total * ${dolarPedido}), 0) AS costo, count(*) AS cantidad,
        coalesce(sum((SELECT sum(json_extract(j.value, '$.cantidad')) FROM json_each(p.items) j)), 0) AS unidades
      FROM pedidos p WHERE p.estado IN ('cobrado', 'entregado') AND substr(p.cobrado_en, 1, 7) = ?`).bind(mes),
    DB.prepare(`SELECT m.categoria, sum(${M}) AS total FROM movimientos m
      WHERE m.tipo = 'egreso' AND ${SIN_DEUDA} AND substr(m.fecha, 1, 7) = ? GROUP BY m.categoria ORDER BY total DESC`).bind(mes),
    DB.prepare('SELECT estado, count(*) AS n FROM pedidos GROUP BY estado'),
    DB.prepare(`SELECT count(*) AS total, sum(visible) AS visibles,
        sum(CASE WHEN imagen IS NULL THEN 1 ELSE 0 END) AS sinFoto,
        sum(CASE WHEN revisar != '' THEN 1 ELSE 0 END) AS revisar,
        sum(CASE WHEN EXISTS (SELECT 1 FROM json_each(presentaciones) WHERE json_extract(value, '$.precioAnterior') IS NOT NULL) THEN 1 ELSE 0 END) AS enOferta
      FROM perfumes`),
    DB.prepare(`SELECT p.id, p.marca, p.nombre, json_extract(j.value, '$.ml') AS ml, json_extract(j.value, '$.stock') AS stock
      FROM perfumes p, json_each(p.presentaciones) j
      WHERE p.visible = 1 AND json_extract(j.value, '$.stock') IS NOT NULL AND json_extract(j.value, '$.stock') <= 1
      ORDER BY stock, p.marca LIMIT 12`),
    DB.prepare(`SELECT json_extract(j.value, '$.id') AS id, json_extract(j.value, '$.marca') AS marca,
        json_extract(j.value, '$.nombre') AS nombre, sum(json_extract(j.value, '$.cantidad')) AS unidades
      FROM pedidos p, json_each(p.items) j
      WHERE p.estado IN ('cobrado', 'entregado') AND substr(p.cobrado_en, 1, 7) = ?
      GROUP BY coalesce(json_extract(j.value, '$.id'), lower(json_extract(j.value, '$.nombre')))
      ORDER BY unidades DESC LIMIT 5`).bind(mes),
    DB.prepare(`SELECT p.id, p.numero, p.creado, p.estado, p.nombre, p.total * ${dolarPedido} AS total, p.origen
      FROM pedidos p ORDER BY p.creado DESC LIMIT 6`),
    DB.prepare(`SELECT
        coalesce(sum(CASE WHEN d.tipo = 'cobrar' THEN ${D('d.monto')} END), 0) AS cobrar,
        coalesce(sum(CASE WHEN d.tipo = 'cobrar' THEN ${D(`max(0, d.monto - ${PAGADO_SQL})`)} END), 0) AS cobrarPendiente,
        coalesce(sum(CASE WHEN d.tipo = 'pagar' THEN ${D('d.monto')} END), 0) AS pagar,
        coalesce(sum(CASE WHEN d.tipo = 'pagar' THEN ${D(`max(0, d.monto - ${PAGADO_SQL})`)} END), 0) AS pagarPendiente
      FROM deudas d WHERE substr(d.fecha, 1, 7) = ?`).bind(mes),
    DB.prepare(`SELECT substr(d.fecha, 1, 7) AS mes,
        coalesce(sum(CASE WHEN d.tipo = 'cobrar' THEN ${D('d.monto')} END), 0) AS cobrar,
        coalesce(sum(CASE WHEN d.tipo = 'pagar' THEN ${D('d.monto')} END), 0) AS pagar
      FROM deudas d WHERE substr(d.fecha, 1, 7) BETWEEN ? AND ? GROUP BY 1`).bind(meses[0], meses.at(-1)),
    DB.prepare(`SELECT CASE WHEN d.compra IS NOT NULL THEN 'Compra de mercadería' ELSE 'Deudas a pagar' END AS categoria, sum(${D('d.monto')}) AS total
      FROM deudas d WHERE d.tipo = 'pagar' AND substr(d.fecha, 1, 7) = ? GROUP BY 1`).bind(mes),
  ]);

  const c = caja.results[0];
  const dm = deudasMes.results[0];
  const porMes = new Map(historia.results.map((r) => [r.mes, { ingresos: r.ingresos, egresos: r.egresos }]));
  for (const r of deudasHistoria.results) {
    const x = porMes.get(r.mes) || { ingresos: 0, egresos: 0 };
    porMes.set(r.mes, { ingresos: x.ingresos + r.cobrar, egresos: x.egresos + r.pagar });
  }
  // Gastos por categoría: las compras que quedaron debiendo se suman a su categoría.
  const porCategoria = new Map(categorias.results.map((r) => [r.categoria, r.total]));
  for (const r of deudasCategorias.results) porCategoria.set(r.categoria, (porCategoria.get(r.categoria) || 0) + r.total);
  const ingresos = c.ingresos + dm.cobrar;
  const egresos = c.egresos + dm.pagar;
  const costoVendido = costo.results[0].costo;
  return json({
    mes,
    moneda,
    dolar,
    caja: {
      ingresos,
      egresos,
      // Ganancia del mes: todo lo que entró (o les deben) menos todo lo que salió (o deben).
      ganancia: ingresos - egresos,
      saldo: ingresos - egresos,
      // De esos totales, lo que todavía no se cobró / no se pagó.
      porCobrar: dm.cobrarPendiente,
      porPagar: dm.pagarPendiente,
      ventas: c.ventas,
      costoVendido,
      comisiones: c.comisiones,
      // Ganancia de las ventas: lo cobrado menos lo que costaron los perfumes y la comisión del pasante.
      margen: c.ventas - costoVendido - c.comisiones,
      ventasCobradas: costo.results[0].cantidad,
      unidades: costo.results[0].unidades,
    },
    meses: meses.map((m) => ({ mes: m, ingresos: porMes.get(m)?.ingresos || 0, egresos: porMes.get(m)?.egresos || 0 })),
    egresosPorCategoria: [...porCategoria].map(([categoria, total]) => ({ categoria, total })).sort((a, b) => b.total - a.total),
    pedidos: Object.fromEntries(estados.results.map((r) => [r.estado, r.n])),
    catalogo: catalogo.results[0],
    stockBajo: stockBajo.results,
    masVendidos: masVendidos.results,
    ultimos: ultimos.results,
  });
});
